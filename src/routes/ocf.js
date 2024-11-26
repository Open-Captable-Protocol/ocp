import { Router } from "express";
import { processTransactionEntity } from "../db/scripts/seed";

const ocf = Router();

ocf.post("/validate/transactions", async (req, res) => {
    const { data } = req.body;
    if (!data) {
        console.log("❌ | no data field in request body");
        return res.status(400).send("❌ | no data field in request body");
    }
    try {
        await processTransactionEntity(data);
        res.status(200).json({ valid: true });
    } catch (error) {
        res.status(500).send({ valid: false, error: JSON.parse(error.message) });
    }
});

export default ocf;
