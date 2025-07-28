import { convertBytes16ToUUID } from "../utils/convertUUID.js";
import { createIssuerAuthorizedSharesAdjustment, createStockClassAuthorizedSharesAdjustment } from "../db/operations/create.js";
import {
    upsertStakeholderById,
    upsertStockTransferById,
    upsertStockCancellationById,
    upsertStockRetractionById,
    upsertStockReissuanceById,
    upsertStockRepurchaseById,
    upsertStockAcceptanceById,
    upsertStockIssuanceById,
    upsertConvertibleIssuanceById,
    upsertEquityCompensationIssuanceById,
    upsertWarrantIssuanceById,
    upsertEquityCompensationExerciseById,
    upsertStockPlanById,
    upsertStockClassById,
} from "../db/operations/update.js";
import { toDecimal } from "../utils/convertToFixedPointDecimals.js";
import * as structs from "./structs.js";
import { v4 as uuid } from "uuid";
import StockPlanPoolAdjustment from "../db/objects/transactions/adjustment/StockPlanPoolAdjustment.js";
import StockClassAuthorizedSharesAdjustment from "../db/objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment.js";
import IssuerAuthorizedSharesAdjustment from "../db/objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment.js";
import StockConsolidation from "../db/objects/transactions/consolidation/index.js";

const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
};

// @dev, this file is where you would create the mapping for the "_mapping" fields.

export const handleStockIssuance = async (stock, issuerId, timestamp, hash) => {
    console.log("StockIssuanceCreated Event Emitted!", stock);
    const {
        id,
        stock_class_id,
        share_price,
        quantity,
        stakeholder_id,
        security_id,
        // _stock_legend_ids_mapping,
        custom_id,
        // _security_law_exemptions_mapping,
    } = stock;

    const _id = convertBytes16ToUUID(id);
    const _security_id = convertBytes16ToUUID(security_id);
    const chainDate = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _stakeholder_id = convertBytes16ToUUID(stakeholder_id);

    // If we have fairmint data, get historical date
    const dateToUse = chainDate;

    const createdStockIssuance = await upsertStockIssuanceById(_id, {
        id: _id,
        stock_class_id: convertBytes16ToUUID(stock_class_id),
        share_price: {
            amount: toDecimal(share_price).toString(),
            currency: "USD",
        },
        quantity: toDecimal(quantity).toString(),
        stakeholder_id: _stakeholder_id,
        security_id: _security_id,
        date: dateToUse,
        issuer: issuerId,
        is_onchain_synced: true,
        custom_id,
        tx_hash: hash,
    });

    console.log(
        `✅ | StockIssuance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockIssuance
    );
};

export const handleStockTransfer = async (stock, issuerId) => {
    console.log(`Stock Transfer with quantity ${toDecimal(stock.quantity).toString()} received at `, new Date(Date.now()).toLocaleDateString());

    const id = convertBytes16ToUUID(stock.id) || uuid();
    const quantity = toDecimal(stock.quantity).toString();
    const createdStockTransfer = await upsertStockTransferById(id, {
        _id: id,
        object_type: "TX_STOCK_TRANSFER",
        quantity,
        // Map blockchain fields to OCF fields
        security_id: convertBytes16ToUUID(stock.consolidated_security_id), // Original position
        balance_security_id: convertBytes16ToUUID(stock.remainder_security_id), // Remaining shares for partial transfer
        resulting_security_ids: [convertBytes16ToUUID(stock.transferee_security_id)], // New position for transferee
        // Optional fields
        // OCP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    console.log("Stock Transfer reflected and validated off-chain", createdStockTransfer);
    console.log(
        `✅ | StockTransfer confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockTransfer
    );
};

export const handleStakeholder = async (id, hash) => {
    try {
        const incomingStakeholderId = convertBytes16ToUUID(id);
        await upsertStakeholderById(incomingStakeholderId, { is_onchain_synced: true, tx_hash: hash });
    } catch (error) {
        throw Error("Error handing Stakeholder On Chain", error);
    }
};

