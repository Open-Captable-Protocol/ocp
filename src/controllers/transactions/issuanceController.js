import { convertUUIDToBytes16 } from "../../utils/convertUUID.js";
import { toScaledBigNumber } from "../../utils/convertToFixedPointDecimals.js";

// Stock Issuance
export const convertAndCreateIssuanceStockOnchain = async (
    contract,
    { security_id, stock_class_id, stakeholder_id, quantity, share_price, custom_id = "", id }
) => {
    const stockClassIdBytes16 = convertUUIDToBytes16(stock_class_id);
    const stakeholderIdBytes16 = convertUUIDToBytes16(stakeholder_id);
    const securityIdBytes16 = convertUUIDToBytes16(security_id);
    const quantityScaled = toScaledBigNumber(quantity);
    const sharePriceScaled = toScaledBigNumber(share_price.amount);
    const idBytes16 = convertUUIDToBytes16(id);

    const tx = await contract.issueStock(
        idBytes16,
        stockClassIdBytes16,
        sharePriceScaled,
        quantityScaled,
        stakeholderIdBytes16,
        securityIdBytes16,
        custom_id,
        "", // stock_legend_ids_mapping
        "" // security_law_exemptions_mapping
    );
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("✅ | Issued stock onchain, unconfirmed: ", {
        security_id,
        stock_class_id,
        stakeholder_id,
        quantity,
        share_price,
        custom_id,
        id,
    });
};

// Convertible Issuance
export const convertAndCreateIssuanceConvertibleOnchain = async (
    contract,
    { security_id, stakeholder_id, investment_amount, convertible_type, seniority, custom_id = "", id }
) => {
    const stakeholderIdBytes16 = convertUUIDToBytes16(stakeholder_id);
    const securityIdBytes16 = convertUUIDToBytes16(security_id);
    const investmentAmountScaled = toScaledBigNumber(investment_amount);
    const idBytes16 = convertUUIDToBytes16(id);

    const tx = await contract.issueConvertible(
        idBytes16,
        stakeholderIdBytes16,
        investmentAmountScaled,
        securityIdBytes16,
        convertible_type,
        seniority,
        custom_id,
        "", // security_law_exemptions_mapping
        "" // conversion_triggers_mapping
    );
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("✅ | Issued convertible onchain, unconfirmed: ", {
        security_id,
        stakeholder_id,
        investment_amount,
        convertible_type,
        seniority,
        custom_id,
        id,
    });
};

// Warrant Issuance
export const convertAndCreateIssuanceWarrantOnchain = async (contract, { security_id, stakeholder_id, quantity, purchase_price, custom_id, id }) => {
    const stakeholderIdBytes16 = convertUUIDToBytes16(stakeholder_id);
    const securityIdBytes16 = convertUUIDToBytes16(security_id);
    const quantityScaled = toScaledBigNumber(quantity);
    const purchasePriceScaled = toScaledBigNumber(purchase_price.amount);
    const idBytes16 = convertUUIDToBytes16(id);

    const tx = await contract.issueWarrant(
        idBytes16,
        stakeholderIdBytes16,
        quantityScaled,
        securityIdBytes16,
        purchasePriceScaled,
        custom_id,
        "", // security_law_exemptions_mapping
        "" // exercise_triggers_mapping
    );
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("✅ | Issued warrant onchain, unconfirmed: ", {
        security_id,
        stakeholder_id,
        quantity,
        purchase_price,
        custom_id,
        id,
    });
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
        id,
    }
) => {
    const stakeholderIdBytes16 = convertUUIDToBytes16(stakeholder_id);
    const securityIdBytes16 = convertUUIDToBytes16(security_id);
    const stockClassIdBytes16 = convertUUIDToBytes16(stock_class_id);
    const stockPlanIdBytes16 = convertUUIDToBytes16(stock_plan_id);
    const quantityScaled = toScaledBigNumber(quantity);
    const exercisePriceScaled = toScaledBigNumber(exercise_price?.amount || 0);
    const basePriceScaled = toScaledBigNumber(base_price?.amount || 0);
    const idBytes16 = convertUUIDToBytes16(id);

    const tx = await contract.issueEquityCompensation(
        idBytes16,
        stakeholderIdBytes16,
        stockClassIdBytes16,
        stockPlanIdBytes16,
        quantityScaled,
        securityIdBytes16,
        compensation_type,
        exercisePriceScaled,
        basePriceScaled,
        expiration_date,
        custom_id,
        "", // termination_exercise_windows_mapping
        "" // security_law_exemptions_mapping
    );
    await tx.wait();
    console.log("Transaction hash:", tx.hash);

    console.log("✅ | Issued equity compensation onchain, unconfirmed: ", {
        security_id,
        stakeholder_id,
        stock_class_id,
        stock_plan_id,
        quantity,
        compensation_type,
        exercise_price,
        base_price,
        expiration_date,
        custom_id,
        id,
    });
};
