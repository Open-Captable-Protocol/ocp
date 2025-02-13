import { Router } from "express";
import fairmintStakeholder from "./fairmint.js";
import baseStakeholder from "./base.js";

const router = Router();

// Mount base stakeholder routes
router.use("/", baseStakeholder);

// Mount your companies specific routes
router.use("/", fairmintStakeholder);

export default router;
