#!/usr/bin/env node

/**
 * @file dumpIssuerData.script.js
 * @description Script to dump issuer data from a source database to a JSON file.
 *
 * This script handles the dumping of all issuer-related data including:
 * - Issuer information
 * - Stakeholders
 * - Stock Classes
 * - Stock Plans
 * - Valuations
 * - Vesting Terms
 * - All transaction types
 *
 * The script will:
 * 1. Connect to the source database
 * 2. Fetch all issuer-related documents
 * 3. Save the data to a JSON file
 * 4. Log the dump summary
 *
 * @usage
 *   node dumpIssuerData.script.js <issuer-id>
 *
 * @example
 *   node dumpIssuerData.script.js 123456789
 *
 * @environment
 *   SOURCE_DB_URL - MongoDB connection URL for the source database
 *
 * @output
 *   - Creates a dump file in ./dumps/
 *   - Filename format: issuer-<issuer-id>-<timestamp>.json
 *   - Logs progress and results to console
 *
 * @notes
 *   - The script creates a new dump file for each run
 *   - Dump files include a timestamp to prevent overwrites
 *   - All sensitive information is redacted in logs
 *   - The dump file contains all necessary data for restoration
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
const SOURCE_DB_URL = process.env.SOURCE_DB_URL;
const DUMP_DIR = "./dumps";

// Create dump directory if it doesn't exist
if (!fs.existsSync(DUMP_DIR)) {
    fs.mkdirSync(DUMP_DIR);
}

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
Usage: node dumpIssuerData.script.js <issuer-id>

Arguments:
  issuer-id    The ID of the issuer whose data should be dumped

Example:
  node dumpIssuerData.script.js <issuer-id>
`);
};

// Fetch all documents for an issuer
const fetchIssuerData = async (issuerId, models) => {
    const data = {
        issuer: await models.Issuer.findOne({ _id: issuerId }),
        stakeholders: await models.Stakeholder.find({ issuer: issuerId }),
        stockClasses: await models.StockClass.find({ issuer: issuerId }),
        stockLegendTemplates: await models.StockLegendTemplate.find({ issuer: issuerId }),
        stockPlans: await models.StockPlan.find({ issuer: issuerId }),
        valuations: await models.Valuation.find({ issuer: issuerId }),
        vestingTerms: await models.VestingTerms.find({ issuer: issuerId }),
        fairmint: await models.Fairmint.find({ issuer: issuerId }),
        // Transactions
        stockIssuances: await models.StockIssuance.find({ issuer: issuerId }),
        stockTransfers: await models.StockTransfer.find({ issuer: issuerId }),
        stockConversions: await models.StockConversion.find({ issuer: issuerId }),
        stockRepurchases: await models.StockRepurchase.find({ issuer: issuerId }),
        stockConsolidations: await models.StockConsolidation.find({ issuer: issuerId }),
        equityCompensationIssuances: await models.EquityCompensationIssuance.find({ issuer: issuerId }),
        equityCompensationTransfers: await models.EquityCompensationTransfer.find({ issuer: issuerId }),
        equityCompensationRetractions: await models.EquityCompensationRetraction.find({ issuer: issuerId }),
        equityCompensationExercises: await models.EquityCompensationExercise.find({ issuer: issuerId }),
        stockPlanPoolAdjustments: await models.StockPlanPoolAdjustment.find({ issuer: issuerId }),
        stockClassAuthorizedSharesAdjustments: await models.StockClassAuthorizedSharesAdjustment.find({ issuer: issuerId }),
        issuerAuthorizedSharesAdjustments: await models.IssuerAuthorizedSharesAdjustment.find({ issuer: issuerId }),
        stockCancellations: await models.StockCancellation.find({ issuer: issuerId }),
    };

    return data;
};

// Main function
const main = async () => {
    const issuerId = process.argv[2];

    if (!issuerId) {
        console.error(chalk.red("Error: Issuer ID is required"));
        printUsage();
        process.exit(1);
    }

    if (!SOURCE_DB_URL) {
        console.error(chalk.red("Error: SOURCE_DB_URL environment variable must be set"));
        process.exit(1);
    }

    let mongoose = null;

    try {
        // Connect to source DB
        console.log(chalk.blue("\nConnecting to source DB..."));
        mongoose = await connectToDB(SOURCE_DB_URL);

        // Create models
        const models = {
            Issuer: mongoose.model("Issuer", Issuer.schema),
            Stakeholder: mongoose.model("Stakeholder", Stakeholder.schema),
            StockClass: mongoose.model("StockClass", StockClass.schema),
            StockLegendTemplate: mongoose.model("StockLegendTemplate", StockLegendTemplate.schema),
            StockPlan: mongoose.model("StockPlan", StockPlan.schema),
            Valuation: mongoose.model("Valuation", Valuation.schema),
            VestingTerms: mongoose.model("VestingTerms", VestingTerms.schema),
            Fairmint: mongoose.model("Fairmint", Fairmint.schema),
            // Transaction models
            StockIssuance: mongoose.model("StockIssuance", StockIssuance.schema),
            StockTransfer: mongoose.model("StockTransfer", StockTransfer.schema),
            StockConversion: mongoose.model("StockConversion", StockConversion.schema),
            StockRepurchase: mongoose.model("StockRepurchase", StockRepurchase.schema),
            StockConsolidation: mongoose.model("StockConsolidation", StockConsolidation.schema),
            EquityCompensationIssuance: mongoose.model("EquityCompensationIssuance", EquityCompensationIssuance.schema),
            EquityCompensationTransfer: mongoose.model("EquityCompensationTransfer", EquityCompensationTransfer.schema),
            EquityCompensationRetraction: mongoose.model("EquityCompensationRetraction", EquityCompensationRetraction.schema),
            EquityCompensationExercise: mongoose.model("EquityCompensationExercise", EquityCompensationExercise.schema),
            StockPlanPoolAdjustment: mongoose.model("StockPlanPoolAdjustment", StockPlanPoolAdjustment.schema),
            StockClassAuthorizedSharesAdjustment: mongoose.model("StockClassAuthorizedSharesAdjustment", StockClassAuthorizedSharesAdjustment.schema),
            IssuerAuthorizedSharesAdjustment: mongoose.model("IssuerAuthorizedSharesAdjustment", IssuerAuthorizedSharesAdjustment.schema),
            StockCancellation: mongoose.model("StockCancellation", StockCancellation.schema),
        };

        // Fetch all documents from source DB
        console.log(chalk.blue("\nFetching documents from source DB..."));
        const data = await fetchIssuerData(issuerId, models);

        // Log the fetched data
        console.log(chalk.blue("\nFetched data summary:"));
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

        // Save data to file
        const dumpFile = path.join(DUMP_DIR, `issuer-${issuerId}-${Date.now()}.json`);
        fs.writeFileSync(
            dumpFile,
            JSON.stringify(
                {
                    timestamp: new Date().toISOString(),
                    issuerId,
                    data,
                    sourceDb: SOURCE_DB_URL.replace(/\/\/(.*):(.*)@/, "//$1:***@"),
                },
                null,
                2
            )
        );

        console.log(chalk.green(`\n✅ Data successfully dumped to ${dumpFile}`));
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
