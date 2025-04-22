/**
 * Warrants Processor Module
 *
 * This module is responsible for processing warrant securities
 * within the stakeholder view state machine.
 */

/**
 * Process warrant issuance for stakeholder view
 * @param {Object} state Current state
 * @param {Object} transaction Warrant issuance transaction
 * @param {Object} stakeholder Stakeholder receiving the warrant
 * @param {Object} stockClass Stock class if applicable
 * @returns {Object} Updated state with processed stakeholder holdings
 */
export const processStakeholderViewWarrantIssuance = (state, transaction, stakeholder, stockClass) => {
    const {
        exercise_triggers,
        id,
        custom_id,
        date,
        board_approval_date,
        security_law_exemptions = [],
        comments = [],
        purchase_price,
        exercise_price,
        quantity,
        quantity_source,
        warrant_expiration_date,
        vestings = [],
        vesting_terms_id,
        consideration_text,
    } = transaction;

    const stakeholderId = stakeholder._id;

    // Deep clone state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    // Try to determine the number of shares this warrant represents
    let numShares = 0;
    let convertToStockClassId = null;
    let triggerType = null;
    let triggerDescription = null;
    let triggerCondition = null;
    let conversionMechanismType = null;
    let conversionDiscount = null;
    let conversionValuationCap = null;

    if (exercise_triggers && exercise_triggers.length > 0) {
        const trigger = exercise_triggers[0];

        // Extract trigger details
        triggerType = trigger.type || null;
        triggerDescription = trigger.trigger_description || trigger.nickname || null;
        triggerCondition = trigger.trigger_condition || null;

        if (
            trigger.conversion_right &&
            trigger.conversion_right.conversion_mechanism &&
            trigger.conversion_right.conversion_mechanism.type === "FIXED_AMOUNT_CONVERSION"
        ) {
            numShares = parseInt(trigger.conversion_right.conversion_mechanism.converts_to_quantity || 0);
            conversionMechanismType = "FIXED_AMOUNT_CONVERSION";
        } else if (
            trigger.conversion_right &&
            trigger.conversion_right.conversion_mechanism &&
            trigger.conversion_right.conversion_mechanism.type === "VALUATION_BASED_CONVERSION"
        ) {
            conversionMechanismType = "VALUATION_BASED_CONVERSION";
            if (trigger.conversion_right.conversion_mechanism.valuation_amount) {
                conversionValuationCap = trigger.conversion_right.conversion_mechanism.valuation_amount.amount;
            }
            // For valuation-based conversions, use quantity as shares if specified
            numShares = parseInt(quantity || 0);
        } else if (
            trigger.conversion_right &&
            trigger.conversion_right.conversion_mechanism &&
            trigger.conversion_right.conversion_mechanism.type === "PPS_BASED_CONVERSION"
        ) {
            conversionMechanismType = "PPS_BASED_CONVERSION";
            if (trigger.conversion_right.conversion_mechanism.discount) {
                conversionDiscount = true;
                if (trigger.conversion_right.conversion_mechanism.discount_amount) {
                    conversionDiscount = trigger.conversion_right.conversion_mechanism.discount_amount.amount;
                }
            }
            // For PPS-based conversions, use quantity as shares if specified
            numShares = parseInt(quantity || 0);
        }

        // Extract stock class ID if present
        if (trigger.conversion_right && trigger.conversion_right.converts_to_stock_class_id) {
            convertToStockClassId = trigger.conversion_right.converts_to_stock_class_id;
        }
    }

    if (numShares === 0) {
        // If we can't determine shares from triggers, use quantity field directly
        numShares = parseInt(quantity || 0);
    }

    // If we still have no shares, this warrant can't be processed
    if (numShares === 0) {
        return state;
    }

    // Initialize holder if not exists
    if (!newState.holders[stakeholderId]) {
        newState.holders[stakeholderId] = {
            id: stakeholderId,
            name: stakeholder.name.legal_name,
            relationship: stakeholder.current_relationship,
            holdings: {
                outstanding: 0,
                asConverted: 0,
                fullyDiluted: 0,
                byClass: {},
            },
            votingRights: {
                votes: 0,
                percentage: 0,
            },
        };
    }

    const holder = newState.holders[stakeholderId];
    const className = stockClass ? stockClass.name : "Unknown";
    const categoryName = `${className} Warrants`;

    // Initialize category in holdings if not exists
    if (!holder.holdings.byClass[categoryName]) {
        holder.holdings.byClass[categoryName] = {
            type: "WARRANT",
            className: categoryName,
            stockClassId: stockClass ? stockClass._id : null,
            outstanding: 0,
            asConverted: 0,
            fullyDiluted: 0,
            votingPower: 0,
        };
    }

    const categoryHolding = holder.holdings.byClass[categoryName];

    // These don't count towards outstanding, only fully diluted
    categoryHolding.fullyDiluted += numShares;

    // Update holder totals - warrants only impact fully diluted
    holder.holdings.fullyDiluted += numShares;

    // Initialize warrants collection if it doesn't exist
    if (!holder.warrants) {
        holder.warrants = [];
    }

    // Format security law exemptions
    const formattedExemptions = security_law_exemptions.map((exemption) => ({
        description: exemption.description || "",
        jurisdiction: exemption.jurisdiction || "",
    }));

    // Process vestings if present
    const formattedVestings = vestings.map((vesting) => ({
        date: vesting.date,
        amount: parseInt(vesting.amount),
    }));

    // Calculate total vested amount
    let vestedAmount = 0;
    if (formattedVestings.length > 0) {
        vestedAmount = formattedVestings.reduce((total, vesting) => total + (vesting.amount || 0), 0);
    }

    // Format the stock class for this warrant
    const targetStockClass = stockClass
        ? {
              id: stockClass._id,
              name: stockClass.name,
              type: stockClass.class_type,
          }
        : null;

    // Determine series of stock
    let seriesOfStock = null;
    if (targetStockClass) {
        seriesOfStock = targetStockClass.name;
    } else if (convertToStockClassId) {
        // We have a reference to a stock class we don't have in our current context
        // This is common for warrants that convert to future series
        seriesOfStock = `Stock Class (ID: ${convertToStockClassId})`;
    }

    // Build basis of issuance text
    let basisOfIssuance = `Warrant to Purchase Stock, dated ${date ? new Date(date).toISOString().split("T")[0] : "N/A"}`;
    if (consideration_text) {
        basisOfIssuance += ` (${consideration_text})`;
    }

    // Add detailed warrant information
    const warrantItem = {
        id,
        customId: custom_id || id.substring(0, 8),
        date,
        boardApprovalDate: board_approval_date || null,

        // Shares information
        sharesIssuable: numShares,
        sharesRemaining: numShares, // Default to full amount unless we track exercises
        sharesExercised: 0, // Default to none exercised
        sharesCancelled: 0, // Default to none cancelled

        // Price information
        exercisePrice: exercise_price?.amount || null,
        currency: exercise_price?.currency || "USD",
        purchasePrice: purchase_price?.amount || null,
        purchaseCurrency: purchase_price?.currency || "USD",

        // Expiration and dates
        expirationDate: warrant_expiration_date,
        exerciseDate: null, // Default to not exercised
        cancellationDate: null, // Default to not cancelled

        // Stock class information
        stockClass: seriesOfStock,
        stockClassId: convertToStockClassId || stockClass?._id || null,

        // Trigger information
        triggerType,
        triggerDescription,
        triggerCondition,

        // Conversion mechanism details
        conversionMechanismType,
        conversionDiscount,
        conversionValuationCap,

        // Vesting information
        vestingTermsId: vesting_terms_id || null,
        vestings: formattedVestings,
        vestedAmount,

        // Regulatory information
        exemptions: formattedExemptions,
        comments: comments || [],

        // Status information
        isOutstanding: true, // Default to outstanding
        basisOfIssuance,
        basisForCancellation: null,

        // Tracking source of quantity
        quantitySource: quantity_source || null,
    };

    // Add to warrants collection
    holder.warrants.push(warrantItem);

    return newState;
};

