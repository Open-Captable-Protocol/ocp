import { Router } from "express";
import { v4 as uuid } from "uuid";

import stockAcceptanceSchema from "../../../ocf/schema/objects/transactions/acceptance/StockAcceptance.schema.json";
import issuerAuthorizedSharesAdjustmentSchema from "../../../ocf/schema/objects/transactions/adjustment/IssuerAuthorizedSharesAdjustment.schema.json";
import stockClassAuthorizedSharesAdjustmentSchema from "../../../ocf/schema/objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment.schema.json";
import stockCancellationSchema from "../../../ocf/schema/objects/transactions/cancellation/StockCancellation.schema.json";
import warrantIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/WarrantIssuance.schema.json";
import convertibleIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/ConvertibleIssuance.schema.json";
import equityCompensationIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json";
import stockIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/StockIssuance.schema.json";
import stockReissuanceSchema from "../../../ocf/schema/objects/transactions/reissuance/StockReissuance.schema.json";
import stockRepurchaseSchema from "../../../ocf/schema/objects/transactions/repurchase/StockRepurchase.schema.json";
import stockRetractionSchema from "../../../ocf/schema/objects/transactions/retraction/StockRetraction.schema.json";
import equityCompensationExerciseSchema from "../../../ocf/schema/objects/transactions/exercise/EquityCompensationExercise.schema.json";
import stockPlanPoolAdjustmentSchema from "../../../ocf/schema/objects/transactions/adjustment/StockPlanPoolAdjustment.schema.json";

import { convertAndAdjustIssuerAuthorizedSharesOnChain } from "../../controllers/issuerController.js";
import { convertAndAdjustStockClassAuthorizedSharesOnchain } from "../../controllers/stockClassController.js";
import { convertAndCreateAcceptanceStockOnchain } from "../../controllers/transactions/acceptanceController.js";
import { convertAndCreateCancellationStockOnchain } from "../../controllers/transactions/cancellationController.js";
import {
    convertAndCreateIssuanceConvertibleOnchain,
    convertAndCreateIssuanceEquityCompensationOnchain,
    convertAndCreateIssuanceStockOnchain,
    convertAndCreateIssuanceWarrantOnchain,
} from "../../controllers/transactions/issuanceController.js";
import { convertAndCreateReissuanceStockOnchain } from "../../controllers/transactions/reissuanceController.js";
import { convertAndCreateRepurchaseStockOnchain } from "../../controllers/transactions/repurchaseController.js";
import { convertAndCreateRetractionStockOnchain } from "../../controllers/transactions/retractionController.js";
import { convertAndCreateTransferStockOnchain } from "../../controllers/transactions/transferController.js";
import {
    createConvertibleIssuance,
    createEquityCompensationIssuance,
    createWarrantIssuance,
    createEquityCompensationExercise,
    createStockIssuance,
    createStockClassAuthorizedSharesAdjustment,
    createIssuerAuthorizedSharesAdjustment,
} from "../../db/operations/create.js";

import {
    readStockPlanById,
    readIssuerById,
    readStockClassById,
    readConvertibleIssuanceBySecurityId,
    readStockIssuanceBySecurityId,
    readEquityCompensationIssuanceBySecurityId,
    readEquityCompensationExerciseBySecurityId,
    readWarrantIssuanceBySecurityId,
} from "../../db/operations/read.js";
import { createStockPlanPoolAdjustment } from "../../db/operations/create.js";
import validateInputAgainstOCF from "../../utils/validateInputAgainstSchema.js";
import get from "lodash/get";
import { convertAndCreateEquityCompensationExerciseOnchain } from "../../controllers/transactions/exerciseController";
import { adjustStockPlanPoolOnchain } from "../../controllers/stockPlanController";
import StockIssuance from "../../db/objects/transactions/issuance/StockIssuance.js";
import ConvertibleIssuance from "../../db/objects/transactions/issuance/ConvertibleIssuance.js";
import EquityCompensationIssuance from "../../db/objects/transactions/issuance/EquityCompensationIssuance.js";
import WarrantIssuance from "../../db/objects/transactions/issuance/WarrantIssuance.js";
import StockClassAuthorizedSharesAdjustment from "../../db/objects/transactions/adjustment/StockClassAuthorizedSharesAdjustment.js";
import StockPlanPoolAdjustment from "../../db/objects/transactions/adjustment/StockPlanPoolAdjustment.js";
import { EquityCompensationExercise } from "../../db/objects/transactions/exercise";

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

        const receipt = await convertAndCreateIssuanceStockOnchain(contract, {
            security_id: incomingStockIssuance.security_id,
            stock_class_id: incomingStockIssuance.stock_class_id,
            stakeholder_id: incomingStockIssuance.stakeholder_id,
            quantity: incomingStockIssuance.quantity,
            share_price: incomingStockIssuance.share_price,
            stock_legend_ids_mapping: incomingStockIssuance.stock_legend_ids_mapping,
            custom_id: incomingStockIssuance.custom_id || "",
            id: incomingStockIssuance.id,
        });

        // Update the stock issuance with tx_hash
        await StockIssuance.findByIdAndUpdate(stockIssuance._id, { tx_hash: receipt.hash });

        res.status(200).send({ stockIssuance: { ...stockIssuance.toObject(), tx_hash: receipt.hash } });
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

        const createdIssuerAdjustment = await createIssuerAuthorizedSharesAdjustment({
            ...issuerAuthorizedSharesAdj,
            issuer: issuerId,
        });

        const receipt = await convertAndAdjustIssuerAuthorizedSharesOnChain(contract, createdIssuerAdjustment);
        res.status(200).send({ ...createdIssuerAdjustment.toObject(), txhash: receipt.hash });
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

        const createdStockClassAdjustment = await createStockClassAuthorizedSharesAdjustment({
            ...stockClassAuthorizedSharesAdjustment,
            issuer: issuerId,
        });

        const receipt = await convertAndAdjustStockClassAuthorizedSharesOnchain(contract, createdStockClassAdjustment);

        // Update the stock class adjustment with tx_hash
        await StockClassAuthorizedSharesAdjustment.findByIdAndUpdate(createdStockClassAdjustment._id, { tx_hash: receipt.hash });

        res.status(200).send({ stockClassAdjustment: { ...createdStockClassAdjustment.toObject(), tx_hash: receipt.hash } });
    } catch (error) {
        console.error(`error: ${error.stack}`);
        res.status(500).send(`${error}`);
    }
});

