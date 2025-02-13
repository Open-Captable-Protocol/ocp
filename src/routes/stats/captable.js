import { find } from "../../db/operations/atomic.js";
import get from "lodash/get";
import Stockclass from "../../db/objects/StockClass.js";
import StockPlan from "../../db/objects/StockPlan.js";
import Stakeholder from "../../db/objects/Stakeholder.js";
import Convertible from "../../db/objects/transactions/issuance/ConvertibleIssuance.js";
import { getStockIssuances } from "./helpers.js";
import WarrantIssuance from "../../db/objects/transactions/issuance/WarrantIssuance.js";
import EquityCompensationIssuance from "../../db/objects/transactions/issuance/EquityCompensationIssuance.js";

const StockClassTypes = {
    COMMON: "COMMON",
    PREFERRED: "PREFERRED",
};

const StockIssuanceTypes = {
    FOUNDERS_STOCK: "FOUNDERS_STOCK",
};

const getAllEquityCompensationIssuances = async (issuerId) => {
    return (await find(EquityCompensationIssuance, { issuer: issuerId })) || [];
};

const getAllWarrants = async (issuerId) => {
    return (await find(WarrantIssuance, { issuer: issuerId })) || [];
};

const getAllStockClasses = async (issuerId) => {
    return (await find(Stockclass, { issuer: issuerId })) || [];
};

const getAllStockPlans = async (issuerId) => {
    return (await find(StockPlan, { issuer: issuerId })) || [];
};

const getAllConvertibles = async (issuerId) => {
    return (await find(Convertible, { issuer: issuerId })) || [];
};

const getAllStakeholders = async (issuerId) => {
    return (await find(Stakeholder, { issuer: issuerId })) || [];
};

const calculateTotalVotingPower = (stockClasses, outstandingSharesByStockClass) => {
    return stockClasses.reduce((acc, stockClass) => {
        const outstandingShares = outstandingSharesByStockClass[stockClass._id] || 0;
        return acc + Number(stockClass.votes_per_share) * outstandingShares;
    }, 0);
};

/*
    Note: we exclude the founder preferred stock issuances from the preferred stock classes summary.
*/
const calculateStockClassSummary = (stockClasses, stockIssuances, excludeIssuanceType = null) => {
    const totalSharesAuthorized = stockClasses.reduce((sum, sc) => sum + Number(sc.initial_shares_authorized), 0);

    const rows = stockClasses
        .map((stockClass) => {
            const classIssuances = stockIssuances.filter(
                (issuance) =>
                    issuance.stock_class_id === stockClass._id && (excludeIssuanceType ? issuance.issuance_type !== excludeIssuanceType : true)
            );

            if (classIssuances.length === 0) return null;

            const outstandingShares = classIssuances.reduce((sum, issuance) => sum + Number(issuance.quantity), 0);
            const votingPower = stockClass.votes_per_share * outstandingShares;
            const liquidation = outstandingShares * Number(stockClass.price_per_share.amount) * Number(stockClass.liquidation_preference_multiple);

            return {
                name: stockClass.name,
                sharesAuthorized: stockClass.initial_shares_authorized,
                outstandingShares,
                fullyDilutedShares: outstandingShares,
                liquidation,
                votingPower,
            };
        })
        .filter((row) => row !== null);

    return {
        totalSharesAuthorized,
        rows,
    };
};