/**
 * Process warrant exercise for stakeholder view
 * @param {Object} state Current state
 * @param {Object} transaction Warrant exercise transaction
 * @param {Object} warrantIssuance Original warrant issuance transaction
 * @param {Object} stockClass Stock class being exercised into
 * @returns {Object} Updated state with exercise recorded
 */
export const processStakeholderViewWarrantExercise = (state, transaction, warrantIssuance, stockClass) => {
    if (!warrantIssuance || !warrantIssuance.stakeholder_id) {
        return state;
    }

    const { quantity, date } = transaction;
    const exercisedShares = parseInt(quantity);
    const stakeholderId = warrantIssuance.stakeholder_id;
    const warrantId = warrantIssuance.id;

    // Deep clone state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    // If holder doesn't exist, exercise has no effect
    if (!newState.holders[stakeholderId]) {
        return state;
    }

    const holder = newState.holders[stakeholderId];

    // Find the warrant in the holder's warrants collection
    if (holder.warrants) {
        const warrantIndex = holder.warrants.findIndex((w) => w.id === warrantId);
        if (warrantIndex >= 0) {
            const warrant = holder.warrants[warrantIndex];

            // Update exercise information
            warrant.sharesExercised = (warrant.sharesExercised || 0) + exercisedShares;
            warrant.sharesRemaining = Math.max(0, warrant.sharesIssuable - warrant.sharesExercised);
            warrant.exerciseDate = date;

            // If all shares exercised, mark as not outstanding
            if (warrant.sharesRemaining <= 0) {
                warrant.isOutstanding = false;
            }

            // Update the warrant
            holder.warrants[warrantIndex] = warrant;
        }
    }

    // Update fully diluted tracking
    // When a warrant is exercised, the shares come out of fully diluted count
    // But will be added back through a stock issuance transaction, so we remove them here
    const className = stockClass ? stockClass.name : "Unknown";
    const categoryName = `${className} Warrants`;

    if (holder.holdings.byClass[categoryName]) {
        const categoryHolding = holder.holdings.byClass[categoryName];
        categoryHolding.fullyDiluted = Math.max(0, categoryHolding.fullyDiluted - exercisedShares);
        holder.holdings.fullyDiluted = Math.max(0, holder.holdings.fullyDiluted - exercisedShares);
    }

    return newState;
};

