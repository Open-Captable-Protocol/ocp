import { Contract } from "ethers";
import { readIssuerById, getAllStateMachineObjectsById } from "../db/operations/read.js";
import { updateIssuerById } from "../db/operations/update.js";
import deployCapTable, { facetsABI, wallet } from "../chain-operations/deployCapTable.js";
import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
import { convertAndReflectStockClassOnchain } from "../controllers/stockClassController.js";
import { convertAndReflectStakeholderOnchain } from "../controllers/stakeholderController.js";
import { convertAndReflectStockPlanOnchain } from "../controllers/stockPlanController.js";
import { convertAndAdjustIssuerAuthorizedSharesOnChain } from "../controllers/issuerController.js";
import { convertAndAdjustStockClassAuthorizedSharesOnchain } from "../controllers/stockClassController.js";
import { adjustStockPlanPool } from "../controllers/stockPlanController.js";
import {
    convertAndCreateIssuanceStockOnchain,
    convertAndCreateIssuanceEquityCompensationOnchain,
    convertAndCreateIssuanceConvertibleOnchain,
    convertAndCreateIssuanceWarrantOnchain,
} from "../controllers/transactions/issuanceController.js";
import { convertAndCreateEquityCompensationExerciseOnchain } from "../controllers/transactions/exerciseController.js";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../db/config/mongoose.ts";
import fs from "fs";
import path from "path";
import { validateIssuerForMigration } from "./validate.js";

// Load environment variables
dotenv.config();

async function loadOrCreateMigrationLog(issuerId) {
    const migrationDir = path.join(process.cwd(), "migrations");
    const logFile = path.join(migrationDir, `${issuerId}.log.json`);

    try {
        // Create migrations directory if it doesn't exist
        if (!fs.existsSync(migrationDir)) {
            fs.mkdirSync(migrationDir, { recursive: true });
        }

        // Try to load existing log file
        if (fs.existsSync(logFile)) {
            const logContent = fs.readFileSync(logFile, "utf8");
            return JSON.parse(logContent);
        }

        // Create new log file if it doesn't exist
        const initialLog = {
            issuerId,
            startedAt: new Date().toISOString(),
            records: {},
            errors: [],
        };
        fs.writeFileSync(logFile, JSON.stringify(initialLog, null, 2));
        return initialLog;
    } catch (error) {
        console.error("Error managing migration log:", error);
        throw error;
    }
}

async function updateMigrationLog(issuerId, log) {
    const logFile = path.join(process.cwd(), "migrations", `${issuerId}.log.json`);
    fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
}

