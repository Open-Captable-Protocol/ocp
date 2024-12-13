import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";

export const convertAndReflectStockPlanOnchain = async (contract, stockPlan) => {
    // Convert OCF Types to Onchain Types
    const stockPlanIdBytes16 = convertUUIDToBytes16(stockPlan.id);
    const stockClassIdsBytes16 = stockPlan.stock_class_ids.map((id) => convertUUIDToBytes16(id));
    const sharesReserved = toScaledBigNumber(stockPlan.initial_shares_reserved);

    console.log("Creating stock plan with ID:", stockPlanIdBytes16);
    console.log("Stock class IDs:", stockClassIdsBytes16);
    console.log("Shares reserved:", sharesReserved.toString());

    // Create stock plan onchain
    const tx = await contract.createStockPlan(stockPlanIdBytes16, stockClassIdsBytes16, sharesReserved);
    await tx.wait();

    console.log("✅ | Stock Plan created onchain");
};

export const adjustStockPlanPoolOnchain = async (contract, { stock_plan_id, shares_reserved }) => {
    const stockPlanIdBytes16 = convertUUIDToBytes16(stock_plan_id);
    const scaledShares = toScaledBigNumber(shares_reserved);

    const tx = await contract.adjustStockPlanPool(stockPlanIdBytes16, scaledShares);
    await tx.wait();

    return tx.hash;
};
