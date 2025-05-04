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
const SOURCE_DB_URL = process.env.SOURCE_DB_URL; // To be updated by user
const TARGET_DB_URL = process.env.TARGET_DB_URL; // To be updated by user
const TARGET_DB_NAME = process.env.TARGET_DB_NAME || "ocp_restored"; // Default to ocp_restored if not specified
const RECOVERY_LOGS_DIR = "./recovery-logs";

console.log("SOURCE_DB_URL", SOURCE_DB_URL);
console.log("TARGET_DB_URL", TARGET_DB_URL);
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

// Connect to a specific database
const connectToDB = async (url, dbName = null) => {
    const mongooseInstance = createMongooseInstance();
    const connectOptions = {
        authMechanism: "SCRAM-SHA-1",
        authSource: "admin",
        tls: true,
        tlsAllowInvalidHostnames: true,
        tlsCAFile: "./global-bundle.pem",
        serverSelectionTimeoutMS: 5000, // 5 second timeout
    };

    if (dbName) {
        connectOptions.dbName = dbName;
    }

    try {
        const sanitizedDatabaseURL = url.replace(/\/\/(.*):(.*)@/, "//$1:***@");
        console.log(chalk.blue("Connecting to DB..."), sanitizedDatabaseURL);
        if (dbName) {
            console.log(chalk.blue("Using database:"), dbName);
        }
        await mongooseInstance.connect(url, connectOptions);
        console.log(chalk.green("Connected to DB"));
        return {
            mongoose: mongooseInstance,
            connection: mongooseInstance.connection,
        };
    } catch (error) {
        console.error(chalk.red("Error connecting to DB:"), error.message);
        throw error;
    }
};

// Print usage information
const printUsage = () => {
    console.log(`
Usage: node recoverIssuerData.script.js <issuer-id>

Arguments:
  issuer-id    The ID of the issuer whose data should be recovered

Example:
  node recoverIssuerData.script.js <issuer-id>
`);
};

// Confirm recovery
const confirmRecovery = (analytics) => {
    return new Promise((resolve) => {
        console.log(chalk.yellow("\n⚠️  Recovery Summary:"));
        console.log("-------------------");
        Object.entries(analytics).forEach(([collection, count]) => {
            console.log(`${collection}: ${count} documents`);
        });
        console.log(chalk.red("\nThis will restore data to the target database."));
        rl.question(chalk.yellow("\nAre you sure you want to proceed? (y/N): "), (answer) => {
            resolve(answer.toLowerCase() === "y");
        });
    });
};