export const handleStockClass = async (id, hash) => {
    console.log("StockClassCreated Event Emitted!", id);
    const incomingStockClassId = convertBytes16ToUUID(id);
    const stockClass = await upsertStockClassById(incomingStockClassId, { _id: incomingStockClassId, is_onchain_synced: true, tx_hash: hash });
    console.log("✅ | StockClass confirmation onchain ", stockClass);
};

export const handleStockCancellation = async (stock, issuerId, timestamp) => {
    console.log("StockCancellationCreated Event Emitted!", stock.id);
    const id = convertBytes16ToUUID(stock.id);
    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];
    const createdStockCancellation = await upsertStockCancellationById(id, {
        _id: id,
        object_type: stock.object_type,
        quantity: toDecimal(stock.quantity).toString(),
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,
        reason_text: stock.reason_text,
        balance_security_id: convertBytes16ToUUID(stock.balance_security_id),
        // OCP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    console.log(
        `✅ | StockCancellation confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockCancellation
    );
};

export const handleStockRetraction = async (stock, issuerId, timestamp) => {
    console.log("StockRetractionCreated Event Emitted!", stock.id);
    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];
    const id = convertBytes16ToUUID(stock.id);
    const createdStockRetraction = await upsertStockRetractionById(id, {
        _id: id,
        object_type: stock.object_type,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,
        reason_text: stock.reason_text,
        // OCP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    console.log(
        `✅ | StockRetraction confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockRetraction
    );
};

export const handleStockReissuance = async (stock, issuerId, timestamp) => {
    console.log("StockReissuanceCreated Event Emitted!", stock.id);
    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];
    const id = convertBytes16ToUUID(stock.id);
    const createdStockReissuance = await upsertStockReissuanceById(id, {
        _id: id,
        object_type: stock.object_type,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,
        reason_text: stock.reason_text,
        resulting_security_ids: stock.resulting_security_ids.map((sId) => convertBytes16ToUUID(sId)),
        // OCP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    console.log(
        `✅ | StockReissuance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockReissuance
    );
};

export const handleStockRepurchase = async (stock, issuerId, timestamp) => {
    console.log("StockRepurchaseCreated Event Emitted!", stock.id);
    const id = convertBytes16ToUUID(stock.id);

    const sharePriceOCF = {
        amount: toDecimal(stock.price).toString(),
        currency: "USD",
    };

    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];

    const createdStockRepurchase = await upsertStockRepurchaseById(id, {
        _id: id,
        object_type: stock.object_type,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,
        price: sharePriceOCF,
        quantity: toDecimal(stock.quantity).toString(),
        consideration_text: stock.consideration_text,
        balance_security_id: convertBytes16ToUUID(stock.balance_security_id),

        // OCP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    console.log(
        `✅ | StockRepurchase confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockRepurchase
    );
};

