import Factory from "../objects/Factory.js";
import Fairmint from "../objects/Fairmint.js";
import Issuer from "../objects/Issuer.js";
import Stakeholder from "../objects/Stakeholder.js";
import StockClass from "../objects/StockClass.js";
import StockLegendTemplate from "../objects/StockLegendTemplate.js";
import StockPlan from "../objects/StockPlan.js";
import Valuation from "../objects/Valuation.js";
import VestingTerms from "../objects/VestingTerms.js";
import ConvertibleIssuance from "../objects/transactions/issuance/ConvertibleIssuance.js";
import StockIssuance from "../objects/transactions/issuance/StockIssuance.js";
import StockTransfer from "../objects/transactions/transfer/StockTransfer.js";
import EquityCompensationIssuance from "../objects/transactions/issuance/EquityCompensationIssuance.js";
import IssuerAuthorizedSharesAdjustment from "../objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment.js";
import StockClassAuthorizedSharesAdjustment from "../objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment.js";
import StockPlanPoolAdjustment from "../objects/transactions/adjustment/StockPlanPoolAdjustment.js";
import EquityCompensationExercise from "../objects/transactions/exercise/EquityCompensationExercise.js";
import { countDocuments, find, findById, findOne } from "./atomic.ts";
import WarrantIssuance from "../objects/transactions/issuance/WarrantIssuance.js";

// READ By ID
export const readIssuerById = async (id) => {
    return await findById(Issuer, id);
};

export const readStakeholderById = async (id) => {
    return await findById(Stakeholder, id);
};

export const readStockClassById = async (id) => {
    return await findById(StockClass, id);
};

export const readStockLegendTemplateById = async (id) => {
    return await findById(StockLegendTemplate, id);
};

export const readStockPlanById = async (id) => {
    return await findById(StockPlan, id);
};

export const readValuationById = async (id) => {
    return await findById(Valuation, id);
};

export const readVestingTermsById = async (id) => {
    return await findById(VestingTerms, id);
};

// COUNT
export const countIssuers = async () => {
    return await countDocuments(Issuer);
};

export const countStakeholders = async () => {
    return await countDocuments(Stakeholder);
};

export const countStockClasses = async () => {
    return await countDocuments(StockClass);
};

export const countStockLegendTemplates = async () => {
    return await countDocuments(StockLegendTemplate);
};

export const countStockPlans = async () => {
    return await countDocuments(StockPlan);
};

export const countValuations = async () => {
    return await countDocuments(Valuation);
};

export const countVestingTerms = async () => {
    return await countDocuments(VestingTerms);
};

export const getAllIssuerDataById = async (issuerId) => {
    const issuerStakeholders = await find(Stakeholder, { issuer: issuerId });
    const issuerStockClasses = await find(StockClass, { issuer: issuerId });
    const issuerStockIssuances = await find(StockIssuance, { issuer: issuerId });
    const issuerStockTransfers = await find(StockTransfer, { issuer: issuerId });

    return {
        stakeholders: issuerStakeholders,
        stockClasses: issuerStockClasses,
        stockIssuances: issuerStockIssuances,
        stockTransfers: issuerStockTransfers,
    };
};

export const getAllStakeholdersByIssuerId = async (issuerId) => {
    return await find(Stakeholder, { issuer: issuerId });
};

export const readAllIssuers = async () => {
    return await find(Issuer);
};

export const readfactories = async () => {
    return await find(Factory);
};

export const readFairmintDataById = async (id) => {
    return await Fairmint.findById(id);
};

export const readFairmintDataBySecurityId = async (securityId) => {
    return await Fairmint.findOne({ security_id: securityId });
};

export const readFairmintDataByStakeholderId = async (stakeholderId) => {
    return await Fairmint.findOne({ stakeholder_id: stakeholderId });
};

