import { v4 as uuid } from "uuid";
import Joi from "joi";
import { Router } from "express";
import warrantIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/WarrantIssuance.schema.json";
import convertibleIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/ConvertibleIssuance.schema.json";
import equityCompensationIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/EquityCompensationIssuance.schema.json";
import stockIssuanceSchema from "../../../ocf/schema/objects/transactions/issuance/StockIssuance.schema.json";
import equityCompensationExerciseSchema from "../../../ocf/schema/objects/transactions/exercise/EquityCompensationExercise.schema.json";

import {
    convertAndCreateIssuanceConvertibleOnchain,
    convertAndCreateIssuanceEquityCompensationOnchain,
    convertAndCreateIssuanceStockOnchain,
    convertAndCreateIssuanceWarrantOnchain,
} from "../../controllers/transactions/issuanceController.js";
import {
    createConvertibleIssuance,
    createEquityCompensationIssuance,
    createWarrantIssuance,
    createEquityCompensationExercise,
    createStockIssuance,
    createFairmintData,
    createStockCancellation,
} from "../../db/operations/create.js";

import {
    readIssuerById,
    readStakeholderById,
    readStockClassById,
    readConvertibleIssuanceBySecurityId,
    readEquityCompensationExerciseBySecurityId,
    readWarrantIssuanceBySecurityId,
} from "../../db/operations/read.js";
import validateInputAgainstOCF from "../../utils/validateInputAgainstSchema.js";
import { getJoiErrorMessage } from "../../chain-operations/utils.js";
import get from "lodash/get";
import { checkStakeholderExistsOnFairmint } from "../../fairmint/checkStakeholder.js";
import { upsertFairmintDataBySecurityId } from "../../db/operations/update";
import { convertAndCreateEquityCompensationExerciseOnchain } from "../../controllers/transactions/exerciseController";
import StockIssuance from "../../db/objects/transactions/issuance/StockIssuance.js";
import EquityCompensationIssuance from "../../db/objects/transactions/issuance/EquityCompensationIssuance.js";
import { ConvertibleIssuance, WarrantIssuance } from "../../db/objects/transactions/issuance";
import { EquityCompensationExercise } from "../../db/objects/transactions/exercise";
// import { convertAndCreateCancellationStockOnchain } from "../../controllers/transactions/cancellationController.js";
import StockCancellation from "../../db/objects/transactions/cancellation/StockCancellation.js";
import { checkInvestment } from "../../fairmint/checkInvestment.js";

const fairmintTransactions = Router();

fairmintTransactions.post("/issuance/stock-fairmint-reflection", async (req, res) => {
    const { contract } = req;
    const { issuerId } = req.body;

    /* This route is used to pass information from Fairmint that is not part of the OCF schema, like series name  and series id*/
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
            issuer: issuerId,
            security_id: incomingStockIssuance.security_id,
            series_id: payload.series_id,
            date: incomingStockIssuance.date,
            attributes: {
                series_name: payload.series_name,
            },
        });

        // Create the stock issuance in the DB
        const stockIssuance = await createStockIssuance({ ...incomingStockIssuance, issuer: issuerId });

        const receipt = await convertAndCreateIssuanceStockOnchain(contract, stockIssuance);

        // Update the stock issuance with tx_hash
        await StockIssuance.findByIdAndUpdate(stockIssuance._id, { tx_hash: receipt.hash });

        res.status(200).send({ stockIssuance: { ...stockIssuance.toObject(), tx_hash: receipt.hash } });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

