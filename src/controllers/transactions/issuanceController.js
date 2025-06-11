import { convertUUIDToBytes16 } from "../../utils/convertUUID.js";
import { toScaledBigNumber } from "../../utils/convertToFixedPointDecimals.js";
import { decodeError } from "../../utils/errorDecoder.js";
import { isCantonChainId } from "../../chain-operations/canton/constants.js";
import { convertAndCreateIssuanceStockOnchainCanton } from "../../chain-operations/issuanceControllerCanton.js";

// Stock Issuance
export const convertAndCreateIssuanceStockOnchain = async (
    contract,
    {
        id,
        chain_id,
        security_id,
        stock_class_id,
        stakeholder_id,
        quantity,
        share_price,
        custom_id = "",
        stockClassContractId,
        stakeholderPartyId,
        issuerPartyId,
    }
) => {
    if (isCantonChainId(chain_id)) {
        return convertAndCreateIssuanceStockOnchainCanton({ stockClassContractId, stakeholderPartyId, quantity, issuerPartyId });
    }

    try {
        const tx = await contract.issueStock({
            id: convertUUIDToBytes16(id),
            stock_class_id: convertUUIDToBytes16(stock_class_id),
            share_price: toScaledBigNumber(share_price.amount),
            quantity: toScaledBigNumber(quantity),
            stakeholder_id: convertUUIDToBytes16(stakeholder_id),
            security_id: convertUUIDToBytes16(security_id),
            custom_id,
            stock_legend_ids_mapping: "",
            security_law_exemptions_mapping: "",
        });
        const receipt = await tx.wait();
        return receipt;
    } catch (error) {
        const decodedError = decodeError(error);
        throw new Error(decodedError.message);
    }
};

// Convertible Issuance
export const convertAndCreateIssuanceConvertibleOnchain = async (
    contract,
    { id, security_id, stakeholder_id, investment_amount, convertible_type, seniority, custom_id = "" }
) => {
    try {
        const tx = await contract.issueConvertible({
            id: convertUUIDToBytes16(id),
            stakeholder_id: convertUUIDToBytes16(stakeholder_id),
            investment_amount: toScaledBigNumber(investment_amount.amount),
            security_id: convertUUIDToBytes16(security_id),
            convertible_type,
            seniority: toScaledBigNumber(seniority),
            custom_id,
            security_law_exemptions_mapping: "",
            conversion_triggers_mapping: "",
        });
        const receipt = await tx.wait();
        return receipt;
    } catch (error) {
        const decodedError = decodeError(error);
        throw new Error(decodedError.message);
    }
};

// Warrant Issuance
export const convertAndCreateIssuanceWarrantOnchain = async (
    contract,
    { id, security_id, stakeholder_id, quantity = "0", purchase_price = { amount: 0 }, custom_id = "" }
) => {
    try {
        const tx = await contract.issueWarrant({
            id: convertUUIDToBytes16(id),
            stakeholder_id: convertUUIDToBytes16(stakeholder_id),
            quantity: toScaledBigNumber(quantity),
            security_id: convertUUIDToBytes16(security_id),
            purchase_price: toScaledBigNumber(purchase_price.amount),
            custom_id,
            security_law_exemptions_mapping: "",
            exercise_triggers_mapping: "",
        });
        const receipt = await tx.wait();
        return receipt;
    } catch (error) {
        const decodedError = decodeError(error);
        throw new Error(decodedError.message);
    }
};

// Equity Compensation Issuance
export const convertAndCreateIssuanceEquityCompensationOnchain = async (
    contract,
    {
        id,
        security_id,
        stakeholder_id,
        stock_class_id,
        stock_plan_id = "00000000-0000-0000-0000-000000000000", // default to empty uuid to pass onchain validation
        quantity,
        compensation_type,
        exercise_price = { amount: "0" },
        base_price = { amount: "0" },
        expiration_date = null,
        custom_id = "",
    }
) => {
    try {
        const tx = await contract.issueEquityCompensation({
            id: convertUUIDToBytes16(id),
            stakeholder_id: convertUUIDToBytes16(stakeholder_id),
            stock_class_id: convertUUIDToBytes16(stock_class_id),
            stock_plan_id: convertUUIDToBytes16(stock_plan_id),
            quantity: toScaledBigNumber(quantity),
            security_id: convertUUIDToBytes16(security_id),
            compensation_type,
            exercise_price: toScaledBigNumber(exercise_price.amount),
            base_price: toScaledBigNumber(base_price.amount),
            expiration_date: expiration_date || "",
            custom_id,
            termination_exercise_windows_mapping: "",
            security_law_exemptions_mapping: "",
        });
        const receipt = await tx.wait();
        return receipt;
    } catch (error) {
        const decodedError = decodeError(error);
        throw new Error(decodedError.message);
    }
};
