import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";
import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
export const convertAndAdjustIssuerAuthorizedSharesOnChain = async (contract, { id, new_shares_authorized }) => {
    const issuerIdBytes16 = convertUUIDToBytes16(id);
    const scaledSharesAuthorized = toScaledBigNumber(new_shares_authorized);
    const tx = await contract.adjustIssuerAuthorizedShares(issuerIdBytes16, scaledSharesAuthorized);
    await tx.wait();
};
