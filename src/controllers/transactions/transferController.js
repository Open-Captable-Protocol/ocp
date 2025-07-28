import { convertUUIDToBytes16 } from "../../utils/convertUUID.js";
import { toScaledBigNumber } from "../../utils/convertToFixedPointDecimals.js";
import { decodeError } from "../../utils/errorDecoder.js";

export const convertAndCreateTransferStockOnchain = async (contract, transfer) => {
    try {
        const { quantity, transferorId, transfereeId, stockClassId, sharePrice } = transfer;

        // First: convert OCF Types to Onchain Types
        const transferorIdBytes16 = convertUUIDToBytes16(transferorId);
        const transfereeIdBytes16 = convertUUIDToBytes16(transfereeId);
        const stockClassIdBytes16 = convertUUIDToBytes16(stockClassId);

        const quantityScaled = toScaledBigNumber(quantity);
        const sharePriceScaled = toScaledBigNumber(sharePrice);

        const tx = await contract.transferStock(transferorIdBytes16, transfereeIdBytes16, stockClassIdBytes16, quantityScaled, sharePriceScaled);
        const receipt = await tx.wait();
        console.log(`Initiate Stock Transfer from transferee ID: ${transfereeId} to transferor ID: ${transferorId}`);
        console.log(`Quantity to be transferred: ${quantity}`);
        console.log(`Price per share: ${sharePrice}`);
        return receipt;
    } catch (error) {
        const decodedError = decodeError(error);
        throw new Error(decodedError.message);
    }
};
