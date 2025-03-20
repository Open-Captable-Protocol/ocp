import { describe, it, beforeAll, beforeEach, afterAll, expect, jest } from "@jest/globals";
import { v4 as uuid } from "uuid";
import mongoose from "mongoose";
import deployCapTable from "../chain-operations/deployCapTable";
import { convertUUIDToBytes16 } from "../utils/convertUUID";
import { createIssuer } from "../db/operations/create";
import { convertAndReflectStockClassOnchain } from "../controllers/stockClassController";
import { convertAndReflectStakeholderOnchain } from "../controllers/stakeholderController";
import { createStockPlanOnchain } from "../controllers/stockPlanController";
import {
    convertAndCreateIssuanceStockOnchain,
    convertAndCreateIssuanceEquityCompensationOnchain,
    convertAndCreateIssuanceConvertibleOnchain,
    convertAndCreateIssuanceWarrantOnchain,
} from "../controllers/transactions/issuanceController";
import { convertAndCreateEquityCompensationExerciseOnchain } from "../controllers/transactions/exerciseController";
import StockClass from "../db/objects/StockClass";
import Stakeholder from "../db/objects/Stakeholder";
import StockPlan from "../db/objects/StockPlan";
import StockIssuance from "../db/objects/transactions/issuance/StockIssuance";
import ConvertibleIssuance from "../db/objects/transactions/issuance/ConvertibleIssuance";
import EquityCompensationIssuance from "../db/objects/transactions/issuance/EquityCompensationIssuance";
import WarrantIssuance from "../db/objects/transactions/issuance/WarrantIssuance";
import EquityCompensationExercise from "../db/objects/transactions/exercise/EquityCompensationExercise";
import Factory from "../db/objects/Factory";
import { addAddressesToWatch, reamoveAllListeners } from "../utils/websocket";
import Issuer from "../db/objects/Issuer";

// Helper function to wait for specified milliseconds
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Increase timeout for all tests
jest.setTimeout(30000);

