import { convertUUIDToBytes16 } from "../../utils/convertUUID.js";
import { toScaledBigNumber } from "../../utils/convertToFixedPointDecimals.js";

export const convertAndCreateEquityCompensationExerciseOnchain = async (
    contract,
    { equity_comp_security_id, resulting_stock_security_id, quantity }
) => {
    const equityCompSecurityIdBytes16 = convertUUIDToBytes16(equity_comp_security_id);
    const resultingStockSecurityIdBytes16 = convertUUIDToBytes16(resulting_stock_security_id);
    const quantityScaled = toScaledBigNumber(quantity);

    const tx = await contract.exerciseEquityCompensation(equityCompSecurityIdBytes16, resultingStockSecurityIdBytes16, quantityScaled);
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("✅ | Exercised equity compensation onchain, unconfirmed: ", {
        equity_comp_security_id,
        resulting_stock_security_id,
        quantity,
    });
};