async function migrateIssuer(issuerId) {
    await connectDB();
    let migrationLog;

    try {
        // Load or create migration log
        migrationLog = await loadOrCreateMigrationLog(issuerId);
        console.log("Migration log loaded:", migrationLog);

        // 1. Check if issuer exists in the database

        const issuer = await readIssuerById(issuerId);
        if (!issuer) {
            throw new Error(`Issuer with ID ${issuerId} not found in database`);
        }
        const issuerData = await getAllStateMachineObjectsById(issuerId);
        const errors = await validateIssuerForMigration(issuerData);
        if (errors.length > 0) {
            console.log("Validation errors found");
            throw new Error(errors.join("\n"));
        }

        console.log(`Found issuer: ${issuer.name}`);

        if (!migrationLog.records[issuerId]) {
            console.log("\nDeploying cap table...");
            const issuerIdBytes16 = convertUUIDToBytes16(issuerId);
            console.log(`Address before deployment: ${issuer.deployed_to}`);
            console.log(`TX Hash before deployment: ${issuer.tx_hash}`);

            const { address, deployHash } = await deployCapTable(issuerIdBytes16, issuer.initial_shares_authorized);
            await updateIssuerById(issuerId, { deployed_to: address, tx_hash: deployHash });

            console.log(`\nCap table deployed successfully:`);
            console.log(`Contract Address: ${address}`);
            console.log(`Deploy Hash: ${deployHash}`);
            migrationLog.address = address;
            migrationLog.deployHash = deployHash;
            migrationLog.records[issuerId] = true;
            await updateMigrationLog(issuerId, migrationLog);
        }

        const contract = new Contract(migrationLog.address, facetsABI, wallet);

        // 5. Deploy Stock Classes
        console.log("\nDeploying Stock Classes...");
        const totalStockClasses = issuerData.stockClasses.length;
        for (const [index, stockClass] of issuerData.stockClasses.entries()) {
            console.log(`\nStock Class Progress: [${index + 1}/${totalStockClasses}]`);
            if (migrationLog.records[stockClass.id]) {
                console.log(`Skipping Stock Class ${stockClass.id} (already deployed)`);
                continue;
            }

            console.log(`Deploying Stock Class: ${stockClass.id}`);
            await convertAndReflectStockClassOnchain(contract, stockClass);
            migrationLog.records[stockClass.id] = true;
            await updateMigrationLog(issuerId, migrationLog);
            console.log(`✅ Stock Class ${stockClass.id} deployed successfully`);
        }

        // 6. Deploy Stock Plans
        console.log("\nDeploying Stock Plans...");
        for (const [index, stockPlan] of issuerData.stockPlans.entries()) {
            console.log(`\nStock Plan Progress: [${index + 1}/${issuerData.stockPlans.length}]`);
            if (migrationLog.records[stockPlan.id]) {
                console.log(`Skipping Stock Plan ${stockPlan.id} (already deployed)`);
                continue;
            }

            console.log(`Deploying Stock Plan: ${stockPlan.id}`);
            await convertAndReflectStockPlanOnchain(contract, stockPlan);
            migrationLog.records[stockPlan.id] = true;
            await updateMigrationLog(issuerId, migrationLog);
            console.log(`✅ Stock Plan ${stockPlan.id} deployed successfully`);
        }

        // 7. Deploy Stakeholders
        console.log("\nDeploying Stakeholders...");
        for (const [index, stakeholder] of issuerData.stakeholders.entries()) {
            console.log(`Stakeholder Progress: [${index + 1}/${issuerData.stakeholders.length}]`);
            if (migrationLog.records[stakeholder.id]) {
                console.log(`Skipping Stakeholder ${stakeholder.id} (already deployed)`);
                continue;
            }

            console.log(`Deploying Stakeholder: ${stakeholder.id}`);
            await convertAndReflectStakeholderOnchain(contract, stakeholder.id);
            migrationLog.records[stakeholder.id] = true;
            await updateMigrationLog(issuerId, migrationLog);
            console.log(`✅ Stakeholder ${stakeholder.id} deployed successfully`);
        }

        // 8. Deploy Transactions in order
        console.log("\nDeploying Transactions...");
        const sortedTransactions = issuerData.transactions;
        const totalTransactions = sortedTransactions.length;
        const successfulTxs = [];
        const failedTxs = [];

        for (const [index, tx] of sortedTransactions.entries()) {
            console.log(`\nTransaction Progress: [${index + 1}/${totalTransactions}]`);
            if (migrationLog.records[tx.id]) {
                console.log(`Skipping Transaction ${tx.id} (already processed)`);
                continue;
            }

            console.log(`Processing transaction: ${tx.object_type} (ID: ${tx.id})`);

            try {
                console.log({ tx });
                switch (tx.object_type) {
                    case "TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT":
                        await convertAndAdjustIssuerAuthorizedSharesOnChain(contract, tx);
                        break;

                    case "TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT":
                        await convertAndAdjustStockClassAuthorizedSharesOnchain(contract, tx);
                        break;

                    case "TX_STOCK_PLAN_POOL_ADJUSTMENT":
                        await adjustStockPlanPool(contract, tx.stock_plan_id, tx.shares_reserved);
                        break;

                    case "TX_STOCK_ISSUANCE":
                        await convertAndCreateIssuanceStockOnchain(contract, tx);
                        break;

                    case "TX_EQUITY_COMPENSATION_ISSUANCE":
                        await convertAndCreateIssuanceEquityCompensationOnchain(contract, tx);
                        break;

                    case "TX_CONVERTIBLE_ISSUANCE":
                        await convertAndCreateIssuanceConvertibleOnchain(contract, {
                            security_id: tx.security_id,
                            stakeholder_id: tx.stakeholder_id,
                            investment_amount: tx.investment_amount.amount,
                        });
                        break;

                    case "TX_EQUITY_COMPENSATION_EXERCISE":
                        if (tx.quantity == 0) {
                            errors.push(`Transaction ${tx.id} has 0 quantity`);
                            break;
                        }
                        if (tx.resulting_security_ids.length == 0) {
                            errors.push(`Transaction ${tx.id} has no resulting security ids`);
                            break;
                        }
                        await convertAndCreateEquityCompensationExerciseOnchain(contract, {
                            equity_comp_security_id: tx.security_id,
                            resulting_stock_security_id: tx.resulting_security_ids[0],
                            quantity: tx.quantity,
                        });
                        break;

                    case "TX_WARRANT_ISSUANCE":
                        if (tx.quantity == 0) {
                            errors.push(`Transaction ${tx.id} has 0 quantity`);
                            break;
                        }
                        await convertAndCreateIssuanceWarrantOnchain(contract, {
                            stock_plan_id: tx.stock_plan_id,
                            stock_class_id: tx.stock_class_id,
                            quantity: tx.quantity,
                        });
                        break;

                    default:
                        throw new Error(`Unhandled transaction type: ${tx.object_type}`);
                }

                migrationLog.records[tx.id] = true;
                await updateMigrationLog(issuerId, migrationLog);
                console.log(`✅ Transaction ${tx.object_type} processed successfully`);
            } catch (error) {
                migrationLog.errors.push({
                    id: tx.id,
                    type: tx.object_type,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                });
                await updateMigrationLog(issuerId, migrationLog);
                throw error;
            }
        }

        // Transaction Deployment Summary
        console.log("\n=========================");
        console.log("Transaction Deploy Summary");
        console.log("=========================");
        console.log(`Total Transactions: ${sortedTransactions.length}`);
        console.log(`Successful: ${successfulTxs.length}`);
        console.log(`Failed: ${failedTxs.length}`);
        console.log(`Validation Errors: ${errors.length}`);

        if (errors.length > 0) {
            console.log("\nValidation Errors:");
            console.log("------------------");
            errors.forEach((error, index) => {
                console.log(`${index + 1}. ${error}`);
            });
        }

        if (failedTxs.length > 0) {
            console.log("\nFailed Transactions:");
            console.log("-------------------");
            failedTxs.forEach((tx, index) => {
                console.log(`${index + 1}. Type: ${tx.type}`);
                console.log(`   ID: ${tx.id}`);
                console.log(`   Error: ${tx.error}`);
            });
        }

        if (successfulTxs.length > 0) {
            console.log("\nSuccessful Transactions:");
            console.log("----------------------");
            successfulTxs.forEach((tx, index) => {
                console.log(`${index + 1}. Type: ${tx.type}`);
                console.log(`   ID: ${tx.id}`);
                console.log(`   Timestamp: ${tx.timestamp}`);
            });
        }

        // Group transactions by type for detailed logging
        const txByType = issuerData.transactions.reduce((acc, tx) => {
            acc[tx.object_type] = (acc[tx.object_type] || 0) + 1;
            return acc;
        }, {});

        console.log("\nTransactions by Type:");
        console.log("--------------------");
        Object.entries(txByType).forEach(([type, count]) => {
            const successful = successfulTxs.filter((tx) => tx.type === type).length;
            const failed = failedTxs.filter((tx) => tx.type === type).length;
            console.log(`${type}: ${count} (Success: ${successful}, Failed: ${failed})`);
        });

        // Log summary of fetched data
        console.log("\nFetched Data Summary:");
        console.log("--------------------");
        console.log(`Stock Classes: ${issuerData.stockClasses.length}`);
        console.log(`Stock Plans: ${issuerData.stockPlans.length}`);
        console.log(`Stakeholders: ${issuerData.stakeholders.length}`);
        console.log(`Total Transactions: ${issuerData.transactions.length}`);
    } catch (error) {
        if (migrationLog) {
            migrationLog.errors.push({
                error: error.message,
                timestamp: new Date().toISOString(),
            });
            await updateMigrationLog(issuerId, migrationLog);
        }
        console.error("Migration failed:", error);
        throw error;
    } finally {
        await mongoose.disconnect();
    }
}

// Allow script to be run from command line
if (process.argv[2]) {
    const issuerId = process.argv[2];
    migrateIssuer(issuerId)
        .then(() => {
            console.log("Migration completed successfully");
            process.exit(0);
        })
        .catch((error) => {
            console.error("Migration failed:", error);
            process.exit(1);
        });
}

export default migrateIssuer;
