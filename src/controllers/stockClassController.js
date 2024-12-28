import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";
import { convertUUIDToBytes16 } from "../utils/convertUUID.js";

/// @dev: controller handles conversion from OCF type to Onchain types and creates the stock class.
export const convertAndReflectStockClassOnchain = async (contract, stockClass) => {
    const stockClassIdBytes16 = convertUUIDToBytes16(stockClass.id);
    const scaledSharePrice = toScaledBigNumber(stockClass.price_per_share.amount);
    const scaledShares = toScaledBigNumber(stockClass.initial_shares_authorized);

    const tx = await contract.createStockClass(stockClassIdBytes16, stockClass.class_type, scaledSharePrice, scaledShares);
    const receipt = await tx.wait();
    return receipt;
};

//TODO: to decide if we want to also return offchain data.
export const getStockClassById = async (contract, id) => {
    const stockClassIdBytes16 = convertUUIDToBytes16(id);
    // Second: get stock class onchain
    const stockClassAdded = await contract.getStockClassById(stockClassIdBytes16);
    const stockClassId = stockClassAdded[0];
    const classType = stockClassAdded[1];
    const pricePerShare = stockClassAdded[2];
    const initialSharesAuthorized = stockClassAdded[3];

    return { stockClassId, classType, pricePerShare, initialSharesAuthorized };
};

export const getTotalNumberOfStockClasses = async (contract) => {
    const totalStockClasses = await contract.getTotalNumberOfStockClasses();
    console.log("＃ | Total number of stock classes:", totalStockClasses.toString());
    return totalStockClasses.toString();
};

export const convertAndAdjustStockClassAuthorizedSharesOnchain = async (contract, { id, stock_class_id, new_shares_authorized }) => {
    const idBytes16 = convertUUIDToBytes16(id);
    const stockClassIdBytes16 = convertUUIDToBytes16(stock_class_id);
    const newSharesAuthorizedScaled = toScaledBigNumber(new_shares_authorized);

    const tx = await contract.adjustAuthorizedShares(idBytes16, stockClassIdBytes16, newSharesAuthorizedScaled);
    const receipt = await tx.wait();
    return receipt;
};
