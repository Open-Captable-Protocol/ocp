import express, { json, urlencoded } from "express";
import { setupEnv } from "./utils/env.js";
import { connectDB } from "./db/config/mongoose.ts";
import { startListener } from "./utils/websocket.ts";
import { setTag } from "@sentry/node";
import cors from "cors";
import * as Sentry from "@sentry/node";

// Routes
import mainRoutes from "./routes/index.js";
import issuerRoutes from "./routes/issuer.js";
import stakeholderRoutes from "./routes/stakeholder/index.js";
import stockClassRoutes from "./routes/stockClass.js";
import stockLegendRoutes from "./routes/stockLegend.js";
import stockPlanRoutes from "./routes/stockPlan.js";
import transactionRoutes from "./routes/transactions/index.js";
import valuationRoutes from "./routes/valuation.js";
import vestingTermsRoutes from "./routes/vestingTerms.js";
import statsRoutes from "./routes/stats/index.js";
import exportRoutes from "./routes/export.js";
import ocfRoutes from "./routes/ocf.js";
import manifestRoutes from "./routes/manifest.js";
import { readAllIssuers, readIssuerById } from "./db/operations/read.js";
import { contractCache } from "./utils/simple_caches.js";
import { getContractInstance } from "./chain-operations/getContractInstances.js";
import { getChainConfig, SUPPORTED_CHAINS } from "./utils/chains.js";

setupEnv();
Sentry.init({
    integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    sendDefaultPii: false,
});

const app = express();

const PORT = process.env.PORT;

// Middlewares
const chainMiddleware = (req, res, next) => {
    // For issuer creation, expect chainId in the request
    const chainId = req.body.chain_id;
    if (!chainId) {
        return res.status(400).send("chain_id is required for issuer creation");
    }

    // Validate that this is a supported chain
    const chainConfig = getChainConfig(Number(chainId));
    if (!chainConfig) {
        return res.status(400).send(`Unsupported chain ID: ${chainId}. Supported chains are: ${Object.keys(SUPPORTED_CHAINS).join(", ")}`);
    }

    req.chain = Number(chainId);
    next();
};

// Middleware to get or create contract instance
// the listener is first started on deployment, then here as a backup
const contractMiddleware = async (req, res, next) => {
    // Log route information
    if (!req.body.issuerId) {
        console.log("❌ | No issuer ID");
        return res.status(400).send("issuerId is required");
    }

    // fetch issuer to ensure it exists
    const issuer = await readIssuerById(req.body.issuerId);
    if (!issuer || !issuer.id) return res.status(404).send("issuer not found ");

    // Check if contract instance already exists in cache
    const cacheKey = `${issuer.chain_id}-${req.body.issuerId}`;
    if (!contractCache[cacheKey]) {
        const contract = await getContractInstance(issuer.deployed_to, issuer.chain_id);
        contractCache[cacheKey] = { contract };
    }

    setTag("issuerId", req.body.issuerId);
    req.contract = contractCache[cacheKey].contract;
    next();
};

app.use(cors());
app.use(urlencoded({ limit: "50mb", extended: true }));
app.use(json({ limit: "50mb" }));
app.enable("trust proxy");

app.use("/", mainRoutes);
app.use("/issuer", chainMiddleware, issuerRoutes);
app.use("/stakeholder", contractMiddleware, stakeholderRoutes);
app.use("/stock-class", contractMiddleware, stockClassRoutes);

// No middleware required since these are only created offchain
app.use("/stock-legend", stockLegendRoutes);
app.use("/stock-plan", contractMiddleware, stockPlanRoutes);
app.use("/valuation", valuationRoutes);
app.use("/vesting-terms", vestingTermsRoutes);
app.use("/stats", statsRoutes);
app.use("/export", exportRoutes);
app.use("/ocf", ocfRoutes);
app.use("/manifest", manifestRoutes);

// transactions
app.use("/transactions/", contractMiddleware, transactionRoutes);

const startServer = async () => {
    // Connect to MongoDB
    await connectDB();

    app.listen(PORT, async () => {
        console.log(`🚀  Server successfully launched at:${PORT}`);
        const issuers = (await readAllIssuers()) || null;
        if (issuers) {
            // Group contracts by chain_id
            const contractsToWatch = issuers
                .filter((issuer) => issuer?.deployed_to && issuer?.chain_id)
                .map((issuer) => ({
                    id: issuer._id,
                    address: issuer.deployed_to,
                    chain_id: issuer.chain_id,
                    name: issuer.legal_name,
                    createdAt: issuer.createdAt,
                }))
                .filter(Boolean);

            // Group contracts by chain_id
            const contractsByChain = contractsToWatch.reduce((acc, contract) => {
                if (!acc[contract.chain_id]) {
                    acc[contract.chain_id] = [];
                }
                acc[contract.chain_id].push(contract);
                return acc;
            }, {});

            // Display contracts grouped by chain
            console.log("\nContracts by Chain:");
            console.log("==================");
            Object.entries(contractsByChain).forEach(([chainId, contracts]) => {
                console.log(`\nChain ID: ${chainId}`);
                console.log("------------------");
                contracts.forEach((contract) => {
                    console.log(`${contract.createdAt.toISOString().padEnd(32)} - ${contract.name.padEnd(32)} -> ${contract.id}`);
                });
            });
            await startListener(contractsToWatch);
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
