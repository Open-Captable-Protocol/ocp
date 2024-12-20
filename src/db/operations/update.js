import Factory from "../objects/Factory.js";
import Issuer from "../objects/Issuer.js";
import Stakeholder from "../objects/Stakeholder.js";
import StockClass from "../objects/StockClass.js";
import StockLegendTemplate from "../objects/StockLegendTemplate.js";
import StockPlan from "../objects/StockPlan.js";
import Valuation from "../objects/Valuation.js";
import VestingTerms from "../objects/VestingTerms.js";
import StockAcceptance from "../objects/transactions/acceptance/StockAcceptance.js";
import WarrantIssuance from "../objects/transactions/issuance/WarrantIssuance.js";
import EquityCompensationIssuance from "../objects/transactions/issuance/EquityCompensationIssuance.js";
import EquityCompensationExercise from "../objects/transactions/exercise/EquityCompensationExercise.js";
import IssuerAuthorizedSharesAdjustment from "../objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment.js";
import StockClassAuthorizedSharesAdjustment from "../objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment.js";
import StockCancellation from "../objects/transactions/cancellation/StockCancellation.js";
import StockIssuance from "../objects/transactions/issuance/StockIssuance.js";
import StockReissuance from "../objects/transactions/reissuance/StockReissuance.js";
import StockRepurchase from "../objects/transactions/repurchase/StockRepurchase.js";
import StockRetraction from "../objects/transactions/retraction/StockRetraction.js";
import StockTransfer from "../objects/transactions/transfer/StockTransfer.js";
import ConvertibleIssuance from "../objects/transactions/issuance/ConvertibleIssuance.js";
import Fairmint from "../objects/Fairmint.js";
import { findByIdAndUpdate, findOne, findBySecurityIdAndUpdate } from "./atomic.ts";
import { createFactory } from "./create.js";
import get from "lodash/get";
import { v4 as uuid } from "uuid";

export const web3WaitTime = 5000;

export const updateIssuerById = async (id, updatedData) => {
    return await findByIdAndUpdate(Issuer, id, updatedData, { new: true });
};

export const updateStakeholderById = async (id, updatedData) => {
    return await findByIdAndUpdate(Stakeholder, id, updatedData, { new: true });
};

export const upsertStakeholderById = async (id, updatedData) => {
    return await findByIdAndUpdate(Stakeholder, id, updatedData, { new: true, upsert: true });
};

export const updateStockClassById = async (id, updatedData) => {
    return await findByIdAndUpdate(StockClass, id, updatedData, { new: true });
};

export const updateStockLegendTemplateById = async (id, updatedData) => {
    return await findByIdAndUpdate(StockLegendTemplate, id, updatedData, { new: true });
};

export const updateStockPlanById = async (id, update) => {
    const stockPlan = await StockPlan.findByIdAndUpdate(id, { $set: update }, { new: true });

    if (!stockPlan) {
        throw new Error(`Stock Plan with id ${id} not found`);
    }

    return stockPlan;
};

export const updateValuationById = async (id, updatedData) => {
    return await findByIdAndUpdate(Valuation, id, updatedData, { new: true });
};

export const updateVestingTermsById = async (id, updatedData) => {
    return await findByIdAndUpdate(VestingTerms, id, updatedData, { new: true });
};

export const upsertStockIssuanceBySecurityId = async (securityId, updatedData) => {
    return await findBySecurityIdAndUpdate(StockIssuance, securityId, updatedData, { new: true, upsert: true });
};

export const upsertConvertibleIssuanceBySecurityId = async (securityId, updatedData) => {
    return await findBySecurityIdAndUpdate(ConvertibleIssuance, securityId, updatedData, { new: true, upsert: true });
};

export const upsertConvertibleIssuanceById = async (id, updatedData) => {
    return await findByIdAndUpdate(ConvertibleIssuance, id, updatedData, { new: true, upsert: true });
};

export const upsertStockIssuanceById = async (id, updatedData) => {
    return await findByIdAndUpdate(StockIssuance, id, updatedData, { new: true, upsert: true });
};

export const upsertStockTransferById = async (id, updatedData) => {
    return await findByIdAndUpdate(StockTransfer, id, updatedData, { new: true, upsert: true });
};

