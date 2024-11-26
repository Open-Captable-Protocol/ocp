import { find } from "../../db/operations/atomic.ts";
import Stakeholder from "../../db/objects/Stakeholder.js";
import StockPlan from "../../db/objects/StockPlan.js";
import StockIssuance from "../../db/objects/transactions/issuance/StockIssuance.js";
import ConvertibleIssuance from "../../db/objects/transactions/issuance/ConvertibleIssuance.js";
import IssuerAuthorizedSharesAdjustment from "../../db/objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment.js";
import StockPlanPoolAdjustment from "../../db/objects/transactions/adjustment/StockPlanPoolAdjustment.js";
import Issuer from "../../db/objects/Issuer.js";
import get from "lodash/get";
import EquityCompensationIssuance from "../../db/objects/transactions/issuance/EquityCompensationIssuance.js";
import { getStockIssuances } from "./helpers.js";

const RELATIONSHIP_TYPES = {
    FOUNDER: "FOUNDER",
    BOARD_MEMBER: "BOARD_MEMBER",
};

const getEquityCompensationIssuances = async (issuerId) => {
    return await find(EquityCompensationIssuance, { issuer: issuerId });
};

const getStockPlans = async (issuerId) => {
    return await find(StockPlan, { issuer: issuerId });
};

const getStakeholders = async (issuerId) => {
    return (await find(Stakeholder, { issuer: issuerId })) || [];
};

const getConvertibleIssuances = async (issuerId) => {
    return await find(ConvertibleIssuance, { issuer: issuerId });
};

const getLatestAuthorizedSharesAdjustment = async (issuerId) => {
    return await IssuerAuthorizedSharesAdjustment.findOne({ issuer: issuerId }).sort({ createdAt: -1 });
};

const getIssuer = async (issuerId) => {
    return await Issuer.findById(issuerId);
};

const getLatestStockIssuance = async (issuerId) => {
    return await StockIssuance.findOne({ issuer: issuerId }).sort({ createdAt: -1 });
};

const calculateTotalShares = (stockIssuances, totalStockPlanAmount) => {
    const totalStockIssuanceShares = stockIssuances.reduce((acc, issuance) => acc + Number(get(issuance, "quantity")), 0);
    return totalStockIssuanceShares + totalStockPlanAmount;
};

const calculateStakeholderShares = (stakeholders, stockIssuances) => {
    const stakeholderShares = stakeholders.reduce((acc, stakeholder) => {
        acc[stakeholder.id] = { shares: 0, type: stakeholder.current_relationship };
        return acc;
    }, {});

    stockIssuances.forEach((issuance) => {
        const stakeholderId = issuance.stakeholder_id;
        if (stakeholderShares[stakeholderId]) {
            stakeholderShares[stakeholderId]["shares"] += Number(issuance.quantity);
        }
    });

    return stakeholderShares;
};

/*
    1. calculating ownership requires calculation total issuances which in case of cancelation the calculation will be wrong, therefore we need better way to get the latest ownership.
    One way we can get through active positions from smart contract
    2. Stock Plan Reissue is not considered in the ownership calculation: need to keep that in mind
*/
const calculateOwnership = (stakeholderShares, totalSharesOutstanding) => {
    const stakeholderTypeShares = Object.values(stakeholderShares).reduce((acc, { shares, type }) => {
        if (!acc[type]) {
            acc[type] = 0;
        }
        acc[type] += shares;
        return acc;
    }, {});

    return Object.entries(stakeholderTypeShares).reduce((acc, [type, shares]) => {
        acc[type] = totalSharesOutstanding ? ((shares / totalSharesOutstanding) * 100).toFixed(2) : "0.00";
        return acc;
    }, {});
};

const calculateTotalRaised = (stockIssuances, convertibleIssuances, filteredStakeholderIds) => {
    const totalStockAmount = stockIssuances
        .filter((iss) => !filteredStakeholderIds.has(iss.stakeholder_id))
        .reduce((acc, issuance) => acc + Number(get(issuance, "quantity")) * Number(get(issuance, "share_price.amount")), 0);

    const totalConvertibleAmount = convertibleIssuances.reduce((acc, issuance) => acc + Number(issuance.investment_amount.amount), 0);
    return totalStockAmount + totalConvertibleAmount;
};

const calculateFullyDilutedShares = (totalStockIssuanceShares, equityCompensationIssuances) => {
    const totalEquityCompensationIssuances = equityCompensationIssuances
        .filter((issuance) => !issuance.stock_class_id)
        .reduce((acc, issuance) => acc + Number(get(issuance, "quantity")), 0);

    return totalStockIssuanceShares + totalEquityCompensationIssuances;
};

const getStockIssuanceValuation = (stockIssuances, sharePrice, filteredStakeholderIds, latestStockIssuance) => {
    // excluding founders and board members
    const totalStockIssuanceShares = stockIssuances
        .filter((iss) => !filteredStakeholderIds.has(iss.stakeholder_id))
        .reduce((acc, issuance) => acc + Number(get(issuance, "quantity")), 0);
    const outstandingShares = totalStockIssuanceShares;
    if (!outstandingShares || !sharePrice) return null;
    return {
        type: "STOCK",
        amount: (outstandingShares * sharePrice).toFixed(2),
        createdAt: get(latestStockIssuance, "createdAt"),
    };
};