const calculateFounderPreferredSummary = (preferredStockClasses, stockIssuances) => {
    const founderIssuances = stockIssuances.filter((issuance) => issuance.issuance_type === StockIssuanceTypes.FOUNDERS_STOCK);

    console.log("founderIssuances", founderIssuances);

    if (founderIssuances.length === 0) return null;

    const outstandingShares = founderIssuances.reduce((sum, issuance) => sum + Number(issuance.quantity), 0);

    const founderPreferredClasses = preferredStockClasses.filter((stockClass) =>
        founderIssuances.some((issuance) => issuance.stock_class_id === stockClass._id)
    );

    if (founderPreferredClasses.length === 0) return null;

    const votingPower = founderIssuances.reduce((sum, issuance) => {
        const stockClass = founderPreferredClasses.find((sc) => sc._id === issuance.stock_class_id);
        return sum + (stockClass ? stockClass.votes_per_share * Number(issuance.quantity) : 0);
    }, 0);

    const liquidation = founderIssuances.reduce((sum, issuance) => {
        const stockClass = founderPreferredClasses.find((sc) => sc._id === issuance.stock_class_id);
        return (
            sum +
            (stockClass
                ? Number(issuance.quantity) * Number(stockClass.price_per_share.amount) * Number(stockClass.liquidation_preference_multiple)
                : 0)
        );
    }, 0);

    return {
        outstandingShares,
        sharesAuthorized: outstandingShares,
        fullyDilutedShares: outstandingShares,
        liquidation,
        votingPower,
    };
};

// modularizing the row creation for warrants and non-plan awards
// for warrants, we need to use the exercise_triggers to get the quantity of shares that the warrant can convert to
// for non-plan awards, we can just use the quantity
const createWarrantAndNonPlanAwardsRow = (issuancesByStockClass, stockClasses, totalOutstandingShares, suffix, isWarrant = false) => {
    return Object.entries(issuancesByStockClass).map(([stockClassId, issuances]) => {
        const fullyDilutedShares = issuances.reduce((sum, issuance) => {
            let quantity;
            if (isWarrant) {
                quantity = Number(get(issuance, "exercise_triggers[0].conversion_right.conversion_mechanism.converts_to_quantity", 0));
            } else {
                quantity = Number(issuance.quantity);
            }
            return sum + (isNaN(quantity) ? 0 : quantity);
        }, 0);

        let name;
        if (stockClassId === "general") {
            name = `General ${suffix}`;
        } else {
            const stockClass = stockClasses.find((sc) => sc._id === stockClassId);
            name = stockClass ? `${stockClass.name} ${suffix}` : `Unknown Stock Class ${suffix}`;
        }

        return {
            name,
            fullyDilutedShares,
        };
    });
};

const createEquityCompensationWithPlanAndTypeSummaryRows = (equityCompensationByStockPlanAndType, stockPlans) => {
    return Object.entries(equityCompensationByStockPlanAndType).flatMap(([stockPlanId, typeIssuances]) => {
        const stockPlan = stockPlans.find((sp) => sp._id === stockPlanId);
        const stockPlanName = stockPlan ? stockPlan.plan_name : "Unknown Stock Plan";

        return Object.entries(typeIssuances).map(([compensationType, issuances]) => {
            const fullyDilutedShares = issuances.reduce((sum, issuance) => {
                const quantity = Number(issuance.quantity);
                return sum + (isNaN(quantity) ? 0 : quantity);
            }, 0);

            return {
                name: `${stockPlanName} ${compensationType.charAt(0).toUpperCase() + compensationType.slice(1).toLowerCase()}s`,
                fullyDilutedShares,
            };
        });
    });
};

