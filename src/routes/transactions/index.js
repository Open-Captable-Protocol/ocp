import { Router } from "express";
import fairmintTransactions from "./fairmint.js";
import baseTransactions from "./base.js";

const router = Router();

// Mount base transactions routes
router.use("/", baseTransactions);

// Mount Fairmint-specific routes
router.use("/", fairmintTransactions);

export default router;
