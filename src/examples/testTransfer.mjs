import { issuer, stakeholder1, stakeholder2, stockClass, stockIssuance, stockTransfer } from "./sampleData.js";
import axios from "axios";
import sleep from "../utils/sleep.js";
import { v4 as uuid } from "uuid";
import { CANTON_DEVNET_CHAIN_ID } from "../chain-operations/canton/constants.js";

const main = async () => {
    try {
        // Generate UUIDs
        const issuerId = uuid();
        const stakeholder1Id = uuid();
        const stakeholder2Id = uuid();
        const stockClassId = uuid();

        // 1. Create issuer
        console.log("⏳ Creating issuer...");
        issuer.id = issuerId;
        issuer.chain_id = CANTON_DEVNET_CHAIN_ID;
        const issuerResponse = await axios.post("http://localhost:8080/issuer/create", issuer);
        console.log("✅ Issuer created:", issuerResponse.data);

        await sleep(2000);

        // 2. Create stakeholder1
        console.log("\n⏳ Creating stakeholder1...");
        const sh1Data = stakeholder1(issuerId);
        sh1Data.data.id = stakeholder1Id;
        const stakeholder1Response = await axios.post("http://localhost:8080/stakeholder/create", sh1Data);
        console.log("✅ Stakeholder1 created:", stakeholder1Response.data);

        await sleep(2000);

        // 3. Create stakeholder2
        console.log("\n⏳ Creating stakeholder2...");
        const sh2Data = stakeholder2(issuerId);
        sh2Data.data.id = stakeholder2Id;
        const stakeholder2Response = await axios.post("http://localhost:8080/stakeholder/create", sh2Data);
        console.log("✅ Stakeholder2 created:", stakeholder2Response.data);

        await sleep(2000);

        // 4. Create stock class
        console.log("\n⏳ Creating stock class...");
        const stockClassData = stockClass(issuerId);
        stockClassData.data.id = stockClassId;
        const stockClassResponse = await axios.post("http://localhost:8080/stock-class/create", stockClassData);
        console.log("✅ Stock class created:", stockClassResponse.data);

        await sleep(2000);

        // 5. Create stock issuance to stakeholder1
        console.log("\n⏳ Creating stock issuance...");
        const issuanceData = stockIssuance(issuerId, stakeholder1Id, stockClassId, "1000", "1");
        const stockIssuanceResponse = await axios.post("http://localhost:8080/transactions/issuance/stock", issuanceData);
        console.log("✅ Stock issued:", stockIssuanceResponse.data);

        await sleep(2000);

        // 6. Create transfer from stakeholder1 to stakeholder2
        console.log("\n⏳ Creating stock transfer...");
        const transferData = stockTransfer(issuerId, "500", stakeholder1Id, stakeholder2Id, stockClassId, "1");
        const transferResponse = await axios.post("http://localhost:8080/transactions/transfer/stock", transferData);
        console.log("✅ Stock transferred:", transferResponse.data);

        console.log("\nTest completed successfully! 🎉");
    } catch (error) {
        if (error.response) {
            console.error("Error Response:", {
                status: error.response.status,
                data: error.response.data,
                headers: error.response.headers,
            });
        } else if (error.request) {
            console.error("Error Request:", error.request);
        } else {
            console.error("Error Message:", error.message);
        }
        console.error("Error Config:", error.config);
    }
};

main();
