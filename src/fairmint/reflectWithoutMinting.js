#!/usr/bin/env node

import { getAllStateMachineObjectsById, readFairmintDataById, readFairmintDataBySecurityId } from "../db/operations/read.js";
import { reflectStakeholder } from "./reflectStakeholder.js";
import { reflectInvestment } from "./reflectInvestment.js";
import { reflectGrant } from "./reflectGrant.js";
import { reflectGrantExercise } from "./reflectGrantExercise.js";
import { reflectInvestmentCancellation } from "./reflectInvestmentCancellation.js";
import { reflectSeries } from "./reflectSeries.js";
import get from "lodash/get.js";
import { SERIES_TYPE } from "./enums.js";
import fs from "fs/promises";
import path from "path";
import readline from "readline";
import { connectDB } from "../db/config/mongoose.ts";
import dotenv from "dotenv";
import { program } from "commander";
import { fileURLToPath } from "url";

// Load environment variables
dotenv.config();

const getStateFilePath = (issuerId) => {
    const filename = `reflection-state-${issuerId}.json`;
    return path.join(process.cwd(), "reflection-states", filename);
};

const createReadlineInterface = () => {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
};

const askForConfirmation = async (message) => {
    const rl = createReadlineInterface();
    try {
        const answer = await new Promise((resolve) => {
            rl.question(`${message} (y/n): `, resolve);
        });
        return answer.toLowerCase() === "y";
    } finally {
        rl.close();
    }
};

const loadState = async (issuerId) => {
    const statePath = getStateFilePath(issuerId);
    try {
        await fs.mkdir(path.dirname(statePath), { recursive: true });
        const data = await fs.readFile(statePath, "utf8");
        return JSON.parse(data);
    } catch (error) {
        if (error.code === "ENOENT") {
            const shouldStart = await askForConfirmation("No previous state found. Start fresh?");
            if (!shouldStart) {
                throw new Error("Operation cancelled by user");
            }
            const initialState = {
                stakeholders: { processed: [] },
                transactions: { processed: [] },
            };
            await saveState(issuerId, initialState);
            return initialState;
        }
        throw error;
    }
};

const saveState = async (issuerId, state) => {
    const statePath = getStateFilePath(issuerId);
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
};