const getConvertibleIssuanceValuation = (convertibleIssuances) => {
    const convertibleValuation = convertibleIssuances
        .map((issuance) => {
            const conversionTriggers = get(issuance, "conversion_triggers", []);
            let conversionValuationCap = null;
            conversionTriggers.forEach((trigger) => {
                const conversionRight = get(trigger, "conversion_right");
                const isConvertibleConversion = get(conversionRight, "type") === "CONVERTIBLE_CONVERSION_RIGHT";
                if (!isConvertibleConversion) return null;
                const conversionMechanism = get(conversionRight, "conversion_mechanism");
                const isSAFEConversion = get(conversionMechanism, "type") === "SAFE_CONVERSION";
                if (!isSAFEConversion || !conversionMechanism) return null;

                conversionValuationCap = get(conversionMechanism, "conversion_valuation_cap.amount");
                if (!conversionValuationCap) return null;
            });
            return {
                type: "CONVERTIBLE",
                amount: conversionValuationCap,
                createdAt: get(issuance, "createdAt"),
            };
        })
        .filter((issuance) => issuance)
        .sort((a, b) => b.createdAt - a.createdAt);
    return get(convertibleValuation, "0", null);
};

const calculateDashboardStats = async (issuerId) => {
    try {
        const stockIssuances = await getStockIssuances(issuerId);
        const equityCompensationIssuances = await getEquityCompensationIssuances(issuerId);
        const stockPlans = await getStockPlans(issuerId);
        const stakeholders = await getStakeholders(issuerId);
        const convertibleIssuances = await getConvertibleIssuances(issuerId);
        const latestAuthorizedSharesAdjustment = await getLatestAuthorizedSharesAdjustment(issuerId);
        const issuer = await getIssuer(issuerId);
        const latestStockIssuance = await getLatestStockIssuance(issuerId);
        const stockPlanPoolAdjustments = await StockPlanPoolAdjustment.find({ stock_plan_id: { $in: stockPlans.map((plan) => plan._id) } });
        const stockPlanAdjustmentMap = stockPlanPoolAdjustments.reduce((acc, adjustment) => {
            acc[adjustment.stock_plan_id] = get(adjustment, "shares_reserved", 0);
            return acc;
        }, {});
        // max(shares_reserved, initial_shares_reserved)
        const totalStockPlanAmount = stockPlans.reduce((acc, plan) => {
            return acc + Math.max(Number(get(stockPlanAdjustmentMap, plan._id, 0)), Number(get(plan, "initial_shares_reserved")));
        }, 0);

        // pass stock
        const totalSharesOutstanding = calculateTotalShares(stockIssuances, totalStockPlanAmount);
        const stakeholderShares = calculateStakeholderShares(stakeholders, stockIssuances);
        const ownership = calculateOwnership(stakeholderShares, totalSharesOutstanding);

        const filteredStakeholderIds = new Set(
            stakeholders
                .filter(
                    (stakeholder) =>
                        stakeholder.current_relationship === RELATIONSHIP_TYPES.FOUNDER ||
                        stakeholder.current_relationship === RELATIONSHIP_TYPES.BOARD_MEMBER
                )
                .map((stakeholder) => stakeholder.id)
        );

        const totalRaised = calculateTotalRaised(stockIssuances, convertibleIssuances, filteredStakeholderIds);

        const totalShares = latestAuthorizedSharesAdjustment
            ? Number(get(latestAuthorizedSharesAdjustment, "new_shares_authorized"))
            : Number(get(issuer, "initial_shares_authorized"));

        const sharePrice = get(latestStockIssuance, "share_price.amount", null);

        const fullyDilutedShares = calculateFullyDilutedShares(totalSharesOutstanding, equityCompensationIssuances);

        const stockIssuanceValuation = getStockIssuanceValuation(stockIssuances, sharePrice, filteredStakeholderIds, latestStockIssuance);
        const convertibleIssuanceValuation = getConvertibleIssuanceValuation(convertibleIssuances);

        /* 
      Valuation Calculation:
        latest issuance either Convertible with valuation cap or stock issuance
        for stock issuance calculation:
            outstanding shares * share price
        for convertible issuance calculation:
            conversion valuation cap
      */
        const valuations = [stockIssuanceValuation, convertibleIssuanceValuation].filter(
            (val) => val && Object.keys(val).length > 0 && get(val, "amount")
        );

        valuations.sort((a, b) => b.createdAt - a.createdAt);
        const valuation = valuations.length > 0 ? valuations[0] : null;

        return {
            ownership,
            fullyDilutedShares,
            numOfStakeholders: stakeholders.length,
            totalRaised,
            stockPlanAmount: totalStockPlanAmount,
            totalShares,
            sharePrice,
            valuation,
        };
    } catch (error) {
        console.error("Error calculating dashboard stats:", error);
        throw new Error("Failed to calculate dashboard stats");
    }
};

export default calculateDashboardStats;
