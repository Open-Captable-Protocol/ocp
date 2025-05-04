#!/usr/bin/env node

/**
 * @file restoreIssuerData.script.js
 * @description Script to restore issuer data from a JSON dump file to a target database.
 *
 * This script handles the restoration of all issuer-related data including:
 * - Issuer information
 * - Stakeholders
 * - Stock Classes
 * - Stock Plans
 * - Valuations
 * - Vesting Terms
 * - All transaction types
 *
 * The script will:
 * 1. Check for existing documents to avoid duplicates
 * 2. Skip any documents that already exist
 * 3. Restore only new documents
 * 4. Maintain data integrity through transactions
 * 5. Log all restored and skipped documents
 *
 * @usage
 *   node restoreIssuerData.script.js <dump-file>
 *
 * @example
 *   node restoreIssuerData.script.js ./dumps/issuer-123-456789.json
 *
 * @environment
 *   TARGET_DB_URL - MongoDB connection URL for the target database
 *   TARGET_DB_NAME - (Optional) Target database name (defaults to "fairmint")
 *
 * @output
 *   - Creates a restoration log in ./recovery-logs/
 *   - Logs progress and results to console
 *
 * @notes
 *   - The script will skip any documents that already exist in the target database
 *   - All operations are performed in a transaction for data integrity
 *   - Progress is shown with a progress bar
 *   - Detailed logs are saved for audit purposes
 */

import mongoose from "mongoose";
import chalk from "chalk";
import readline from "readline";
import fs from "fs";
import path from "path";

// Import all models
import Issuer from "../src/db/objects/Issuer";
import Stakeholder from "../src/db/objects/Stakeholder";
import StockClass from "../src/db/objects/StockClass";
import StockLegendTemplate from "../src/db/objects/StockLegendTemplate";
import StockPlan from "../src/db/objects/StockPlan";
import Valuation from "../src/db/objects/Valuation";
import VestingTerms from "../src/db/objects/VestingTerms";
import Fairmint from "../src/db/objects/Fairmint";

// Import transaction models
import StockIssuance from "../src/db/objects/transactions/issuance/StockIssuance";
import StockTransfer from "../src/db/objects/transactions/transfer/StockTransfer";
import StockConversion from "../src/db/objects/transactions/conversion/StockConversion";
import StockRepurchase from "../src/db/objects/transactions/repurchase/StockRepurchase";
import StockConsolidation from "../src/db/objects/transactions/consolidation";
import EquityCompensationIssuance from "../src/db/objects/transactions/issuance/EquityCompensationIssuance";
import EquityCompensationTransfer from "../src/db/objects/transactions/transfer/EquityCompensationTransfer";
import EquityCompensationRetraction from "../src/db/objects/transactions/retraction/EquityCompensationRetraction";
import EquityCompensationExercise from "../src/db/objects/transactions/exercise/EquityCompensationExercise";
import StockPlanPoolAdjustment from "../src/db/objects/transactions/adjustment/StockPlanPoolAdjustment";
import StockClassAuthorizedSharesAdjustment from "../src/db/objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment";
import IssuerAuthorizedSharesAdjustment from "../src/db/objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment";
import StockCancellation from "../src/db/objects/transactions/cancellation/StockCancellation";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

// Configuration
const TARGET_DB_URL = process.env.TARGET_DB_URL;
const RECOVERY_LOGS_DIR = "./recovery-logs";

// Create recovery logs directory if it doesn't exist
if (!fs.existsSync(RECOVERY_LOGS_DIR)) {
    fs.mkdirSync(RECOVERY_LOGS_DIR);
}

// Progress bar implementation
const progressBar = (current, total, width = 50) => {
    const percentage = (current / total) * 100;
    const filledWidth = Math.round((width * current) / total);
    const bar = "█".repeat(filledWidth) + "░".repeat(width - filledWidth);
    return `[${bar}] ${percentage.toFixed(1)}%`;
};

// Create a new Mongoose instance
const createMongooseInstance = () => {
    return new mongoose.Mongoose();
};

// Connect to database
const connectToDB = async (url) => {
    const mongooseInstance = createMongooseInstance();
    const connectOptions = {
        authMechanism: "SCRAM-SHA-1",
        authSource: "admin",
        tls: true,
        tlsAllowInvalidHostnames: true,
        tlsCAFile: "./global-bundle.pem",
        serverSelectionTimeoutMS: 5000, // 5 second timeout
    };

    try {
        const sanitizedDatabaseURL = url.replace(/\/\/(.*):(.*)@/, "//$1:***@");
        console.log(chalk.blue("Connecting to DB..."), sanitizedDatabaseURL);
        await mongooseInstance.connect(url, connectOptions);
        console.log(chalk.green("Connected to DB"));
        return mongooseInstance;
    } catch (error) {
        console.error(chalk.red("Error connecting to DB:"), error.message);
        throw error;
    }
};

