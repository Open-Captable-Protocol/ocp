import get from "lodash/get.js";
import { captableStats } from "../rxjs/index.js";

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
            required: ["stock_plan_id", "stakeholder_id", "quantity", "stock_class_id"],
            references: { stock_plan_id: stockPlanIds, stakeholder_id: stakeholderIds, stock_class_id: stockClassIds },
        },
        TX_CONVERTIBLE_ISSUANCE: {
            required: ["stakeholder_id", "investment_amount.amount"],
            references: { stakeholder_id: stakeholderIds },
        },
        TX_WARRANT_ISSUANCE: {
            required: ["stock_plan_id", "stock_class_id", "quantity"],
            references: { stock_plan_id: stockPlanIds, stock_class_id: stockClassIds },
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
                const resultingStockIssuance = transactions.find(
                    (t) => t.security_id === tx.resulting_security_ids[0] && t.object_type === "TX_STOCK_ISSUANCE"
                );

                if (!resultingStockIssuance) {
                    errors.push(`Transaction ${tx.id} references non-existent stock issuance with security_id: ${tx.resulting_security_ids[0]}`);
                    return errors;
                }

                // Validate quantities match
                if (tx.quantity !== resultingStockIssuance.quantity) {
                    errors.push(
                        `${tx.object_type} - ${tx.id} quantity (${tx.quantity}) does not match resulting stock issuance quantity (${resultingStockIssuance.quantity})`
                    );
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
        errors.push(...validateRequiredFields(tx, validation.required, "Transaction", tx.id));
    }

    if (validation.references) {
        errors.push(...validateReferences(tx, validation.references, "Transaction"));
    }

    if (validation.customValidation) {
        errors.push(...validation.customValidation(tx, referenceSets.transactions));
    }

    return errors;
}

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

export async function validateIssuerForMigration(issuerData) {
    const rxjsData = await captableStats(issuerData);
    if (rxjsData?.errors?.size > 0) {
        return Array.from(rxjsData.errors);
    }

    return validateCapTableData(issuerData);
}
