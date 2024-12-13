import { convertUUIDToBytes16 } from "../../utils/convertUUID.js";
import { toScaledBigNumber } from "../../utils/convertToFixedPointDecimals.js";

// Stock Issuance
export const convertAndCreateIssuanceStockOnchain = async (
    contract,
    { security_id, stock_class_id, stakeholder_id, quantity, share_price, custom_id = "" }
) => {
    console.log("data to save", {
        stock_class_id: convertUUIDToBytes16(stock_class_id),
        share_price: toScaledBigNumber(share_price.amount),
        quantity: toScaledBigNumber(quantity),
        stakeholder_id: convertUUIDToBytes16(stakeholder_id),
        security_id: convertUUIDToBytes16(security_id),
        custom_id,
        stock_legend_ids_mapping: "",
        security_law_exemptions_mapping: "",
    });
    const tx = await contract.issueStock({
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
};

// Convertible Issuance
export const convertAndCreateIssuanceConvertibleOnchain = async (
    contract,
    { security_id, stakeholder_id, investment_amount, convertible_type, seniority, custom_id = "" }
) => {
    const tx = await contract.issueConvertible({
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
};

// Warrant Issuance
export const convertAndCreateIssuanceWarrantOnchain = async (
    contract,
    { security_id, stakeholder_id, quantity, purchase_price = { amount: 0 }, custom_id = "" }
) => {
    const tx = await contract.issueWarrant({
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
};

// Equity Compensation Issuance
export const convertAndCreateIssuanceEquityCompensationOnchain = async (
    contract,
    {
        security_id,
        stakeholder_id,
        stock_class_id,
        stock_plan_id,
        quantity,
        compensation_type,
        exercise_price,
        base_price,
        expiration_date,
        custom_id = "",
    }
) => {
    const tx = await contract.issueEquityCompensation({
        stakeholder_id: convertUUIDToBytes16(stakeholder_id),
        stock_class_id: convertUUIDToBytes16(stock_class_id),
        stock_plan_id: convertUUIDToBytes16(stock_plan_id),
        quantity: toScaledBigNumber(quantity),
        security_id: convertUUIDToBytes16(security_id),
        compensation_type,
        exercise_price: toScaledBigNumber(exercise_price?.amount || 0),
        base_price: toScaledBigNumber(base_price?.amount || 0),
        expiration_date,
        custom_id,
        termination_exercise_windows_mapping: "",
        security_law_exemptions_mapping: "",
    });
    const receipt = await tx.wait();
    return receipt;
};
