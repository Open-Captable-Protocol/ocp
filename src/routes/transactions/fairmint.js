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
} from "../../db/operations/create.js";

import {
    readIssuerById,
    readStakeholderById,
    readStockClassById,
    readConvertibleIssuanceBySecurityId,
    readEquityCompensationIssuanceBySecurityId,
    readEquityCompensationExerciseBySecurityId,
    readWarrantIssuanceBySecurityId,
} from "../../db/operations/read.js";
import validateInputAgainstOCF from "../../utils/validateInputAgainstSchema.js";
import { getJoiErrorMessage } from "../../chain-operations/utils.js";
import get from "lodash/get";
import { checkStakeholderExistsOnFairmint } from "../../fairmint/checkStakeholder.js";
import { upsertFairmintDataBySecurityId } from "../../db/operations/update";
import { convertAndCreateEquityCompensationExerciseOnchain } from "../../controllers/transactions/exerciseController";

const fairmintTransactions = Router();

fairmintTransactions.post("/issuance/stock-fairmint-reflection", async (req, res) => {
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
            date: incomingStockIssuance.date,
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
            custom_id: incomingStockIssuance.custom_id || "",
            id: incomingStockIssuance.id,
        });

        // TODO: Store Historical Transactions
        res.status(200).send({ stockIssuance });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

fairmintTransactions.post("/issuance/equity-compensation-fairmint-reflection", async (req, res) => {
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
            compensation_type: incomingEquityCompensationIssuance.compensation_type,
            exercise_price: incomingEquityCompensationIssuance.exercise_price,
            base_price: incomingEquityCompensationIssuance.base_price,
            expiration_date: incomingEquityCompensationIssuance.expiration_date,
            custom_id: incomingEquityCompensationIssuance.custom_id || "",
            id: incomingEquityCompensationIssuance.id,
        });

        // TODO: Store Historical Transactions

        res.status(200).send({ equityCompensationIssuance: createdIssuance });
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
            date: incomingConvertibleIssuance.date,
            attributes: {
                series_name: payload.series_name,
            },
        });

        // save onchain
        await convertAndCreateIssuanceConvertibleOnchain(contract, {
            security_id: incomingConvertibleIssuance.security_id,
            stakeholder_id: incomingConvertibleIssuance.stakeholder_id,
            investment_amount: incomingConvertibleIssuance.investment_amount,
            convertible_type: incomingConvertibleIssuance.convertible_type,
            seniority: incomingConvertibleIssuance.seniority,
            custom_id: incomingConvertibleIssuance.custom_id || "",
            id: incomingConvertibleIssuance.id,
        });

        // TODO: Store Historical Transactions

        res.status(200).send({ convertibleIssuance: createdIssuance });
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
        await convertAndCreateIssuanceWarrantOnchain(contract, {
            security_id: incomingWarrantIssuance.security_id,
            stakeholder_id: incomingWarrantIssuance.stakeholder_id,
            quantity: incomingWarrantIssuance.quantity,
            purchase_price: incomingWarrantIssuance.purchase_price,
            custom_id: incomingWarrantIssuance.custom_id || "",
            id: incomingWarrantIssuance.id,
        });

        // TODO: Store Historical Transactions

        res.status(200).send({ warrantIssuance: createdIssuance });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

fairmintTransactions.get("/health", (req, res) => {
    res.status(200).send("OK");
});

export default fairmintTransactions;