export const reflectWithoutMinting = async (issuerId, options = {}) => {
    // Initialize state and logs
    const state = await loadState(issuerId);
    const logs = [];

    const logOperation = async (type, id, status, error = null) => {
        const log = {
            timestamp: new Date(),
            operation: {
                type,
                id,
                status,
                ...(error && { error: error.message || String(error) }),
            },
        };
        logs.push(log);

        // Update state file
        const section = type.startsWith("TX_") ? "transactions" : "stakeholders";
        const processed = state[section].processed;

        // Remove any existing entry for this ID
        const index = processed.findIndex((item) => item.id === id);
        if (index !== -1) {
            processed.splice(index, 1);
        }

        // Add new entry
        processed.push({ id, status, timestamp: log.timestamp });

        // Save updated state
        await saveState(issuerId, state);

        // Log to console if verbose mode is enabled
        if (options.verbose) {
            console.log(JSON.stringify(log, null, 2));
        }
    };

    try {
        // Get all data
        const { stakeholders, transactions } = await getAllStateMachineObjectsById(issuerId);

        // Process stakeholders first
        console.log("Processing stakeholders...");
        for (const stakeholder of stakeholders) {
            // Skip if already successfully processed
            const existingStakeholder = state.stakeholders.processed.find((s) => s.id === stakeholder._id && s.status === "SUCCESS");
            if (existingStakeholder) {
                console.log(`Skipping already processed stakeholder: ${stakeholder._id}`);
                continue;
            }

            try {
                await reflectStakeholder({ stakeholder, issuerId });
                await logOperation(stakeholder.object_type, stakeholder._id, "SUCCESS");
            } catch (error) {
                await logOperation(stakeholder.object_type, stakeholder._id, "FAILURE", error);
            }
        }

        // Process transactions
        console.log("Processing transactions...");
        for (const tx of transactions) {
            // Skip if already successfully processed
            const existingTx = state.transactions.processed.find((t) => t.id === tx._id && t.status === "SUCCESS");
            if (existingTx) {
                console.log(`Skipping already processed transaction: ${tx._id} (${tx.object_type})`);
                continue;
            }

            try {
                const fairmintData = (await readFairmintDataBySecurityId(tx.security_id)) || (await readFairmintDataById(tx.id));
                if (!fairmintData || !fairmintData._id) {
                    console.log(`⚠️ Fairmint data not found for transaction ${tx._id} (${tx.object_type}) with security_id ${tx.security_id}`);
                    await logOperation(tx.object_type, tx._id, "SKIPPED", new Error("Fairmint data not found"));
                    continue;
                }

                const dateToUse = get(fairmintData, "date", tx.date) || tx.date;

                switch (tx.object_type) {
                    case "TX_CONVERTIBLE_ISSUANCE":
                        await reflectSeries({
                            issuerId,
                            series_id: fairmintData.series_id,
                            series_name: get(fairmintData, "attributes.series_name"),
                            series_type: SERIES_TYPE.FUNDRAISING,
                            date: dateToUse,
                        });

                        await reflectInvestment({
                            security_id: tx.security_id,
                            issuerId,
                            stakeholder_id: tx.stakeholder_id,
                            series_id: fairmintData.series_id,
                            amount: get(tx, "investment_amount.amount"),
                            date: dateToUse,
                        });
                        break;

                    case "TX_EQUITY_COMPENSATION_ISSUANCE":
                        await reflectSeries({
                            issuerId,
                            series_id: fairmintData.series_id,
                            series_name: get(fairmintData, "attributes.series_name"),
                            stock_class_id: tx.stock_class_id,
                            stock_plan_id: tx.stock_plan_id,
                            series_type: SERIES_TYPE.GRANT,
                            date: dateToUse,
                        });

                        await reflectGrant({
                            security_id: tx.security_id,
                            issuerId,
                            stakeholder_id: tx.stakeholder_id,
                            series_id: fairmintData.series_id,
                            quantity: tx.quantity,
                            exercise_price: get(tx, "exercise_price.amount"),
                            compensation_type: tx.compensation_type,
                            option_grant_type: tx.option_grant_type,
                            security_law_exemptions: tx.security_law_exemptions,
                            expiration_date: tx.expiration_date,
                            termination_exercise_windows: tx.termination_exercise_windows,
                            vestings: tx.vestings,
                            date: dateToUse,
                            vesting_terms_id: tx.vesting_terms_id,
                        });
                        break;

                    case "TX_WARRANT_ISSUANCE":
                        await reflectSeries({
                            issuerId,
                            series_id: fairmintData.series_id,
                            series_name: get(fairmintData, "attributes.series_name"),
                            series_type: SERIES_TYPE.WARRANT,
                            date: dateToUse,
                        });

                        await reflectInvestment({
                            security_id: tx.security_id,
                            issuerId,
                            stakeholder_id: tx.stakeholder_id,
                            series_id: fairmintData.series_id,
                            amount: get(tx, "purchase_price.amount", 1), // Default to 1 if no purchase price
                            date: dateToUse,
                        });
                        break;

                    case "TX_STOCK_ISSUANCE":
                        await reflectSeries({
                            issuerId,
                            series_id: fairmintData.series_id,
                            series_name: get(fairmintData, "attributes.series_name"),
                            series_type: SERIES_TYPE.SHARES,
                            price_per_share: get(tx, "share_price.amount"),
                            date: dateToUse,
                        });

                        await reflectInvestment({
                            security_id: tx.security_id,
                            issuerId,
                            stakeholder_id: tx.stakeholder_id,
                            series_id: fairmintData.series_id,
                            amount: Number(get(tx, "share_price.amount", 0)) * Number(tx.quantity),
                            number_of_shares: tx.quantity,
                            date: dateToUse,
                        });
                        break;

                    case "TX_EQUITY_COMPENSATION_EXERCISE":
                        await reflectGrantExercise({
                            security_id: tx.security_id,
                            issuerId,
                            quantity: tx.quantity,
                            date: dateToUse,
                            resulting_security_ids: tx.resulting_security_ids,
                        });
                        break;

                    case "TX_STOCK_CANCELLATION":
                        await reflectInvestmentCancellation({
                            security_id: tx.security_id,
                            issuerId,
                            cancellation_amount: tx.quantity,
                            date: dateToUse,
                            balance_security_id: tx.balance_security_id,
                        });
                        break;
                }
                await logOperation(tx.object_type, tx._id, "SUCCESS");
            } catch (error) {
                await logOperation(tx.object_type, tx._id, "FAILURE", error);
            }
        }

        return logs;
    } catch (error) {
        console.error("Error in reflectWithoutMinting:", error);
        throw error;
    }
};