fairmintTransactions.post("/issuance/equity-compensation-fairmint-reflection", async (req, res) => {
    const { contract } = req;
    const { issuerId } = req.body;

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

        const incomingEquityCompensationIssuance = {
            id: uuid(), // for OCF Validation
            security_id: uuid(), // for OCF Validation
            date: new Date().toISOString().slice(0, 10), // for OCF Validation
            object_type: "TX_EQUITY_COMPENSATION_ISSUANCE",
            ...payload.data,
        };

        // Enforce data.stock_class_id and data.stock_plan_id are present
        if (!get(incomingEquityCompensationIssuance, "stock_class_id")) {
            return res.status(400).send({ error: "Stock class id is required" });
        }

        await validateInputAgainstOCF(incomingEquityCompensationIssuance, equityCompensationIssuanceSchema);

        const stakeholder = await readStakeholderById(incomingEquityCompensationIssuance.stakeholder_id);
        const stockClass = await readStockClassById(incomingEquityCompensationIssuance.stock_class_id);

        if (!stakeholder || !stakeholder._id) {
            return res.status(404).send({ error: "Stakeholder not found on OCP" });
        }

        if (!stockClass || !stockClass._id) {
            return res.status(404).send({ error: "Stock class not found on OCP" });
        }

        await checkStakeholderExistsOnFairmint({ stakeholder_id: stakeholder._id, portal_id: issuerId });

        // Save Fairmint data
        await createFairmintData({
            issuer: issuerId,
            security_id: incomingEquityCompensationIssuance.security_id,
            series_id: payload.series_id,
            attributes: {
                series_name: payload.series_name,
            },
        });

        // Save offchain
        const createdIssuance = await createEquityCompensationIssuance({ ...incomingEquityCompensationIssuance, issuer: issuerId });

        // Save onchain
        const receipt = await convertAndCreateIssuanceEquityCompensationOnchain(contract, createdIssuance);

        // Update the equity compensation issuance with tx_hash
        await EquityCompensationIssuance.findByIdAndUpdate(createdIssuance._id, { tx_hash: receipt.hash });

        res.status(200).send({ equityCompensationIssuance: { ...createdIssuance.toObject(), tx_hash: receipt.hash } });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

fairmintTransactions.post("/exercise/equity-compensation-fairmint-reflection", async (req, res) => {
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
        console.log("incomingEquityCompensationExercise", incomingEquityCompensationExercise);
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
        await createFairmintData({ id: incomingEquityCompensationExercise.id, security_id: incomingEquityCompensationExercise.security_id });

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

fairmintTransactions.post("/issuance/convertible-fairmint-reflection", async (req, res) => {
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

        // Check if convertible exists - updated to use securityId -- TODO use id instead of securityId
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
            issuer: issuerId,
            security_id: incomingConvertibleIssuance.security_id,
            series_id: payload.series_id,
            date: incomingConvertibleIssuance.date,
            attributes: {
                series_name: payload.series_name,
            },
        });

        // save onchain
        const receipt = await convertAndCreateIssuanceConvertibleOnchain(contract, createdIssuance);

        await ConvertibleIssuance.findByIdAndUpdate(createdIssuance._id, { tx_hash: receipt.hash });

        res.status(200).send({ convertibleIssuance: { ...createdIssuance.toObject(), tx_hash: receipt.hash } });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

fairmintTransactions.post("/issuance/warrant-fairmint-reflection", async (req, res) => {
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
            issuer: issuerId,
            security_id: incomingWarrantIssuance.security_id,
            series_id: payload.series_id,
            date: incomingWarrantIssuance.date,
            attributes: {
                series_name: payload.series_name,
            },
        });

        // Save Offchain
        const createdIssuance = await createWarrantIssuance({ ...incomingWarrantIssuance, issuer: issuerId });

        // Save Onchain
        const receipt = await convertAndCreateIssuanceWarrantOnchain(contract, createdIssuance);

        // Update the warrant issuance with tx_hash
        await WarrantIssuance.findByIdAndUpdate(createdIssuance._id, { tx_hash: receipt.hash });

        res.status(200).send({ warrantIssuance: { ...createdIssuance.toObject(), tx_hash: receipt.hash } });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

fairmintTransactions.post("/cancel/stock-fairmint-reflection", async (req, res) => {
    // const { contract } = req;
    const { issuerId, data } = req.body;

    try {
        await readIssuerById(issuerId);

        const incomingCancellation = {
            id: uuid(), // for OCF Validation
            security_id: data.security_id,
            date: new Date().toISOString().slice(0, 10), // for OCF Validation
            object_type: "TX_STOCK_CANCELLATION",
            ...data,
        };

        // Verify investment exists on Fairmint
        await checkInvestment({
            issuerId,
            securityId: data.security_id,
        });

        // Save Fairmint data
        await createFairmintData({
            id: incomingCancellation.id,
            object_type: incomingCancellation.object_type,
            tx_id: incomingCancellation.id,
            issuer: issuerId,
            date: incomingCancellation.date,
        });

        // Save offchain
        const createdCancellation = await createStockCancellation({ ...incomingCancellation, issuer: issuerId });

        // Save onchain
        // const receipt = await convertAndCreateCancellationStockOnchain(contract, createdCancellation);
        const receipt = { hash: null };

        // Update the cancellation with tx_hash
        await StockCancellation.findByIdAndUpdate(createdCancellation._id, { tx_hash: receipt.hash });

        res.status(200).send({ stockCancellation: { ...createdCancellation.toObject(), tx_hash: receipt.hash } });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

fairmintTransactions.get("/health", (req, res) => {
    res.status(200).send("OK");
});

export default fairmintTransactions;
