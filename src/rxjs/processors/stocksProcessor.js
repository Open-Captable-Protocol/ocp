/**
 * Stocks Processor Module
 *
 * This module is responsible for processing stock transactions for the stakeholder view
 * and preparing the data for the Stocks Ledger tab in the Excel export.
 * It processes various transaction types related to stocks including:
 *   - Stock Issuance
 *   - Stock Cancellation
 *   - Stock Transfer
 *   - Equity Compensation Issuance
 *   - Equity Compensation Exercise
 */

/**
 * Initialize stocks processor state
 * @returns {Object} Initial stocks state
 */
export const stocksProcessorInitialState = () => {
    return {
        stockTransactions: [],
        stockClassTotals: {},
        stockClasses: {},
    };
};

/**
 * Process stock issuance transaction
 * @param {Object} state Current state
 * @param {Object} transaction Stock issuance transaction
 * @param {Object} stakeholder Stakeholder receiving the stock
 * @param {Object} stockClass Stock class being issued
 * @param {Object} _stockPlan Stock plan if applicable
 * @returns {Object} Updated state with processed stock issuance
 */
export const processStockIssuance = (state, transaction, stakeholder, stockClass, _stockPlan) => {
    // Create deep clone of state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    const {
        id: transactionId,
        date,
        security_id,
        quantity,
        share_price,
        board_approval_date,
        custom_id,
        comments,
        stock_legend_ids,
        vesting_terms_id,
        issuance_type: issuanceType,
        stock_class_id,
        stock_plan_id,
    } = transaction;

    // Find related vesting terms if available
    let vestingTerms = null;
    let vestingSchedule = null;
    let vestingCommencementDate = null;

    if (vesting_terms_id && transaction.issuer_data && transaction.issuer_data.vesting_terms) {
        vestingTerms = transaction.issuer_data.vesting_terms.find((term) => term.id === vesting_terms_id);
        if (vestingTerms) {
            vestingSchedule = vestingTerms.vesting_schedule ? vestingTerms.vesting_schedule.name : null;
            vestingCommencementDate = vestingTerms.vesting_commencement_date || null;
        }
    }

    // Calculate amounts
    const numShares = parseInt(quantity) || 0;
    const pricePerShare = share_price ? parseFloat(share_price.amount) : 0;
    const amountPaid = numShares * pricePerShare;

    // Get stock class information
    const className = stockClass ? stockClass.name : "Unknown";
    const classType = stockClass ? stockClass.class_type : "Unknown";

    // Initialize stock class in tracking objects if not exists
    if (!newState.stockClassTotals[stock_class_id]) {
        newState.stockClassTotals[stock_class_id] = {
            id: stock_class_id,
            name: className,
            type: classType,
            sharesIssued: 0,
            sharesOutstanding: 0,
            sharesTransferred: 0,
            sharesCancelled: 0,
        };
    }

    // Store stock class reference for later use
    if (!newState.stockClasses[stock_class_id] && stockClass) {
        newState.stockClasses[stock_class_id] = stockClass;
    }

    // Update shares count
    newState.stockClassTotals[stock_class_id].sharesIssued += numShares;
    newState.stockClassTotals[stock_class_id].sharesOutstanding += numShares;

    // Get plan name if available
    let planName = null;
    if (stock_plan_id && transaction.issuer_data && transaction.issuer_data.stock_plans) {
        const stockPlanObj = transaction.issuer_data.stock_plans.find((plan) => plan.id === stock_plan_id);
        planName = stockPlanObj ? stockPlanObj.name : null;
    }

    // Get legends if available
    let legends = [];
    if (stock_legend_ids && stock_legend_ids.length > 0 && transaction.issuer_data && transaction.issuer_data.stock_legends) {
        legends = stock_legend_ids
            .map((id) => {
                const legend = transaction.issuer_data.stock_legends.find((l) => l.id === id);
                return legend ? legend.text : null;
            })
            .filter((l) => l !== null);
    }

    // Create a formatted transaction record
    const transactionRecord = {
        id: transactionId,
        securityId: security_id,
        certificateId: custom_id || "N/A",
        date: new Date(date),
        type: "TX_STOCK_ISSUANCE",
        displayType: "Stock Issuance",
        holderName: stakeholder ? stakeholder.name.legal_name : "Unknown",
        holderId: stakeholder ? stakeholder._id : null,
        relationship: stakeholder ? stakeholder.current_relationship : "Unknown",
        stockClassId: stock_class_id,
        stockClassName: className,
        stockClassType: classType,
        quantity: numShares,
        pricePerShare: pricePerShare,
        amountPaid: amountPaid,
        boardApprovalDate: board_approval_date ? new Date(board_approval_date) : null,
        issuanceType: issuanceType || "Standard",
        outstandingQuantity: numShares,
        isOutstanding: true,
        vestingTermsId: vesting_terms_id,
        vestingSchedule: vestingSchedule,
        vestingCommencementDate: vestingCommencementDate ? new Date(vestingCommencementDate) : null,
        stockPlanId: stock_plan_id,
        planName: planName,
        legends: legends.join("; "),
        isCertificated: custom_id ? "Yes" : "No",
        notes: comments || "",
    };

    // Add to transactions list
    newState.stockTransactions.push(transactionRecord);

    return newState;
};

