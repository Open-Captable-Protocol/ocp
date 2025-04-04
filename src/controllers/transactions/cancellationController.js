import { convertUUIDToBytes16 } from "../../utils/convertUUID.js";
import { toScaledBigNumber } from "../../utils/convertToFixedPointDecimals.js";

export const convertAndCreateCancellationStockOnchain = async (contract, { id, security_id, quantity }) => {
    const scaledQuantity = toScaledBigNumber(quantity);
    const securityIdBytes16 = convertUUIDToBytes16(security_id);
    const idBytes16 = convertUUIDToBytes16(id);
    const tx = await contract.cancelStock(idBytes16, securityIdBytes16, scaledQuantity);
    const receipt = await tx.wait();
    return receipt;
};
