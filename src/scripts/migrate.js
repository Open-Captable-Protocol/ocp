import { Contract } from "ethers";
import { readIssuerById, getAllStateMachineObjectsById, readAllIssuers } from "../db/operations/read.js";
import { updateIssuerById } from "../db/operations/update.js";
import deployCapTable, { getWallet } from "../chain-operations/deployCapTable.js";
import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
import { convertAndReflectStockClassOnchain } from "../controllers/stockClassController.js";
import { convertAndReflectStakeholderOnchain } from "../controllers/stakeholderController.js";
import { createStockPlanOnchain, adjustStockPlanPoolOnchain } from "../controllers/stockPlanController.js";
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
import chalk from "chalk";
import readline from "readline";
import { addAddressesToWatch, reamoveAllListeners } from "../utils/websocket.ts";
import { validateIssuerForMigration } from "./validate.js";
import { facetsABI } from "../utils/errorDecoder.js";
import { convertAndCreateCancellationStockOnchain } from "../controllers/transactions/cancellationController.js";

// Load environment variables
dotenv.config();

const ISSUERS_TO_SKIP = [];
const ISSUERS_TO_MIGRATE = ["5df2208b-3b1b-477a-8654-f2b0b06e5807"];

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

async function updateMigrationLog(issuerName, log, gasTracker = null) {
    const logFile = path.join(process.cwd(), "migrations", `${issuerName}.log.json`);
    const updatedLog = {
        ...log,
        updatedAt: new Date().toISOString(),
        // Add gas tracking if provided
        ...(gasTracker && {
            gasUsed: gasTracker.gasUsed.toString(),
            transactionCount: gasTracker.transactionCount,
        }),
    };
    fs.writeFileSync(logFile, JSON.stringify(updatedLog, null, 2));
}

const waitBetweenTransactions = async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
};

