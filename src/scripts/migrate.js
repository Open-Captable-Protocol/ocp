import { Contract } from "ethers";
import { readIssuerById, getAllStateMachineObjectsById, readAllIssuers } from "../db/operations/read.js";
import { updateIssuerById } from "../db/operations/update.js";
import deployCapTable, { facetsABI, getWallet } from "../chain-operations/deployCapTable.js";
import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
import { convertAndReflectStockClassOnchain } from "../controllers/stockClassController.js";
import { convertAndReflectStakeholderOnchain } from "../controllers/stakeholderController.js";
import { convertAndReflectStockPlanOnchain } from "../controllers/stockPlanController.js";
import { convertAndAdjustIssuerAuthorizedSharesOnChain } from "../controllers/issuerController.js";
import { convertAndAdjustStockClassAuthorizedSharesOnchain } from "../controllers/stockClassController.js";
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
import chalk from "chalk";
import readline from "readline";
import { addAddressesToWatch, reamoveAllListeners } from "../utils/websocket.ts";

// Load environment variables
dotenv.config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const askQuestion = (question) => {
    return new Promise((resolve) => {
        rl.question(chalk.cyan(question), (answer) => {
            resolve(answer);
        });
    });
};

async function loadOrCreateMigrationLog(issuerName) {
    const migrationDir = path.join(process.cwd(), "migrations");
    const logFile = path.join(migrationDir, `${issuerName}.log.json`);

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
            name: issuerName,
            startedAt: new Date().toISOString(),
            updatedAt: null,
            migrated: false,
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

async function updateMigrationLog(issuerName, log) {
    const logFile = path.join(process.cwd(), "migrations", `${issuerName}.log.json`);
    fs.writeFileSync(logFile, JSON.stringify({ ...log, updatedAt: new Date().toISOString() }, null, 2));
}

async function migrateIssuer(issuerId) {
    await connectDB();
    let migrationLog;
    let issuer;
    try {
        // Load or create migration log

        // 1. Check if issuer exists in the database

        issuer = await readIssuerById(issuerId);
        if (!issuer) {
            throw new Error(`Issuer with ID ${issuerId} not found in database`);
        }
        migrationLog = await loadOrCreateMigrationLog(issuer.legal_name);
        console.log("Migration log loaded:", migrationLog);
        const issuerData = await getAllStateMachineObjectsById(issuerId);
        const errors = await validateIssuerForMigration(issuerData);
        if (errors.length > 0) {
            console.log("Validation errors found");
            throw new Error(errors.join("\n"));
        }

        console.log(`Found issuer: ${issuer.legal_name}`);

        if (!migrationLog.records[issuerId]) {
            console.log("\nDeploying cap table...");
            const issuerIdBytes16 = convertUUIDToBytes16(issuerId);
            console.log(`Address before deployment: ${issuer.deployed_to}`);
            console.log(`TX Hash before deployment: ${issuer.tx_hash}`);

            const { address, deployHash } = await deployCapTable(issuerIdBytes16, issuer.initial_shares_authorized, issuer.chain_id);
            await updateIssuerById(issuerId, { deployed_to: address, tx_hash: deployHash });

            console.log(`\nCap table deployed successfully:`);
            console.log(`Contract Address: ${address}`);
            console.log(`Deploy Hash: ${deployHash}`);
            migrationLog.address = address;
            migrationLog.deployHash = deployHash;
            migrationLog.records[issuerId] = true;
            await updateMigrationLog(issuer.legal_name, migrationLog);
        }

        console.log({ issuerId, address: migrationLog.address, chainId: issuer.chain_id });
        const contract = new Contract(migrationLog.address, facetsABI, await getWallet(issuer.chain_id));
        addAddressesToWatch(Number(issuer.chain_id), migrationLog.address);

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
            await updateMigrationLog(issuer.legal_name, migrationLog);
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
            await updateMigrationLog(issuer.legal_name, migrationLog);
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
            await updateMigrationLog(issuer.legal_name, migrationLog);
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
                        await convertAndReflectStockPlanOnchain(contract, tx.stock_plan_id, tx.shares_reserved);
                        break;

                    case "TX_STOCK_ISSUANCE":
                        await convertAndCreateIssuanceStockOnchain(contract, tx);
                        break;

                    case "TX_EQUITY_COMPENSATION_ISSUANCE":
                        await convertAndCreateIssuanceEquityCompensationOnchain(contract, tx);
                        break;

                    case "TX_CONVERTIBLE_ISSUANCE":
                        await convertAndCreateIssuanceConvertibleOnchain(contract, tx);
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
                        await convertAndCreateEquityCompensationExerciseOnchain(contract, tx);
                        break;

                    case "TX_WARRANT_ISSUANCE":
                        if (tx.quantity == 0) {
                            errors.push(`Transaction ${tx.id} has 0 quantity`);
                            break;
                        }
                        await convertAndCreateIssuanceWarrantOnchain(contract, tx);
                        break;

                    default:
                        throw new Error(`Unhandled transaction type: ${tx.object_type}`);
                }

                migrationLog.records[tx.id] = true;
                await updateMigrationLog(issuer.legal_name, migrationLog);
                console.log(`✅ Transaction ${tx.object_type} processed successfully`);
            } catch (error) {
                migrationLog.errors.push({
                    id: tx.id,
                    type: tx.object_type,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                });
                await updateMigrationLog(issuer.legal_name, migrationLog);
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

        // After all migrations are successful, mark as migrated in the log
        migrationLog.migrated = true;
        await updateMigrationLog(issuer.legal_name, migrationLog);

        // Update issuer in database
        await updateIssuerById(issuerId, { migrated: true });
    } catch (error) {
        if (migrationLog) {
            migrationLog.errors.push({
                error: error.message,
                timestamp: new Date().toISOString(),
            });
            migrationLog.migrated = false;
            await updateMigrationLog(issuer.legal_name, migrationLog);
        }
        console.error("Migration failed:", error);
        throw error;
    } finally {
        await mongoose.disconnect();
    }
}

