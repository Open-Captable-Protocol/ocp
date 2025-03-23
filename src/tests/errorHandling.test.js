import { describe, test, beforeAll, beforeEach, afterAll, expect, jest, fail } from "@jest/globals";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";
import deployCapTable from "../chain-operations/deployCapTable.js";
import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";
import { decodeError } from "../utils/errorDecoder.js";
import { createIssuer } from "../db/operations/create.js";
import { convertAndReflectStockClassOnchain } from "../controllers/stockClassController.js";
import { convertAndReflectStakeholderOnchain } from "../controllers/stakeholderController.js";
import Factory from "../db/objects/Factory.js";
import { addAddressesToWatch, reamoveAllListeners } from "../utils/websocket.ts";

// Helper function to wait for specified milliseconds
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Increase timeout for all tests
jest.setTimeout(30000);

describe("Error Handling Integration Tests", () => {
    let contract;
    let validStockClassId;
    let validStakeholderId;
    let issuerId;
    let mongoConnection;

    beforeAll(async () => {
        // Connect to test database
        const testDbUrl = process.env.MONGODB_TEST_URI;
        if (!testDbUrl) {
            throw new Error("MONGODB_TEST_URI is not set");
        }
        mongoConnection = await mongoose.connect(testDbUrl);

        // Clear database before tests
        console.log("Dropping database");
        await mongoose.connection.dropDatabase();
        console.log("Dropped database");

        console.log("Creating factory...");
        // Set up a factory record
        await Factory.create({
            implementation_address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
            factory_address: "0x9A676e781A523b5d0C0e43731313A708CB607508",
            chain_id: "31337",
            version: "DIAMOND",
        });

        // Create test issuer
        issuerId = uuidv4();
        const issuerData = {
            _id: issuerId,
            legal_name: "Test Issuer",
            initial_shares_authorized: "1000000",
            chain_id: "31337", // Local hardhat chain
        };

        const issuer = await createIssuer(issuerData);

        // Deploy cap table
        const issuerIdBytes16 = convertUUIDToBytes16(issuerId);
        const { contract: deployedContract, address } = await deployCapTable(issuerIdBytes16, issuer.initial_shares_authorized, issuer.chain_id);
        contract = deployedContract;
        addAddressesToWatch(issuer.chain_id, address);

        // Create a valid stock class for testing
        validStockClassId = uuidv4();
        await convertAndReflectStockClassOnchain(contract, {
            id: validStockClassId,
            class_type: "COMMON",
            price_per_share: {
                amount: "1.00",
                currency: "USD",
            },
            initial_shares_authorized: "100000",
        });

        // Create a valid stakeholder for testing
        validStakeholderId = uuidv4();
        await convertAndReflectStakeholderOnchain(contract, validStakeholderId);

        // Wait for contract to be ready
        await wait(2000);
    }, 30000); // 30 second timeout for setup

    beforeEach(async () => {
        // Wait for 3 seconds before each test
        await wait(3000);
    });

    describe("Stock Issuance Errors", () => {
        test("should handle invalid stakeholder ID error", async () => {
            const invalidStakeholderId = "00000000-0000-0000-0000-000000000000";

            try {
                await contract.issueStock({
                    id: convertUUIDToBytes16(uuidv4()),
                    stock_class_id: convertUUIDToBytes16(validStockClassId),
                    share_price: toScaledBigNumber("10"),
                    quantity: toScaledBigNumber("100"),
                    stakeholder_id: convertUUIDToBytes16(invalidStakeholderId),
                    security_id: convertUUIDToBytes16(uuidv4()),
                    custom_id: "",
                    stock_legend_ids_mapping: "",
                    security_law_exemptions_mapping: "",
                });
                fail("Expected an error but none was thrown");
            } catch (error) {
                const decodedError = decodeError(error);
                console.log(decodedError);
                expect(decodedError.name).toBe("NoStakeholder");
                expect(decodedError.args.stakeholder_id).toBe(convertUUIDToBytes16(invalidStakeholderId));
            }
        });

        test("should handle invalid stock class ID error", async () => {
            const invalidStockClassId = "00000000-0000-0000-0000-000000000000";

            try {
                await contract.issueStock({
                    id: convertUUIDToBytes16(uuidv4()),
                    stock_class_id: convertUUIDToBytes16(invalidStockClassId),
                    share_price: toScaledBigNumber("10"),
                    quantity: toScaledBigNumber("100"),
                    stakeholder_id: convertUUIDToBytes16(validStakeholderId),
                    security_id: convertUUIDToBytes16(uuidv4()),
                    custom_id: "",
                    stock_legend_ids_mapping: "",
                    security_law_exemptions_mapping: "",
                });
                fail("Expected an error but none was thrown");
            } catch (error) {
                const decodedError = decodeError(error);
                console.log(decodedError);
                expect(decodedError.name).toBe("InvalidStockClass");
                expect(decodedError.args.stock_class_id).toBe(convertUUIDToBytes16(invalidStockClassId));
            }
        });

        test("should handle invalid quantity error", async () => {
            try {
                await contract.issueStock({
                    id: convertUUIDToBytes16(uuidv4()),
                    stock_class_id: convertUUIDToBytes16(validStockClassId),
                    share_price: toScaledBigNumber("10"),
                    quantity: toScaledBigNumber("0"), // Invalid quantity
                    stakeholder_id: convertUUIDToBytes16(validStakeholderId),
                    security_id: convertUUIDToBytes16(uuidv4()),
                    custom_id: "",
                    stock_legend_ids_mapping: "",
                    security_law_exemptions_mapping: "",
                });
                fail("Expected an error but none was thrown");
            } catch (error) {
                const decodedError = decodeError(error);
                console.log(decodedError);
                expect(decodedError.name).toBe("InvalidQuantity");
            }
        });
    });

    describe("Stock Transfer Errors", () => {
        test("should handle insufficient shares error", async () => {
            try {
                console.log("Starting insufficient shares test...");

                // First issue a small amount of shares
                const securityId = uuidv4();
                console.log("Issuing initial shares...");
                await contract.issueStock({
                    id: convertUUIDToBytes16(uuidv4()),
                    stock_class_id: convertUUIDToBytes16(validStockClassId),
                    share_price: toScaledBigNumber("10"),
                    quantity: toScaledBigNumber("100"),
                    stakeholder_id: convertUUIDToBytes16(validStakeholderId),
                    security_id: convertUUIDToBytes16(securityId),
                    custom_id: "",
                    stock_legend_ids_mapping: "",
                    security_law_exemptions_mapping: "",
                });

                // Wait for the transaction to be mined
                console.log("Waiting for issuance transaction to be mined...");
                await wait(5000);

                // Create a new stakeholder to transfer to
                const newStakeholderId = uuidv4();
                console.log("Creating new stakeholder...");
                await convertAndReflectStakeholderOnchain(contract, newStakeholderId);

                // Wait for the transaction to be mined
                console.log("Waiting for stakeholder creation to be mined...");
                await wait(5000);

                // Try to transfer more shares than available
                console.log("Attempting to transfer more shares than available...");
                await contract.transferStock(
                    convertUUIDToBytes16(validStakeholderId),
                    convertUUIDToBytes16(newStakeholderId),
                    convertUUIDToBytes16(validStockClassId),
                    toScaledBigNumber("1000"), // More than issued
                    toScaledBigNumber("10")
                );
                fail("Expected an error but none was thrown");
            } catch (error) {
                console.log("Raw error:", error);
                const decodedError = decodeError(error);
                console.log("Decoded error:", decodedError);
                expect(decodedError.message).toBe("Error: =Insufficient shares for transfer");
            }
        });
    });

    afterAll(async () => {
        console.log("Removing listeners");
        await reamoveAllListeners();
        if (mongoConnection) {
            console.log("Dropping database");
            await mongoose.connection.dropDatabase();
            console.log("Dropped database");
            console.log("Disconnecting from database");
            await mongoConnection.disconnect();
            console.log("Disconnected from database");
        }
    }, 30000);
});