/**
 * Process stock cancellation transaction
 * @param {Object} state Current state
 * @param {Object} transaction Stock cancellation transaction
 * @param {Object} stakeholder Stakeholder whose stock is being cancelled
 * @param {Object} stockIssuance The original stock issuance being cancelled
 * @param {Object} stockClass Stock class being cancelled
 * @returns {Object} Updated state with processed stock cancellation
 */
export const processStockCancellation = (state, transaction, stakeholder, stockIssuance, stockClass) => {
    // Create deep clone of state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    const { id: transactionId, date, security_id, quantity, comments, reason } = transaction;

    // We need the stock class from the original issuance
    const stock_class_id = stockIssuance.stock_class_id;

    // Calculate quantities
    const numShares = parseInt(quantity) || 0;

    // Get stock class information
    const className = stockClass ? stockClass.name : "Unknown";
    const classType = stockClass ? stockClass.class_type : "Unknown";

    // Initialize stock class in tracking objects if not exists (unlikely but for safety)
    if (!newState.stockClassTotals[stock_class_id]) {
        newState.stockClassTotals[stock_class_id] = {
            id: stock_class_id,
            name: className,
            type: classType,
            sharesIssued: 0,
            sharesOutstanding: 0,
            sharesTransferred: 0,
            sharesCancelled: 0,
        };
    }

    // Update share counts
    newState.stockClassTotals[stock_class_id].sharesCancelled += numShares;
    newState.stockClassTotals[stock_class_id].sharesOutstanding -= numShares;

    // Create a formatted transaction record
    const transactionRecord = {
        id: transactionId,
        securityId: security_id,
        certificateId: stockIssuance.custom_id || "N/A",
        date: new Date(date),
        type: "TX_STOCK_CANCELLATION",
        displayType: "Stock Cancellation",
        holderName: stakeholder ? stakeholder.name.legal_name : "Unknown",
        holderId: stakeholder ? stakeholder._id : null,
        relationship: stakeholder ? stakeholder.current_relationship : "Unknown",
        stockClassId: stock_class_id,
        stockClassName: className,
        stockClassType: classType,
        quantity: numShares,
        pricePerShare: 0,
        amountPaid: 0,
        cancellationDate: new Date(date),
        cancellationReason: reason || "Not specified",
        outstandingQuantity: 0,
        isOutstanding: false,
        notes: comments || "",
        relatedSecurityId: stockIssuance.id,
    };

    // Add to transactions list
    newState.stockTransactions.push(transactionRecord);

    return newState;
};

