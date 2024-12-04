import get from "lodash/get.js";
import { captableStats } from "../rxjs/index.js";

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
            required: ["stock_class_id", "quantity"],
            references: { stock_plan_id: stockPlanIds, stock_class_id: stockClassIds },
            customValidation: (tx) => {
                const errors = [];
                if (tx.quantity === 0) {
                    errors.push(`Transaction ${tx.id} quantity has to be greater than 0`);
                }
                return errors;
            },
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
                const resultingStockIssuances = tx.resulting_security_ids.map((securityId) =>
                    transactions.find((t) => t.security_id === securityId && t.object_type === "TX_STOCK_ISSUANCE")
                );

                if (resultingStockIssuances.length == 0) {
                    errors.push(`Transaction ${tx.id} references non-existent stock issuance with security_id: ${tx.resulting_security_ids[0]}`);
                    return errors;
                }

                // Validate quantities match if there is only one resulting stock issuance
                if (resultingStockIssuances.length === 1) {
                    const resultingStockIssuance = resultingStockIssuances[0];
                    if (tx.quantity !== resultingStockIssuance.quantity) {
                        errors.push(
                            `${tx.object_type} - ${tx.id} quantity (${tx.quantity}) does not match resulting stock issuance quantity (${resultingStockIssuance.quantity}) resulting_security_id: ${resultingStockIssuance.security_id}`
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
async function validateCapTableData(issuerData) {
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

    // Validate basic objects
    errors.push(
        ...validateRequiredFields(issuerData.issuer, ["initial_shares_authorized"], "Issuer", issuerData.issuer.id),
        ...stockClasses.flatMap((sc) => validateRequiredFields(sc, ["initial_shares_authorized", "price_per_share.amount"], "StockClass", sc.id)),
        ...stockPlans.flatMap((sp) => validateRequiredFields(sp, ["initial_shares_reserved", "stock_class_ids"], "StockPlan", sp.id))
    );

    // Validate transactions
    errors.push(...transactions.flatMap((tx) => validateTransactionByType(tx, referenceSets)));

    return errors;
}

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
