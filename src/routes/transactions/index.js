import { Router } from "express";
import fairmintTransactions from "./fairmint.js";
import baseTransactions from "./base.js";

const router = Router();

// Mount base transactions routes
router.use("/", baseTransactions);

// Mount your company's specific transactions routes
router.use("/", fairmintTransactions);

export default router;