/**
 * Process stock transfer transaction
 * @param {Object} state Current state
 * @param {Object} transaction Stock transfer transaction
 * @param {Object} fromStakeholder Stakeholder transferring the stock
 * @param {Object} toStakeholder Stakeholder receiving the stock
 * @param {Object} stockIssuance The original stock issuance being transferred
 * @param {Object} stockClass Stock class being transferred
 * @returns {Object} Updated state with processed stock transfer
 */
export const processStockTransfer = (state, transaction, fromStakeholder, toStakeholder, stockIssuance, stockClass) => {
    // Create deep clone of state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    const { id: transactionId, date, security_id, quantity, comments, consideration } = transaction;

    // Get the stock class from the original issuance
    const stock_class_id = stockIssuance.stock_class_id;

    // Calculate
    const numShares = parseInt(quantity) || 0;

    // Get stock class information
    const className = stockClass ? stockClass.name : "Unknown";
    const classType = stockClass ? stockClass.class_type : "Unknown";

    // Initialize stock class in tracking objects if not exists
    if (!newState.stockClassTotals[stock_class_id]) {
        newState.stockClassTotals[stock_class_id] = {
            id: stock_class_id,
            name: className,
            type: classType,
            sharesIssued: 0,
            sharesOutstanding: 0,
            sharesTransferred: numShares,
            sharesCancelled: 0,
        };
    } else {
        newState.stockClassTotals[stock_class_id].sharesTransferred += numShares;
    }

    // Create a formatted transaction record
    const transactionRecord = {
        id: transactionId,
        securityId: security_id,
        certificateId: transaction.custom_id || stockIssuance.custom_id || "N/A",
        date: new Date(date),
        type: "TX_STOCK_TRANSFER",
        displayType: "Stock Transfer",
        holderName: toStakeholder ? toStakeholder.name.legal_name : "Unknown",
        holderId: toStakeholder ? toStakeholder._id : null,
        relationship: toStakeholder ? toStakeholder.current_relationship : "Unknown",
        fromHolderName: fromStakeholder ? fromStakeholder.name.legal_name : "Unknown",
        fromHolderId: fromStakeholder ? fromStakeholder._id : null,
        stockClassId: stock_class_id,
        stockClassName: className,
        stockClassType: classType,
        quantity: numShares,
        consideration: consideration ? consideration.amount : 0,
        outstandingQuantity: numShares,
        isOutstanding: true,
        notes: comments || "",
        relatedSecurityId: stockIssuance.id,
    };

    // Add to transactions list
    newState.stockTransactions.push(transactionRecord);

    return newState;
};

/**
 * Process equity compensation issuance
 * @param {Object} state Current state
 * @param {Object} transaction Equity compensation issuance transaction
 * @param {Object} stakeholder Stakeholder receiving the equity comp
 * @param {Object} stockClass Stock class (if applicable)
 * @param {Object} _stockPlan Stock plan (if applicable)
 * @returns {Object} Updated state with processed equity compensation
 */
