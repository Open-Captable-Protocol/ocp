import express, { json, urlencoded } from "express";

import { setupEnv } from "./utils/env";

// import connectDB from "./db/config/mongoose.js";

import { connectDB } from "./db/config/mongoose.ts";

import startOnchainListeners from "./chain-operations/transactionListener.js";

// Routes
import historicalTransactions from "./routes/historicalTransactions.js";
import mainRoutes from "./routes/index.js";
import issuerRoutes from "./routes/issuer.js";
import stakeholderRoutes from "./routes/stakeholder.js";
import stockClassRoutes from "./routes/stockClass.js";
import stockLegendRoutes from "./routes/stockLegend.js";
import stockPlanRoutes from "./routes/stockPlan.js";
import transactionRoutes from "./routes/transactions.js";
import valuationRoutes from "./routes/valuation.js";
import vestingTermsRoutes from "./routes/vestingTerms.js";
import dashboard from "./routes/dashboard.js";
import exportRoutes from "./routes/export.js";

import { readIssuerById, readAllIssuers } from "./db/operations/read.js";
import { contractCache } from "./utils/simple_caches.js";
// import { getIssuerContract } from "./utils/caches.ts";
import { getContractInstance } from "./chain-operations/getContractInstances.js";

setupEnv();
// const contractCache = {};
const app = express();

const PORT = process.env.PORT;
const CHAIN = process.env.CHAIN;

// Middlewares
const chainMiddleware = (req, res, next) => {
    req.chain = CHAIN;
    next();
};

// Middleware to get or create contract instance
// the listener is first started on deployment, then here as a backup
const contractMiddleware = async (req, res, next) => {
    if (!req.body.issuerId) {
        console.log("❌ | No issuer ID");
        return res.status(400).send("issuerId is required");
    }

    // fetch issuer to ensure it exists
    const issuer = await readIssuerById(req.body.issuerId);
    if (!issuer || !issuer.id) return res.status(404).send("issuer not found ");

    // Check if contract instance already exists in cache
    if (!contractCache[req.body.issuerId]) {
        const { contract, provider, libraries } = await getContractInstance(issuer.deployed_to);
        contractCache[req.body.issuerId] = { contract, provider, libraries };

        // Initialize listener for this contract
        startOnchainListeners(contract, provider, req.body.issuerId, libraries);
    }

    req.contract = contractCache[req.body.issuerId].contract;
    req.provider = contractCache[req.body.issuerId].provider;
    next();
};

app.use(urlencoded({ limit: "50mb", extended: true }));
app.use(json({ limit: "50mb" }));
app.enable("trust proxy");

app.use("/", chainMiddleware, mainRoutes);
app.use("/issuer", chainMiddleware, issuerRoutes);
app.use("/stakeholder", contractMiddleware, stakeholderRoutes);
app.use("/stock-class", contractMiddleware, stockClassRoutes);
// No middleware required since these are only created offchain
app.use("/stock-legend", stockLegendRoutes);
app.use("/stock-plan", stockPlanRoutes);
app.use("/valuation", valuationRoutes);
app.use("/vesting-terms", vestingTermsRoutes);
app.use("/historical-transactions", historicalTransactions);
app.use("/dashboard", dashboard);
app.use("/export", exportRoutes);

// transactions
app.use("/transactions/", contractMiddleware, transactionRoutes);

const startServer = async () => {
    // Connect to MongoDB
    console.log("Connecting to MongoDB...");
    await connectDB();
    console.log("Connected to MongoDB");

    app.listen(PORT, async () => {
        console.log(`🚀  Server successfully launched at:${PORT}`);
        // Fetch all issuers
        const issuers = await readAllIssuers();
        if (issuers && issuers.length > 0) {
            for (const issuer of issuers) {
                if (issuer.deployed_to) {
                    // Create a new contract instance for each issuer
                    console.log("issuer.deployed_to", issuer.deployed_to);
                    const { contract, provider, libraries } = await getContractInstance(issuer.deployed_to);

                    // Initialize listener for this contract
                    try {
                        startOnchainListeners(contract, provider, issuer._id, libraries);
                    } catch (error) {
                        console.error(`Error inside transaction listener for Issuer ${issuer._id}:`, error);
                    }
                }
            }
        }
    });
    app.on("error", (err) => {
        console.error(err);
        if (err.code === "EADDRINUSE") {
            console.log(`Port ${PORT} is already in use.`);
        } else {
            console.log(err);
        }
    });
};

startServer().catch((error) => {
    console.error("Error starting server:", error);
});