async function migrateIssuer(issuerId, gasTracker = { gasUsed: BigInt(0), transactionCount: 0 }) {
    let migrationLog;
    let issuer;
    try {
        // Check if issuer should be skipped
        if (ISSUERS_TO_SKIP.includes(issuerId)) {
            console.log(chalk.yellow(`Skipping issuer ${issuerId} as it's in the skip list`));
            return { success: true, gasTracker };
        }

        // Load or create migration log
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

            const { address, deployHash, receipt, factory } = await deployCapTable(
                issuerIdBytes16,
                issuer.initial_shares_authorized,
                issuer.chain_id
            );
            trackGasUsage(receipt, gasTracker);

            // Update issuer with deployed address, tx hash, and factory
            await updateIssuerById(issuerId, {
                deployed_to: address,
                tx_hash: deployHash,
                factory: factory._id,
            });

            console.log(`\nCap table deployed successfully:`);
            console.log(`Contract Address: ${address}`);
            console.log(`Deploy Hash: ${deployHash}`);
            migrationLog.address = address;
            migrationLog.deployHash = deployHash;
            migrationLog.records[issuerId] = true;
            await updateMigrationLog(issuer.legal_name, migrationLog, gasTracker);
        }

        console.log({ issuerId, address: migrationLog.address, chainId: issuer.chain_id });
        const contract = new Contract(migrationLog.address, facetsABI, await getWallet(issuer.chain_id));
        addAddressesToWatch(issuer.chain_id, migrationLog.address);

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
            const receipt = await convertAndReflectStockClassOnchain(contract, stockClass);
            migrationLog.records[stockClass.id] = true;

            trackGasUsage(receipt, gasTracker);
            await updateMigrationLog(issuer.legal_name, migrationLog, gasTracker);
            await waitBetweenTransactions();
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
            const receipt = await createStockPlanOnchain(contract, stockPlan);
            migrationLog.records[stockPlan.id] = true;
            trackGasUsage(receipt, gasTracker);
            await updateMigrationLog(issuer.legal_name, migrationLog, gasTracker);
            await waitBetweenTransactions();
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
            const receipt = await convertAndReflectStakeholderOnchain(contract, stakeholder.id);
            migrationLog.records[stakeholder.id] = true;
            trackGasUsage(receipt, gasTracker);
            await updateMigrationLog(issuer.legal_name, migrationLog, gasTracker);
            await waitBetweenTransactions();
            console.log(`✅ Stakeholder ${stakeholder.id} deployed successfully`);
        }

        // 8. Deploy Transactions in order
        console.log("\nDeploying Transactions...");
        const sortedTransactions = issuerData.transactions;
        const totalTransactions = sortedTransactions.length;
        const successfulTxs = [];
        const failedTxs = [];

        for (let index = 0; index < sortedTransactions.length; index++) {
            const tx = sortedTransactions[index];
            console.log(`\nTransaction Progress: [${index + 1}/${totalTransactions}]`);
            if (migrationLog.records[tx.id]) {
                console.log(`Skipping Transaction ${tx.id} (already processed)`);
                continue;
            }

            console.log(`Processing transaction: ${tx.object_type} (ID: ${tx.id})`);

            try {
                console.log({ tx });
                let receipt;
                switch (tx.object_type) {
                    case "TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT":
                        receipt = await convertAndAdjustIssuerAuthorizedSharesOnChain(contract, tx);
                        break;

                    case "TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT":
                        receipt = await convertAndAdjustStockClassAuthorizedSharesOnchain(contract, tx);
                        break;

                    case "TX_STOCK_PLAN_POOL_ADJUSTMENT":
                        receipt = await adjustStockPlanPoolOnchain(contract, tx);
                        break;

                    case "TX_STOCK_ISSUANCE":
                        receipt = await convertAndCreateIssuanceStockOnchain(contract, tx);
                        break;

                    case "TX_EQUITY_COMPENSATION_ISSUANCE":
                        receipt = await convertAndCreateIssuanceEquityCompensationOnchain(contract, tx);
                        break;

                    case "TX_CONVERTIBLE_ISSUANCE":
                        receipt = await convertAndCreateIssuanceConvertibleOnchain(contract, tx);
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
                        receipt = await convertAndCreateEquityCompensationExerciseOnchain(contract, tx);
                        break;

                    case "TX_WARRANT_ISSUANCE":
                        if (tx.quantity == 0) {
                            errors.push(`Transaction ${tx.id} has 0 quantity`);
                            break;
                        }
                        receipt = await convertAndCreateIssuanceWarrantOnchain(contract, tx);
                        break;
                    case "TX_STOCK_CANCELLATION":
                        if (tx.quantity == 0) {
                            errors.push(`Transaction ${tx.id} has 0 quantity`);
                            break;
                        }
                        receipt = await convertAndCreateCancellationStockOnchain(contract, tx);
                        break;

                    default:
                        throw new Error(`Unhandled transaction type: ${tx.object_type}`);
                }

                migrationLog.records[tx.id] = true;
                trackGasUsage(receipt, gasTracker);
                await updateMigrationLog(issuer.legal_name, migrationLog, gasTracker);
                await waitBetweenTransactions();
                console.log(`✅ Transaction ${tx.object_type} processed successfully`);
            } catch (error) {
                const answer = await askQuestion(
                    `\nError processing ${tx.object_type}. Would you like to:\n` +
                        `  ${chalk.yellow("s")} - Skip this transaction\n` +
                        `  ${chalk.yellow("r")} - Retry this transaction\n` +
                        `  ${chalk.yellow("a")} - Abort migration\n` +
                        `Enter your choice: `
                );

                if (answer.toLowerCase() === "a") {
                    throw error;
                } else if (answer.toLowerCase() === "r") {
                    index--; // Retry same transaction
                    continue;
                }
                // 's' skips to next transaction
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
        await updateMigrationLog(issuer.legal_name, migrationLog, gasTracker);

        // Update issuer in database
        await updateIssuerById(issuerId, { migrated: true });

        return {
            success: true,
            gasTracker,
            issuerName: issuer.legal_name,
        };
    } catch (error) {
        if (migrationLog) {
            migrationLog.errors.push({
                error: error.message,
                timestamp: new Date().toISOString(),
            });
            migrationLog.migrated = false;
            await updateMigrationLog(issuer.legal_name, migrationLog, gasTracker);
        }
        console.error("Migration failed:", error);
        return { success: false, gasTracker, error };
    }
}

