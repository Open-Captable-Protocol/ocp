import get from "lodash/get.js";
import { getAllStateMachineObjectsById, readAllIssuers } from "../db/operations/read.js";
import { connectDB, disconnectDB } from "../db/config/mongoose.ts";
import readline from "readline";
import chalk from "chalk";
import { captableStats } from "../rxjs/index.js";

/**
 * Validates issuer data for migration, combining RXJS validation with cap table validation
 * @param {Object} issuerData - Complete issuer data to validate
 * @returns {Promise<string[]>} Promise resolving to array of error messages
 */
export async function validateIssuerForMigration(issuerData) {
    const rxjsData = await captableStats(issuerData);
    if (rxjsData?.errors?.size > 0) {
        return Array.from(rxjsData.errors);
    }

    return validateCapTableData(issuerData);
}

/**
 * Validates that all required fields are present and non-empty in an object
 * @param {Object} object - The object to validate
 * @param {string[]} fields - Array of field names that are required
 * @param {string} objectType - Type of object being validated (e.g., "Transaction", "StockClass")
 * @param {string} objectId - Identifier of the object being validated
 * @returns {string[]} Array of error messages, empty if validation passes
 */
function validateRequiredFields(object, fields, objectType, objectId) {
    const errors = [];
    fields.forEach((field) => {
        const value = get(object, field);
        if (!value || (typeof value === "string" && !value.trim())) {
            errors.push(`${objectType} ${objectId} missing required field: ${field}`);
        }
    });
    return errors;
}

/**
 * Validates that referenced IDs exist in their respective reference sets
 * @param {Object} object - The object containing references to validate
 * @param {Object.<string, Set>} referenceMap - Map of field names to Sets of valid reference IDs
 * @param {string} objectType - Type of object being validated
 * @returns {string[]} Array of error messages, empty if validation passes
 */
function validateReferences(object, referenceMap, objectType) {
    const errors = [];
    Object.entries(referenceMap).forEach(([field, refSet]) => {
        const value = get(object, field);
        if (value && !refSet.has(value)) {
            errors.push(`${objectType} ${object.id} references non-existent ${field}: ${value}`);
        }
    });
    return errors;
}

/**
 * Validates a transaction based on its type-specific requirements
 * @param {Object} tx - Transaction object to validate
 * @param {Object} referenceSets - Object containing Sets of valid IDs for different entity types
 * @param {Set<string>} referenceSets.stakeholderIds - Valid stakeholder IDs
 * @param {Set<string>} referenceSets.stockClassIds - Valid stock class IDs
 * @param {Set<string>} referenceSets.stockPlanIds - Valid stock plan IDs
 * @param {Array} referenceSets.transactions - Array of all transactions
 * @returns {string[]} Array of error messages, empty if validation passes
 */
function validateTransactionByType(tx, referenceSets) {
    const errors = [];
    const { stakeholderIds, stockClassIds, stockPlanIds } = referenceSets;

    const transactionValidations = {
        TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT: {
            required: ["new_shares_authorized"],
        },
        TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT: {
            required: ["stock_class_id", "new_shares_authorized"],
            references: { stock_class_id: stockClassIds },
        },
        TX_STOCK_PLAN_POOL_ADJUSTMENT: {
            required: ["stock_plan_id", "shares_reserved"],
            references: { stock_plan_id: stockPlanIds },
        },
        TX_STOCK_ISSUANCE: {
            required: ["stock_class_id", "stakeholder_id", "quantity"],
            references: { stock_class_id: stockClassIds, stakeholder_id: stakeholderIds },
        },
        TX_EQUITY_COMPENSATION_ISSUANCE: {
            required: ["stakeholder_id", "quantity", "stock_class_id"],
            references: { stock_plan_id: stockPlanIds, stakeholder_id: stakeholderIds, stock_class_id: stockClassIds },
        },
        TX_CONVERTIBLE_ISSUANCE: {
            required: ["stakeholder_id", "investment_amount.amount"],
            references: { stakeholder_id: stakeholderIds },
        },
        TX_WARRANT_ISSUANCE: {
            required: [],
            references: { stakeholder_id: stakeholderIds },
        },
        TX_EQUITY_COMPENSATION_EXERCISE: {
            required: ["quantity", "resulting_security_ids"],
            customValidation: (tx, transactions) => {
                const errors = [];
                if (tx.quantity === 0) {
                    errors.push(`Transaction ${tx.id} has 0 quantity`);
                }
                if (!tx.resulting_security_ids?.length) {
                    errors.push(`Transaction ${tx.id} has no resulting security ids`);
                    return errors;
                }

                // Find the resulting stock issuance transaction
                const resultingStockIssuances = tx.resulting_security_ids
                    .map((securityId) => transactions.find((t) => t.security_id === securityId && t.object_type === "TX_STOCK_ISSUANCE"))
                    .filter(Boolean); // Filter out any undefined values

                if (resultingStockIssuances.length == 0) {
                    errors.push(`Transaction ${tx.id} references non-existent stock issuance with security_id: ${tx.resulting_security_ids[0]}`);
                    return errors;
                }

                // Validate quantities match if there is only one resulting stock issuance
                if (resultingStockIssuances.length === 1) {
                    const resultingStockIssuanceQuantity = resultingStockIssuances[0].quantity;
                    if (tx.quantity !== resultingStockIssuanceQuantity) {
                        errors.push(
                            `${tx.object_type} - ${tx.id} quantity (${tx.quantity}) does not match resulting stock issuance quantity (${resultingStockIssuanceQuantity}) resulting_security_id: ${resultingStockIssuances[0].security_id}`
                        );
                    }
                }

                return errors;
            },
        },
    };

    const validation = transactionValidations[tx.object_type];
    if (!validation) {
        return [`Unknown transaction type: ${tx.object_type}`];
    }

    if (validation.required) {
        errors.push(...validateRequiredFields(tx, validation.required, tx.object_type, tx.id));
    }

    if (validation.references) {
        errors.push(...validateReferences(tx, validation.references, tx.object_type));
    }

    if (validation.customValidation) {
        errors.push(...validation.customValidation(tx, referenceSets.transactions));
    }

    return errors;
}