export const processEquityCompensationIssuance = (state, transaction, stakeholder, stockClass, _stockPlan) => {
    // Create deep clone of state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    const {
        id: transactionId,
        date,
        security_id,
        quantity,
        exercise_price,
        board_approval_date,
        custom_id,
        comments,
        stock_class_id,
        stock_plan_id,
        vesting_terms_id,
        equity_compensation_type,
    } = transaction;

    // Find related vesting terms if available
    let vestingTerms = null;
    let vestingSchedule = null;
    let vestingCommencementDate = null;

    if (vesting_terms_id && transaction.issuer_data && transaction.issuer_data.vesting_terms) {
        vestingTerms = transaction.issuer_data.vesting_terms.find((term) => term.id === vesting_terms_id);
        if (vestingTerms) {
            vestingSchedule = vestingTerms.vesting_schedule ? vestingTerms.vesting_schedule.name : null;
            vestingCommencementDate = vestingTerms.vesting_commencement_date || null;
        }
    }

    // Calculate
    const numShares = parseInt(quantity) || 0;
    const strikePrice = exercise_price ? parseFloat(exercise_price.amount) : 0;

    // Get plan name if available
    let planName = null;
    if (stock_plan_id && transaction.issuer_data && transaction.issuer_data.stock_plans) {
        const stockPlanObj = transaction.issuer_data.stock_plans.find((plan) => plan.id === stock_plan_id);
        planName = stockPlanObj ? stockPlanObj.name : null;
    }

    // Get stock class information if available
    let className = "N/A";
    let classType = "N/A";

    if (stock_class_id && stockClass) {
        className = stockClass.name;
        classType = stockClass.class_type;

        // Initialize stock class in tracking objects if not exists
        if (!newState.stockClassTotals[stock_class_id]) {
            newState.stockClassTotals[stock_class_id] = {
                id: stock_class_id,
                name: className,
                type: classType,
                sharesIssued: 0,
                sharesOutstanding: 0,
                sharesTransferred: 0,
                sharesCancelled: 0,
                optionsIssued: numShares,
            };
        } else {
            if (!newState.stockClassTotals[stock_class_id].optionsIssued) {
                newState.stockClassTotals[stock_class_id].optionsIssued = 0;
            }
            newState.stockClassTotals[stock_class_id].optionsIssued += numShares;
        }
    }

    // Create a formatted transaction record for equity comp issuance
    const transactionRecord = {
        id: transactionId,
        securityId: security_id,
        certificateId: custom_id || "N/A",
        date: new Date(date),
        type: "TX_EQUITY_COMPENSATION_ISSUANCE",
        displayType: equity_compensation_type || "Equity Compensation",
        holderName: stakeholder ? stakeholder.name.legal_name : "Unknown",
        holderId: stakeholder ? stakeholder._id : null,
        relationship: stakeholder ? stakeholder.current_relationship : "Unknown",
        stockClassId: stock_class_id,
        stockClassName: className,
        stockClassType: classType,
        quantity: numShares,
        pricePerShare: strikePrice,
        outstandingQuantity: numShares,
        isOutstanding: true,
        vestingTermsId: vesting_terms_id,
        vestingSchedule: vestingSchedule,
        vestingCommencementDate: vestingCommencementDate ? new Date(vestingCommencementDate) : null,
        boardApprovalDate: board_approval_date ? new Date(board_approval_date) : null,
        stockPlanId: stock_plan_id,
        planName: planName,
        notes: comments || "",
    };

    // Add to transactions list
    newState.stockTransactions.push(transactionRecord);

    return newState;
};

/**
 * Process equity compensation exercise
 * @param {Object} state Current state
 * @param {Object} transaction Exercise transaction
 * @param {Object} stakeholder Stakeholder exercising the equity comp
 * @param {Object} equityCompIssuance Original equity compensation issuance
 * @param {Object} stockClass Stock class (if applicable)
 * @returns {Object} Updated state with processed exercise
 */
export const processEquityCompensationExercise = (state, transaction, stakeholder, equityCompIssuance, stockClass) => {
    // Create deep clone of state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    const { id: transactionId, date, security_id, quantity, consideration, comments } = transaction;

    const stock_class_id = equityCompIssuance ? equityCompIssuance.stock_class_id : null;

    // Calculate
    const numShares = parseInt(quantity) || 0;
    const amountPaid = consideration ? parseFloat(consideration.amount) : 0;

    // Get stock class information if available
    let className = "N/A";
    let classType = "N/A";

    if (stock_class_id && stockClass) {
        className = stockClass.name;
        classType = stockClass.class_type;

        // Initialize stock class in tracking objects if not exists
        if (!newState.stockClassTotals[stock_class_id]) {
            newState.stockClassTotals[stock_class_id] = {
                id: stock_class_id,
                name: className,
                type: classType,
                sharesIssued: numShares,
                sharesOutstanding: numShares,
                sharesTransferred: 0,
                sharesCancelled: 0,
                optionsExercised: numShares,
            };
        } else {
            newState.stockClassTotals[stock_class_id].sharesIssued += numShares;
            newState.stockClassTotals[stock_class_id].sharesOutstanding += numShares;

            if (!newState.stockClassTotals[stock_class_id].optionsExercised) {
                newState.stockClassTotals[stock_class_id].optionsExercised = 0;
            }
            newState.stockClassTotals[stock_class_id].optionsExercised += numShares;
        }
    }

    // Create a formatted transaction record for exercise
    const transactionRecord = {
        id: transactionId,
        securityId: security_id,
        certificateId: transaction.custom_id || "N/A",
        date: new Date(date),
        type: "TX_EQUITY_COMPENSATION_EXERCISE",
        displayType: "Option Exercise",
        holderName: stakeholder ? stakeholder.name.legal_name : "Unknown",
        holderId: stakeholder ? stakeholder._id : null,
        relationship: stakeholder ? stakeholder.current_relationship : "Unknown",
        stockClassId: stock_class_id,
        stockClassName: className,
        stockClassType: classType,
        quantity: numShares,
        amountPaid: amountPaid,
        outstandingQuantity: numShares,
        isOutstanding: true,
        notes: comments || "",
        relatedSecurityId: equityCompIssuance ? equityCompIssuance.id : null,
    };

    // Add to transactions list
    newState.stockTransactions.push(transactionRecord);

    return newState;
};

