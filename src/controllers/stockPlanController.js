import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";
import { decodeError } from "../utils/errorDecoder.js";

export const createStockPlanOnchain = async (contract, stockPlan) => {
    try {
        // Convert OCF Types to Onchain Types
        const stockPlanIdBytes16 = convertUUIDToBytes16(stockPlan.id);
        const stockClassIdsBytes16 = stockPlan.stock_class_ids.map((id) => convertUUIDToBytes16(id));
        const sharesReserved = toScaledBigNumber(stockPlan.initial_shares_reserved);

        console.log("Creating stock plan with ID:", stockPlanIdBytes16);
        console.log("Stock class IDs:", stockClassIdsBytes16);
        console.log("Shares reserved:", sharesReserved.toString());

        // Create stock plan onchain
        const tx = await contract.createStockPlan(stockPlanIdBytes16, stockClassIdsBytes16, sharesReserved);
        const receipt = await tx.wait();

        return receipt;
    } catch (error) {
        const decodedError = decodeError(error);
        throw new Error(decodedError.message);
    }
};

export const adjustStockPlanPoolOnchain = async (contract, { id, stock_plan_id, shares_reserved }) => {
    try {
        const idBytes16 = convertUUIDToBytes16(id);
        const stockPlanIdBytes16 = convertUUIDToBytes16(stock_plan_id);
        const scaledShares = toScaledBigNumber(shares_reserved);

        const tx = await contract.adjustStockPlanPool(idBytes16, stockPlanIdBytes16, scaledShares);
        const receipt = await tx.wait();
        return receipt;
    } catch (error) {
        const decodedError = decodeError(error);
        throw new Error(decodedError.message);
    }
};