/**
 * Validates the entire cap table data structure
 * @param {Object} issuerData - Complete cap table data
 * @param {Object} issuerData.issuer - Issuer information
 * @param {Array} issuerData.stakeholders - Array of stakeholder objects
 * @param {Array} issuerData.stockClasses - Array of stock class objects
 * @param {Array} issuerData.stockPlans - Array of stock plan objects
 * @param {Array} issuerData.transactions - Array of transaction objects
 * @returns {Promise<string[]>} Promise resolving to array of error messages
 */
export async function validateCapTableData(issuerData) {
    const errors = [];
    const { stakeholders, stockClasses, stockPlans, transactions } = issuerData;

    // Create reference sets
    const referenceSets = {
        stakeholderIds: new Set(stakeholders.map((s) => s.id)),
        stockClassIds: new Set(stockClasses.map((sc) => sc.id)),
        stockPlanIds: new Set(stockPlans.map((sp) => sp.id)),
        securityIds: new Set(transactions.map((t) => t.security_id)),
        transactions,
    };
    referenceSets.stockPlanIds.add("00000000-0000-0000-0000-000000000000");

    // Validate basic objects
    errors.push(
        ...validateRequiredFields(issuerData.issuer, ["initial_shares_authorized"], "Issuer", issuerData.issuer.id),
        ...stockClasses.flatMap((sc) => validateRequiredFields(sc, ["initial_shares_authorized", "price_per_share.amount"], "StockClass", sc.id)),
        ...stockPlans.flatMap((sp) => validateRequiredFields(sp, ["initial_shares_reserved", "stock_class_ids"], "StockPlan", sp.id))
    );

    // Validate stock class shares don't exceed issuer authorized shares
    stockClasses.forEach((stockClass) => {
        if (Number(stockClass.initial_shares_authorized) > Number(issuerData.issuer.initial_shares_authorized)) {
            errors.push(
                `StockClass ${stockClass.id} initial_shares_authorized (${stockClass.initial_shares_authorized}) exceeds issuer initial_shares_authorized (${issuerData.issuer.initial_shares_authorized}) - issuer id: ${issuerData.issuer.id}`
            );
        }
    });

    // Validate transactions
    errors.push(...transactions.flatMap((tx) => validateTransactionByType(tx, referenceSets)));

    return errors;
}

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

// To run the script from the command line, use the following command: `npx tsx src/scripts/validate.js`
const main = async () => {
    try {
        await connectDB();
        // Skip Protelicious USA Corp
        const skipIssuers = [];
        const issuers = (await readAllIssuers()).filter((i) => !skipIssuers.includes(i.legal_name));
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

// Only run if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    // To run the script from the command line, use the following command: `npx tsx src/scripts/validate.js`
    if (process.argv[2]) {
        // Run validation for specific issuer
        main(process.argv[2])
            .then(() => {
                console.log(chalk.green("Validation completed successfully"));
                process.exit(0);
            })
            .catch((error) => {
                console.error(chalk.red("Validation failed:"), error);
                process.exit(1);
            });
    } else {
        // Run validation for all issuers
        main()
            .then(() => {
                console.log(chalk.green("Full validation completed successfully"));
                process.exit(0);
            })
            .catch((error) => {
                console.error(chalk.red("Validation failed:"), error);
                process.exit(1);
            });
    }
}