/**
 * Format stocks data for display in the Excel export
 * @param {Object} stocksState The current stocks processor state
 * @returns {Object} Formatted data ready for Excel export
 */
export const formatStocksForDisplay = (stocksState) => {
    // Deep clone state to avoid mutations
    const formattedState = JSON.parse(JSON.stringify(stocksState));

    // Format dates and numbers for better display
    formattedState.stockTransactions = formattedState.stockTransactions.map((tx) => {
        // Format dates
        if (tx.date) {
            tx.date = new Date(tx.date);
        }
        if (tx.boardApprovalDate) {
            tx.boardApprovalDate = new Date(tx.boardApprovalDate);
        }
        if (tx.vestingCommencementDate) {
            tx.vestingCommencementDate = new Date(tx.vestingCommencementDate);
        }
        if (tx.cancellationDate) {
            tx.cancellationDate = new Date(tx.cancellationDate);
        }

        // Calculate equity value (used for display)
        if (tx.quantity && tx.pricePerShare) {
            tx.equityValue = tx.quantity * tx.pricePerShare;
        } else {
            tx.equityValue = 0;
        }

        return tx;
    });

    // Sort transactions by date
    formattedState.stockTransactions.sort((a, b) => {
        if (a.date && b.date) {
            return a.date - b.date;
        }
        return 0;
    });

    // Group transactions by stakeholder
    const stocksByStakeholder = {};

    formattedState.stockTransactions.forEach((tx) => {
        if (!tx.holderId) return;

        // Initialize stakeholder entry if not exists
        if (!stocksByStakeholder[tx.holderId]) {
            stocksByStakeholder[tx.holderId] = {
                id: tx.holderId,
                name: tx.holderName,
                relationship: tx.relationship,
                holdings: {
                    stocks: [],
                },
            };
        }

        // Group by stock class
        let stockClassHolding = stocksByStakeholder[tx.holderId].holdings.stocks.find((s) => s.stockClassId === tx.stockClassId);

        if (!stockClassHolding) {
            stockClassHolding = {
                stockClassId: tx.stockClassId,
                className: tx.stockClassName,
                type: tx.stockClassType,
                transactions: [],
            };
            stocksByStakeholder[tx.holderId].holdings.stocks.push(stockClassHolding);
        }

        // Add transaction to the appropriate stock class
        stockClassHolding.transactions.push(tx);
    });

    // Convert to array format for easier consumption
    const formattedOutput = {
        transactions: formattedState.stockTransactions,
        classTotals: Object.values(formattedState.stockClassTotals),
        stakeholders: Object.values(stocksByStakeholder),
    };

    return formattedOutput;
};

/**
 * Process all stock transaction types from issuer data
 * @param {Object} issuerData Full issuer data including transactions, stakeholders, etc.
 * @returns {Object} Processed stocks data ready for display
 */
