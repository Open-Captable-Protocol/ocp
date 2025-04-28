#!/usr/bin/env node

import { connectDB } from "../src/db/config/mongoose";
import { deleteIssuerData } from "../src/tests/integration/utils";
import Issuer from "../src/db/objects/Issuer";

const printUsage = () => {
    console.log(`
Usage: node deleteIssuerData.script.js <issuer-id>

Arguments:
  issuer-id    The ID of the issuer whose data should be deleted

Example:
  node deleteIssuerData.script.js <issuer-id>
`);
};

const main = async () => {
    const issuerId = process.argv[2];

    if (!issuerId) {
        console.error("Error: Issuer ID is required");
        printUsage();
        process.exit(1);
    }

    try {
        console.log("NODE_ENV", process.env.NODE_ENV);
        console.log("USE_ENV_FILE", process.env.USE_ENV_FILE);
        console.log("Connecting to DB...");
        await connectDB();
        console.log("Connected to DB");
        const issuer = await Issuer.findOne({ _id: issuerId });
        if (!issuer) {
            console.error("Error: Issuer not found");
            process.exit(1);
        }
        await deleteIssuerData(issuerId);
        console.log("Successfully deleted issuer data");
    } catch (error) {
        console.error("Error:", error.message);
        process.exit(1);
    } finally {
        process.exit(0);
    }
};

main();