const groupIssuancesByStockClass = (issuances, stockClassIdPath) => {
    return issuances.reduce((acc, issuance) => {
        const stockClassId = get(issuance, stockClassIdPath) || "general";
        if (!acc[stockClassId]) {
            acc[stockClassId] = [];
        }
        acc[stockClassId].push(issuance);
        return acc;
    }, {});
};
const groupIssuancesByStockPlanAndType = (issuances) => {
    return issuances.reduce((acc, issuance) => {
        const stockPlanId = issuance.stock_plan_id;
        const compensationType = issuance.compensation_type || "Unknown";
        if (!acc[stockPlanId]) {
            acc[stockPlanId] = {};
        }
        if (!acc[stockPlanId][compensationType]) {
            acc[stockPlanId][compensationType] = [];
        }
        acc[stockPlanId][compensationType].push(issuance);
        return acc;
    }, {});
};
// Note: warrants only have fully diluted shares and fds %
const calculateWarrantAndNonPlanAwardSummary = (
    stockClasses,
    warrantIssuances,
    equityCompensationIssuancesWithoutStockPlan,
    totalOutstandingShares
) => {
    console.log("warrantIssuances", warrantIssuances);
    console.log("equityCompensationIssuancesWithoutStockPlan", equityCompensationIssuancesWithoutStockPlan);

    /*
        {
            stockClassId1: [warrant1, warrant2, ...],
            general: [warrant3, warrant4, ...]
        }
    */
    const warrantsByStockClass = groupIssuancesByStockClass(warrantIssuances, "exercise_triggers.0.conversion_right.converts_to_stock_class_id");
    const equityCompensationByStockClass = groupIssuancesByStockClass(equityCompensationIssuancesWithoutStockPlan, "stock_class_id");

    console.log("warrantsByStockClass", warrantsByStockClass);
    console.log("equityCompensationByStockClass", equityCompensationByStockClass);

    const warrantRows = createWarrantAndNonPlanAwardsRow(warrantsByStockClass, stockClasses, totalOutstandingShares, "Warrants", true);
    const equityCompensationRows = createWarrantAndNonPlanAwardsRow(
        equityCompensationByStockClass,
        stockClasses,
        totalOutstandingShares,
        "Non-Plan Awards"
    );

    console.log("warrantRows", warrantRows);
    console.log("equityCompensationRows", equityCompensationRows);

    return {
        rows: [...warrantRows, ...equityCompensationRows],
    };
};

const calculateStockPlanSummary = (stockPlans, equityCompensationIssuances, totalOutstandingShares) => {
    // Filter equity compensation issuances with stock plans
    const equityCompensationWithPlan = equityCompensationIssuances.filter((issuance) => issuance.stock_plan_id);

    // Group issuances by stock plan
    const equityCompensationByStockPlanAndType = groupIssuancesByStockPlanAndType(equityCompensationWithPlan);

    const rows = createEquityCompensationWithPlanAndTypeSummaryRows(equityCompensationByStockPlanAndType, stockPlans, totalOutstandingShares);

    // Calculate total shares authorized and available for grants
    const totalSharesAuthorized = stockPlans.reduce((sum, plan) => sum + Number(plan.initial_shares_reserved), 0);
    const totalIssuedShares = equityCompensationWithPlan.reduce((sum, issuance) => sum + Number(issuance.quantity), 0);
    const availableForGrants = totalSharesAuthorized - totalIssuedShares;

    // Add the 'Available for Grants' row
    const finalRows = [...rows];
    if (availableForGrants > 0) {
        finalRows.push({
            name: "Available for Grants",
            fullyDilutedShares: availableForGrants,
        });
    }

    return {
        totalSharesAuthorized,
        rows: finalRows,
    };
};