export const processStocksData = (issuerData) => {
    // Initialize state
    let state = stocksProcessorInitialState();

    // Extract necessary data from issuer data
    const transactions = issuerData.transactions || [];
    const stakeholders = issuerData.stakeholders || [];
    const stockClasses = issuerData.stock_classes || [];
    const stockPlans = issuerData.stock_plans || [];

    // Process each transaction
    transactions.forEach((transaction) => {
        // Find related stakeholder
        const stakeholder = stakeholders.find((s) => s.id === transaction.stakeholder_id);

        // Find related stock class if applicable
        let stockClass = null;
        if (transaction.stock_class_id) {
            stockClass = stockClasses.find((sc) => sc.id === transaction.stock_class_id);
        }

        // Find related stock plan if applicable
        let stockPlan = null;
        if (transaction.stock_plan_id) {
            stockPlan = stockPlans.find((sp) => sp.id === transaction.stock_plan_id);
        }

        // Add issuer data to transaction for referencing related objects
        transaction.issuer_data = issuerData;

        // Process different transaction types
        switch (transaction.object_type) {
            case "TX_STOCK_ISSUANCE":
                if (stakeholder && stockClass) {
                    state = processStockIssuance(state, transaction, stakeholder, stockClass, stockPlan);
                }
                break;

            case "TX_STOCK_CANCELLATION":
                {
                    // Find the original issuance
                    const stockIssuance = transactions.find(
                        (t) =>
                            t.security_id === transaction.security_id &&
                            (t.object_type === "TX_STOCK_ISSUANCE" || t.object_type === "TX_EQUITY_COMPENSATION_EXERCISE")
                    );

                    if (stakeholder && stockIssuance) {
                        // Get the stock class
                        const cancellationStockClass = stockClasses.find((sc) => sc.id === stockIssuance.stock_class_id);

                        if (cancellationStockClass) {
                            state = processStockCancellation(state, transaction, stakeholder, stockIssuance, cancellationStockClass);
                        }
                    }
                }
                break;

            case "TX_STOCK_TRANSFER":
                {
                    // Find the original issuance
                    const stockIssuance = transactions.find(
                        (t) =>
                            t.security_id === transaction.security_id &&
                            (t.object_type === "TX_STOCK_ISSUANCE" || t.object_type === "TX_EQUITY_COMPENSATION_EXERCISE")
                    );

                    // Find the stakeholder this is being transferred from
                    const fromStakeholder = stakeholders.find((s) => s.id === transaction.from_stakeholder_id);

                    // Find the stakeholder this is being transferred to
                    const toStakeholder = stakeholders.find((s) => s.id === transaction.stakeholder_id);

                    if (stockIssuance && fromStakeholder && toStakeholder) {
                        // Get the stock class
                        const transferStockClass = stockClasses.find((sc) => sc.id === stockIssuance.stock_class_id);

                        if (transferStockClass) {
                            state = processStockTransfer(state, transaction, fromStakeholder, toStakeholder, stockIssuance, transferStockClass);
                        }
                    }
                }
                break;

            case "TX_EQUITY_COMPENSATION_ISSUANCE":
                if (stakeholder) {
                    state = processEquityCompensationIssuance(state, transaction, stakeholder, stockClass, stockPlan);
                }
                break;

            case "TX_EQUITY_COMPENSATION_EXERCISE":
                {
                    // Find the original equity issuance
                    const equityIssuance = transactions.find(
                        (t) => t.object_type === "TX_EQUITY_COMPENSATION_ISSUANCE" && t.security_id === transaction.security_id
                    );

                    if (stakeholder && equityIssuance) {
                        // Get the stock class
                        const exerciseStockClass = stockClasses.find((sc) => sc.id === equityIssuance.stock_class_id);

                        if (exerciseStockClass) {
                            state = processEquityCompensationExercise(state, transaction, stakeholder, equityIssuance, exerciseStockClass);
                        }
                    }
                }
                break;
        }
    });

    // Format data for display
    return formatStocksForDisplay(state);
};
