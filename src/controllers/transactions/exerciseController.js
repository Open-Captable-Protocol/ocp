import { convertUUIDToBytes16 } from "../../utils/convertUUID.js";
import { toScaledBigNumber } from "../../utils/convertToFixedPointDecimals.js";

export const convertAndCreateEquityCompensationExerciseOnchain = async (contract, { security_id, resulting_security_ids, quantity }) => {
    const equityCompSecurityIdBytes16 = convertUUIDToBytes16(security_id);
    const resultingStockSecurityIdBytes16 = convertUUIDToBytes16(resulting_security_ids[0]);
    const quantityScaled = toScaledBigNumber(quantity);

    const tx = await contract.exerciseEquityCompensation(equityCompSecurityIdBytes16, resultingStockSecurityIdBytes16, quantityScaled);
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("[PENDING] Exercised equity compensation onchain", tx.hash);
    return tx.hash;
};