const MAX_RETRIES = 3; // Maximum number of retry attempts

async function main() {
    const gasReport = createGasReport();

    try {
        await connectDB();

        const issuers = (await readAllIssuers())
            .filter((i) => ISSUERS_TO_MIGRATE.includes(i._id))
            .filter((i) => {
                // Check both database and log file status
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
                    const result = await migrateIssuer(issuer.id);
                    if (result.success) {
                        console.log(chalk.green(`\n✅ Successfully migrated ${chalk.yellow(issuer.legal_name)}`));
                        console.log(chalk.blue(`   Gas used: ${result.gasTracker.gasUsed.toString()}`));
                        console.log(chalk.blue(`   Transactions: ${result.gasTracker.transactionCount}`));
                        gasReport.issuers.push({
                            name: issuer.legal_name,
                            gasUsed: result.gasTracker.gasUsed,
                            transactionCount: result.gasTracker.transactionCount,
                        });
                        gasReport.totalGasUsed += result.gasTracker.gasUsed;
                    }
                    success = true;
                } catch (error) {
                    console.error(chalk.red(`\n❌ Error migrating ${chalk.yellow(issuer.legal_name)}:`), error);

                    const answer = await askQuestion(
                        `\nWould you like to:\n` +
                            `  ${chalk.yellow("c")} - Continue with next issuer\n` +
                            `  ${chalk.yellow("r")} - Retry this issuer\n` +
                            `  ${chalk.yellow("s")} - Stop migration\n` +
                            `Enter your choice: `
                    );

                    if (answer.toLowerCase() === "s") {
                        console.log(chalk.yellow("\nStopping migration process..."));
                        break;
                    } else if (answer.toLowerCase() === "r") {
                        i--; // Retry same issuer
                        continue;
                    }
                    // 'c' continues to next issuer
                }
            }

            console.log(chalk.gray("\n-------------------\n"));
        }

        // Save final gas report
        const reportPath = saveGasReport(gasReport);
        console.log(chalk.green.bold("\nMigration process completed."));
        console.log(chalk.blue(`Gas report saved to: ${reportPath}`));
        console.log(chalk.blue(`Total gas used: ${gasReport.totalGasUsed.toString()}`));
        console.log(chalk.blue(`Total issuers processed: ${gasReport.issuers.length}`));
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
        .then((result) => {
            if (result.success) {
                console.log(chalk.green("Single issuer migration completed successfully"));
                const reportPath = saveGasReport({
                    totalGasUsed: result.gasTracker.gasUsed,
                    issuers: [
                        {
                            name: result.issuerName,
                            gasUsed: result.gasTracker.gasUsed,
                            transactionCount: result.gasTracker.transactionCount,
                        },
                    ],
                    startTime: new Date().toISOString(),
                    endTime: new Date().toISOString(),
                });
                console.log(chalk.blue(`Gas report saved to: ${reportPath}`));
            } else {
                throw result.error;
            }
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

function createGasReport() {
    return {
        totalGasUsed: BigInt(0),
        issuers: [],
        startTime: new Date().toISOString(),
        endTime: null,
    };
}

function saveGasReport(report) {
    const reportPath = path.join(process.cwd(), "migrations", `migration-report-${new Date().toISOString().split("T")[0]}.json`);
    report.endTime = new Date().toISOString();
    fs.writeFileSync(
        reportPath,
        JSON.stringify(report, (_, value) => (typeof value === "bigint" ? value.toString() : value), 2)
    );
    return reportPath;
}

function trackGasUsage(receipt, tracker) {
    if (!receipt) {
        console.warn(chalk.yellow("Warning: No receipt provided for gas tracking"));
        return;
    }
    tracker.gasUsed += BigInt(receipt.gasUsed);
    tracker.transactionCount += 1;
}