const groupConvertibles = (convertibles, stakeholderMap) => {
    return convertibles.reduce((acc, convertible) => {
        const type = convertible.convertible_type || "Other";
        let subType = "Other";
        if (type === "SAFE") {
            const conversionTiming = get(convertible, "conversion_triggers[0].conversion_right.conversion_mechanism.conversion_timing", "");
            subType = conversionTiming === "PRE_MONEY" ? "Pre-Money SAFE" : conversionTiming === "POST_MONEY" ? "Post-Money SAFE" : "Other SAFE";
        } else if (type === "NOTE") {
            subType = "Convertible Notes";
        }

        const discount = Number(get(convertible, "conversion_triggers[0].conversion_right.conversion_mechanism.conversion_discount", 0));
        const valuationCap = Number(
            get(convertible, "conversion_triggers[0].conversion_right.conversion_mechanism.conversion_valuation_cap.amount", 0)
        );

        const valuationCapInMillions = valuationCap > 0 ? `${Math.floor(valuationCap / 1000000)}M` : "";

        let key = subType;
        if (discount > 0 && valuationCap > 0) {
            key += ` - ${discount}% discount, ${valuationCapInMillions} valuation cap`;
        } else if (discount > 0) {
            key += ` - ${discount}% discount`;
        } else if (valuationCap > 0) {
            key += ` - ${valuationCapInMillions} valuation cap`;
        } else {
            key += " - No discount or valuation cap";
        }

        if (!acc[key]) {
            acc[key] = {
                numberOfSecurities: 0,
                outstandingAmount: 0,
                discount,
                valuationCap,
                rows: [],
            };
        }

        acc[key].numberOfSecurities++;
        acc[key].outstandingAmount += Number(convertible.investment_amount.amount);
        acc[key].rows.push({
            name: `${subType} - ${stakeholderMap[convertible.stakeholder_id] || "Unknown Stakeholder"}`,
            numberOfSecurities: 1,
            outstandingAmount: Number(convertible.investment_amount.amount),
            discount,
            valuationCap,
        });

        return acc;
    }, {});
};

const groupWarrants = (warrants, stakeholderMap) => {
    return warrants.reduce((acc, warrant) => {
        const discount = Number(get(warrant, "conversion_triggers[0].conversion_right.conversion_mechanism.conversion_discount", 0));
        const valuationCap = Number(get(warrant, "conversion_triggers[0].conversion_right.conversion_mechanism.conversion_valuation_cap.amount", 0));

        let key = "Warrants for future series of Preferred Stock";
        if (discount > 0) {
            key += ` - ${discount}% discount`;
        } else if (valuationCap > 0) {
            key += ` - ${valuationCap.toLocaleString()} valuation cap`;
        } else {
            key += " - No discount or valuation cap";
        }

        if (!acc[key]) {
            acc[key] = {
                numberOfSecurities: 0,
                outstandingAmount: 0,
                discount,
                valuationCap,
                rows: [],
            };
        }

        acc[key].numberOfSecurities++;
        acc[key].outstandingAmount += Number(warrant.purchase_price.amount);
        acc[key].rows.push({
            name: `Warrant - ${stakeholderMap[warrant.stakeholder_id] || "Unknown Stakeholder"}`,
            numberOfSecurities: 1,
            outstandingAmount: Number(warrant.purchase_price.amount),
            discount,
            valuationCap,
        });

        return acc;
    }, {});
};

const calculateConvertibleSummary = (convertibles, stakeholders, warrantsTreatedAsConvertibles) => {
    const stakeholderMap = stakeholders.reduce((acc, stakeholder) => {
        acc[stakeholder.id] = get(stakeholder, "name.legal_name", "Unknown Stakeholder");
        return acc;
    }, {});

    const convertiblesSummary = groupConvertibles(convertibles, stakeholderMap);

    if (warrantsTreatedAsConvertibles.length > 0) {
        const warrantsSummary = groupWarrants(warrantsTreatedAsConvertibles, stakeholderMap);
        Object.assign(convertiblesSummary, warrantsSummary);
    }

    return convertiblesSummary;
};

