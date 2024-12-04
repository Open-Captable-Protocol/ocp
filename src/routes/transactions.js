import { Router } from "express";
import { v4 as uuid } from "uuid";
import Joi from "joi";

import stockAcceptanceSchema from "../../ocf/schema/objects/transactions/acceptance/StockAcceptance.schema.json";
import issuerAuthorizedSharesAdjustmentSchema from "../../ocf/schema/objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment.schema.json";
import stockClassAuthorizedSharesAdjustmentSchema from "../../ocf/schema/objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment.schema.json";
import stockCancellationSchema from "../../ocf/schema/objects/transactions/cancellation/StockCancellation.schema.json";
import warrantIssuanceSchema from "../../ocf/schema/objects/transactions/issuance/WarrantIssuance.schema.json";
import convertibleIssuanceSchema from "../../ocf/schema/objects/transactions/issuance/ConvertibleIssuance.schema.json";
import equityCompensationIssuanceSchema from "../../ocf/schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json";
import stockIssuanceSchema from "../../ocf/schema/objects/transactions/issuance/StockIssuance.schema.json";
import stockReissuanceSchema from "../../ocf/schema/objects/transactions/reissuance/StockReissuance.schema.json";
import stockRepurchaseSchema from "../../ocf/schema/objects/transactions/repurchase/StockRepurchase.schema.json";
import stockRetractionSchema from "../../ocf/schema/objects/transactions/retraction/StockRetraction.schema.json";
import equityCompensationExerciseSchema from "../../ocf/schema/objects/transactions/exercise/EquityCompensationExercise.schema.json";
import stockPlanPoolAdjustmentSchema from "../../ocf/schema/objects/transactions/adjustment/StockPlanPoolAdjustment.schema.json";

import { convertAndAdjustIssuerAuthorizedSharesOnChain } from "../controllers/issuerController.js";
import { convertAndAdjustStockClassAuthorizedSharesOnchain } from "../controllers/stockClassController.js";
import { convertAndCreateAcceptanceStockOnchain } from "../controllers/transactions/acceptanceController.js";
import { convertAndCreateCancellationStockOnchain } from "../controllers/transactions/cancellationController.js";
import {
    convertAndCreateIssuanceConvertibleOnchain,
    convertAndCreateIssuanceEquityCompensationOnchain,
    convertAndCreateIssuanceStockOnchain,
    convertAndCreateIssuanceWarrantOnchain,
} from "../controllers/transactions/issuanceController.js";
import { convertAndCreateReissuanceStockOnchain } from "../controllers/transactions/reissuanceController.js";
import { convertAndCreateRepurchaseStockOnchain } from "../controllers/transactions/repurchaseController.js";
import { convertAndCreateRetractionStockOnchain } from "../controllers/transactions/retractionController.js";
import { convertAndCreateTransferStockOnchain } from "../controllers/transactions/transferController.js";
import {
    createConvertibleIssuance,
    createEquityCompensationIssuance,
    createWarrantIssuance,
    createEquityCompensationExercise,
    createStockIssuance,
    createFairmintData,
} from "../db/operations/create.js";

import {
    readStockPlanById,
    readIssuerById,
    readStakeholderById,
    readStockClassById,
    readConvertibleIssuanceBySecurityId,
    readStockIssuanceBySecurityId,
    readEquityCompensationIssuanceBySecurityId,
    readEquityCompensationExerciseBySecurityId,
    readWarrantIssuanceBySecurityId,
} from "../db/operations/read.js";
import { createStockPlanPoolAdjustment } from "../db/operations/create.js";
import validateInputAgainstOCF from "../utils/validateInputAgainstSchema.js";
import { getJoiErrorMessage } from "../chain-operations/utils.js";
import get from "lodash/get";
import { checkStakeholderExistsOnFairmint } from "../fairmint/checkStakeholder.js";
import { upsertFairmintDataBySecurityId } from "../db/operations/update";
import { convertAndCreateEquityCompensationExerciseOnchain } from "../controllers/transactions/exerciseController";

const transactions = Router();

