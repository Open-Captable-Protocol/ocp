import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";
export const convertAndAdjustIssuerAuthorizedSharesOnChain = async (contract, { new_shares_authorized }) => {
    const scaledSharesAuthorized = toScaledBigNumber(new_shares_authorized);
    const tx = await contract.adjustIssuerAuthorizedShares(scaledSharesAuthorized);
    const receipt = await tx.wait();
    return receipt;
};
