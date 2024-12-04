import { convertBytes16ToUUID } from "../utils/convertUUID.js";
import { createHistoricalTransaction } from "../db/operations/create.js";
import { readFairmintDataBySecurityId, readFairmintDataByStakeholderId } from "../db/operations/read.js";
import {
    upsertStakeholderById,
    updateStockClassById,
    upsertStockTransferById,
    upsertStockCancellationById,
    upsertStockRetractionById,
    upsertStockReissuanceById,
    upsertStockRepurchaseById,
    upsertStockAcceptanceById,
    upsertStockClassAuthorizedSharesAdjustment,
    upsertIssuerAuthorizedSharesAdjustment,
    updateStockPlanById,
    upsertStockIssuanceBySecurityId,
    upsertConvertibleIssuanceBySecurityId,
    upsertWarrantIssuanceBySecurityId,
    upsertEquityCompensationIssuanceBySecurityId,
    upsertEquityCompensationExerciseBySecurityId,
} from "../db/operations/update.js";
import get from "lodash/get";
import { reflectSeries } from "../fairmint/reflectSeries.js";
import { toDecimal } from "../utils/convertToFixedPointDecimals.js";
import { SERIES_TYPE } from "../fairmint/enums.js";
import { reflectStakeholder } from "../fairmint/reflectStakeholder.js";
import { reflectInvestment } from "../fairmint/reflectInvestment.js";
import {
    IssuerAuthorizedSharesAdjustment,
    StockAcceptance,
    StockCancellation,
    StockClassAuthorizedSharesAdjustment,
    StockIssuance,
    StockReissuance,
    StockRepurchase,
    StockRetraction,
    StockTransfer,
    ConvertibleIssuance,
    WarrantIssuance,
    EquityCompensationIssuance,
    EquityCompensationExercise,
} from "./structs.js";
import { reflectGrant } from "../fairmint/reflectGrant.js";
import { reflectGrantExercise } from "../fairmint/reflectGrantExercise.js";

const isUUID = (value) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
};

const options = {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
};

// @dev, this file is where you would create the mapping for the "_mapping" fields.

export const handleStockIssuance = async (stock, issuerId, timestamp) => {
    console.log("StockIssuanceCreated Event Emitted!", stock);
    const { 
        stock_class_id, 
        share_price, 
        quantity, 
        stakeholder_id, 
        security_id, 
        stock_legend_ids_mapping, 
        custom_id,
        security_law_exemptions_mapping 
    } = stock;

    const _security_id = convertBytes16ToUUID(security_id);
    const fairmintData = await readFairmintDataBySecurityId(_security_id);
    const chainDate = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _stakeholder_id = convertBytes16ToUUID(stakeholder_id);

    // If we have fairmint data, get historical date
    const dateToUse = fairmintData && fairmintData._id ? get(fairmintData, "date", chainDate) : chainDate;

    const createdStockIssuance = await upsertStockIssuanceBySecurityId(_security_id, {
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
    });

    await createHistoricalTransaction({
        transaction: createdStockIssuance._id,
        issuer: issuerId,
        transactionType: "StockIssuance",
    });

    if (isUUID(get(fairmintData, "series_id")) && fairmintData && fairmintData._id) {
        const dollarAmount = Number(get(createdStockIssuance, "share_price.amount")) * Number(get(createdStockIssuance, "quantity"));

        const seriesCreatedResp = await reflectSeries({
            issuerId,
            series_id: get(fairmintData, "series_id"),
            stock_class_id: get(createdStockIssuance, "stock_class_id", null),
            stock_plan_id: get(createdStockIssuance, "stock_plan_id", null),
            series_name: get(fairmintData, "attributes.series_name"),
            series_type: SERIES_TYPE.SHARES,
            price_per_share: get(createdStockIssuance, "share_price.amount", null),
            date: dateToUse,
        });

        console.log("series created response ", seriesCreatedResp);

        const reflectedInvestmentResp = await reflectInvestment({
            security_id: _security_id,
            issuerId,
            stakeholder_id: _stakeholder_id,
            series_id: get(fairmintData, "series_id"),
            amount: dollarAmount,
            number_of_shares: get(createdStockIssuance, "quantity").toString(),
            date: dateToUse,
        });

        console.log("stock investment response:", reflectedInvestmentResp);
    }

    console.log(
        `✅ | StockIssuance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockIssuance
    );
};

export const handleStockTransfer = async (stock, issuerId) => {
    console.log(`Stock Transfer with quantity ${toDecimal(stock.quantity).toString()} received at `, new Date(Date.now()).toLocaleDateString());

    const id = convertBytes16ToUUID(stock.id);
    const quantity = toDecimal(stock.quantity).toString();
    const createdStockTransfer = await upsertStockTransferById(id, {
        _id: id,
        object_type: stock.object_type,
        quantity,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        consideration_text: stock.consideration_text,
        balance_security_id: convertBytes16ToUUID(stock.balance_security_id),
        resulting_security_ids: convertBytes16ToUUID(stock.resulting_security_ids),
        // OCP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    console.log("Stock Transfer reflected and validated off-chain", createdStockTransfer);

    await createHistoricalTransaction({
        transaction: createdStockTransfer._id,
        issuer: createdStockTransfer.issuer,
        transactionType: "StockTransfer",
    });

    console.log(
        `✅ | StockTransfer confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockTransfer
    );
};

