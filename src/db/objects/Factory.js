import mongoose from "mongoose";
import { v4 as uuid } from "uuid";

const FactorySchema = new mongoose.Schema(
    {
        _id: { type: String, default: () => uuid() },
        object_type: { type: String, default: "FACTORY" },
        implementation_address: String,
        factory_address: String,
        chain_id: {
            type: String,
            required: true,
            enum: [
                "8453", // Base mainnet
                "84532", // Base Sepolia
                "31337", // anvil
            ],
        },
        version: {
            type: String,
            required: true,
            enum: ["DIAMOND", "LEGACY"],
        },
        tx_hash: { type: String, default: null },
    },
    { timestamps: true }
);

const Factory = mongoose.model("Factory", FactorySchema);

export default Factory;
