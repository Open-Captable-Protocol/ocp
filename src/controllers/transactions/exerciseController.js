import { convertUUIDToBytes16 } from "../../utils/convertUUID.js";
import { toScaledBigNumber } from "../../utils/convertToFixedPointDecimals.js";

export const convertAndCreateEquityCompensationExerciseOnchain = async (
    contract,
    { id, equity_comp_security_id, resulting_stock_security_id, quantity }
) => {
    const idBytes16 = convertUUIDToBytes16(id);
    const equityCompSecurityIdBytes16 = convertUUIDToBytes16(equity_comp_security_id);
    const resultingStockSecurityIdBytes16 = convertUUIDToBytes16(resulting_stock_security_id);
    const quantityScaled = toScaledBigNumber(quantity);

    const tx = await contract.exerciseEquityCompensation(idBytes16, equityCompSecurityIdBytes16, resultingStockSecurityIdBytes16, quantityScaled);
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("✅ | Exercised equity compensation onchain, unconfirmed: ", {
        id,
        equity_comp_security_id,
        resulting_stock_security_id,
        quantity,
    });
};
