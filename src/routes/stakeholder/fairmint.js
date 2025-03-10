import { Router } from "express";
import { v4 as uuid } from "uuid";
import { convertAndReflectStakeholderOnchain } from "../../controllers/stakeholderController.js";
import stakeholderSchema from "../../../ocf/schema/objects/Stakeholder.schema.json";
import { createFairmintData, createStakeholder } from "../../db/operations/create.js";
import { readIssuerById, readStakeholderById } from "../../db/operations/read.js";
import validateInputAgainstOCF from "../../utils/validateInputAgainstSchema.js";
import { checkStakeholderExistsOnFairmint } from "../../fairmint/checkStakeholder.js";
import { updateStakeholderById } from "../../db/operations/update.js";
import { updateReflectedStakeholder } from "../../fairmint/updateReflectStakeholder.js";
import { reflectStakeholder } from "../../fairmint/reflectStakeholder.js";

const router = Router();

/// @dev: stakeholder is always created onchain, then to the DB
router.post("/create-fairmint-reflection", async (req, res) => {
    const { contract } = req;
    const { data, issuerId } = req.body;

    try {
        const issuer = await readIssuerById(issuerId);

        // OCF doesn't allow extra fields in their validation
        const incomingStakeholderToValidate = {
            id: uuid(),
            object_type: "STAKEHOLDER",
            ...data,
        };

        const incomingStakeholderForDB = {
            ...incomingStakeholderToValidate,
            issuer: issuer._id,
        };

        await validateInputAgainstOCF(incomingStakeholderToValidate, stakeholderSchema);
        const stakeholder_id = incomingStakeholderToValidate.id;
        const foundStakeholder = await readStakeholderById(stakeholder_id);

        if (foundStakeholder && foundStakeholder._id) {
            await reflectStakeholder({ issuerId, stakeholder: foundStakeholder });
            return res.status(200).send({
                message: `Stakeholder already found`,
                stakeholder: foundStakeholder,
            });
        }

        const stakeholder = await createStakeholder(incomingStakeholderForDB);
        const fairmintData = await createFairmintData({ stakeholder_id: stakeholder._id });
        console.log("✅ | Fairmint Data created:", fairmintData);
        await convertAndReflectStakeholderOnchain(contract, incomingStakeholderForDB.id);

        console.log("✅ | Stakeholder created offchain:", stakeholder);

        res.status(200).send({ stakeholder });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

/// @dev: stakeholder is always created onchain, then to the DB
router.post("/update-fairmint-reflection", async (req, res) => {
    const { data, issuerId } = req.body;

    try {
        const issuer = await readIssuerById(issuerId);

        // OCF doesn't allow extra fields in their validation
        const incomingStakeholderToValidate = {
            object_type: "STAKEHOLDER",
            ...data,
        };

        const incomingStakeholderForDB = {
            ...incomingStakeholderToValidate,
            issuer: issuer._id,
        };

        await validateInputAgainstOCF(incomingStakeholderToValidate, stakeholderSchema);
        const stakeholder_id = incomingStakeholderToValidate.id;
        const foundStakeholder = await readStakeholderById(stakeholder_id);

        if (!foundStakeholder || !foundStakeholder._id) {
            return res.status(404).send(`Stakeholder not found`);
        }

        await checkStakeholderExistsOnFairmint({ portal_id: issuerId, stakeholder_id });

        const updatedStakeholder = await updateStakeholderById(stakeholder_id, incomingStakeholderForDB);

        await updateReflectedStakeholder({
            issuerId: issuerId,
            stakeholder: updatedStakeholder,
        });

        console.log("✅ | Stakeholder updated offchain:", updatedStakeholder);

        res.status(200).send({ stakeholder: updatedStakeholder });
    } catch (error) {
        console.error(error);
        res.status(500).send(`${error}`);
    }
});

export default router;
