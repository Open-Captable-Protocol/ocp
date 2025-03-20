import mongoose from "mongoose";
import { v4 as uuid } from "uuid";

const StockConsolidationSchema = new mongoose.Schema(
    {
        _id: { type: String, default: () => uuid() },
        object_type: { type: String, default: "TX_STOCK_CONSOLIDATION" },
        security_ids: [String],
        resulting_security_id: String,
        comments: [String],
        date: String,
        reason_text: String,
        issuer: {
            type: String,
            ref: "Issuer",
        },
        is_onchain_synced: { type: Boolean, default: false },
        tx_hash: { type: String, default: null },
    },
    { timestamps: true }
);

const StockConsolidation = mongoose.model("StockConsolidation", StockConsolidationSchema);

export default StockConsolidation;