export const handleStockAcceptance = async (stock, issuerId, timestamp) => {
    console.log("StockAcceptanceCreated Event Emitted!", stock.id);
    const id = convertBytes16ToUUID(stock.id);
    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];

    const createdStockAcceptance = await upsertStockAcceptanceById(id, {
        _id: id,
        object_type: stock.object_type,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,

        // OCP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    console.log(
        `✅ | StockAcceptance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockAcceptance
    );
};

export const handleStockClassAuthorizedSharesAdjusted = async (data, issuerId, timestamp, hash) => {
    console.log("StockClassAuthorizedSharesAdjusted Event Received!");
    const [id, stock_class_id, new_shares_authorized] = data;
    const _id = convertBytes16ToUUID(id);

    // Update
    let result;
    const existingStockClassAdjustment = await StockClassAuthorizedSharesAdjustment.findById({ _id: _id });
    if (existingStockClassAdjustment) {
        result = await StockClassAuthorizedSharesAdjustment.findByIdAndUpdate({ _id: _id }, { is_onchain_synced: true }, { new: true });
        console.log("[UPDATED] StockClassAuthorizedSharesAdjusted", result);
    } else {
        // create
        result = await createStockClassAuthorizedSharesAdjustment({
            stock_class_id: convertBytes16ToUUID(stock_class_id),
            new_shares_authorized: toDecimal(new_shares_authorized).toString(),
            date: new Date(timestamp * 1000).toISOString().split("T")[0],
            issuer: issuerId,
            is_onchain_synced: true,
            tx_hash: hash,
        });
        console.log("[CREATED] StockClassAuthorizedSharesAdjusted", result);
    }

    console.log(`✅ [CONFIRMED] StockClassAuthorizedSharesAdjusted  ${new Date(Date.now()).toLocaleDateString("en-US", options)}`);
};

export const handleIssuerAuthorizedSharesAdjusted = async (data, issuerId, timestamp, hash) => {
    console.log("IssuerAuthorizedSharesAdjusted Event Received!");
    const [id, new_shares_authorized] = data;
    const _id = convertBytes16ToUUID(id);

    // Try to find existing record first
    const existingAdjustment = await IssuerAuthorizedSharesAdjustment.findOne({ _id: _id });

    const adjustmentData = {
        issuer: issuerId,
        issuer_id: issuerId,
        new_shares_authorized: toDecimal(new_shares_authorized).toString(),
        date: new Date(timestamp * 1000).toISOString().split("T")[0],
        is_onchain_synced: true,
        tx_hash: hash,
    };

    let result;
    if (existingAdjustment) {
        // Update existing record
        result = await IssuerAuthorizedSharesAdjustment.findOneAndUpdate(
            { _id: _id },
            { ...existingAdjustment, is_onchain_synced: true },
            { new: true }
        );
        console.log("[UPDATED] IssuerAuthorizedSharesAdjusted", result);
    } else {
        // Create new record
        result = await createIssuerAuthorizedSharesAdjustment(adjustmentData);
        console.log("[CREATED] IssuerAuthorizedSharesAdjusted", result);
    }
    console.log(`✅ [CONFIRMED] IssuerAuthorizedSharesAdjusted  ${new Date(Date.now()).toLocaleDateString("en-US", options)}`);
};

export const handleStockPlan = async (id, sharesReserved, hash) => {
    console.log("StockPlanCreated Event Emitted!", id);
    const incomingStockPlanId = convertBytes16ToUUID(id);
    const stockPlan = await upsertStockPlanById(incomingStockPlanId, {
        initial_shares_reserved: toDecimal(sharesReserved).toString(),
        is_onchain_synced: true,
        tx_hash: hash,
    });
    console.log("✅ | CONFIRMED - StockPlan Created", stockPlan);
};

export const handleConvertibleIssuance = async (convertible, issuerId, timestamp, hash) => {
    console.log("ConvertibleIssuanceCreated Event Emitted!", convertible);
    const {
        id,
        security_id,
        stakeholder_id,
        investment_amount,
        convertible_type,
        conversion_triggers_mapping,
        seniority,
        security_law_exemptions_mapping,
        custom_id,
    } = convertible;
    const _security_id = convertBytes16ToUUID(security_id);
    const _id = convertBytes16ToUUID(id);
    const chainDate = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _stakeholder_id = convertBytes16ToUUID(stakeholder_id);

    const dateToUse = chainDate;

    const createdConvertibleIssuance = await upsertConvertibleIssuanceById(_id, {
        id: _id,
        investment_amount: {
            amount: toDecimal(investment_amount).toString(),
            currency: "USD",
        },
        stakeholder_id: _stakeholder_id,
        security_id: _security_id,
        date: dateToUse,
        issuer: issuerId,
        is_onchain_synced: true,
        convertible_type,
        conversion_triggers_mapping,
        seniority: Number(toDecimal(seniority).toString()),
        security_law_exemptions_mapping,
        custom_id,
        tx_hash: hash,
    });

    console.log(
        `✅ | ConvertibleIssuance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdConvertibleIssuance
    );
};

