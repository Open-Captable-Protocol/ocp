#!/usr/bin/env node

import { connectDB } from "../src/db/config/mongoose";
import { deleteIssuerData } from "../src/tests/integration/utils";
import Issuer from "../src/db/objects/Issuer";
import chalk from "chalk";
import readline from "readline";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const printUsage = () => {
    console.log(`
Usage: node deleteIssuerData.script.js <issuer-id>

Arguments:
  issuer-id    The ID of the issuer whose data should be deleted

Example:
  node deleteIssuerData.script.js <issuer-id>
`);
};

const confirmDeletion = (issuerName) => {
    return new Promise((resolve) => {
        console.log(chalk.yellow(`\n⚠️  You are about to delete all data for issuer: ${chalk.bold(issuerName)}`));
        console.log(chalk.red("This action cannot be undone!"));
        rl.question(chalk.yellow("\nAre you sure you want to proceed? (y/N): "), (answer) => {
            resolve(answer.toLowerCase() === "y");
        });
    });
};

const main = async () => {
    const issuerId = process.argv[2];

    if (!issuerId) {
        console.error(chalk.red("Error: Issuer ID is required"));
        printUsage();
        process.exit(1);
    }

    try {
        console.log(chalk.blue("Connecting to DB..."));
        await connectDB();
        console.log(chalk.green("Connected to DB"));

        // const issuer = await Issuer.findOne({ _id: issuerId });
        // if (!issuer) {
        //     console.error(chalk.red("Error: Issuer not found"));
        //     process.exit(1);
        // }

        // const confirmed = await confirmDeletion(issuer.legal_name);
        // if (!confirmed) {
        //     console.log(chalk.green("Operation cancelled"));
        //     process.exit(0);
        // }

        await deleteIssuerData(issuerId);
        console.log(chalk.green("Successfully deleted issuer data"));
    } catch (error) {
        console.error(chalk.red("Error:"), error.message);
        process.exit(1);
    } finally {
        rl.close();
    }
};

main();
