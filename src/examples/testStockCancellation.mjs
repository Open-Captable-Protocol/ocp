import { issuer, stakeholder1, stockClass, stockIssuance } from "./sampleData.js";
import axios from "axios";
import sleep from "../utils/sleep.js";
import { v4 as uuid } from "uuid";

const main = async () => {
    try {
        // Generate UUIDs
        const issuerId = uuid();
        const stakeholderId = uuid();
        const stockClassId = uuid();
        const stockSecurityId = uuid();

        // 1. Create issuer
        console.log("⏳ Creating issuer...");
        issuer.id = issuerId;
        issuer.chain_id = 31337;
        const issuerResponse = await axios.post("http://localhost:8080/issuer/create", issuer);
        console.log("✅ Issuer created:", issuerResponse.data);

        await sleep(3000);

        // 2. Create stakeholder
        console.log("\n⏳ Creating stakeholder...");
        const stakeholderData = stakeholder1(issuerId);
        stakeholderData.data.id = stakeholderId;
        const stakeholderResponse = await axios.post("http://localhost:8080/stakeholder/create", stakeholderData);
        console.log("✅ Stakeholder created:", stakeholderResponse.data);

        await sleep(3000);

        // 3. Create stock class
        console.log("\n⏳ Creating stock class...");
        const stockClassData = stockClass(issuerId);
        stockClassData.data.id = stockClassId;
        const stockClassResponse = await axios.post("http://localhost:8080/stock-class/create", stockClassData);
        console.log("✅ Stock class created:", stockClassResponse.data);

        await sleep(3000);

        // 4. Create stock issuance
        console.log("\n⏳ Creating stock issuance...");
        const stockIssuanceData = stockIssuance(issuerId, stakeholderId, stockClassId, "1000", "1.00");
        stockIssuanceData.data.security_id = stockSecurityId;
        const stockIssuanceResponse = await axios.post("http://localhost:8080/transactions/issuance/stock", stockIssuanceData);
        console.log("✅ Stock issued:", stockIssuanceResponse.data);

        await sleep(3000);

        // 5. Cancel stock
        console.log("\n⏳ Cancelling stock...");
        const cancellationData = {
            issuerId,
            data: {
                security_id: stockSecurityId,
                date: new Date().toISOString().slice(0, 10),
                quantity: "500",
                reason_text: "Voluntary cancellation",
                comments: ["Cancelling 500 shares"],
            },
        };
        // const cancellationResponse = await axios.post("http://localhost:8080/transactions/cancel/stock-fairmint-reflection", cancellationData);
        const cancellationResponse = await axios.post("http://localhost:8080/transactions/cancel/stock", cancellationData);
        console.log("✅ Stock cancelled:", cancellationResponse.data);

        console.log("\nTest completed successfully! 🎉");
    } catch (error) {
        if (error.response) {
            console.error("Error Response:", {
                status: error.response.status,
                data: error.response.data,
                // headers: error.response.headers,
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