const calculateCaptableStats = async (issuerId) => {
    // First Section: Stock Classes
    const stockClasses = await getAllStockClasses(issuerId);
    const stockIssuances = await getStockIssuances(issuerId);
    const warrantIssuances = await getAllWarrants(issuerId);
    const stakeholders = await getAllStakeholders(issuerId);
    const stockPlans = await getAllStockPlans(issuerId);
    const equityCompensationIssuances = await getAllEquityCompensationIssuances(issuerId);
    console.log("equityCompensationIssuances", equityCompensationIssuances);
    const equityCompensationIssuancesStockPlan = equityCompensationIssuances.filter(
        (issuance) => issuance.stock_plan_id && issuance.stock_plan_id !== ""
    );
    const equityCompensationIssuancesWithoutStockPlan = equityCompensationIssuances.filter((issuance) => !get(issuance, "stock_plan_id", null));

    const warrantIssuancesStockClass = warrantIssuances.filter((issuance) =>
        get(issuance, "exercise_triggers.0.conversion_right.converts_to_stock_class_id", null)
    );
    // Warrants without a stock class are treated as convertibles.
    const warrantIssuancesWithoutStockClass = warrantIssuances.filter(
        (issuance) => !get(issuance, "exercise_triggers.0.conversion_right.converts_to_stock_class_id", null)
    );

    console.log("warrantsWithStockClass", warrantIssuancesStockClass);
    console.log("warrantsWithoutStockClass", warrantIssuancesWithoutStockClass);

    // Creates a map of stockClassId to the total number of shares issued
    const outstandingSharesByStockClass = stockIssuances.reduce((acc, issuance) => {
        const stockClassId = issuance.stock_class_id;
        if (!acc[stockClassId]) {
            acc[stockClassId] = 0;
        }
        acc[stockClassId] += Number(get(issuance, "quantity"));
        return acc;
    }, {});

    const totalOutstandingShares = stockIssuances.reduce((acc, issuance) => acc + Number(issuance.quantity), 0);

    const commonStockClasses = stockClasses.filter((stockClass) => stockClass.class_type === StockClassTypes.COMMON);
    const preferredStockClasses = stockClasses.filter((stockClass) => stockClass.class_type === StockClassTypes.PREFERRED);

    // only used for the voting % calculation
    const commonTotalVotingPower = calculateTotalVotingPower(commonStockClasses, outstandingSharesByStockClass);
    const preferredTotalVotingPower = calculateTotalVotingPower(preferredStockClasses, outstandingSharesByStockClass);
    const totalVotingPower = commonTotalVotingPower + preferredTotalVotingPower;

    // Second Section: Convertibles
    const convertibles = await getAllConvertibles(issuerId);
    // Warrants without a stock class are treated as convertibles.

    console.log("convertibles", convertibles);

    const commonSummary = calculateStockClassSummary(commonStockClasses, stockIssuances);
    const preferredSummary = calculateStockClassSummary(preferredStockClasses, stockIssuances, StockIssuanceTypes.FOUNDERS_STOCK);
    const founderPreferredSummary = calculateFounderPreferredSummary(preferredStockClasses, stockIssuances);
    const warrantsAndNonPlanAwardsSummary = calculateWarrantAndNonPlanAwardSummary(
        stockClasses,
        warrantIssuancesStockClass,
        equityCompensationIssuancesWithoutStockPlan,
        totalOutstandingShares
    );
    const stockPlansSummary = calculateStockPlanSummary(stockPlans, equityCompensationIssuancesStockPlan, totalOutstandingShares);

    const totalAuthorizedShares =
        commonSummary.totalSharesAuthorized +
        preferredSummary.totalSharesAuthorized +
        (founderPreferredSummary ? founderPreferredSummary.sharesAuthorized : 0);

    const totalFullyDilutedShares =
        commonSummary.rows.reduce((sum, row) => sum + row.fullyDilutedShares, 0) +
        preferredSummary.rows.reduce((sum, row) => sum + row.fullyDilutedShares, 0) +
        (founderPreferredSummary ? founderPreferredSummary.fullyDilutedShares : 0) +
        warrantsAndNonPlanAwardsSummary.rows.reduce((sum, row) => sum + row.fullyDilutedShares, 0) +
        stockPlansSummary.rows.reduce((sum, row) => sum + row.fullyDilutedShares, 0);

    console.log("totalFullyDilutedShares", totalFullyDilutedShares);

    // Function to recalculate percentages
    const recalculatePercentages = (summary) => {
        summary.rows.forEach((row) => {
            row.fullyDilutedPercentage = (row.fullyDilutedShares / totalFullyDilutedShares).toFixed(4);
            if (row.votingPower !== undefined) {
                row.votingPercentage = (row.votingPower / totalVotingPower).toFixed(4);
            }
        });
        return summary;
    };

    // Recalculate percentages for all summaries
    const updatedCommonSummary = recalculatePercentages(commonSummary);
    const updatedPreferredSummary = recalculatePercentages(preferredSummary);
    const updatedWarrantsAndNonPlanAwardsSummary = recalculatePercentages(warrantsAndNonPlanAwardsSummary);
    const updatedStockPlansSummary = recalculatePercentages(stockPlansSummary);

    // Update founder preferred summary if it exists
    let updatedFounderPreferredSummary = null;
    if (founderPreferredSummary) {
        updatedFounderPreferredSummary = {
            ...founderPreferredSummary,
            fullyDilutedPercentage: (founderPreferredSummary.fullyDilutedShares / totalFullyDilutedShares).toFixed(4),
            votingPercentage: (founderPreferredSummary.votingPower / totalVotingPower).toFixed(4),
        };
    }

    // Calculate convertibles summary separately
    const convertiblesSummary = calculateConvertibleSummary(convertibles, stakeholders, warrantIssuancesWithoutStockClass);

    const totalOutstandingAmountConvertibles = Object.values(convertiblesSummary).reduce(
        (sum, typeSummary) => sum + typeSummary.outstandingAmount,
        0
    );

    // Calculate total liquidation
    const totalLiquidation =
        updatedCommonSummary.rows.reduce((sum, row) => sum + (row.liquidation || 0), 0) +
        updatedPreferredSummary.rows.reduce((sum, row) => sum + (row.liquidation || 0), 0) +
        (updatedFounderPreferredSummary ? updatedFounderPreferredSummary.liquidation : 0);

    // Check if the summary is empty
    const isSummaryEmpty =
        commonSummary.rows.length === 0 &&
        preferredSummary.rows.length === 0 &&
        !founderPreferredSummary &&
        warrantsAndNonPlanAwardsSummary.rows.length === 0 &&
        stockPlansSummary.rows.length === 0;

    // Check if convertibles are empty
    const isConvertiblesEmpty = Object.keys(convertiblesSummary).length === 0;

    // Check if the entire cap table is empty
    const isCapTableEmpty = isSummaryEmpty && isConvertiblesEmpty;

    // Adjust totals based on whether the cap table is empty
    const adjustedTotals = {
        totalAuthorizedShares: isCapTableEmpty ? 0 : totalAuthorizedShares,
        totalOutstandingShares: isCapTableEmpty ? 0 : totalOutstandingShares,
        totalFullyDilutedShares: isCapTableEmpty ? 0 : totalFullyDilutedShares,
        totalFullyPercentage: isCapTableEmpty ? 0 : 1,
        totalVotingPower: isCapTableEmpty ? 0 : totalVotingPower,
        totalVotingPowerPercentage: isCapTableEmpty ? 0 : 1,
        totalLiquidation: isCapTableEmpty ? 0 : totalLiquidation,
    };

    return {
        isCapTableEmpty,
        summary: {
            isEmpty: isSummaryEmpty,
            common: updatedCommonSummary,
            preferred: updatedPreferredSummary,
            founderPreferred: updatedFounderPreferredSummary,
            warrantsAndNonPlanAwards: updatedWarrantsAndNonPlanAwardsSummary,
            stockPlans: updatedStockPlansSummary,
            totals: adjustedTotals,
        },
        convertibles: {
            isEmpty: isConvertiblesEmpty,
            convertiblesSummary,
            totals: {
                outstandingAmount: isCapTableEmpty ? 0 : totalOutstandingAmountConvertibles,
            },
        },
    };
};

export default calculateCaptableStats;
