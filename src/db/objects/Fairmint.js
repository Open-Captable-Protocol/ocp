import mongoose from "mongoose";
import { v4 as uuid } from "uuid";

/*
How flexible do we need this to be?
- if it's for issuance transactions only, then we only need series_id as the link.
For example, 
{
    series_id: "1234-5678-91011-1213",
    attributes: {
        "series_name": "Seed Round",
        "another_fairmint_specific_field": "hello world"
    }
}
*/
const FairmintSchema = new mongoose.Schema(
    {
        _id: { type: String, default: () => uuid() },
        series_id: { type: String, default: null },
        security_id: { type: String, default: null },
        stakeholder_id: { type: String, default: null },
        attributes: { type: mongoose.Schema.Types.Mixed, default: {} },
        date: { type: String, default: null },
        issuer: {
            type: String,
            ref: "Issuer",
        },
    },
    { timestamps: true }
);

const Fairmint = mongoose.model("Fairmint", FairmintSchema);

export default Fairmint;