const main = async () => {
    try {
        program
            .name("reflect-without-minting")
            .description("Reflect cap table data without minting")
            .requiredOption("-i, --issuer-id <id>", "Issuer ID to process")
            .option("-v, --verbose", "Enable verbose logging")
            .option("-f, --force", "Force reflection of all items, ignoring previous state")
            .parse(process.argv);

        const options = program.opts();

        // Connect to database
        await connectDB();

        console.log(`Starting reflection for issuer: ${options.issuerId}`);

        // First, verify issuer exists and get data preview
        const { stakeholders, transactions } = await getAllStateMachineObjectsById(options.issuerId);

        if (!stakeholders.length && !transactions.length) {
            console.error(`No data found for issuer ID: ${options.issuerId}`);
            process.exit(1);
        }

        // Show data preview
        console.log("\nData Preview:");
        console.log(`- Stakeholders to process: ${stakeholders.length}`);
        console.log(`- Transactions to process: ${transactions.length}`);

        // Show transaction breakdown
        const txBreakdown = transactions
            .filter((tx) => !tx.object_type.includes("ADJUSTMENT"))
            .reduce((acc, tx) => {
                acc[tx.object_type] = (acc[tx.object_type] || 0) + 1;
                return acc;
            }, {});

        console.log("\nTransaction Breakdown:");
        Object.entries(txBreakdown).forEach(([type, count]) => {
            console.log(`- ${type}: ${count}`);
        });

        // Get user confirmation
        const rl = createReadlineInterface();
        const answer = await new Promise((resolve) => {
            rl.question("\nDo you want to proceed with reflection? (y/n): ", resolve);
        });
        rl.close();

        if (answer.toLowerCase() !== "y") {
            console.log("Operation cancelled by user");
            process.exit(0);
        }

        if (options.force) {
            const statePath = getStateFilePath(options.issuerId);
            try {
                await fs.unlink(statePath);
                console.log("Previous state cleared, starting fresh");
            } catch (error) {
                if (error.code !== "ENOENT") {
                    throw error;
                }
            }
        }

        const logs = await reflectWithoutMinting(options.issuerId, options);

        // Print summary
        const summary = {
            total: logs.length,
            success: logs.filter((l) => l.operation.status === "SUCCESS").length,
            failure: logs.filter((l) => l.operation.status === "FAILURE").length,
            skipped: logs.filter((l) => l.operation.status === "SKIPPED").length,
        };

        console.log("\nReflection Summary:");
        console.log(JSON.stringify(summary, null, 2));

        // Exit with error if any operations failed
        process.exit(summary.failure > 0 ? 1 : 0);
    } catch (error) {
        console.error("Fatal error:", error);
        process.exit(1);
    }
};

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