export const upsertStockCancellationById = async (id, updatedData) => {
    return await findByIdAndUpdate(StockCancellation, id, updatedData, { new: true, upsert: true });
};

export const upsertStockRetractionById = async (id, updatedData) => {
    return await findByIdAndUpdate(StockRetraction, id, updatedData, { new: true, upsert: true });
};

export const upsertStockReissuanceById = async (id, updatedData) => {
    return await findByIdAndUpdate(StockReissuance, id, updatedData, { new: true, upsert: true });
};

export const upsertStockRepurchaseById = async (id, updatedData) => {
    return await findByIdAndUpdate(StockRepurchase, id, updatedData, { new: true, upsert: true });
};

export const upsertStockAcceptanceById = async (id, updatedData) => {
    return await findByIdAndUpdate(StockAcceptance, id, updatedData, { new: true, upsert: true });
};

export const upsertStockClassAuthorizedSharesAdjustment = async (id, updatedData) => {
    return await findByIdAndUpdate(StockClassAuthorizedSharesAdjustment, id, updatedData, { new: true, upsert: true });
};

export const upsertIssuerAuthorizedSharesAdjustment = async (id, updatedData) => {
    return await findByIdAndUpdate(IssuerAuthorizedSharesAdjustment, id, updatedData, { new: true, upsert: true });
};

export const upsertFactory = async (updatedData) => {
    // For now, we only allow a single record in the database
    const existing = await findOne(Factory);
    if (existing) {
        return await findByIdAndUpdate(Factory, existing._id, updatedData, { new: true });
    }
    return await createFactory(updatedData);
};

export const upsertFairmintData = async (id, updatedData = {}) => {
    const existing = await findOne(Fairmint, { _id: id });
    if (existing && existing._id) {
        updatedData.attributes = {
            ...get(existing, "attributes", {}),
            ...get(updatedData, "attributes", {}),
        };
    }
    return await findByIdAndUpdate(Fairmint, get(existing, "_id"), updatedData, { new: true, upsert: true });
};

export const upsertFairmintDataBySecurityId = async (security_id, updatedData = {}) => {
    const existing = await findOne(Fairmint, { security_id });
    if (existing && existing._id) {
        updatedData.attributes = {
            ...get(existing, "attributes", {}),
            ...get(updatedData, "attributes", {}),
        };
    }
    return await findByIdAndUpdate(Fairmint, get(existing, "_id", uuid()), updatedData, { new: true, upsert: true });
};

export const upsertFairmintDataByStakeholderId = async (stakeholder_id, updatedData = {}) => {
    const existing = await findOne(Fairmint, { stakeholder_id });
    if (existing && existing._id) {
        updatedData.attributes = {
            ...get(existing, "attributes", {}),
            ...get(updatedData, "attributes", {}),
        };
    }
    return await findByIdAndUpdate(Fairmint, get(existing, "_id", uuid()), updatedData, { new: true, upsert: true });
};

export const upsertWarrantIssuanceBySecurityId = async (securityId, updatedData) => {
    return await findBySecurityIdAndUpdate(WarrantIssuance, securityId, updatedData, { new: true, upsert: true });
};

export const upsertWarrantIssuanceById = async (id, updatedData) => {
    return await findByIdAndUpdate(WarrantIssuance, id, updatedData, { new: true, upsert: true });
};

export const upsertEquityCompensationIssuanceBySecurityId = async (securityId, updatedData) => {
    return await findBySecurityIdAndUpdate(EquityCompensationIssuance, securityId, updatedData, { new: true, upsert: true });
};

export const upsertEquityCompensationIssuanceById = async (id, updatedData) => {
    return await findByIdAndUpdate(EquityCompensationIssuance, id, updatedData, { new: true, upsert: true });
};

export const upsertEquityCompensationExerciseBySecurityId = async (securityId, updatedData) => {
    return await findBySecurityIdAndUpdate(EquityCompensationExercise, securityId, updatedData, { new: true, upsert: true });
};

export const upsertEquityCompensationExerciseById = async (id, updatedData) => {
    return await findByIdAndUpdate(EquityCompensationExercise, id, updatedData, { new: true, upsert: true });
};
