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
        const stockPlanId = uuid();
        const equityCompSecurityId = uuid();
        const resultingStockSecurityId = uuid();

        // 1. Create issuer
        console.log("⏳ Creating issuer...");
        issuer.id = issuerId;
        issuer.chain_id = 84532;
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

        // 4. Create stock plan
        console.log("\n⏳ Creating stock plan...");
        const stockPlanData = {
            issuerId,
            data: {
                id: stockPlanId,
                plan_name: "2024 Stock Incentive Plan",
                initial_shares_reserved: "1000000",
                default_cancellation_behavior: "RETURN_TO_POOL",
                stock_class_ids: [stockClassId],
                board_approval_date: "2024-01-01",
            },
        };
        const stockPlanResponse = await axios.post("http://localhost:8080/stock-plan/create", stockPlanData);
        console.log("✅ Stock plan created:", stockPlanResponse.data);

        await sleep(3000);

        // 5. Create equity compensation issuance
        console.log("\n⏳ Creating equity compensation issuance...");
        const equityCompData = {
            issuerId,
            data: {
                security_id: equityCompSecurityId,
                stakeholder_id: stakeholderId,
                stock_class_id: stockClassId,
                stock_plan_id: stockPlanId,
                custom_id: "OPT-01",
                compensation_type: "OPTION_ISO",
                option_grant_type: "ISO",
                quantity: "24073",
                exercise_price: {
                    amount: "0.08",
                    currency: "USD",
                },
                security_law_exemptions: [
                    {
                        description: "SEC Rule 701",
                        jurisdiction: "US",
                    },
                ],
                vestings: [
                    {
                        date: "2025-02-11",
                        amount: "1003.04",
                    },
                ],
                expiration_date: "2035-08-23",
                termination_exercise_windows: [
                    {
                        reason: "INVOLUNTARY_WITH_CAUSE",
                        period: 90,
                        period_type: "DAYS",
                    },
                ],
                comments: [""],
            },
        };
        const equityCompResponse = await axios.post("http://localhost:8080/transactions/issuance/equity-compensation", equityCompData);
        console.log("✅ Equity compensation issued:", equityCompResponse.data);

        await sleep(3000);

        // 6. Create stock issuance (this will be the resulting security)
        console.log("\n⏳ Creating stock issuance...");
        const stockIssuanceData = stockIssuance(issuerId, stakeholderId, stockClassId, "500", "1.00");
        stockIssuanceData.data.security_id = resultingStockSecurityId;
        const stockIssuanceResponse = await axios.post("http://localhost:8080/transactions/issuance/stock", stockIssuanceData);
        console.log("✅ Stock issued:", stockIssuanceResponse.data);

        await sleep(3000);

        // 7. Exercise equity compensation
        console.log("\n⏳ Exercising equity compensation...");
        const exerciseData = {
            issuerId,
            data: {
                security_id: equityCompSecurityId,
                date: "2025-03-05",
                consideration_text: "Anagram Ltd. Exercise 24,073 shares for $1925.84 ",
                resulting_security_ids: [resultingStockSecurityId],
                quantity: "500",
                comments: [""],
            },
        };
        const exerciseResponse = await axios.post("http://localhost:8080/transactions/exercise/equity-compensation", exerciseData);
        console.log("✅ Equity compensation exercised:", exerciseResponse.data);

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