transactions.post("/adjust/stock-plan-pool", async (req, res) => {
    const { contract } = req;
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

        const createdStockPlanAdjustment = await createStockPlanPoolAdjustment({
            ...stockPlanPoolAdjustment,
            issuer: issuerId,
        });

        const receipt = await adjustStockPlanPoolOnchain(contract, stockPlanPoolAdjustment);

        // Update the stock plan pool adjustment with tx_hash
        await StockPlanPoolAdjustment.findByIdAndUpdate(createdStockPlanAdjustment._id, { tx_hash: receipt.hash });

        res.status(200).send({ stockPlanAdjustment: { ...createdStockPlanAdjustment.toObject(), tx_hash: receipt.hash } });
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
        // Enforce data.stock_class_id is present
        if (!get(incomingEquityCompensationIssuance, "stock_class_id")) {
            return res.status(400).send({ error: "Stock class id is required" });
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

        const receipt = await convertAndCreateIssuanceEquityCompensationOnchain(contract, createdIssuance);

        // Update the equity compensation issuance with tx_hash
        await EquityCompensationIssuance.findByIdAndUpdate(createdIssuance._id, { tx_hash: receipt.hash });

        res.status(200).send({ equityCompensationIssuance: { ...createdIssuance, tx_hash: receipt.hash } });
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
        const receipt = await convertAndCreateEquityCompensationExerciseOnchain(contract, incomingEquityCompensationExercise);

        // Update the equity compensation exercise with tx_hash
        await EquityCompensationExercise.findByIdAndUpdate(createdExercise._id, { tx_hash: receipt.hash });

        res.status(200).send({ equityCompensationExercise: { ...createdExercise.toObject(), tx_hash: receipt.hash } });
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

        await validateInputAgainstOCF(incomingConvertibleIssuance, convertibleIssuanceSchema);

        // Check if convertible exists - TODO use id instead of securityId
        const convertibleExists = await readConvertibleIssuanceBySecurityId(incomingConvertibleIssuance.security_id);
        if (convertibleExists && convertibleExists._id) {
            return res.status(200).send({
                message: "Convertible Issuance Already Exists",
                convertibleIssuance: convertibleExists,
            });
        }

        const convertibleIssuance = await createConvertibleIssuance({ ...incomingConvertibleIssuance, issuer: issuerId });

        const receipt = await convertAndCreateIssuanceConvertibleOnchain(contract, convertibleIssuance);

        // Update the convertible issuance with tx_hash
        await ConvertibleIssuance.findByIdAndUpdate(convertibleIssuance._id, { tx_hash: receipt.hash });

        res.status(200).send({ convertibleIssuance: { ...convertibleIssuance.toObject(), tx_hash: receipt.hash } });
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

        const warrantIssuance = await createWarrantIssuance({ ...incomingWarrantIssuance, issuer: issuerId });

        const receipt = await convertAndCreateIssuanceWarrantOnchain(contract, warrantIssuance);

        // Update the warrant issuance with tx_hash
        await WarrantIssuance.findByIdAndUpdate(warrantIssuance._id, { tx_hash: receipt.hash });

        res.status(200).send({ warrantIssuance: { ...warrantIssuance.toObject(), tx_hash: receipt.hash } });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

export default transactions;
