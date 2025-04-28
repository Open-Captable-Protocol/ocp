import { Router } from "express";
import { readIssuerById } from "../../db/operations/read.js";
import { dashboardStats, captableStats } from "../../rxjs/index.js";
import { captureException, setTag } from "@sentry/node";
import { getAllStateMachineObjectsById } from "../../db/operations/read.js";
import quineInput from "../../tests/captables/inputs/quine_input.json";
const stats = Router();

stats.get("/rxjs/dashboard", async (req, res) => {
    try {
        const { issuerId } = req.query;
        setTag("issuerId", issuerId);

        const issuer = await readIssuerById(issuerId);
        if (!issuer) {
            return res.status(404).send({ error: "Issuer not found" });
        }

        const issuerData = await getAllStateMachineObjectsById(issuerId);
        const rxjsData = await dashboardStats(issuerData);

        if (rxjsData?.errors?.size > 0) {
            captureException(new Error(Array.from(rxjsData.errors).join("\n")));
            return res.status(500).send({ errors: Array.from(rxjsData.errors) });
        }

        res.status(200).send(rxjsData);
    } catch (error) {
        captureException(error);
        res.status(500).send({ error });
    }
});

stats.get("/rxjs/captable", async (req, res) => {
    try {
        const { issuerId } = req.query;
        setTag("issuerId", issuerId);

        const issuer = await readIssuerById(issuerId);
        if (!issuer) {
            return res.status(404).send({ error: "Issuer not found" });
        }

        const issuerData = await getAllStateMachineObjectsById(issuerId);
        // console.log("issuerData", JSON.stringify(issuerData, null, 2));

        const rxjsData = await captableStats(issuerData);
        if (rxjsData?.errors?.size > 0) {
            captureException(new Error(Array.from(rxjsData.errors).join("\n")));
            return res.status(500).send({ errors: Array.from(rxjsData.errors) });
        }

        // console.log("rxjsData", JSON.stringify(rxjsData, null, 2));

        res.status(200).send(rxjsData);
    } catch (error) {
        captureException(error);
        res.status(500).send({ error });
    }
});

export default stats;
