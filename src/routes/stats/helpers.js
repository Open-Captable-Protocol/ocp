import { find } from "../../db/operations/atomic.ts";
import StockIssuance from "../../db/objects/transactions/issuance/StockIssuance.js";

export const getStockIssuances = async (issuerId) => {
    return await find(StockIssuance, { issuer: issuerId });
};