const MAX_RETRIES = 3; // Maximum number of retry attempts

const askForRetry = async (issuerName, error, attempt) => {
    console.error(chalk.red(`\nError migrating ${chalk.yellow(issuerName)} (Attempt ${attempt}/${MAX_RETRIES}):`), error);

    if (attempt >= MAX_RETRIES) {
        console.log(chalk.red(`\nMaximum retry attempts (${MAX_RETRIES}) reached for ${chalk.yellow(issuerName)}`));
        return false;
    }

    const answer = await askQuestion(`Would you like to retry migrating ${chalk.yellow(issuerName)}? (y/n): `);
    return answer.toLowerCase() === "y";
};

async function main() {
    try {
        await connectDB();
        const issuers = (await readAllIssuers()).filter((i) => {
            if (i.legal_name.includes("Protelicious USA Corp") || i.legal_name.toLowerCase().includes("fairbnb")) {
                return false;
            }

            // Check both database and log file migration status
            const logFile = path.join(process.cwd(), "migrations", `${i.legal_name}.log.json`);
            if (fs.existsSync(logFile)) {
                const log = JSON.parse(fs.readFileSync(logFile, "utf8"));
                return !i.migrated && !log.migrated;
            }

            return !i.migrated;
        });

        console.log(chalk.blue.bold(`Found ${issuers.length} issuers to migrate.\n`));

        const initialAnswer = await askQuestion(
            `Would you like to: \n` +
                `  ${chalk.yellow("a")} - Migrate all issuers\n` +
                `  ${chalk.yellow("y")} - Migrate issuers one by one\n` +
                `  ${chalk.yellow("q")} - Quit\n` +
                `Enter your choice: `
        );

        if (initialAnswer.toLowerCase() === "q") {
            console.log(chalk.yellow("\nExiting migration process..."));
            return;
        }

        const migrateAll = initialAnswer.toLowerCase() === "a";

        for (let i = 0; i < issuers.length; i++) {
            const issuer = issuers[i];
            let attempt = 1;
            let success = false;

            if (!migrateAll) {
                const answer = await askQuestion(
                    `Migrate issuer ${chalk.yellow(issuer.legal_name)} (${chalk.green(`${i + 1}/${issuers.length}`)})? (y/n/q to quit): `
                );

                if (answer.toLowerCase() === "q") {
                    console.log(chalk.yellow("\nExiting migration process..."));
                    break;
                }

                if (answer.toLowerCase() !== "y") {
                    continue;
                }
            }

            while (!success && attempt <= MAX_RETRIES) {
                console.log(
                    chalk.blue(
                        `\nMigrating issuer ${chalk.yellow(issuer.legal_name)} (${chalk.green(
                            `${i + 1}/${issuers.length}`
                        )}) - Attempt ${attempt}/${MAX_RETRIES}`
                    )
                );

                try {
                    await migrateIssuer(issuer.id);
                    console.log(chalk.green(`\n✅ Successfully migrated ${chalk.yellow(issuer.legal_name)}`));
                    success = true;
                } catch (error) {
                    if (await askForRetry(issuer.legal_name, error, attempt)) {
                        attempt++;
                        continue;
                    } else {
                        console.log(chalk.yellow(`\nSkipping ${chalk.yellow(issuer.legal_name)} and continuing with next issuer...`));
                        break;
                    }
                }
            }

            if (!success) {
                console.log(chalk.red(`\n❌ Failed to migrate ${chalk.yellow(issuer.legal_name)} after ${attempt - 1} attempts`));
            }

            console.log(chalk.gray("\n-------------------\n"));
        }

        console.log(chalk.green.bold("\nMigration process completed."));
    } catch (error) {
        console.error(chalk.red.bold("Error during migration process:"), chalk.red(error));
    } finally {
        rl.close();
        await mongoose.disconnect();
        await reamoveAllListeners();
        console.log(chalk.gray("\nExiting migration process..."));
    }
}

// To run the script from the command line, use the following command: `npx tsx src/scripts/migrate.js <issuer_id>`
// Allow script to be run from command line with a specific issuer ID or run all
if (process.argv[2]) {
    const issuerId = process.argv[2];
    migrateIssuer(issuerId)
        .then(() => {
            console.log(chalk.green("Single issuer migration completed successfully"));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red("Migration failed:"), error);
            process.exit(1);
        });
} else {
    // Run migration for all issuers
    main()
        .then(() => {
            console.log(chalk.green("Full migration completed successfully"));
            process.exit(0);
        })
        .catch((error) => {
            console.error(chalk.red("Migration failed:"), error);
            process.exit(1);
        });
}