/**
 * Process warrant cancellation for stakeholder view
 * @param {Object} state Current state
 * @param {Object} transaction Warrant cancellation transaction
 * @param {Object} warrantIssuance Original warrant issuance transaction
 * @param {Object} stockClass Stock class of the warrant
 * @returns {Object} Updated state with cancellation recorded
 */
export const processStakeholderViewWarrantCancellation = (state, transaction, warrantIssuance, stockClass) => {
    if (!warrantIssuance || !warrantIssuance.stakeholder_id) {
        return state;
    }

    const { quantity, date, cancellation_reason } = transaction;
    const cancelledShares = parseInt(quantity);
    const stakeholderId = warrantIssuance.stakeholder_id;
    const warrantId = warrantIssuance.id;

    // Deep clone state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    // If holder doesn't exist, cancellation has no effect
    if (!newState.holders[stakeholderId]) {
        return state;
    }

    const holder = newState.holders[stakeholderId];

    // Find the warrant in the holder's warrants collection
    if (holder.warrants) {
        const warrantIndex = holder.warrants.findIndex((w) => w.id === warrantId);
        if (warrantIndex >= 0) {
            const warrant = holder.warrants[warrantIndex];

            // Update cancellation information
            warrant.sharesCancelled = (warrant.sharesCancelled || 0) + cancelledShares;
            warrant.sharesRemaining = Math.max(0, warrant.sharesIssuable - warrant.sharesExercised - warrant.sharesCancelled);
            warrant.cancellationDate = date;
            warrant.basisForCancellation = cancellation_reason || "Cancelled";

            // If all shares cancelled or exercised, mark as not outstanding
            if (warrant.sharesRemaining <= 0) {
                warrant.isOutstanding = false;
            }

            // Update the warrant
            holder.warrants[warrantIndex] = warrant;
        }
    }

    // Update fully diluted tracking
    const className = stockClass ? stockClass.name : "Unknown";
    const categoryName = `${className} Warrants`;

    if (holder.holdings.byClass[categoryName]) {
        const categoryHolding = holder.holdings.byClass[categoryName];
        categoryHolding.fullyDiluted = Math.max(0, categoryHolding.fullyDiluted - cancelledShares);
        holder.holdings.fullyDiluted = Math.max(0, holder.holdings.fullyDiluted - cancelledShares);
    }

    return newState;
};

/**
 * Format warrants for display
 *
 * @param {Array} warrants - Raw warrants data
 * @returns {Array} Formatted warrants data ready for display
 */
export const formatWarrantsForDisplay = (warrants) => {
    if (!warrants || !Array.isArray(warrants)) {
        return [];
    }

    return warrants.map((warrant) => ({
        ...warrant,
        formattedSharesIssuable: warrant.sharesIssuable ? warrant.sharesIssuable.toLocaleString() : "0",
        formattedSharesRemaining: warrant.sharesRemaining ? warrant.sharesRemaining.toLocaleString() : "0",
        formattedSharesExercised: warrant.sharesExercised ? warrant.sharesExercised.toLocaleString() : "0",
        formattedSharesCancelled: warrant.sharesCancelled ? warrant.sharesCancelled.toLocaleString() : "0",
        formattedExercisePrice: warrant.exercisePrice ? `$${Number(warrant.exercisePrice).toLocaleString()}` : "",
        formattedPurchasePrice: warrant.purchasePrice ? `$${Number(warrant.purchasePrice).toLocaleString()}` : "",
        formattedDate: warrant.date ? new Date(warrant.date).toISOString().split("T")[0] : "",
        formattedBoardApprovalDate: warrant.boardApprovalDate ? new Date(warrant.boardApprovalDate).toISOString().split("T")[0] : "",
        formattedExpirationDate: warrant.expirationDate ? new Date(warrant.expirationDate).toISOString().split("T")[0] : "",
        formattedExerciseDate: warrant.exerciseDate ? new Date(warrant.exerciseDate).toISOString().split("T")[0] : "",
        formattedCancellationDate: warrant.cancellationDate ? new Date(warrant.cancellationDate).toISOString().split("T")[0] : "",
        formattedExemptions: warrant.exemptions?.map((e) => `${e.description} (${e.jurisdiction})`).join("; ") || "",
        basisOfIssuance:
            warrant.basisOfIssuance ||
            `Warrant to Purchase Stock, dated ${warrant.date ? new Date(warrant.date).toISOString().split("T")[0] : "N/A"}`,
        outstanding: warrant.isOutstanding ? "Y" : "N",
    }));
};

// Export the module
export default {
    processStakeholderViewWarrantIssuance,
    processStakeholderViewWarrantExercise,
    processStakeholderViewWarrantCancellation,
    formatWarrantsForDisplay,
};