transactions.post("/issuance/stock", async (req, res) => {
    const { contract } = req;
    const { issuerId, data } = req.body;

    try {
        await readIssuerById(issuerId);
        const incomingStockIssuance = {
            id: uuid(), // for OCF Validation
            security_id: uuid(), // for OCF Validation
            date: new Date().toISOString().slice(0, 10), // for OCF Validation
            object_type: "TX_STOCK_ISSUANCE",
            ...data,
        };
        await validateInputAgainstOCF(incomingStockIssuance, stockIssuanceSchema);

        const stockExists = await readStockIssuanceBySecurityId(incomingStockIssuance.security_id);
        if (stockExists && stockExists._id) {
            return res.status(200).send({
                message: "Stock Issuance Already Exists",
                stockIssuance: stockExists,
            });
        }

        const stockIssuance = await createStockIssuance({ ...incomingStockIssuance, issuer: issuerId });

        await convertAndCreateIssuanceStockOnchain(contract, {
            security_id: incomingStockIssuance.security_id,
            stock_class_id: incomingStockIssuance.stock_class_id,
            stakeholder_id: incomingStockIssuance.stakeholder_id,
            quantity: incomingStockIssuance.quantity,
            share_price: incomingStockIssuance.share_price,
            stock_legend_ids_mapping: incomingStockIssuance.stock_legend_ids_mapping,
            custom_id: incomingStockIssuance.custom_id || ""
        });

        res.status(200).send({ stockIssuance });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/issuance/stock-fairmint-reflection", async (req, res) => {
    const { contract } = req;
    const { issuerId } = req.body;

    /*
    We need new information to pass to Fairmint, like series name
    */
    const schema = Joi.object({
        issuerId: Joi.string().uuid().required(),
        series_id: Joi.string().uuid().required(),
        data: Joi.object().required(),
        series_name: Joi.string().required(),
    });

    const { error, value: payload } = schema.validate(req.body);

    if (error) {
        return res.status(400).send({
            error: getJoiErrorMessage(error),
        });
    }

    try {
        await readIssuerById(issuerId);

        const incomingStockIssuance = {
            id: uuid(), // for OCF Validation
            security_id: uuid(), // for OCF Validation
            date: new Date().toISOString().slice(0, 10), // for OCF Validation
            object_type: "TX_STOCK_ISSUANCE",
            ...payload.data,
        };

        await validateInputAgainstOCF(incomingStockIssuance, stockIssuanceSchema);

        const stakeholder = await readStakeholderById(incomingStockIssuance.stakeholder_id);
        const stockClass = await readStockClassById(incomingStockIssuance.stock_class_id);

        // check if the stakeholder exists on OCP
        if (!stakeholder || !stakeholder._id) {
            return res.status(404).send({ error: "Stakeholder not found on OCP" });
        }

        if (!stockClass || !stockClass._id) {
            return res.status(404).send({ error: "Stock class not found on OCP" });
        }

        await checkStakeholderExistsOnFairmint({ stakeholder_id: stakeholder._id, portal_id: issuerId });

        // TODO use createFairmintData instead
        await upsertFairmintDataBySecurityId(incomingStockIssuance.security_id, {
            security_id: incomingStockIssuance.security_id,
            series_id: payload.series_id,
            attributes: {
                series_name: payload.series_name,
            },
        });

        // Create the stock issuance in the DB
        const stockIssuance = await createStockIssuance({ ...incomingStockIssuance, issuer: issuerId });

        await convertAndCreateIssuanceStockOnchain(contract, {
            security_id: incomingStockIssuance.security_id,
            stock_class_id: incomingStockIssuance.stock_class_id,
            stakeholder_id: incomingStockIssuance.stakeholder_id,
            quantity: incomingStockIssuance.quantity,
            share_price: incomingStockIssuance.share_price,
        });

        res.status(200).send({ stockIssuance });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/transfer/stock", async (req, res) => {
    const { contract } = req;
    const { issuerId, data } = req.body;

    try {
        await readIssuerById(issuerId);

        // @dev: Transfer Validation is not possible through schema because it validates that the transfer has occurred,at this stage it has not yet.
        await convertAndCreateTransferStockOnchain(contract, data);

        res.status(200).send("success");
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/cancel/stock", async (req, res) => {
    const { contract } = req;
    const { issuerId, data } = req.body;

    try {
        await readIssuerById(issuerId);

        const { stakeholderId, stockClassId } = data;
        console.log({ data });
        const incomingStockCancellation = {
            id: uuid(),
            security_id: uuid(),
            date: new Date().toISOString().slice(0, 10),
            object_type: "TX_STOCK_CANCELLATION",
            ...data,
        };
        delete incomingStockCancellation.stakeholderId;
        delete incomingStockCancellation.stockClassId;

        // NOTE: schema validation does not include stakeholder, stockClassId, however these properties are needed on to be passed on chain

        await validateInputAgainstOCF(incomingStockCancellation, stockCancellationSchema);

        await convertAndCreateCancellationStockOnchain(contract, {
            ...incomingStockCancellation,
            stakeholderId,
            stockClassId,
        });

        res.status(200).send({ stockCancellation: incomingStockCancellation });
    } catch (error) {
        console.error(`error: ${error.stack}`);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/retract/stock", async (req, res) => {
    const { contract } = req;
    const { data } = req.body;

    try {
        const { stakeholderId, stockClassId } = data;
        const incomingStockRetraction = {
            id: uuid(), // placeholder
            date: new Date().toISOString().slice(0, 10),
            object_type: "TX_STOCK_RETRACTION",
            ...data,
        };

        delete incomingStockRetraction.stakeholderId;
        delete incomingStockRetraction.stockClassId;

        // NOTE: schema validation does not include stakeholder, stockClassId, however these properties are needed on to be passed on chain
        await validateInputAgainstOCF(incomingStockRetraction, stockRetractionSchema);

        await convertAndCreateRetractionStockOnchain(contract, {
            ...incomingStockRetraction,
            stakeholderId,
            stockClassId,
        });

        res.status(200).send({ stockRetraction: incomingStockRetraction });
    } catch (error) {
        console.error(`error: ${error.stack}`);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/reissue/stock", async (req, res) => {
    const { contract } = req;
    const { data } = req.body;

    try {
        const { stakeholderId, stockClassId } = data;
        const incomingStockReissuance = {
            id: uuid(), // placeholder
            date: new Date().toISOString().slice(0, 10),
            object_type: "TX_STOCK_REISSUANCE",
            ...data,
        };

        delete incomingStockReissuance.stakeholderId;
        delete incomingStockReissuance.stockClassId;

        // NOTE: schema validation does not include stakeholder, stockClassId, however these properties are needed on to be passed on chain
        await validateInputAgainstOCF(incomingStockReissuance, stockReissuanceSchema);

        await convertAndCreateReissuanceStockOnchain(contract, {
            ...incomingStockReissuance,
            stakeholderId,
            stockClassId,
        });

        res.status(200).send({ stockReissuance: incomingStockReissuance });
    } catch (error) {
        console.error(`error: ${error.stack}`);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/repurchase/stock", async (req, res) => {
    const { contract } = req;
    const { data } = req.body;

    try {
        const { stakeholderId, stockClassId } = data;
        const incomingStockRepurchase = {
            id: uuid(), // placeholder
            date: new Date().toISOString().slice(0, 10),
            object_type: "TX_STOCK_REPURCHASE",
            ...data,
        };

        delete incomingStockRepurchase.stakeholderId;
        delete incomingStockRepurchase.stockClassId;

        // NOTE: schema validation does not include stakeholder, stockClassId, however these properties are needed on to be passed on chain
        await validateInputAgainstOCF(incomingStockRepurchase, stockRepurchaseSchema);

        await convertAndCreateRepurchaseStockOnchain(contract, {
            ...incomingStockRepurchase,
            stakeholderId,
            stockClassId,
        });

        res.status(200).send({ stockRepurchase: incomingStockRepurchase });
    } catch (error) {
        console.error(`error: ${error.stack}`);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/accept/stock", async (req, res) => {
    const { contract } = req;
    const { data } = req.body;

    try {
        const { stakeholderId, stockClassId } = data;
        const incomingStockAcceptance = {
            id: uuid(), // placeholder
            date: new Date().toISOString().slice(0, 10),
            object_type: "TX_STOCK_ACCEPTANCE",
            ...data,
        };

        delete incomingStockAcceptance.stakeholderId;
        delete incomingStockAcceptance.stockClassId;

        // NOTE: schema validation does not include stakeholder, stockClassId, however these properties are needed on to be passed on chain
        await validateInputAgainstOCF(incomingStockAcceptance, stockAcceptanceSchema);

        await convertAndCreateAcceptanceStockOnchain(contract, {
            ...incomingStockAcceptance,
            stakeholderId,
            stockClassId,
        });

        res.status(200).send({ stockAcceptance: incomingStockAcceptance });
    } catch (error) {
        console.error(`error: ${error.stack}`);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/adjust/issuer/authorized-shares", async (req, res) => {
    const { contract } = req;
    const { data, issuerId } = req.body;

    try {
        await readIssuerById(issuerId);
        // OCF doesn't allow extra fields in their validation
        const issuerAuthorizedSharesAdj = {
            id: uuid(),
            date: new Date().toISOString().slice(0, 10),
            object_type: "TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT",
            issuer_id: issuerId,
            ...data,
        };

        await validateInputAgainstOCF(issuerAuthorizedSharesAdj, issuerAuthorizedSharesAdjustmentSchema);

        await convertAndAdjustIssuerAuthorizedSharesOnChain(contract, issuerAuthorizedSharesAdj);

        res.status(200).send({ issuerAuthorizedSharesAdj });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/adjust/stock-class/authorized-shares", async (req, res) => {
    const { contract } = req;
    const { data, issuerId } = req.body;

    try {
        await readIssuerById(issuerId);
        const stockClassAuthorizedSharesAdjustment = {
            id: uuid(), // placeholder
            date: new Date().toISOString().slice(0, 10),
            object_type: "TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT",
            ...data,
        };

        console.log("stockClassAuthorizedSharesAdjustment", stockClassAuthorizedSharesAdjustment);

        // NOTE: schema validation does not include stakeholder, stockClassId, however these properties are needed on to be passed on chain
        await validateInputAgainstOCF(stockClassAuthorizedSharesAdjustment, stockClassAuthorizedSharesAdjustmentSchema);

        const stockClass = await readStockClassById(stockClassAuthorizedSharesAdjustment.stock_class_id);

        if (!stockClass || !stockClass._id) {
            return res.status(404).send({ error: "Stock class not found on OCP" });
        }

        await convertAndAdjustStockClassAuthorizedSharesOnchain(contract, {
            ...stockClassAuthorizedSharesAdjustment,
        });

        res.status(200).send({ stockClassAdjustment: stockClassAuthorizedSharesAdjustment });
    } catch (error) {
        console.error(`error: ${error.stack}`);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/adjust/stock-plan-pool", async (req, res) => {
    // const { contract } = req;
    const { data, issuerId } = req.body;

    try {
        await readIssuerById(issuerId);
        const stockPlanPoolAdjustment = {
            id: uuid(), // placeholder
            date: new Date().toISOString().slice(0, 10),
            object_type: "TX_STOCK_PLAN_POOL_ADJUSTMENT",
            ...data,
        };

        console.log("stockPlanPoolAdjustment", stockPlanPoolAdjustment);

        // NOTE: schema validation does not include stakeholder, stockClassId, however these properties are needed on to be passed on chain
        await validateInputAgainstOCF(stockPlanPoolAdjustment, stockPlanPoolAdjustmentSchema);

        const stockPlan = await readStockPlanById(stockPlanPoolAdjustment.stock_plan_id);

        if (!stockPlan || !stockPlan._id) {
            return res.status(404).send({ error: "Stock plan not found on OCP" });
        }

        // TODO: implement Chain OP

        await createStockPlanPoolAdjustment({
            ...stockPlanPoolAdjustment,
            issuer: issuerId,
        });

        res.status(200).send({ stockPlanAdjustment: stockPlanPoolAdjustment });
    } catch (error) {
        console.error(`error: ${error.stack}`);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/issuance/equity-compensation", async (req, res) => {
    const { contract } = req;
    const { issuerId, data } = req.body;

    try {
        // ensuring issuer exists
        await readIssuerById(issuerId);

        const incomingEquityCompensationIssuance = {
            id: uuid(), // for OCF Validation
            security_id: uuid(), // for OCF Validation,
            date: new Date().toISOString().slice(0, 10), // for OCF Validation
            object_type: "TX_EQUITY_COMPENSATION_ISSUANCE",
            ...data,
        };
        // Enforce data.stock_class_id and data.stock_plan_id are present
        if (!get(incomingEquityCompensationIssuance, "stock_class_id")) {
            return res.status(400).send({ error: "Stock class id is required" });
        }
        if (!get(incomingEquityCompensationIssuance, "stock_plan_id")) {
            return res.status(400).send({ error: "Stock plan id is required" });
        }

        await validateInputAgainstOCF(incomingEquityCompensationIssuance, equityCompensationIssuanceSchema);

        const stock_class_id = get(incomingEquityCompensationIssuance, "stock_class_id");
        if (!stock_class_id) {
            return res.status(400).send({ error: "Stock class id is required" });
        }

        const stockClass = await readStockClassById(stock_class_id);
        if (!stockClass || !stockClass._id) {
            return res.status(404).send({ error: "Stock class not found on OCP" });
        }

        // Check if equity compensation issuance exists
        const equityExists = await readEquityCompensationIssuanceBySecurityId(incomingEquityCompensationIssuance.security_id);
        if (equityExists && equityExists._id) {
            return res.status(200).send({
                message: "Equity Compensation Issuance Already Exists",
                equityCompensationIssuance: equityExists,
            });
        }

        // Save offchain
        const createdIssuance = await createEquityCompensationIssuance({ ...incomingEquityCompensationIssuance, issuer: issuerId });

        // Save onchain
        await convertAndCreateIssuanceEquityCompensationOnchain(contract, {
            security_id: incomingEquityCompensationIssuance.security_id,
            stakeholder_id: incomingEquityCompensationIssuance.stakeholder_id,
            stock_class_id: incomingEquityCompensationIssuance.stock_class_id,
            stock_plan_id: incomingEquityCompensationIssuance.stock_plan_id,
            quantity: incomingEquityCompensationIssuance.quantity,
        });

        res.status(200).send({ equityCompensationIssuance: createdIssuance });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/issuance/equity-compensation-fairmint-reflection", async (req, res) => {
    const { contract } = req;
    const { issuerId, data } = req.body;
    const schema = Joi.object({
        issuerId: Joi.string().uuid().required(),
        series_id: Joi.string().uuid().required(),
        series_name: Joi.string().required(),
        data: Joi.object().required(),
    });

    const { error, value: payload } = schema.validate(req.body);

    if (error) {
        return res.status(400).send({
            error: getJoiErrorMessage(error),
        });
    }
    try {
        // ensuring issuer exists
        await readIssuerById(issuerId);

        const incomingEquityCompensationIssuance = {
            id: uuid(), // for OCF Validation
            security_id: uuid(), // for OCF Validation,
            date: new Date().toISOString().slice(0, 10), // for OCF Validation, it gets overriden if date exists in data
            object_type: "TX_EQUITY_COMPENSATION_ISSUANCE",
            ...data,
        };

        // Enforce data.stock_class_id and data.stock_plan_id are present
        if (!get(incomingEquityCompensationIssuance, "stock_class_id")) {
            return res.status(400).send({ error: "Stock class id is required" });
        }
        if (!get(incomingEquityCompensationIssuance, "stock_plan_id")) {
            return res.status(400).send({ error: "Stock plan id is required" });
        }

        await validateInputAgainstOCF(incomingEquityCompensationIssuance, equityCompensationIssuanceSchema);

        const stock_class_id = get(incomingEquityCompensationIssuance, "stock_class_id");

        if (!stock_class_id) {
            return res.status(400).send({ error: "Stock class id is required" });
        }

        const stockClass = await readStockClassById(stock_class_id);
        if (!stockClass || !stockClass._id) {
            return res.status(404).send({ error: "Stock class not found on OCP" });
        }

        const stakeholder = await readStakeholderById(incomingEquityCompensationIssuance.stakeholder_id);

        // check if the stakeholder exists on OCP
        if (!stakeholder || !stakeholder._id) {
            return res.status(404).send({ error: "Stakeholder not found on OCP" });
        }

        await checkStakeholderExistsOnFairmint({
            stakeholder_id: stakeholder._id,
            portal_id: issuerId,
        });

        // Check if equity compensation exists
        const equityExists = await readEquityCompensationIssuanceBySecurityId(incomingEquityCompensationIssuance.security_id);
        if (equityExists && equityExists._id) {
            return res.status(200).send({
                message: "Equity Compensation Issuance Already Exists",
                equityCompensationIssuance: equityExists,
            });
        }

        // Save Fairmint data
        await createFairmintData({
            security_id: incomingEquityCompensationIssuance.security_id,
            series_id: payload.series_id,
            attributes: {
                series_name: payload.series_name,
            },
        });

        // Save offchain
        const createdIssuance = await createEquityCompensationIssuance({ ...incomingEquityCompensationIssuance, issuer: issuerId });

        // Save onchain
        await convertAndCreateIssuanceEquityCompensationOnchain(contract, {
            security_id: incomingEquityCompensationIssuance.security_id,
            stakeholder_id: incomingEquityCompensationIssuance.stakeholder_id,
            stock_class_id: incomingEquityCompensationIssuance.stock_class_id,
            stock_plan_id: incomingEquityCompensationIssuance.stock_plan_id,
            quantity: incomingEquityCompensationIssuance.quantity,
        });

        res.status(200).send({ equityCompensationIssuance: createdIssuance });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/exercise/equity-compensation", async (req, res) => {
    const { contract } = req;
    const { issuerId, data } = req.body;

    try {
        // ensuring issuer exists
        await readIssuerById(issuerId);

        const incomingEquityCompensationExercise = {
            id: uuid(), // for OCF Validation
            date: new Date().toISOString().slice(0, 10), // for OCF Validation
            object_type: "TX_EQUITY_COMPENSATION_EXERCISE",
            ...data,
        };

        await validateInputAgainstOCF(incomingEquityCompensationExercise, equityCompensationExerciseSchema);

        // Enforce data.resulting_security_ids array has at least one element
        if (get(incomingEquityCompensationExercise, "resulting_security_ids").length === 0) {
            return res.status(400).send({ error: "resulting_security_ids array is required and must have at least one element" });
        }
        // Check if exercise exists
        const exerciseExists = await readEquityCompensationExerciseBySecurityId(incomingEquityCompensationExercise.id);
        if (exerciseExists && exerciseExists._id) {
            return res.status(200).send({
                message: "Equity Compensation Exercise Already Exists",
                equityCompensationExercise: exerciseExists,
            });
        }

        // Save offchain
        const createdExercise = await createEquityCompensationExercise({ ...incomingEquityCompensationExercise, issuer: issuerId });

        // Save onchain
        await convertAndCreateEquityCompensationExerciseOnchain(contract, {
            equity_comp_security_id: incomingEquityCompensationExercise.security_id,
            resulting_stock_security_id: incomingEquityCompensationExercise.resulting_security_ids[0],
            quantity: incomingEquityCompensationExercise.quantity,
        });

        res.status(200).send({ equityCompensationExercise: createdExercise });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/exercise/equity-compensation-fairmint-reflection", async (req, res) => {
    const { contract } = req;
    const { issuerId, data } = req.body;

    try {
        // ensuring issuer exists
        await readIssuerById(issuerId);

        const incomingEquityCompensationExercise = {
            id: uuid(), // for OCF Validation
            security_id: uuid(), // for OCF Validation
            date: new Date().toISOString().slice(0, 10), // for OCF Validation
            object_type: "TX_EQUITY_COMPENSATION_EXERCISE",
            ...data,
        };

        await validateInputAgainstOCF(incomingEquityCompensationExercise, equityCompensationExerciseSchema);

        // Enforce data.resulting_security_ids array has at least one element
        if (get(incomingEquityCompensationExercise, "resulting_security_ids").length === 0) {
            return res.status(400).send({ error: "resulting_security_ids array is required and must have at least one element" });
        }
        // Check if exercise exists
        const exerciseExists = await readEquityCompensationExerciseBySecurityId(incomingEquityCompensationExercise.security_id);
        if (exerciseExists && exerciseExists._id) {
            return res.status(200).send({
                message: "Equity Compensation Exercise Already Exists",
                equityCompensationExercise: exerciseExists,
            });
        }
        // Save Fairmint data
        await createFairmintData({ security_id: incomingEquityCompensationExercise.security_id });

        // Save offchain
        const createdExercise = await createEquityCompensationExercise({ ...incomingEquityCompensationExercise, issuer: issuerId });

        // Save onchain
        await convertAndCreateEquityCompensationExerciseOnchain(contract, {
            equity_comp_security_id: incomingEquityCompensationExercise.security_id,
            resulting_stock_security_id: incomingEquityCompensationExercise.resulting_security_ids[0],
            quantity: incomingEquityCompensationExercise.quantity,
        });

        res.status(200).send({ equityCompensationExercise: createdExercise });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/issuance/convertible", async (req, res) => {
    const { contract } = req;
    const { issuerId, data } = req.body;

    try {
        // ensuring issuer exists
        await readIssuerById(issuerId);

        const incomingConvertibleIssuance = {
            id: uuid(), // for OCF Validation
            security_id: uuid(), // for OCF Validation
            date: new Date().toISOString().slice(0, 10), // for OCF Validation
            object_type: "TX_CONVERTIBLE_ISSUANCE",
            ...data,
        };

        console.log("incomingConvertibleIssuance", incomingConvertibleIssuance);
        await validateInputAgainstOCF(incomingConvertibleIssuance, convertibleIssuanceSchema);

        // Check if convertible exists - updated to use securityId
        const convertibleExists = await readConvertibleIssuanceBySecurityId(incomingConvertibleIssuance.security_id);
        if (convertibleExists && convertibleExists._id) {
            return res.status(200).send({
                message: "Convertible Issuance Already Exists",
                convertibleIssuance: convertibleExists,
            });
        }

        // save to DB
        const createdIssuance = await createConvertibleIssuance({ ...incomingConvertibleIssuance, issuer: issuerId });

        // Create convertible onchain
        await convertAndCreateIssuanceConvertibleOnchain(contract, {
            security_id: incomingConvertibleIssuance.security_id,
            stakeholder_id: incomingConvertibleIssuance.stakeholder_id,
            investment_amount: incomingConvertibleIssuance.investment_amount.amount,
        });

        res.status(200).send({ convertibleIssuance: createdIssuance });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/issuance/convertible-fairmint-reflection", async (req, res) => {
    const { contract } = req;
    const { issuerId, data } = req.body;
    const schema = Joi.object({
        series_id: Joi.string().uuid().required(),
        series_name: Joi.string().required(),
        data: Joi.object().required(),
        issuerId: Joi.string().uuid().required(),
    });

    const { error, value: payload } = schema.validate(req.body);

    if (error) {
        return res.status(400).send({
            error: getJoiErrorMessage(error),
        });
    }

    try {
        // ensuring issuer exists
        await readIssuerById(issuerId);

        const incomingConvertibleIssuance = {
            id: uuid(), // for OCF Validation
            security_id: uuid(), // for OCF Validation
            date: new Date().toISOString().slice(0, 10), // for OCF Validation
            object_type: "TX_CONVERTIBLE_ISSUANCE",
            ...data,
        };

        console.log("incomingConvertibleIssuance", incomingConvertibleIssuance);
        await validateInputAgainstOCF(incomingConvertibleIssuance, convertibleIssuanceSchema);

        // check if the stakeholder exists
        const stakeholder = await readStakeholderById(incomingConvertibleIssuance.stakeholder_id);
        if (!stakeholder || !stakeholder._id) {
            return res.status(400).send({ error: "Stakeholder not found on OCP" });
        }

        // check stakeholder exists on fairmint
        await checkStakeholderExistsOnFairmint({
            stakeholder_id: stakeholder._id,
            portal_id: issuerId,
        });

        // Check if convertible exists - updated to use securityId
        const convertibleExists = await readConvertibleIssuanceBySecurityId(incomingConvertibleIssuance.security_id);
        if (convertibleExists && convertibleExists._id) {
            return res.status(200).send({
                message: "Convertible Issuance Already Exists",
                convertibleIssuance: convertibleExists,
            });
        }

        // save offchain
        const createdIssuance = await createConvertibleIssuance({
            ...incomingConvertibleIssuance,
            issuer: issuerId,
        });

        // TODO use createFairmintData instead
        await upsertFairmintDataBySecurityId(incomingConvertibleIssuance.security_id, {
            security_id: incomingConvertibleIssuance.security_id,
            series_id: payload.series_id,
            attributes: {
                series_name: payload.series_name,
            },
        });

        // save onchain
        await convertAndCreateIssuanceConvertibleOnchain(contract, {
            security_id: incomingConvertibleIssuance.security_id,
            stakeholder_id: incomingConvertibleIssuance.stakeholder_id,
            investment_amount: incomingConvertibleIssuance.investment_amount.amount,
        });

        res.status(200).send({ convertibleIssuance: createdIssuance });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/issuance/warrant", async (req, res) => {
    const { contract } = req;
    const { issuerId, data } = req.body;

    try {
        // ensuring issuer exists
        await readIssuerById(issuerId);

        const incomingWarrantIssuance = {
            id: uuid(), // for OCF Validation
            security_id: uuid(), // for OCF Validation
            date: new Date().toISOString().slice(0, 10), // for OCF Validation
            object_type: "TX_WARRANT_ISSUANCE",
            ...data,
        };

        console.log("incomingWarrantIssuance", incomingWarrantIssuance);
        await validateInputAgainstOCF(incomingWarrantIssuance, warrantIssuanceSchema);

        // Check if warrant exists
        const warrantExists = await readWarrantIssuanceBySecurityId(incomingWarrantIssuance.security_id);
        if (warrantExists && warrantExists._id) {
            return res.status(200).send({
                message: "Warrant Issuance Already Exists",
                warrantIssuance: warrantExists,
            });
        }

        // Save Offchain
        const createdIssuance = await createWarrantIssuance({ ...incomingWarrantIssuance, issuer: issuerId });

        // Save Onchain
        await convertAndCreateIssuanceWarrantOnchain(contract, {
            security_id: incomingWarrantIssuance.security_id,
            stakeholder_id: incomingWarrantIssuance.stakeholder_id,
            quantity: incomingWarrantIssuance.quantity,
        });

        res.status(200).send({ warrantIssuance: createdIssuance });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/issuance/warrant-fairmint-reflection", async (req, res) => {
    const { contract } = req;
    const { issuerId, data } = req.body;
    const schema = Joi.object({
        series_id: Joi.string().uuid().required(),
        series_name: Joi.string().required(),
        data: Joi.object().required(),
        issuerId: Joi.string().uuid().required(),
    });

    const { error, value: payload } = schema.validate(req.body);

    if (error) {
        return res.status(400).send({
            error: getJoiErrorMessage(error),
        });
    }

    try {
        await readIssuerById(issuerId);

        const incomingWarrantIssuance = {
            id: uuid(), // for OCF Validation
            security_id: uuid(), // for OCF Validation
            date: new Date().toISOString().slice(0, 10), // for OCF Validation
            object_type: "TX_WARRANT_ISSUANCE",
            ...data,
        };

        await validateInputAgainstOCF(incomingWarrantIssuance, warrantIssuanceSchema);

        // Verify stakeholder exists
        const stakeholder = await readStakeholderById(incomingWarrantIssuance.stakeholder_id);
        if (!stakeholder || !stakeholder._id) {
            return res.status(400).send({ error: "Stakeholder not found on OCP" });
        }

        // Check stakeholder exists on fairmint
        await checkStakeholderExistsOnFairmint({
            stakeholder_id: stakeholder._id,
            portal_id: issuerId,
        });

        // Check if warrant exists
        const warrantExists = await readWarrantIssuanceBySecurityId(incomingWarrantIssuance.security_id);
        if (warrantExists && warrantExists._id) {
            return res.status(200).send({
                message: "Warrant Issuance Already Exists",
                warrantIssuance: warrantExists,
            });
        }

        // Save Fairmint data: TODO use createFairmintData instead
        await upsertFairmintDataBySecurityId(incomingWarrantIssuance.security_id, {
            security_id: incomingWarrantIssuance.security_id,
            series_id: payload.series_id,
            attributes: {
                series_name: payload.series_name,
            },
        });

        // Save Offchain
        const createdIssuance = await createWarrantIssuance({ ...incomingWarrantIssuance, issuer: issuerId });

        // Save Onchain
        await convertAndCreateIssuanceWarrantOnchain(contract, {
            security_id: incomingWarrantIssuance.security_id,
            stakeholder_id: incomingWarrantIssuance.stakeholder_id,
            quantity: incomingWarrantIssuance.quantity,
        });

        res.status(200).send({ warrantIssuance: createdIssuance });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});
export default transactions;