// Print usage information
const printUsage = () => {
    console.log(`
Usage: node restoreIssuerData.script.js <dump-file>

Arguments:
  dump-file    The path to the JSON dump file to restore from

Example:
  node restoreIssuerData.script.js ./dumps/issuer-123-456789.json
`);
};

// Confirm restoration
const confirmRestoration = (data) => {
    return new Promise((resolve) => {
        console.log(chalk.yellow("\n⚠️  Restoration Summary:"));
        console.log("-------------------");
        console.log(`Issuer: ${data.issuer?._id}`);
        console.log(`Stakeholders: ${data.stakeholders?.length || 0}`);
        console.log(`Stock Classes: ${data.stockClasses?.length || 0}`);
        console.log(`Stock Plans: ${data.stockPlans?.length || 0}`);
        console.log(
            `Transactions: ${Object.values(data)
                .filter((v) => Array.isArray(v))
                .reduce((sum, arr) => sum + arr.length, 0)}`
        );
        console.log(chalk.red("\nThis will restore data to the target database."));
        rl.question(chalk.yellow("\nAre you sure you want to proceed? (y/N): "), (answer) => {
            resolve(answer.toLowerCase() === "y");
        });
    });
};

// Restore documents to target database
const restoreDocuments = async (data, targetMongoose) => {
    if (!targetMongoose) {
        throw new Error("Target Mongoose instance is required for restoration");
    }
    const models = {
        Issuer: targetMongoose.model("Issuer", Issuer.schema),
        Stakeholder: targetMongoose.model("Stakeholder", Stakeholder.schema),
        StockClass: targetMongoose.model("StockClass", StockClass.schema),
        StockLegendTemplate: targetMongoose.model("StockLegendTemplate", StockLegendTemplate.schema),
        StockPlan: targetMongoose.model("StockPlan", StockPlan.schema),
        Valuation: targetMongoose.model("Valuation", Valuation.schema),
        VestingTerms: targetMongoose.model("VestingTerms", VestingTerms.schema),
        Fairmint: targetMongoose.model("Fairmint", Fairmint.schema),
        // Transaction models
        StockIssuance: targetMongoose.model("StockIssuance", StockIssuance.schema),
        StockTransfer: targetMongoose.model("StockTransfer", StockTransfer.schema),
        StockConversion: targetMongoose.model("StockConversion", StockConversion.schema),
        StockRepurchase: targetMongoose.model("StockRepurchase", StockRepurchase.schema),
        StockConsolidation: targetMongoose.model("StockConsolidation", StockConsolidation.schema),
        EquityCompensationIssuance: targetMongoose.model("EquityCompensationIssuance", EquityCompensationIssuance.schema),
        EquityCompensationTransfer: targetMongoose.model("EquityCompensationTransfer", EquityCompensationTransfer.schema),
        EquityCompensationRetraction: targetMongoose.model("EquityCompensationRetraction", EquityCompensationRetraction.schema),
        EquityCompensationExercise: targetMongoose.model("EquityCompensationExercise", EquityCompensationExercise.schema),
        StockPlanPoolAdjustment: targetMongoose.model("StockPlanPoolAdjustment", StockPlanPoolAdjustment.schema),
        StockClassAuthorizedSharesAdjustment: targetMongoose.model(
            "StockClassAuthorizedSharesAdjustment",
            StockClassAuthorizedSharesAdjustment.schema
        ),
        IssuerAuthorizedSharesAdjustment: targetMongoose.model("IssuerAuthorizedSharesAdjustment", IssuerAuthorizedSharesAdjustment.schema),
        StockCancellation: targetMongoose.model("StockCancellation", StockCancellation.schema),
    };

    const restored = {};
    const skipped = {};
    const totalDocuments = Object.values(data).reduce((sum, docs) => sum + (Array.isArray(docs) ? docs.length : docs ? 1 : 0), 0);
    let currentCount = 0;

    try {
        // Start a session for transaction
        const session = await targetMongoose.connection.startSession();
        await session.startTransaction();

        try {
            // Log the data being restored
            console.log(chalk.blue("\nData to be restored:"));
            console.log(
                JSON.stringify(
                    {
                        issuer: data.issuer?._id,
                        stakeholders: data.stakeholders?.length,
                        stockClasses: data.stockClasses?.length,
                        stockPlans: data.stockPlans?.length,
                        transactions: {
                            stockIssuances: data.stockIssuances?.length,
                            stockTransfers: data.stockTransfers?.length,
                            stockConversions: data.stockConversions?.length,
                            stockRepurchases: data.stockRepurchases?.length,
                            stockConsolidations: data.stockConsolidations?.length,
                            equityCompensationIssuances: data.equityCompensationIssuances?.length,
                            equityCompensationTransfers: data.equityCompensationTransfers?.length,
                            equityCompensationRetractions: data.equityCompensationRetractions?.length,
                            equityCompensationExercises: data.equityCompensationExercises?.length,
                            stockPlanPoolAdjustments: data.stockPlanPoolAdjustments?.length,
                            stockClassAuthorizedSharesAdjustments: data.stockClassAuthorizedSharesAdjustments?.length,
                            issuerAuthorizedSharesAdjustments: data.issuerAuthorizedSharesAdjustments?.length,
                            stockCancellations: data.stockCancellations?.length,
                        },
                    },
                    null,
                    2
                )
            );

            // Helper function to handle document restoration with duplicate checking
            const restoreDocumentsWithDuplicateCheck = async (model, documents, documentType) => {
                if (!documents?.length) return;

                console.log(chalk.blue(`Checking ${documentType}...`));
                const existingDocs = await model.find({ _id: { $in: documents.map((d) => d._id) } });
                const existingIds = new Set(existingDocs.map((d) => d._id.toString()));
                const newDocs = documents.filter((d) => !existingIds.has(d._id.toString()));

                if (existingDocs.length > 0) {
                    console.log(chalk.yellow(`⚠️  ${existingDocs.length} ${documentType} already exist, skipping...`));
                    skipped[documentType] = existingDocs.length;
                }

                if (newDocs.length > 0) {
                    console.log(chalk.blue(`Restoring new ${documentType}...`));
                    const result = await model.create(newDocs, { session });
                    console.log(chalk.gray(`Restored ${documentType}:`), result.length);
                    restored[documentType] = result.length;
                }

                currentCount += documents.length;
                console.log(progressBar(currentCount, totalDocuments));
            };

            // Restore in the same order as deletion
            if (data.issuer) {
                await restoreDocumentsWithDuplicateCheck(models.Issuer, [data.issuer], "issuer");
            }

            if (data.stakeholders?.length) {
                await restoreDocumentsWithDuplicateCheck(models.Stakeholder, data.stakeholders, "stakeholders");
            }

            if (data.stockClasses?.length) {
                await restoreDocumentsWithDuplicateCheck(models.StockClass, data.stockClasses, "stockClasses");
            }

            if (data.stockLegendTemplates?.length) {
                await restoreDocumentsWithDuplicateCheck(models.StockLegendTemplate, data.stockLegendTemplates, "stockLegendTemplates");
            }

            if (data.stockPlans?.length) {
                await restoreDocumentsWithDuplicateCheck(models.StockPlan, data.stockPlans, "stockPlans");
            }

            if (data.valuations?.length) {
                await restoreDocumentsWithDuplicateCheck(models.Valuation, data.valuations, "valuations");
            }

            if (data.vestingTerms?.length) {
                await restoreDocumentsWithDuplicateCheck(models.VestingTerms, data.vestingTerms, "vestingTerms");
            }

            if (data.fairmint?.length) {
                await restoreDocumentsWithDuplicateCheck(models.Fairmint, data.fairmint, "fairmint");
            }

            // Restore transactions
            if (data.stockIssuances?.length) {
                await restoreDocumentsWithDuplicateCheck(models.StockIssuance, data.stockIssuances, "stockIssuances");
            }

            if (data.stockTransfers?.length) {
                await restoreDocumentsWithDuplicateCheck(models.StockTransfer, data.stockTransfers, "stockTransfers");
            }

            if (data.stockConversions?.length) {
                await restoreDocumentsWithDuplicateCheck(models.StockConversion, data.stockConversions, "stockConversions");
            }

            if (data.stockRepurchases?.length) {
                await restoreDocumentsWithDuplicateCheck(models.StockRepurchase, data.stockRepurchases, "stockRepurchases");
            }

            if (data.stockConsolidations?.length) {
                await restoreDocumentsWithDuplicateCheck(models.StockConsolidation, data.stockConsolidations, "stockConsolidations");
            }

            if (data.equityCompensationIssuances?.length) {
                await restoreDocumentsWithDuplicateCheck(
                    models.EquityCompensationIssuance,
                    data.equityCompensationIssuances,
                    "equityCompensationIssuances"
                );
            }

            if (data.equityCompensationTransfers?.length) {
                await restoreDocumentsWithDuplicateCheck(
                    models.EquityCompensationTransfer,
                    data.equityCompensationTransfers,
                    "equityCompensationTransfers"
                );
            }

            if (data.equityCompensationRetractions?.length) {
                await restoreDocumentsWithDuplicateCheck(
                    models.EquityCompensationRetraction,
                    data.equityCompensationRetractions,
                    "equityCompensationRetractions"
                );
            }

            if (data.equityCompensationExercises?.length) {
                await restoreDocumentsWithDuplicateCheck(
                    models.EquityCompensationExercise,
                    data.equityCompensationExercises,
                    "equityCompensationExercises"
                );
            }

            if (data.stockPlanPoolAdjustments?.length) {
                await restoreDocumentsWithDuplicateCheck(models.StockPlanPoolAdjustment, data.stockPlanPoolAdjustments, "stockPlanPoolAdjustments");
            }

            if (data.stockClassAuthorizedSharesAdjustments?.length) {
                await restoreDocumentsWithDuplicateCheck(
                    models.StockClassAuthorizedSharesAdjustment,
                    data.stockClassAuthorizedSharesAdjustments,
                    "stockClassAuthorizedSharesAdjustments"
                );
            }

            if (data.issuerAuthorizedSharesAdjustments?.length) {
                await restoreDocumentsWithDuplicateCheck(
                    models.IssuerAuthorizedSharesAdjustment,
                    data.issuerAuthorizedSharesAdjustments,
                    "issuerAuthorizedSharesAdjustments"
                );
            }

            if (data.stockCancellations?.length) {
                await restoreDocumentsWithDuplicateCheck(models.StockCancellation, data.stockCancellations, "stockCancellations");
            }

            // Commit the transaction
            await session.commitTransaction();
            console.log(chalk.green("\n✅ All documents restored successfully!"));

            // Log summary of restored and skipped documents
            console.log(chalk.blue("\nRestoration Summary:"));
            console.log("-------------------");
            console.log("Restored:", restored);
            console.log("Skipped:", skipped);

            return { restored, skipped };
        } catch (error) {
            // If an error occurs, abort the transaction
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error(chalk.red("Error during restoration:"), error.message);
        throw error;
    }
};

// Main function
const main = async () => {
    const dumpFile = process.argv[2];

    if (!dumpFile) {
        console.error(chalk.red("Error: Dump file path is required"));
        printUsage();
        process.exit(1);
    }

    if (!TARGET_DB_URL) {
        console.error(chalk.red("Error: TARGET_DB_URL environment variable must be set"));
        process.exit(1);
    }

    let mongoose = null;

    try {
        // Read dump file
        console.log(chalk.blue("\nReading dump file..."));
        const dumpData = JSON.parse(fs.readFileSync(dumpFile, "utf8"));
        const { data, issuerId } = dumpData;

        // Confirm restoration
        const confirmed = await confirmRestoration(data);
        if (!confirmed) {
            console.log(chalk.green("Operation cancelled"));
            process.exit(0);
        }

        // Connect to target DB
        console.log(chalk.blue("\nConnecting to target DB..."));
        mongoose = await connectToDB(TARGET_DB_URL);

        // Restore documents
        const { restored, skipped } = await restoreDocuments(data, mongoose);

        // Save restoration results
        const restorationFile = path.join(RECOVERY_LOGS_DIR, `restoration-${issuerId}-${Date.now()}.json`);
        fs.writeFileSync(
            restorationFile,
            JSON.stringify(
                {
                    timestamp: new Date().toISOString(),
                    issuerId,
                    restored,
                    skipped,
                    targetDb: TARGET_DB_URL.replace(/\/\/(.*):(.*)@/, "//$1:***@"),
                },
                null,
                2
            )
        );

        console.log(chalk.green(`\n✅ Restoration results saved to ${restorationFile}`));
    } catch (error) {
        console.error(chalk.red("Error:"), error.message);
        process.exit(1);
    } finally {
        if (mongoose) {
            await mongoose.disconnect();
            console.log(chalk.green("Closed database connection"));
        }
        rl.close();
    }
};

main();