export const getAllStateMachineObjectsById = async (issuerId) => {
    const issuer = await readIssuerById(issuerId);
    const stockClasses = await find(StockClass, { issuer: issuerId });
    const stockPlans = await find(StockPlan, { issuer: issuerId });
    const stakeholders = await find(Stakeholder, { issuer: issuerId });

    // Get all transaction types
    const issuerAuthorizedSharesAdjustments = await find(IssuerAuthorizedSharesAdjustment, { issuer: issuerId });
    const stockClassAuthorizedSharesAdjustments = await find(StockClassAuthorizedSharesAdjustment, { issuer: issuerId });
    const stockPlanPoolAdjustment = await find(StockPlanPoolAdjustment, { issuer: issuerId });
    const stockIssuances = await find(StockIssuance, { issuer: issuerId });
    const equityCompensationIssuances = await find(EquityCompensationIssuance, { issuer: issuerId });
    const equityCompensationExercises = await find(EquityCompensationExercise, { issuer: issuerId });
    const convertibleIssuances = await find(ConvertibleIssuance, { issuer: issuerId });
    const warrantIssuances = await find(WarrantIssuance, { issuer: issuerId });

    // Combine all transactions into one array
    const allTransactions = [
        ...issuerAuthorizedSharesAdjustments,
        ...stockClassAuthorizedSharesAdjustments,
        ...stockPlanPoolAdjustment,
        ...stockIssuances,
        ...equityCompensationIssuances,
        ...equityCompensationExercises,
        ...convertibleIssuances,
        ...warrantIssuances,
    ].sort((a, b) => {
        // First sort by transaction type to ensure adjustments happen first
        const typeOrder = {
            TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT: 0,
            TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT: 1,
            TX_STOCK_PLAN_POOL_ADJUSTMENT: 2,
            TX_STOCK_ISSUANCE: 3,
            TX_EQUITY_COMPENSATION_ISSUANCE: 3,
            TX_CONVERTIBLE_ISSUANCE: 3,
            TX_WARRANT_ISSUANCE: 3,
            TX_EQUITY_COMPENSATION_EXERCISE: 4,
            TX_STOCK_CANCELLATION: 4,
        };
        const typeCompare = typeOrder[a.object_type] - typeOrder[b.object_type];

        // If same type, sort by createdAt
        return typeCompare !== 0 ? typeCompare : new Date(a.createdAt) - new Date(b.createdAt);
    });

    console.log("All Transactions:", allTransactions.length);

    return {
        issuer,
        stockClasses,
        stockPlans,
        stakeholders,
        transactions: allTransactions,
    };
};

export async function sumEquityCompensationIssuances(issuerId, stockPlanId) {
    try {
        const result = await EquityCompensationIssuance.aggregate([
            {
                $match: {
                    issuer: issuerId,
                    stock_plan_id: stockPlanId,
                    quantity: { $exists: true, $ne: null, $type: "string" },
                },
            },
            {
                $addFields: {
                    numericQuantity: { $toDouble: "$quantity" },
                },
            },
            {
                $group: {
                    _id: null,
                    totalShares: { $sum: "$numericQuantity" },
                },
            },
        ]);

        return result.length > 0 ? result[0].totalShares : 0;
    } catch (error) {
        console.error("Error in sumEquityCompensationIssuances:", error);
        return 0;
    }
}

export const readWarrantIssuanceBySecurityId = async (securityId) => {
    return await findOne(WarrantIssuance, { security_id: securityId });
};

export const readStockIssuanceBySecurityId = async (securityId) => {
    return await findOne(StockIssuance, { security_id: securityId });
};

export const readConvertibleIssuanceBySecurityId = async (securityId) => {
    return await findOne(ConvertibleIssuance, { security_id: securityId });
};

export const readEquityCompensationIssuanceBySecurityId = async (securityId) => {
    return await findOne(EquityCompensationIssuance, { security_id: securityId });
};

export const readEquityCompensationExerciseBySecurityId = async (securityId) => {
    return await findOne(EquityCompensationExercise, { security_id: securityId });
};