describe("Transaction Hash Storage Test", () => {
    let issuer;
    let contract;
    let issuerId;
    let stockClassId;
    let stakeholderId;
    let stockPlanId;
    let mongoConnection;
    const stockIssuanceSecurityId = uuid();
    const equityCompSecurityId = uuid();

    beforeAll(async () => {
        // Connect to test database
        const testDbUrl = process.env.MONGODB_TEST_URI;
        if (!testDbUrl) {
            throw new Error("MONGODB_TEST_URI is not set");
        }
        mongoConnection = await mongoose.connect(testDbUrl);

        // Clear database before each test
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
        issuerId = uuid();
        const issuerData = {
            _id: issuerId,
            legal_name: "Test Issuer",
            initial_shares_authorized: "1000000",
            chain_id: "31337", // Local hardhat chain
        };

        issuer = await createIssuer(issuerData);

        // Deploy cap table
        const issuerIdBytes16 = convertUUIDToBytes16(issuerId);
        const { contract: deployedContract, address } = await deployCapTable(issuerIdBytes16, issuer.initial_shares_authorized, issuer.chain_id);
        await Issuer.findOneAndUpdate({ _id: issuerId }, { $set: { deployed_to: address } });
        contract = deployedContract;
        addAddressesToWatch(issuer.chain_id, address);

        // Wait for contract to be ready
        await wait(2000);
    }, 30000); // 30 second timeout for setup

    beforeEach(async () => {
        // Wait for 2 seconds before each test
        await wait(2000);
    });

    it("should create stock class and store transaction hash", async () => {
        stockClassId = uuid();
        const stockClassData = {
            id: stockClassId,
            class_type: "COMMON",
            price_per_share: {
                amount: "1.00",
                currency: "USD",
            },
            initial_shares_authorized: "100000",
        };

        const receipt = await convertAndReflectStockClassOnchain(contract, stockClassData);
        // Wait for transaction to be mined
        await wait(2000);

        expect(receipt.hash).toBeDefined();

        const stockClass = await StockClass.findOne({ tx_hash: receipt.hash });
        expect(stockClass).toBeDefined();
    }, 30000);

    it("should create stakeholder and store transaction hash", async () => {
        stakeholderId = uuid();
        const receipt = await convertAndReflectStakeholderOnchain(contract, stakeholderId);
        // Wait for transaction to be mined
        await wait(2000);
        expect(receipt.hash).toBeDefined();

        const stakeholder = await Stakeholder.findOne({ tx_hash: receipt.hash });

        expect(stakeholder).toBeDefined();
    }, 30000);

    it("should create stock plan and store transaction hash", async () => {
        stockPlanId = uuid();
        const stockPlanData = {
            id: stockPlanId,
            stock_class_ids: [stockClassId],
            initial_shares_reserved: "50000",
        };

        const receipt = await createStockPlanOnchain(contract, stockPlanData);
        // Wait for transaction to be mined
        await wait(2000);

        expect(receipt.hash).toBeDefined();

        const stockPlan = await StockPlan.findOne({ tx_hash: receipt.hash });
        expect(stockPlan).toBeDefined();
        expect(stockPlan.tx_hash).toBe(receipt.hash);
    }, 30000);

    it("should store transaction hash for stock issuance", async () => {
        const stockIssuanceData = {
            id: uuid(),
            stock_class_id: stockClassId,
            stakeholder_id: stakeholderId,
            security_id: stockIssuanceSecurityId,
            quantity: "1000",
            share_price: {
                amount: "1.00",
                currency: "USD",
            },
            custom_id: "STOCK_001",
            stock_legend_ids: ["LEGEND_1"],
            security_law_exemptions: ["REG_D"],
        };

        const receipt = await convertAndCreateIssuanceStockOnchain(contract, stockIssuanceData);
        // Wait for transaction to be mined
        await wait(2000);
        expect(receipt.hash).toBeDefined();

        const stockIssuance = await StockIssuance.findOne({ tx_hash: receipt.hash });
        expect(stockIssuance).toBeDefined();
        expect(stockIssuance.tx_hash).toBe(receipt.hash);
        expect(stockIssuance.issuer.toString()).toBe(issuerId);
    }, 30000);

    it("should store transaction hash for convertible issuance", async () => {
        const convertibleId = uuid();
        const securityId = uuid();
        const convertibleData = {
            id: convertibleId,
            stakeholder_id: stakeholderId,
            security_id: securityId,
            investment_amount: {
                amount: "1000000",
                currency: "USD",
            },
            convertible_type: "SAFE",
            seniority: "1",
            custom_id: "CONV_001",
            security_law_exemptions: ["REG_D"],
            conversion_triggers: ["CONVERSION_ON_NEXT_EQUITY"],
        };

        const receipt = await convertAndCreateIssuanceConvertibleOnchain(contract, convertibleData);
        // Wait for transaction to be mined
        await wait(2000);

        expect(receipt.hash).toBeDefined();

        const convertibleIssuance = await ConvertibleIssuance.findOne({ tx_hash: receipt.hash });
        expect(convertibleIssuance).toBeDefined();
        expect(convertibleIssuance.tx_hash).toBe(receipt.hash);
        expect(convertibleIssuance.issuer.toString()).toBe(issuerId);
    }, 30000);

    it("should store transaction hash for equity compensation issuance", async () => {
        const equityCompId = uuid();
        const equityCompData = {
            id: equityCompId,
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            security_id: equityCompSecurityId,
            quantity: "1000",
            compensation_type: "ISO",
            exercise_price: {
                amount: "1.00",
                currency: "USD",
            },
            base_price: {
                amount: "1.00",
                currency: "USD",
            },
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_001",
            termination_exercise_windows: ["90_DAYS"],
            security_law_exemptions: ["REG_D"],
        };

        const receipt = await convertAndCreateIssuanceEquityCompensationOnchain(contract, equityCompData);
        // Wait for transaction to be mined
        await wait(2000);
        expect(receipt.hash).toBeDefined();

        const equityCompIssuance = await EquityCompensationIssuance.findOne({ tx_hash: receipt.hash });
        expect(equityCompIssuance).toBeDefined();
        expect(equityCompIssuance.tx_hash).toBe(receipt.hash);
        expect(equityCompIssuance.issuer.toString()).toBe(issuerId);
    });

    it("should store transaction hash for warrant issuance", async () => {
        const warrantId = uuid();
        const securityId = uuid();
        const warrantData = {
            id: warrantId,
            stakeholder_id: stakeholderId,
            security_id: securityId,
            quantity: "1000",
            purchase_price: {
                amount: "1.00",
                currency: "USD",
            },
            custom_id: "WARRANT_001",
            security_law_exemptions: ["REG_D"],
            exercise_triggers: ["TIME_BASED"],
        };

        const receipt = await convertAndCreateIssuanceWarrantOnchain(contract, warrantData);
        // Wait for transaction to be mined
        await wait(2000);
        expect(receipt.hash).toBeDefined();

        const warrantIssuance = await WarrantIssuance.findOne({ tx_hash: receipt.hash });
        expect(warrantIssuance).toBeDefined();
        expect(warrantIssuance.tx_hash).toBe(receipt.hash);
        expect(warrantIssuance.issuer.toString()).toBe(issuerId);
    });

    it("should store transaction hash for equity compensation exercise", async () => {
        // First create an equity compensation to exercise
        const equityCompId = uuid();
        const equityCompData = {
            id: equityCompId,
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId, // test with or without stock plan id
            security_id: equityCompSecurityId,
            quantity: "1000",
            compensation_type: "ISO",
            exercise_price: {
                amount: "1.00",
                currency: "USD",
            },
            base_price: {
                amount: "1.00",
                currency: "USD",
            },
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_002",
            termination_exercise_windows: ["90_DAYS"],
            security_law_exemptions: ["REG_D"],
        };

        await convertAndCreateIssuanceEquityCompensationOnchain(contract, equityCompData);

        // Now exercise it
        const exerciseId = uuid();
        const exerciseData = {
            id: exerciseId,
            security_id: equityCompSecurityId,
            resulting_security_ids: [stockIssuanceSecurityId],
            quantity: "1000",
        };

        const receipt = await convertAndCreateEquityCompensationExerciseOnchain(contract, exerciseData);
        expect(receipt.hash).toBeDefined();

        const equityCompExercise = await EquityCompensationExercise.findOne({ tx_hash: receipt.hash });
        expect(equityCompExercise).toBeDefined();
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
