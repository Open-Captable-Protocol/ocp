import { Router } from "express";
import { captableStats, verifyCapTable } from "../rxjs/index.js";
import { validateCapTableData } from "../scripts/validate.js";

const router = Router();

const getAllStateMachineObjectsFromWorkspaceJSON = async (workspaceJson) => {
    const issuer = workspaceJson.Manifest_files?.issuer || {};
    const stockClasses = workspaceJson.StockClasses_files?.items || [];
    const stockPlans = workspaceJson.StockPlans_files?.items || [];
    const stakeholders = workspaceJson.Stakeholders_files?.items || [];
    const transactions = workspaceJson.Transactions_files?.items || [];

    // OCF transaction types are already prefixed with TX_ (e.g., TX_STOCK_ISSUANCE)
    // We can directly use these types for sorting if they match the existing typeOrder keys.
    // The existing typeOrder might need adjustment if OCF types differ slightly or have new ones.
    const allTransactions = [...transactions].sort((a, b) => {
        const typeOrder = {
            TX_ISSUER_AUTHORIZED_SHARES_ADJUSTMENT: 0,
            TX_STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT: 1,
            TX_STOCK_PLAN_POOL_ADJUSTMENT: 2,
            TX_STOCK_ISSUANCE: 3,
            TX_EQUITY_COMPENSATION_ISSUANCE: 3, // Assuming OCF uses this or a similar type
            TX_CONVERTIBLE_ISSUANCE: 3,
            TX_WARRANT_ISSUANCE: 3, // Assuming OCF uses this or a similar type
            TX_EQUITY_COMPENSATION_EXERCISE: 4, // Assuming OCF uses this or a similar type
            TX_STOCK_CANCELLATION: 4, // Assuming OCF uses this or a similar type
            TX_VESTING_START: 5, // Vesting events might need a defined order
            // Add any other OCF transaction types here and assign order
        };

        const typeCompare = (typeOrder[a.object_type] ?? 99) - (typeOrder[b.object_type] ?? 99);

        if (typeCompare !== 0) {
            return typeCompare;
        }

        // Sort by date if types are the same. OCF transactions have a 'date' field.
        // Ensure dates are valid before comparing
        const dateA = a.date ? new Date(a.date) : null;
        const dateB = b.date ? new Date(b.date) : null;

        if (dateA && dateB) {
            return dateA - dateB;
        } else if (dateA) {
            return -1; // Place items with valid dates first
        } else if (dateB) {
            return 1;
        } else {
            return 0; // If neither has a date, keep original relative order for same types
        }
    });

    return {
        issuer,
        stockClasses,
        stockPlans,
        stakeholders,
        transactions: allTransactions,
    };
};

router.post("/captable", async (req, res) => {
    try {
        console.log("req.body", req.body);
        const workspaceJson = req.body;
        console.log("workspaceJson", workspaceJson);

        if (!workspaceJson || Object.keys(workspaceJson).length === 0) {
            return res.status(400).send({ error: "Request body is empty or invalid JSON." });
        }

        const issuerData = await getAllStateMachineObjectsFromWorkspaceJSON(workspaceJson);
        const errors = await validateCapTableData(issuerData);
        if (errors.length > 0) {
            return res.status(400).send({ errors });
        }
        const result = await verifyCapTable(issuerData);
        if (!result.valid) {
            return res.status(400).send({ errors: result.errors });
        }
        const rxjsData = await captableStats(issuerData);

        if (rxjsData?.errors?.size > 0) {
            // captureException(new Error(Array.from(rxjsData.errors).join("\n")));
            return res.status(500).send({ errors: Array.from(rxjsData.errors) });
        }

        res.status(200).send(rxjsData);
        // res.status(200).send("hello");
    } catch (error) {
        // captureException(error);
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
        res.status(500).send({ error: "Failed to generate workspace stats.", details: errorMessage });
    }
});

router.post("/verify", async (req, res) => {
    try {
        // Validate request body
        if (!req.body || Object.keys(req.body).length === 0) {
            return res.status(400).send({
                error: "Request body is empty or invalid JSON.",
                valid: false,
            });
        }

        // Get data from workspace JSON
        const data = await getAllStateMachineObjectsFromWorkspaceJSON(req.body);

        // Validate cap table data
        const validationErrors = await validateCapTableData(data);
        if (validationErrors.length > 0) {
            return res.status(400).send({
                errors: validationErrors,
                valid: false,
            });
        }

        // Verify cap table
        const verificationResult = await verifyCapTable(data);

        return res.status(200).send({
            valid: verificationResult.valid,
            errors: verificationResult.valid ? undefined : verificationResult.errors,
        });
    } catch (error) {
        console.error("Cap table verification error:", error);
        return res.status(500).send({
            error: String(error),
            valid: false,
        });
    }
});

export default router;
