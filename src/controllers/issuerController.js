import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";
import { convertUUIDToBytes16 } from "../utils/convertUUID.js";
import { decodeError } from "../utils/errorDecoder.js";

export const convertAndAdjustIssuerAuthorizedSharesOnChain = async (contract, { id, new_shares_authorized }) => {
    try {
        const idBytes16 = convertUUIDToBytes16(id);
        const scaledSharesAuthorized = toScaledBigNumber(new_shares_authorized);
        const tx = await contract.adjustIssuerAuthorizedShares(idBytes16, scaledSharesAuthorized);
        const receipt = await tx.wait();
        return receipt;
    } catch (error) {
        const decodedError = decodeError(error);
        throw new Error(decodedError.message);
    }
};