// Create models for a specific Mongoose instance
const createModels = (mongooseInstance) => {
    if (!mongooseInstance) {
        throw new Error("Mongoose instance is required to create models");
    }
    return {
        Issuer: mongooseInstance.model("Issuer", Issuer.schema),
        Stakeholder: mongooseInstance.model("Stakeholder", Stakeholder.schema),
        StockClass: mongooseInstance.model("StockClass", StockClass.schema),
        StockLegendTemplate: mongooseInstance.model("StockLegendTemplate", StockLegendTemplate.schema),
        StockPlan: mongooseInstance.model("StockPlan", StockPlan.schema),
        Valuation: mongooseInstance.model("Valuation", Valuation.schema),
        VestingTerms: mongooseInstance.model("VestingTerms", VestingTerms.schema),
        Fairmint: mongooseInstance.model("Fairmint", Fairmint.schema),
        // Transaction models
        StockIssuance: mongooseInstance.model("StockIssuance", StockIssuance.schema),
        StockTransfer: mongooseInstance.model("StockTransfer", StockTransfer.schema),
        StockConversion: mongooseInstance.model("StockConversion", StockConversion.schema),
        StockRepurchase: mongooseInstance.model("StockRepurchase", StockRepurchase.schema),
        StockConsolidation: mongooseInstance.model("StockConsolidation", StockConsolidation.schema),
        EquityCompensationIssuance: mongooseInstance.model("EquityCompensationIssuance", EquityCompensationIssuance.schema),
        EquityCompensationTransfer: mongooseInstance.model("EquityCompensationTransfer", EquityCompensationTransfer.schema),
        EquityCompensationRetraction: mongooseInstance.model("EquityCompensationRetraction", EquityCompensationRetraction.schema),
        EquityCompensationExercise: mongooseInstance.model("EquityCompensationExercise", EquityCompensationExercise.schema),
        StockPlanPoolAdjustment: mongooseInstance.model("StockPlanPoolAdjustment", StockPlanPoolAdjustment.schema),
        StockClassAuthorizedSharesAdjustment: mongooseInstance.model(
            "StockClassAuthorizedSharesAdjustment",
            StockClassAuthorizedSharesAdjustment.schema
        ),
        IssuerAuthorizedSharesAdjustment: mongooseInstance.model("IssuerAuthorizedSharesAdjustment", IssuerAuthorizedSharesAdjustment.schema),
        StockCancellation: mongooseInstance.model("StockCancellation", StockCancellation.schema),
    };
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

// Verify document restoration
const verifyRestoration = async (models, data, restored) => {
    console.log(chalk.blue("\nVerifying restoration..."));
    const verificationResults = {};

    try {
        // Verify issuer
        if (data.issuer) {
            const restoredIssuer = await models.Issuer.findOne({ _id: data.issuer._id });
            verificationResults.issuer = {
                expected: data.issuer._id,
                actual: restoredIssuer?._id,
                success: restoredIssuer?._id === data.issuer._id,
            };
            console.log(chalk.blue("Verifying issuer..."), verificationResults.issuer.success ? chalk.green("✅") : chalk.red("❌"));
        }

        // Verify stakeholders
        if (data.stakeholders?.length) {
            const restoredStakeholders = await models.Stakeholder.find({ issuer: data.issuer._id });
            verificationResults.stakeholders = {
                expected: data.stakeholders.length,
                actual: restoredStakeholders.length,
                success: restoredStakeholders.length === data.stakeholders.length,
            };
            console.log(chalk.blue("Verifying stakeholders..."), verificationResults.stakeholders.success ? chalk.green("✅") : chalk.red("❌"));
        }

        // Verify stock classes
        if (data.stockClasses?.length) {
            const restoredStockClasses = await models.StockClass.find({ issuer: data.issuer._id });
            verificationResults.stockClasses = {
                expected: data.stockClasses.length,
                actual: restoredStockClasses.length,
                success: restoredStockClasses.length === data.stockClasses.length,
            };
            console.log(chalk.blue("Verifying stock classes..."), verificationResults.stockClasses.success ? chalk.green("✅") : chalk.red("❌"));
        }

        // Verify stock plans
        if (data.stockPlans?.length) {
            const restoredStockPlans = await models.StockPlan.find({ issuer: data.issuer._id });
            verificationResults.stockPlans = {
                expected: data.stockPlans.length,
                actual: restoredStockPlans.length,
                success: restoredStockPlans.length === data.stockPlans.length,
            };
            console.log(chalk.blue("Verifying stock plans..."), verificationResults.stockPlans.success ? chalk.green("✅") : chalk.red("❌"));
        }

        // Verify transactions
        if (data.stockIssuances?.length) {
            const restoredStockIssuances = await models.StockIssuance.find({ issuer: data.issuer._id });
            verificationResults.stockIssuances = {
                expected: data.stockIssuances.length,
                actual: restoredStockIssuances.length,
                success: restoredStockIssuances.length === data.stockIssuances.length,
            };
            console.log(chalk.blue("Verifying stock issuances..."), verificationResults.stockIssuances.success ? chalk.green("✅") : chalk.red("❌"));
        }

        // Add more transaction verifications as needed...

        return verificationResults;
    } catch (error) {
        console.error(chalk.red("Error during verification:"), error.message);
        throw error;
    }
};

// Restore documents to target database
const restoreDocuments = async (data, targetMongoose) => {
    if (!targetMongoose) {
        throw new Error("Target Mongoose instance is required for restoration");
    }
    const models = createModels(targetMongoose);
    const restored = {};
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

            // Restore in the same order as deletion
            if (data.issuer) {
                console.log(chalk.blue("Restoring issuer..."));
                const result = await models.Issuer.create([data.issuer], { session });
                console.log(chalk.gray("Restored issuer:"), result[0]._id);
                restored.issuer = 1;
                currentCount++;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.stakeholders?.length) {
                console.log(chalk.blue("Restoring stakeholders..."));
                const result = await models.Stakeholder.create(data.stakeholders, { session });
                console.log(chalk.gray("Restored stakeholders:"), result.length);
                restored.stakeholders = data.stakeholders.length;
                currentCount += data.stakeholders.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.stockClasses?.length) {
                console.log(chalk.blue("Restoring stock classes..."));
                await models.StockClass.create(data.stockClasses, { session });
                restored.stockClasses = data.stockClasses.length;
                currentCount += data.stockClasses.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.stockLegendTemplates?.length) {
                console.log(chalk.blue("Restoring stock legend templates..."));
                await models.StockLegendTemplate.create(data.stockLegendTemplates, { session });
                restored.stockLegendTemplates = data.stockLegendTemplates.length;
                currentCount += data.stockLegendTemplates.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.stockPlans?.length) {
                console.log(chalk.blue("Restoring stock plans..."));
                await models.StockPlan.create(data.stockPlans, { session });
                restored.stockPlans = data.stockPlans.length;
                currentCount += data.stockPlans.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.valuations?.length) {
                console.log(chalk.blue("Restoring valuations..."));
                await models.Valuation.create(data.valuations, { session });
                restored.valuations = data.valuations.length;
                currentCount += data.valuations.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.vestingTerms?.length) {
                console.log(chalk.blue("Restoring vesting terms..."));
                await models.VestingTerms.create(data.vestingTerms, { session });
                restored.vestingTerms = data.vestingTerms.length;
                currentCount += data.vestingTerms.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.fairmint?.length) {
                console.log(chalk.blue("Restoring fairmint data..."));
                await models.Fairmint.create(data.fairmint, { session });
                restored.fairmint = data.fairmint.length;
                currentCount += data.fairmint.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            // Restore transactions
            if (data.stockIssuances?.length) {
                console.log(chalk.blue("Restoring stock issuances..."));
                await models.StockIssuance.create(data.stockIssuances, { session });
                restored.stockIssuances = data.stockIssuances.length;
                currentCount += data.stockIssuances.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.stockTransfers?.length) {
                console.log(chalk.blue("Restoring stock transfers..."));
                await models.StockTransfer.create(data.stockTransfers, { session });
                restored.stockTransfers = data.stockTransfers.length;
                currentCount += data.stockTransfers.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.stockConversions?.length) {
                console.log(chalk.blue("Restoring stock conversions..."));
                await models.StockConversion.create(data.stockConversions, { session });
                restored.stockConversions = data.stockConversions.length;
                currentCount += data.stockConversions.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.stockRepurchases?.length) {
                console.log(chalk.blue("Restoring stock repurchases..."));
                await models.StockRepurchase.create(data.stockRepurchases, { session });
                restored.stockRepurchases = data.stockRepurchases.length;
                currentCount += data.stockRepurchases.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.stockConsolidations?.length) {
                console.log(chalk.blue("Restoring stock consolidations..."));
                await models.StockConsolidation.create(data.stockConsolidations, { session });
                restored.stockConsolidations = data.stockConsolidations.length;
                currentCount += data.stockConsolidations.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.equityCompensationIssuances?.length) {
                console.log(chalk.blue("Restoring equity compensation issuances..."));
                await models.EquityCompensationIssuance.create(data.equityCompensationIssuances, { session });
                restored.equityCompensationIssuances = data.equityCompensationIssuances.length;
                currentCount += data.equityCompensationIssuances.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.equityCompensationTransfers?.length) {
                console.log(chalk.blue("Restoring equity compensation transfers..."));
                await models.EquityCompensationTransfer.create(data.equityCompensationTransfers, { session });
                restored.equityCompensationTransfers = data.equityCompensationTransfers.length;
                currentCount += data.equityCompensationTransfers.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.equityCompensationRetractions?.length) {
                console.log(chalk.blue("Restoring equity compensation retractions..."));
                await models.EquityCompensationRetraction.create(data.equityCompensationRetractions, { session });
                restored.equityCompensationRetractions = data.equityCompensationRetractions.length;
                currentCount += data.equityCompensationRetractions.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.equityCompensationExercises?.length) {
                console.log(chalk.blue("Restoring equity compensation exercises..."));
                await models.EquityCompensationExercise.create(data.equityCompensationExercises, { session });
                restored.equityCompensationExercises = data.equityCompensationExercises.length;
                currentCount += data.equityCompensationExercises.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.stockPlanPoolAdjustments?.length) {
                console.log(chalk.blue("Restoring stock plan pool adjustments..."));
                await models.StockPlanPoolAdjustment.create(data.stockPlanPoolAdjustments, { session });
                restored.stockPlanPoolAdjustments = data.stockPlanPoolAdjustments.length;
                currentCount += data.stockPlanPoolAdjustments.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.stockClassAuthorizedSharesAdjustments?.length) {
                console.log(chalk.blue("Restoring stock class authorized shares adjustments..."));
                await models.StockClassAuthorizedSharesAdjustment.create(data.stockClassAuthorizedSharesAdjustments, { session });
                restored.stockClassAuthorizedSharesAdjustments = data.stockClassAuthorizedSharesAdjustments.length;
                currentCount += data.stockClassAuthorizedSharesAdjustments.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.issuerAuthorizedSharesAdjustments?.length) {
                console.log(chalk.blue("Restoring issuer authorized shares adjustments..."));
                await models.IssuerAuthorizedSharesAdjustment.create(data.issuerAuthorizedSharesAdjustments, { session });
                restored.issuerAuthorizedSharesAdjustments = data.issuerAuthorizedSharesAdjustments.length;
                currentCount += data.issuerAuthorizedSharesAdjustments.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            if (data.stockCancellations?.length) {
                console.log(chalk.blue("Restoring stock cancellations..."));
                await models.StockCancellation.create(data.stockCancellations, { session });
                restored.stockCancellations = data.stockCancellations.length;
                currentCount += data.stockCancellations.length;
                console.log(progressBar(currentCount, totalDocuments));
            }

            // Commit the transaction
            await session.commitTransaction();
            console.log(chalk.green("\n✅ All documents restored successfully!"));

            // Verify the restoration
            const verificationResults = await verifyRestoration(models, data, restored);
            console.log(chalk.blue("\nRestoration verification results:"));
            console.log(JSON.stringify(verificationResults, null, 2));

            return { restored, verificationResults };
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

// Verify database connection
const verifyConnection = async (url, name, dbName = null) => {
    try {
        const { mongoose, connection } = await connectToDB(url, dbName);
        console.log(chalk.green(`✅ Successfully connected to ${name} database`));
        return { mongoose, connection };
    } catch (error) {
        console.error(chalk.red(`❌ Failed to connect to ${name} database:`), error.message);
        throw new Error(`Failed to connect to ${name} database: ${error.message}`);
    }
};

// Test database connection
const testConnection = async (url, name) => {
    console.log(chalk.blue(`\nTesting connection to ${name} database...`));
    console.log(chalk.gray(`URL: ${url.replace(/\/\/(.*):(.*)@/, "//$1:***@")}`));

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
        await mongooseInstance.connect(url, connectOptions);
        console.log(chalk.green(`✅ Successfully connected to ${name} database`));

        // Test a simple query
        const testModel = mongooseInstance.model("Test", new mongoose.Schema({}));
        await testModel.find().limit(1);
        console.log(chalk.green(`✅ Successfully queried ${name} database`));

        await mongooseInstance.disconnect();
        console.log(chalk.green(`✅ Successfully disconnected from ${name} database`));
        return true;
    } catch (error) {
        console.error(chalk.red(`❌ Failed to connect to ${name} database:`), error.message);
        if (mongooseInstance.connection.readyState === 1) {
            await mongooseInstance.disconnect();
        }
        return false;
    }
};

// Main function
const main = async () => {
    const issuerId = process.argv[2];

    if (!issuerId) {
        console.error(chalk.red("Error: Issuer ID is required"));
        printUsage();
        process.exit(1);
    }

    if (!SOURCE_DB_URL || !TARGET_DB_URL) {
        console.error(chalk.red("Error: Both SOURCE_DB_URL and TARGET_DB_URL environment variables must be set"));
        process.exit(1);
    }

    // Test connections first
    console.log(chalk.blue("\nTesting database connections..."));
    const sourceTest = await testConnection(SOURCE_DB_URL, "source");
    const targetTest = await testConnection(TARGET_DB_URL, "target", TARGET_DB_NAME);

    if (!sourceTest || !targetTest) {
        console.error(chalk.red("\n❌ Connection tests failed. Please check your connection settings and try again."));
        process.exit(1);
    }

    console.log(chalk.green("\n✅ Both database connections tested successfully"));
    console.log(chalk.blue("\nProceeding with data recovery..."));

    let sourceMongoose = null;
    let targetMongoose = null;

    try {
        // Verify both database connections first
        console.log(chalk.blue("\nVerifying database connections..."));
        const sourceConnection = await verifyConnection(SOURCE_DB_URL, "source");
        const targetConnection = await verifyConnection(TARGET_DB_URL, "target", TARGET_DB_NAME);

        sourceMongoose = sourceConnection.mongoose;
        targetMongoose = targetConnection.mongoose;

        console.log(chalk.green("\n✅ Both database connections verified successfully"));
        console.log(chalk.blue("\nGathering data for issuer", issuerId));

        // Create models for source connection
        const sourceModels = createModels(sourceMongoose);

        // Collect analytics
        const analytics = {
            issuer: await sourceModels.Issuer.countDocuments({ _id: issuerId }),
            stakeholder: await sourceModels.Stakeholder.countDocuments({ issuer: issuerId }),
            stockClass: await sourceModels.StockClass.countDocuments({ issuer: issuerId }),
            stockLegendTemplate: await sourceModels.StockLegendTemplate.countDocuments({ issuer: issuerId }),
            stockPlan: await sourceModels.StockPlan.countDocuments({ issuer: issuerId }),
            valuation: await sourceModels.Valuation.countDocuments({ issuer: issuerId }),
            vestingTerms: await sourceModels.VestingTerms.countDocuments({ issuer: issuerId }),
            fairmint: await sourceModels.Fairmint.countDocuments({ issuer: issuerId }),
            // Add transaction counts
            stockIssuance: await sourceModels.StockIssuance.countDocuments({ issuer: issuerId }),
            stockTransfer: await sourceModels.StockTransfer.countDocuments({ issuer: issuerId }),
            stockConversion: await sourceModels.StockConversion.countDocuments({ issuer: issuerId }),
            stockRepurchase: await sourceModels.StockRepurchase.countDocuments({ issuer: issuerId }),
            stockConsolidation: await sourceModels.StockConsolidation.countDocuments({ issuer: issuerId }),
            equityCompensationIssuance: await sourceModels.EquityCompensationIssuance.countDocuments({ issuer: issuerId }),
            equityCompensationTransfer: await sourceModels.EquityCompensationTransfer.countDocuments({ issuer: issuerId }),
            equityCompensationRetraction: await sourceModels.EquityCompensationRetraction.countDocuments({ issuer: issuerId }),
            equityCompensationExercise: await sourceModels.EquityCompensationExercise.countDocuments({ issuer: issuerId }),
            stockPlanPoolAdjustment: await sourceModels.StockPlanPoolAdjustment.countDocuments({ issuer: issuerId }),
            stockClassAuthorizedSharesAdjustment: await sourceModels.StockClassAuthorizedSharesAdjustment.countDocuments({ issuer: issuerId }),
            issuerAuthorizedSharesAdjustment: await sourceModels.IssuerAuthorizedSharesAdjustment.countDocuments({ issuer: issuerId }),
            stockCancellation: await sourceModels.StockCancellation.countDocuments({ issuer: issuerId }),
        };

        // Save analytics to file
        const analyticsFile = path.join(RECOVERY_LOGS_DIR, `recovery-${issuerId}-${Date.now()}.json`);
        fs.writeFileSync(
            analyticsFile,
            JSON.stringify(
                {
                    timestamp: new Date().toISOString(),
                    issuerId,
                    analytics,
                    sourceDb: SOURCE_DB_URL.replace(/\/\/(.*):(.*)@/, "//$1:***@"),
                    targetDb: TARGET_DB_URL.replace(/\/\/(.*):(.*)@/, "//$1:***@"),
                },
                null,
                2
            )
        );

        // Confirm recovery
        const confirmed = await confirmRecovery(analytics);
        if (!confirmed) {
            console.log(chalk.green("Operation cancelled"));
            if (sourceMongoose) await sourceMongoose.disconnect();
            if (targetMongoose) await targetMongoose.disconnect();
            process.exit(0);
        }

        // Fetch all documents from source DB
        console.log(chalk.blue("\nFetching documents from source DB..."));
        const data = await fetchIssuerData(issuerId, sourceModels);

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

        // Close source connection
        if (sourceMongoose) {
            await sourceMongoose.disconnect();
            console.log(chalk.green("Closed source DB connection"));
        }

        // Restore documents
        const { restored, verificationResults } = await restoreDocuments(data, targetMongoose);

        // Update analytics file with restoration results
        const restorationResults = {
            ...JSON.parse(fs.readFileSync(analyticsFile, "utf8")),
            restorationResults: restored,
            verificationResults,
            restorationTimestamp: new Date().toISOString(),
        };
        fs.writeFileSync(analyticsFile, JSON.stringify(restorationResults, null, 2));

        // Close target connection
        if (targetMongoose) {
            await targetMongoose.disconnect();
            console.log(chalk.green("Closed target DB connection"));
        }
    } catch (error) {
        console.error(chalk.red("Error:"), error.message);
        // Ensure connections are closed even if there's an error
        if (sourceMongoose) await sourceMongoose.disconnect();
        if (targetMongoose) await targetMongoose.disconnect();
        process.exit(1);
    } finally {
        rl.close();
    }
};

main();
