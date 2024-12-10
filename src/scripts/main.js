import { getAllStateMachineObjectsById, readAllIssuers } from "../db/operations/read.js";
import { validateIssuerForMigration } from "./validate.js";
import { connectDB, disconnectDB } from "../db/config/mongoose.ts";
import readline from "readline";
import chalk from "chalk";

/**
 * Creates a readline interface for user input
 */
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

/**
 * Prompts the user with a question and returns the answer
 * @param {string} question - The question to ask the user
 * @returns {Promise<string>} The user's answer
 */
const askQuestion = (question) => {
    return new Promise((resolve) => {
        rl.question(chalk.cyan(question), (answer) => {
            resolve(answer);
        });
    });
};

const main = async () => {
    try {
        await connectDB();
        // Skip Protelicious USA Corp
        const issuers = (await readAllIssuers()).filter((i) => !i.legal_name.includes("Protelicious USA Corp"));
        const globalErrors = [];

        console.log(chalk.blue.bold(`Found ${issuers.length} issuers to validate.\n`));

        const initialAnswer = await askQuestion(
            `Would you like to: \n` +
                `  ${chalk.yellow("a")} - Validate all issuers\n` +
                `  ${chalk.yellow("y")} - Validate issuers one by one\n` +
                `  ${chalk.yellow("q")} - Quit\n` +
                `Enter your choice: `
        );

        if (initialAnswer.toLowerCase() === "q") {
            console.log(chalk.yellow("\nExiting validation process..."));
            return;
        }

        const validateAll = initialAnswer.toLowerCase() === "a";

        for (let i = 0; i < issuers.length; i++) {
            if (issuers[i].legal_name.toLowerCase().includes("fairbnb")) {
                continue;
            }
            const issuer = issuers[i];

            if (!validateAll) {
                const answer = await askQuestion(
                    `Validate issuer ${chalk.yellow(issuer.legal_name)} (${chalk.green(`${i + 1}/${issuers.length}`)})? (y/n/q to quit): `
                );

                if (answer.toLowerCase() === "q") {
                    console.log(chalk.yellow("\nExiting validation process..."));
                    break;
                }

                if (answer.toLowerCase() !== "y") {
                    continue;
                }
            }

            console.log(chalk.blue(`\nValidating issuer ${chalk.yellow(issuer.legal_name)}...`));
            const issuerData = await getAllStateMachineObjectsById(issuer.id);
            const errors = await validateIssuerForMigration(issuerData);

            if (errors.length > 0) {
                console.log(chalk.red(`\nFound ${errors.length} errors for issuer ${chalk.yellow(issuer.legal_name)}:`));
                errors.forEach((error, index) => {
                    console.log(chalk.red(`${index + 1}. ${error}`));
                });
                globalErrors.push(...errors.map((error) => `[${issuer.legal_name}] ${error}`));
            } else {
                console.log(chalk.green(`\nNo errors found for ${chalk.yellow(issuer.legal_name)}`));
            }
            console.log(chalk.gray("\n-------------------\n"));
        }

        if (globalErrors.length > 0) {
            console.log(chalk.red.bold("\nSummary of all errors found:"));
            globalErrors.forEach((error, index) => {
                console.log(chalk.red(`${index + 1}. ${error}`));
            });
        } else {
            console.log(chalk.green.bold("\nValidation complete. No errors found."));
        }
    } catch (error) {
        console.error(chalk.red.bold("Error during validation:"), chalk.red(error));
    } finally {
        await disconnectDB();
        rl.close();
        console.log(chalk.gray("\nExiting validation process..."));
        process.exit(0);
    }
};

main();
