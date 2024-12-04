import { convertUUIDToBytes16 } from "../../utils/convertUUID.js";
import { toScaledBigNumber } from "../../utils/convertToFixedPointDecimals.js";

// Stock Issuance
export const convertAndCreateIssuanceStockOnchain = async (contract, { 
    security_id, 
    stock_class_id, 
    stakeholder_id, 
    quantity, 
    share_price,
    stock_legend_ids_mapping = "",
    custom_id = "",
    security_law_exemptions_mapping = ""
}) => {
    const stockClassIdBytes16 = convertUUIDToBytes16(stock_class_id);
    const stakeholderIdBytes16 = convertUUIDToBytes16(stakeholder_id);
    const securityIdBytes16 = convertUUIDToBytes16(security_id);
    const quantityScaled = toScaledBigNumber(quantity);
    const sharePriceScaled = toScaledBigNumber(share_price.amount);

    const tx = await contract.issueStock(
        stockClassIdBytes16, 
        sharePriceScaled, 
        quantityScaled, 
        stakeholderIdBytes16, 
        securityIdBytes16,
        stock_legend_ids_mapping,
        custom_id ,
        security_law_exemptions_mapping 
    );
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("✅ | Issued stock onchain, unconfirmed: ", {
        security_id,
        stock_class_id,
        stakeholder_id,
        quantity,
        share_price,
        stock_legend_ids_mapping,
        custom_id,
        security_law_exemptions_mapping
    });
};

// Convertible Issuance
export const convertAndCreateIssuanceConvertibleOnchain = async (contract, { 
    security_id, 
    stakeholder_id, 
    investment_amount,
    convertible_type,  // "NOTE" | "SAFE" | "CONVERTIBLE_SECURITY"
    conversion_triggers_mapping = "",
    seniority,
    security_law_exemptions_mapping = "",
    custom_id = ""
}) => {
    const stakeholderIdBytes16 = convertUUIDToBytes16(stakeholder_id);
    const securityIdBytes16 = convertUUIDToBytes16(security_id);
    const investmentAmountScaled = toScaledBigNumber(investment_amount);

    const tx = await contract.issueConvertible(
        stakeholderIdBytes16, 
        investmentAmountScaled, 
        securityIdBytes16,
        convertible_type,
        conversion_triggers_mapping ,
        seniority,
        security_law_exemptions_mapping ,
        custom_id
    );
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("✅ | Issued convertible onchain, unconfirmed: ", {
        security_id,
        stakeholder_id,
        investment_amount,
        convertible_type,
        conversion_triggers_mapping,
        seniority,
        security_law_exemptions_mapping,
        custom_id
    });
};

// Warrant Issuance
export const convertAndCreateIssuanceWarrantOnchain = async (contract, { security_id, stakeholder_id, quantity }) => {
    const stakeholderIdBytes16 = convertUUIDToBytes16(stakeholder_id);
    const securityIdBytes16 = convertUUIDToBytes16(security_id);
    const quantityScaled = toScaledBigNumber(quantity);

    const tx = await contract.issueWarrant(stakeholderIdBytes16, quantityScaled, securityIdBytes16);
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("✅ | Issued warrant onchain, unconfirmed: ", {
        security_id,
        stakeholder_id,
        quantity,
    });
};

// Equity Compensation Issuance
export const convertAndCreateIssuanceEquityCompensationOnchain = async (
    contract,
    { security_id, stakeholder_id, stock_class_id, stock_plan_id, quantity }
) => {
    const stakeholderIdBytes16 = convertUUIDToBytes16(stakeholder_id);
    const securityIdBytes16 = convertUUIDToBytes16(security_id);
    const stockClassIdBytes16 = convertUUIDToBytes16(stock_class_id);
    const stockPlanIdBytes16 = convertUUIDToBytes16(stock_plan_id);
    const quantityScaled = toScaledBigNumber(quantity);

    const tx = await contract.issueEquityCompensation(
        stakeholderIdBytes16,
        stockClassIdBytes16,
        stockPlanIdBytes16,
        quantityScaled,
        securityIdBytes16
    );
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("✅ | Issued equity compensation onchain, unconfirmed: ", {
        security_id,
        stakeholder_id,
        stock_class_id,
        stock_plan_id,
        quantity,
    });
};
