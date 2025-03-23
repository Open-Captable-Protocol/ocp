import { convertUUIDToBytes16 } from "../../utils/convertUUID.js";
import { toScaledBigNumber } from "../../utils/convertToFixedPointDecimals.js";
import { decodeError } from "../../utils/errorDecoder.js";

export const convertAndCreateEquityCompensationExerciseOnchain = async (contract, { id, security_id, resulting_security_ids, quantity }) => {
    try {
        const idBytes16 = convertUUIDToBytes16(id);
        const equityCompSecurityIdBytes16 = convertUUIDToBytes16(security_id);
        const resultingStockSecurityIdBytes16 = convertUUIDToBytes16(resulting_security_ids[0]);
        const quantityScaled = toScaledBigNumber(quantity);

        const tx = await contract.exerciseEquityCompensation(idBytes16, equityCompSecurityIdBytes16, resultingStockSecurityIdBytes16, quantityScaled);
        const receipt = await tx.wait();
        return receipt;
    } catch (error) {
        const decodedError = decodeError(error);
        throw new Error(decodedError.message);
    }
};