export const handleStakeholder = async (id) => {
    try {
        console.log("StakeholderCreated Event Emitted!", id);
        const incomingStakeholderId = convertBytes16ToUUID(id);
        const stakeholder = await upsertStakeholderById(incomingStakeholderId, { is_onchain_synced: true });

        // fairmint data reflection
        const fairmintData = await readFairmintDataByStakeholderId(incomingStakeholderId);
        if (fairmintData && fairmintData._id) {
            await reflectStakeholder({ stakeholder, issuerId: stakeholder.issuer });
        }
    } catch (error) {
        throw Error("Error handing Stakeholder On Chain", error);
    }
};

export const handleStockClass = async (id) => {
    console.log("StockClassCreated Event Emitted!", id);
    const incomingStockClassId = convertBytes16ToUUID(id);
    const stockClass = await updateStockClassById(incomingStockClassId, { is_onchain_synced: true });
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

    await createHistoricalTransaction({
        transaction: createdStockCancellation._id,
        issuer: createdStockCancellation.issuer,
        transactionType: "StockCancellation",
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

    await createHistoricalTransaction({
        transaction: createdStockRetraction._id,
        issuer: createdStockRetraction.issuer,
        transactionType: "StockRetraction",
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

    await createHistoricalTransaction({
        transaction: createdStockReissuance._id,
        issuer: createdStockReissuance.issuer,
        transactionType: "StockReissuance",
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

    await createHistoricalTransaction({
        transaction: createdStockRepurchase._id,
        issuer: createdStockRepurchase.issuer,
        transactionType: "StockRepurchase",
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

    await createHistoricalTransaction({
        transaction: createdStockAcceptance._id,
        issuer: createdStockAcceptance.issuer,
        transactionType: "StockAcceptance",
    });
    console.log(
        `✅ | StockAcceptance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdStockAcceptance
    );
};

export const handleStockClassAuthorizedSharesAdjusted = async (stock, issuerId, timestamp) => {
    console.log("StockClassAuthorizedSharesAdjusted Event Emitted!", stock.id);
    const id = convertBytes16ToUUID(stock.id);
    console.log("stock price", stock.price);

    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];

    const upsert = await upsertStockClassAuthorizedSharesAdjustment(id, {
        _id: id,
        stock_class_id: convertBytes16ToUUID(stock.stock_class_id),
        object_type: stock.object_type,
        comments: stock.comments,
        security_id: convertBytes16ToUUID(stock.security_id),
        date: dateOCF,
        new_shares_authorized: toDecimal(stock.new_shares_authorized).toString(),
        board_approval_date: stock.board_approval_date,
        stockholder_approval_date: stock.stockholder_approval_date,

        // OCP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: upsert._id,
        issuer: issuerId,
        transactionType: "StockClassAuthorizedSharesAdjustment",
    });
    console.log(
        `✅ | StockClassAuthorizedSharesAdjusted confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        upsert
    );
};

export const handleIssuerAuthorizedSharesAdjusted = async (issuer, issuerId, timestamp) => {
    console.log("IssuerAuthorizedSharesAdjusted Event Emitted!", issuer.id);
    const id = convertBytes16ToUUID(issuer.id);
    console.log("stock price", issuer.price);

    const dateOCF = new Date(timestamp * 1000).toISOString().split("T")[0];

    const upsert = await upsertIssuerAuthorizedSharesAdjustment(id, {
        _id: id,
        object_type: issuer.object_type,
        comments: issuer.comments,
        issuer_id: convertBytes16ToUUID(issuer.security_id),
        date: dateOCF,
        new_shares_authorized: toDecimal(issuer.new_shares_authorized).toString(),
        board_approval_date: issuer.board_approval_date,
        stockholder_approval_date: issuer.stockholder_approval_date,

        // OCP Native Fields
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: upsert._id,
        issuer: issuerId,
        transactionType: "IssuerAuthorizedSharesAdjustment",
    });
    console.log(
        `✅ | IssuerAuthorizedSharesAdjusted confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        upsert
    );
};

export const handleStockPlan = async (id, sharesReserved) => {
    console.log("StockPlanCreated Event Emitted!", id);
    const incomingStockPlanId = convertBytes16ToUUID(id);
    const stockPlan = await updateStockPlanById(incomingStockPlanId, {
        initial_shares_reserved: toDecimal(sharesReserved).toString(),
        is_onchain_synced: true,
    });
    console.log("✅ | StockPlan confirmation onchain ", stockPlan);
};


export const handleConvertibleIssuance = async (convertible, issuerId, timestamp) => {
    console.log("ConvertibleIssuanceCreated Event Emitted!", convertible);
    const { 
        security_id, 
        stakeholder_id, 
        investment_amount,
        convertible_type,
        conversion_triggers_mapping,
        seniority,
        security_law_exemptions_mapping,
        custom_id 
    } = convertible;
    const _security_id = convertBytes16ToUUID(security_id);
    const fairmintData = await readFairmintDataBySecurityId(_security_id);
    const chainDate = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _stakeholder_id = convertBytes16ToUUID(stakeholder_id);

    // If we have fairmint data, get historical date
    const dateToUse = fairmintData && fairmintData._id ? get(fairmintData, "date", chainDate) : chainDate;

    const createdConvertibleIssuance = await upsertConvertibleIssuanceBySecurityId(_security_id, {
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
        seniority,
        custom_id
    });

    await createHistoricalTransaction({
        transaction: createdConvertibleIssuance._id,
        issuer: issuerId,
        transactionType: "ConvertibleIssuance",
    });

    if (fairmintData && fairmintData._id) {
        const seriesCreatedResp = await reflectSeries({
            issuerId,
            series_id: fairmintData.series_id,
            series_name: get(fairmintData, "attributes.series_name"),
            series_type: SERIES_TYPE.FUNDRAISING,
            date: dateToUse,
        });

        console.log("Series created response:", seriesCreatedResp);

        const reflectedInvestmentResp = await reflectInvestment({
            security_id: _security_id,
            issuerId,
            stakeholder_id: _stakeholder_id,
            series_id: fairmintData.series_id,
            amount: toDecimal(investment_amount).toString(),
            date: dateToUse,
        });

        console.log("Convertible investment response:", reflectedInvestmentResp);
    }

    console.log(
        `✅ | ConvertibleIssuance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdConvertibleIssuance
    );
};

export const handleWarrantIssuance = async (warrant, issuerId, timestamp) => {
    console.log("WarrantIssuanceCreated Event Emitted!", warrant);
    const { stakeholder_id, quantity, security_id } = warrant;

    const _security_id = convertBytes16ToUUID(security_id);
    const fairmintData = await readFairmintDataBySecurityId(_security_id);
    console.log("Fairmint data:", fairmintData);

    const chainDate = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _stakeholder_id = convertBytes16ToUUID(stakeholder_id);

    const createdWarrantIssuance = await upsertWarrantIssuanceBySecurityId(_security_id, {
        date: chainDate,
        quantity: toDecimal(quantity).toString(),
        stakeholder_id: _stakeholder_id,
        security_id: _security_id,
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: createdWarrantIssuance._id,
        issuer: issuerId,
        transactionType: "WarrantIssuance",
    });

    if (fairmintData && fairmintData._id) {
        // Query the warrant issuance to get additional data like purchase_price, if it's reflection data then it will have `purchase_price` field off chain
        const dollarAmount = Number(get(createdWarrantIssuance, "purchase_price.amount", 1));
        const seriesCreatedResp = await reflectSeries({
            issuerId,
            series_id: fairmintData.series_id,
            series_name: get(fairmintData, "attributes.series_name"),
            series_type: SERIES_TYPE.WARRANT,
            date: chainDate,
        });

        console.log("Series created response:", seriesCreatedResp);

        const reflectedInvestmentResp = await reflectInvestment({
            security_id: _security_id,
            issuerId,
            stakeholder_id: _stakeholder_id,
            series_id: fairmintData.series_id,
            amount: dollarAmount,
            date: chainDate,
        });

        console.log("Warrant investment response:", reflectedInvestmentResp);
    }

    console.log(
        `✅ | WarrantIssuance confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdWarrantIssuance
    );
};

export const handleEquityCompensationIssuance = async (equity, issuerId, timestamp) => {
    console.log("EquityCompensationIssuanceCreated Event Emitted!", equity);
    const { stakeholder_id, stock_class_id, stock_plan_id, quantity, security_id } = equity;

    const _security_id = convertBytes16ToUUID(security_id);
    const fairmintData = await readFairmintDataBySecurityId(_security_id);
    const chainDate = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _stakeholder_id = convertBytes16ToUUID(stakeholder_id);

    // If we have fairmint data, get historical date
    const dateToUse = fairmintData && fairmintData._id ? get(fairmintData, "date", chainDate) : chainDate;

    const createdEquityCompIssuance = await upsertEquityCompensationIssuanceBySecurityId(_security_id, {
        date: dateToUse,
        stakeholder_id: _stakeholder_id,
        stock_class_id: convertBytes16ToUUID(stock_class_id),
        stock_plan_id: convertBytes16ToUUID(stock_plan_id),
        quantity: toDecimal(quantity).toString(),
        security_id: _security_id,
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: createdEquityCompIssuance._id,
        issuer: issuerId,
        transactionType: "EquityCompensationIssuance",
    });

    if (fairmintData && fairmintData._id) {
        const seriesCreatedResp = await reflectSeries({
            issuerId,
            series_id: get(fairmintData, "series_id"),
            series_name: get(fairmintData, "attributes.series_name"),
            stock_class_id: get(createdEquityCompIssuance, "stock_class_id"),
            stock_plan_id: get(createdEquityCompIssuance, "stock_plan_id"),
            series_type: SERIES_TYPE.GRANT,
            date: dateToUse,
        });

        console.log("Series created response:", seriesCreatedResp);

        const reflectGrantResponse = await reflectGrant({
            security_id: get(createdEquityCompIssuance, "security_id"),
            issuerId,
            stakeholder_id: _stakeholder_id,
            series_id: get(fairmintData, "series_id"),
            quantity: get(createdEquityCompIssuance, "quantity", "0"),
            exercise_price: get(createdEquityCompIssuance, "exercise_price.amount", "0"),
            compensation_type: get(createdEquityCompIssuance, "compensation_type", ""),
            option_grant_type: get(createdEquityCompIssuance, "option_grant_type", ""),
            security_law_exemptions: get(createdEquityCompIssuance, "security_law_exemptions", []),
            expiration_date: get(createdEquityCompIssuance, "expiration_date", null),
            termination_exercise_windows: get(createdEquityCompIssuance, "termination_exercise_windows", []),
            vestings: get(createdEquityCompIssuance, "vestings", []),
            vesting_terms_id: get(createdEquityCompIssuance, "vesting_terms_id", null),
            date: dateToUse,
        });

        console.log("Grant response:", reflectGrantResponse);
    }
};

export const handleEquityCompensationExercise = async (exercise, issuerId, timestamp) => {
    console.log("EquityCompensationExerciseCreated Event Emitted!", exercise);
    const { equity_comp_security_id, resulting_stock_security_id, quantity } = exercise;

    const _equity_comp_security_id = convertBytes16ToUUID(equity_comp_security_id);
    const fairmintData = await readFairmintDataBySecurityId(_equity_comp_security_id);
    const chainDate = new Date(timestamp * 1000).toISOString().split("T")[0];
    const _resulting_stock_security_id = convertBytes16ToUUID(resulting_stock_security_id);

    // If we have fairmint data, get historical date
    const dateToUse = fairmintData && fairmintData._id ? get(fairmintData, "date", chainDate) : chainDate;

    const createdExercise = await upsertEquityCompensationExerciseBySecurityId(_equity_comp_security_id, {
        date: dateToUse,
        equity_comp_security_id: _equity_comp_security_id,
        resulting_security_ids: [_resulting_stock_security_id],
        quantity: toDecimal(quantity).toString(),
        issuer: issuerId,
        is_onchain_synced: true,
    });

    await createHistoricalTransaction({
        transaction: createdExercise._id,
        issuer: issuerId,
        transactionType: "EquityCompensationExercise",
    });

    if (fairmintData && fairmintData._id) {
        const reflectedExercise = await reflectGrantExercise({
            security_id: _equity_comp_security_id,
            resulting_security_ids: [_resulting_stock_security_id],
            issuerId,
            quantity: toDecimal(quantity).toString(),
            date: dateToUse,
        });

        console.log("Exercise reflected response:", reflectedExercise);
    }

    console.log(
        `✅ | EquityCompensationExercise confirmation onchain with date ${new Date(Date.now()).toLocaleDateString("en-US", options)}`,
        createdExercise
    );
};

export const contractFuncs = new Map([
    ["StakeholderCreated", handleStakeholder],
    ["StockClassCreated", handleStockClass],
    ["StockPlanCreated", handleStockPlan],
]);

// DANGEROUS DANGEROUS DANGEROUS THIS HAS TO BE IN SAME ORDER AS DiamondTxHelper:TxType Enum
export const txMapper = {
    1: [IssuerAuthorizedSharesAdjustment, handleIssuerAuthorizedSharesAdjusted],
    2: [StockClassAuthorizedSharesAdjustment, handleStockClassAuthorizedSharesAdjusted],
    3: [StockAcceptance, handleStockAcceptance],
    4: [StockCancellation, handleStockCancellation],
    5: [StockIssuance, handleStockIssuance],
    6: [StockReissuance, handleStockReissuance],
    7: [StockRepurchase, handleStockRepurchase],
    8: [StockRetraction, handleStockRetraction],
    9: [StockTransfer, handleStockTransfer],
    10: [ConvertibleIssuance, handleConvertibleIssuance],
    11: [EquityCompensationIssuance, handleEquityCompensationIssuance],
    // 12: [null, /*TODO: StockPlanPoolAdjustment, handleStockPlanPoolAdjustment*/ null],
    13: [WarrantIssuance, handleWarrantIssuance],
    14: [EquityCompensationExercise, handleEquityCompensationExercise],
};
// (idx => type name) derived from txMapper
export const txTypes = Object.fromEntries(
    // @ts-ignore
    Object.entries(txMapper).map(([i, [_, f]]) => [i, f.name.replace("handle", "")])
);
// (name => handler) derived from txMapper
export const txFuncs = Object.fromEntries(Object.entries(txMapper).map(([i, [_, f]]) => [txTypes[i], f]));