export const handleWarrantIssuance = async (warrant, issuerId, timestamp, hash) => {
    console.log("WarrantIssuanceCreated Event Emitted!", warrant);
    const { id, stakeholder_id, quantity, security_id, purchase_price, custom_id, security_law_exemptions_mapping, exercise_triggers_mapping } =
        warrant;

    const _security_id = convertBytes16ToUUID(security_id);
    const _id = convertBytes16ToUUID(id);
    const chainDate = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _stakeholder_id = convertBytes16ToUUID(stakeholder_id);

    const dateToUse = chainDate;

    const createdWarrantIssuance = await upsertWarrantIssuanceById(_id, {
        _id: _id,
        date: dateToUse,
        stakeholder_id: _stakeholder_id,
        quantity: toDecimal(quantity).toString(),
        security_id: _security_id,
        issuer: issuerId,
        is_onchain_synced: true,
        custom_id,
        purchase_price:
            purchase_price > 0
                ? {
                      amount: toDecimal(purchase_price).toString(),
                      currency: "USD",
                  }
                : undefined,
        security_law_exemptions: security_law_exemptions_mapping,
        exercise_triggers: exercise_triggers_mapping,
        tx_hash: hash,
    });

    console.log(
        `✅ | WarrantIssuance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdWarrantIssuance
    );
};

export const handleEquityCompensationIssuance = async (equity, issuerId, timestamp, hash) => {
    console.log("EquityCompensationIssuanceCreated Event Emitted!", equity);
    const {
        id,
        stakeholder_id,
        stock_class_id,
        stock_plan_id,
        quantity,
        security_id,
        compensation_type,
        exercise_price,
        base_price,
        expiration_date,
        custom_id,
        termination_exercise_windows_mapping,
        security_law_exemptions_mapping,
    } = equity;

    const _id = convertBytes16ToUUID(id);
    const _security_id = convertBytes16ToUUID(security_id);
    const chainDate = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _stakeholder_id = convertBytes16ToUUID(stakeholder_id);

    const dateToUse = chainDate;

    const createdEquityCompIssuance = await upsertEquityCompensationIssuanceById(_id, {
        _id: _id,
        date: dateToUse,
        stakeholder_id: _stakeholder_id,
        stock_class_id: convertBytes16ToUUID(stock_class_id),
        stock_plan_id: convertBytes16ToUUID(stock_plan_id),
        quantity: toDecimal(quantity).toString(),
        security_id: _security_id,
        issuer: issuerId,
        is_onchain_synced: true,
        compensation_type,
        exercise_price:
            exercise_price > 0
                ? {
                      amount: toDecimal(exercise_price).toString(),
                      currency: "USD", // Default to USD, can be made configurable if needed
                  }
                : undefined,
        base_price:
            base_price > 0
                ? {
                      amount: toDecimal(base_price).toString(),
                      currency: "USD", // Default to USD, can be made configurable if needed
                  }
                : undefined,
        expiration_date: expiration_date === "" ? null : expiration_date, // smart contract value type is string yet we want to store null if we want to pass ocf validation
        termination_exercise_windows_mapping,
        security_law_exemptions_mapping,
        custom_id,
        tx_hash: hash,
    });

    console.log(
        `✅ | EquityCompensationIssuance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdEquityCompIssuance
    );
};

export const handleEquityCompensationExercise = async (exercise, issuerId, timestamp, hash) => {
    console.log("EquityCompensationExerciseCreated Event Emitted!", exercise);
    const { id, equity_comp_security_id, resulting_stock_security_id, quantity } = exercise;

    const _id = convertBytes16ToUUID(id);
    const _equity_comp_security_id = convertBytes16ToUUID(equity_comp_security_id);
    const chainDate = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _resulting_stock_security_id = convertBytes16ToUUID(resulting_stock_security_id);

    const dateToUse = chainDate;

    const createdExercise = await upsertEquityCompensationExerciseById(_id, {
        id: _id,
        date: dateToUse,
        equity_comp_security_id: _equity_comp_security_id,
        resulting_security_ids: [_resulting_stock_security_id],
        quantity: toDecimal(quantity).toString(),
        issuer: issuerId,
        is_onchain_synced: true,
        tx_hash: hash,
    });

    console.log(
        `✅ | EquityCompensationExercise confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdExercise
    );
};

// Note: consolidations are only coming as a helper from transfers
export const handleStockConsolidation = async (data, issuerId, timestamp) => {
    console.log("StockConsolidation Event Received!");
    const { security_ids, resulting_security_id } = data;

    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _id = uuid(); // TODO verify this.

    let result;

    // create new consolidation record
    result = await StockConsolidation.create({
        _id,
        security_ids: security_ids.map((id) => convertBytes16ToUUID(id)),
        resulting_security_id: convertBytes16ToUUID(resulting_security_id),
        date: dateOCF,
        issuer: issuerId,
        is_onchain_synced: true,
    });
    console.log("[CREATED] StockConsolidation", result);

    console.log(`✅ [CONFIRMED] StockConsolidation ${new Date(Date.now()).toLocaleDateString("en-US", options)}`);
};

export const handleStockPlanPoolAdjustment = async (data, issuerId, timestamp, hash) => {
    console.log("StockPlanPoolAdjustment Event Received!");
    console.log("data", data);
    const [id, stockPlanId, newSharesReserved] = data;

    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _id = convertBytes16ToUUID(id);
    let result;
    const exists = await StockPlanPoolAdjustment.findOne({ _id: _id });
    if (exists) {
        // update
        result = await StockPlanPoolAdjustment.findOneAndUpdate({ _id: _id }, { is_onchain_synced: true });
        console.log("[UPDATED] StockPlanPoolAdjustment", result);
    } else {
        // upsert
        result = await StockPlanPoolAdjustment.create({
            stock_plan_id: stockPlanId,
            shares_reserved: toDecimal(newSharesReserved).toString(),
            date: dateOCF,
            issuer: issuerId,
            is_onchain_synced: true,
            tx_hash: hash,
        });
        console.log("[CREATED] StockPlanPoolAdjustment", result);
    }
    console.log(`✅ [CONFIRMED] StockPlanPoolAdjustment ${new Date(Date.now()).toLocaleDateString("en-US", options)}`);
};

export const contractFuncs = new Map([
    ["StakeholderCreated", handleStakeholder],
    ["StockClassCreated", handleStockClass],
    ["StockPlanCreated", handleStockPlan],
]);

// DANGEROUS DANGEROUS DANGEROUS THIS HAS TO BE IN SAME ORDER AS TxHelper.sol:TxType Enum
export const txMapper = {
    1: [structs.IssuerAuthorizedSharesAdjustment, handleIssuerAuthorizedSharesAdjusted],
    2: [structs.StockClassAuthorizedSharesAdjustment, handleStockClassAuthorizedSharesAdjusted],
    3: [structs.StockAcceptance, handleStockAcceptance],
    4: [structs.StockCancellation, handleStockCancellation],
    5: [structs.StockIssuance, handleStockIssuance],
    6: [structs.StockReissuance, handleStockReissuance],
    7: [structs.StockRepurchase, handleStockRepurchase],
    8: [structs.StockRetraction, handleStockRetraction],
    9: [structs.StockTransfer, handleStockTransfer],
    10: [structs.ConvertibleIssuance, handleConvertibleIssuance],
    11: [structs.EquityCompensationIssuance, handleEquityCompensationIssuance],
    12: [structs.StockPlanPoolAdjustment, handleStockPlanPoolAdjustment],
    13: [structs.WarrantIssuance, handleWarrantIssuance],
    14: [structs.EquityCompensationExercise, handleEquityCompensationExercise],
    15: [structs.StockConsolidation, handleStockConsolidation],
};
// (idx => type name) derived from txMapper
export const txTypes = Object.fromEntries(
    // @ts-ignore
    Object.entries(txMapper).map(([i, [_, f]]) => [i, f.name.replace("handle", "")])
);
// (name => handler) derived from txMapper
export const txFuncs = Object.fromEntries(Object.entries(txMapper).map(([i, [_, f]]) => [txTypes[i], f]));
