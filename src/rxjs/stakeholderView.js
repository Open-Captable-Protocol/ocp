/**
 * StakeholderView Module
 *
 * This module is responsible for processing and formatting stakeholder holdings and voting rights data
 * for display in the cap table dashboard. It calculates:
 *   - Total Stock Outstanding
 *   - Total Stock (As Converted)
 *   - Fully Diluted Shares
 *   - Voting Rights
 *   - Ownership percentages
 */

// Security types
const StockClassTypes = {
    COMMON: "COMMON",
    PREFERRED: "PREFERRED",
};

const StockIssuanceTypes = {
    FOUNDERS_STOCK: "FOUNDERS_STOCK",
};

/**
 * Initialize stakeholder view state
 * @returns {Object} Initial stakeholder view state
 */
export const stakeholderViewInitialState = () => {
    return {
        holders: {},
    };
};

/**
 * Process stock issuance for stakeholder view
 * @param {Object} state Current state
 * @param {Object} transaction Stock issuance transaction
 * @param {Object} stakeholder Stakeholder receiving the stock
 * @param {Object} originalStockClass Stock class being issued
 * @returns {Object} Updated state with processed stakeholder holdings
 */
export const processStakeholderViewStockIssuance = (state, transaction, stakeholder, originalStockClass) => {
    const { stock_class_id, quantity, issuance_type } = transaction;
    const numShares = parseInt(quantity);
    const stakeholderId = stakeholder._id;

    // Deep clone state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

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
    const className = originalStockClass.name;
    const classType = originalStockClass.class_type;
    const votesPerShare = parseInt(originalStockClass.votes_per_share);

    // Calculate voting power for this issuance
    const votingPower = votesPerShare * numShares;

    // Initialize class in holdings if not exists
    if (!holder.holdings.byClass[className]) {
        holder.holdings.byClass[className] = {
            type: classType,
            className: className,
            stockClassId: stock_class_id,
            outstanding: 0,
            asConverted: 0,
            fullyDiluted: 0,
            votingPower: 0,
            isFounderPreferred: classType === StockClassTypes.PREFERRED && issuance_type === StockIssuanceTypes.FOUNDERS_STOCK,
        };
    }

    const classHolding = holder.holdings.byClass[className];

    // Update share counts
    classHolding.outstanding += numShares;
    classHolding.fullyDiluted += numShares;
    classHolding.votingPower += votingPower;

    // Calculate as-converted shares
    let asConvertedShares = numShares;

    // If this is preferred stock, check for conversion rights
    if (classType === StockClassTypes.PREFERRED && originalStockClass.conversion_rights && originalStockClass.conversion_rights.length > 0) {
        const conversionRight = originalStockClass.conversion_rights[0];
        if (conversionRight.conversion_mechanism && conversionRight.conversion_mechanism.type === "RATIO_CONVERSION") {
            const ratio = conversionRight.conversion_mechanism.ratio;
            if (ratio) {
                const numerator = parseInt(ratio.numerator);
                const denominator = parseInt(ratio.denominator);
                if (numerator && denominator) {
                    asConvertedShares = numShares * (numerator / denominator);
                }
            }
        }
    }

    classHolding.asConverted += asConvertedShares;

    // Update holder totals
    holder.holdings.outstanding += numShares;
    holder.holdings.asConverted += asConvertedShares;
    holder.holdings.fullyDiluted += numShares;
    holder.votingRights.votes += votingPower;

    return newState;
};

/**
 * Process equity compensation issuance for stakeholder view
 * @param {Object} state Current state
 * @param {Object} transaction Equity comp transaction
 * @param {Object} stakeholder Stakeholder
 * @param {Object} stockClass Stock class if applicable
 * @param {Object} _stockPlan Stock plan if applicable
 * @returns {Object} Updated state with processed stakeholder holdings
 */
export const processStakeholderViewEquityCompIssuance = (state, transaction, stakeholder, stockClass, _stockPlan) => {
    const { quantity, compensation_type, stock_plan_id } = transaction;
    const numShares = parseInt(quantity);
    const stakeholderId = stakeholder._id;

    // Deep clone state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

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

    // Format the type for display
    const isOption = compensation_type && compensation_type.includes("OPTION_");
    const isPlanAward = !!stock_plan_id;

    // Determine category name
    let categoryName;
    if (isOption && isPlanAward) {
        categoryName = `${className} Options`;
    } else if (!isPlanAward) {
        categoryName = `${className} Non-Plan Awards`;
    } else {
        categoryName = `${className} Equity Compensation`;
    }

    // Initialize category in holdings if not exists
    if (!holder.holdings.byClass[categoryName]) {
        holder.holdings.byClass[categoryName] = {
            type: "EQUITY_COMPENSATION",
            className: categoryName,
            stockClassId: stockClass ? stockClass._id : null,
            outstanding: 0,
            asConverted: 0,
            fullyDiluted: 0,
            votingPower: 0,
            isOption,
            isPlanAward,
        };
    }

    const categoryHolding = holder.holdings.byClass[categoryName];

    // These don't count towards outstanding, only fully diluted
    categoryHolding.fullyDiluted += numShares;

    // Update holder totals - equity comp only impacts fully diluted
    holder.holdings.fullyDiluted += numShares;

    return newState;
};

/**
 * Process warrant issuance for stakeholder view
 * @param {Object} state Current state
 * @param {Object} transaction Warrant issuance transaction
 * @param {Object} stakeholder Stakeholder receiving the warrant
 * @param {Object} stockClass Stock class if applicable
 * @returns {Object} Updated state with processed stakeholder holdings
 */
export const processStakeholderViewWarrantIssuance = (state, transaction, stakeholder, stockClass) => {
    const { exercise_triggers } = transaction;
    const stakeholderId = stakeholder._id;

    // Deep clone state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    // Try to determine the number of shares this warrant represents
    let numShares = 0;
    if (exercise_triggers && exercise_triggers.length > 0) {
        const trigger = exercise_triggers[0];
        if (
            trigger.conversion_right &&
            trigger.conversion_right.conversion_mechanism &&
            trigger.conversion_right.conversion_mechanism.type === "FIXED_AMOUNT_CONVERSION"
        ) {
            numShares = parseInt(trigger.conversion_right.conversion_mechanism.converts_to_quantity || 0);
        }
    }

    if (numShares === 0) {
        // If we can't determine shares from triggers, use quantity field directly
        numShares = parseInt(transaction.quantity || 0);
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

    return newState;
};

/**
 * Process convertible issuance for stakeholder view
 * @param {Object} state Current state
 * @param {Object} transaction Convertible transaction
 * @param {Object} stakeholder Stakeholder
 * @returns {Object} Updated state
 */
export const processStakeholderViewConvertibleIssuance = (state, transaction, stakeholder) => {
    // Deep clone state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));
    const stakeholderId = stakeholder._id;

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
            convertibles: {
                safes: [],
                notes: [],
                other: [],
            },
        };
    }

    const holder = newState.holders[stakeholderId];

    // Ensure convertibles property exists
    if (!holder.convertibles) {
        holder.convertibles = {
            safes: [],
            notes: [],
            other: [],
        };
    }

    // Extract convertible details
    const { id, convertible_type, investment_amount, date, conversion_triggers = [], custom_id } = transaction;

    // Get monetary value
    const amount = investment_amount?.amount || 0;
    const currency = investment_amount?.currency || "USD";

    // Extract conversion details from triggers (val cap, discount)
    let valuationCap = null;
    let discount = null;

    // Find conversion details in triggers
    conversion_triggers.forEach((trigger) => {
        if (trigger.conversion_mechanism) {
            // Extract valuation cap if present
            if (trigger.conversion_mechanism.valuation_cap) {
                valuationCap = trigger.conversion_mechanism.valuation_cap.amount;
            }

            // Extract discount if present
            if (trigger.conversion_mechanism.type === "DISCOUNT_CONVERSION" && trigger.conversion_mechanism.discount) {
                discount = trigger.conversion_mechanism.discount;
            }
        }

        // Check for conversion right structure (this is the actual path in OCP data)
        if (trigger.conversion_right && trigger.conversion_right.conversion_mechanism) {
            const mechanism = trigger.conversion_right.conversion_mechanism;

            // Extract valuation cap
            if (mechanism.conversion_valuation_cap) {
                valuationCap = mechanism.conversion_valuation_cap.amount;
            }

            // Extract discount
            if (mechanism.type === "DISCOUNT_CONVERSION" && mechanism.discount) {
                discount = mechanism.discount;
            } else if (mechanism.type === "SAFE_CONVERSION" && mechanism.discount) {
                discount = mechanism.discount;
            }
        }
    });

    // Build convertible object
    const convertibleItem = {
        id,
        customId: custom_id || id.substring(0, 8),
        amount,
        currency,
        date,
        valuationCap,
        discount,
        conversionTriggers: conversion_triggers.map((trigger) => ({
            type: trigger.trigger_type,
            description: trigger.description || "",
        })),
    };

    // Add to appropriate list based on type
    switch (convertible_type) {
        case "SAFE":
            holder.convertibles.safes.push(convertibleItem);
            break;
        case "NOTE":
            holder.convertibles.notes.push(convertibleItem);
            break;
        default:
            holder.convertibles.other.push(convertibleItem);
            break;
    }

    return newState;
};

/**
 * Process equity compensation exercise for stakeholder view
 * @param {Object} state Current state
 * @param {Object} transaction Exercise transaction
 * @param {Object} equityIssuance Original equity compensation issuance
 * @returns {Object} Updated state with properly adjusted holdings after exercise
 */
export const processStakeholderViewEquityCompExercise = (state, transaction, equityIssuance) => {
    const { quantity } = transaction;
    const exercisedShares = parseInt(quantity);
    const stakeholderId = equityIssuance.stakeholder_id;

    // If no stakeholder found in state, nothing to do
    if (!state.holders[stakeholderId]) {
        return state;
    }

    // Deep clone state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));
    const holder = newState.holders[stakeholderId];

    // Find the equity category (options/awards)
    const categoryNames = Object.keys(holder.holdings.byClass).filter(
        (className) => holder.holdings.byClass[className].isOption || holder.holdings.byClass[className].isPlanAward
    );

    for (const categoryName of categoryNames) {
        const categoryHolding = holder.holdings.byClass[categoryName];

        // Only adjust the category if it's from the original equity issuance
        if (categoryHolding.stockClassId === equityIssuance.stock_class_id) {
            // Reduce fully diluted shares by the exercised amount
            // This prevents double counting when the resulting stock is issued
            categoryHolding.fullyDiluted -= exercisedShares;
            
            // If all options are exercised, set fully diluted to zero explicitly
            if (categoryHolding.fullyDiluted <= 0) {
                categoryHolding.fullyDiluted = 0;
            }

            // Track which options have been exercised
            if (!categoryHolding.exercised) {
                categoryHolding.exercised = 0;
            }
            categoryHolding.exercised += exercisedShares;
            
            // Mark the options as exercised with a flag for UI filtering
            categoryHolding.isExercised = categoryHolding.fullyDiluted === 0;
            
            // Adjust holder total
            holder.holdings.fullyDiluted -= exercisedShares;

            break;
        }
    }

    return newState;
};

/**
 * Process stock cancellation for stakeholder view
 * @param {Object} state Current state
 * @param {Object} transaction Stock cancellation transaction
 * @param {Object} stockIssuance Original stock issuance being cancelled
 * @param {Object} originalStockClass Stock class being cancelled
 * @returns {Object} Updated state with processed stakeholder cancellation
 */
export const processStakeholderViewStockCancellation = (state, transaction, stockIssuance, originalStockClass) => {
    if (!stockIssuance || !stockIssuance.stakeholder_id) {
        return state;
    }

    const { quantity } = transaction;
    const cancelledShares = parseInt(quantity);
    const stakeholderId = stockIssuance.stakeholder_id;

    // Deep clone state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    // If holder doesn't exist, cancellation has no effect
    if (!newState.holders[stakeholderId]) {
        return state;
    }

    const holder = newState.holders[stakeholderId];
    const className = originalStockClass.name;
    const classType = originalStockClass.class_type;
    const votesPerShare = parseInt(originalStockClass.votes_per_share);

    // Calculate voting power for this cancellation
    const votingPower = votesPerShare * cancelledShares;

    // Check if this class exists in holder's portfolio
    if (!holder.holdings.byClass[className]) {
        return state; // Can't cancel what wasn't issued
    }

    const classHolding = holder.holdings.byClass[className];

    // Calculate as-converted shares to cancel
    let asConvertedShares = cancelledShares;

    // If this is preferred stock, check for conversion rights
    if (classType === StockClassTypes.PREFERRED && originalStockClass.conversion_rights && originalStockClass.conversion_rights.length > 0) {
        const conversionRight = originalStockClass.conversion_rights[0];
        if (conversionRight.conversion_mechanism && conversionRight.conversion_mechanism.type === "RATIO_CONVERSION") {
            const ratio = conversionRight.conversion_mechanism.ratio;
            if (ratio) {
                const numerator = parseInt(ratio.numerator);
                const denominator = parseInt(ratio.denominator);
                if (numerator && denominator) {
                    asConvertedShares = cancelledShares * (numerator / denominator);
                }
            }
        }
    }

    // Update share counts
    classHolding.outstanding -= cancelledShares;
    classHolding.asConverted -= asConvertedShares;
    classHolding.fullyDiluted -= cancelledShares;
    classHolding.votingPower -= votingPower;

    // Update holder totals
    holder.holdings.outstanding -= cancelledShares;
    holder.holdings.asConverted -= asConvertedShares;
    holder.holdings.fullyDiluted -= cancelledShares;
    holder.votingRights.votes -= votingPower;

    return newState;
};

/**
 * Calculate percentages for all stakeholders
 * @param {Object} state Current state
 * @returns {Object} Updated state with percentages calculated
 */
export const calculateStakeholderPercentages = (state) => {
    // Deep clone state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    // Calculate totals across all holders
    const totals = {
        outstandingShares: 0,
        asConvertedShares: 0,
        fullyDilutedShares: 0,
        votingRights: 0,
    };

    // Initialize counters for voting rights by class
    const votingTotals = {
        total: 0, // Total voting power (as converted)
        common: 0, // All Common voting power
        preferred: 0, // All Preferred voting power (as converted)
        byClass: {}, // By specific class (Series A, Series Seed, etc.)
    };

    // First pass - calculate global totals and class totals
    Object.values(newState.holders).forEach((holder) => {
        // Calculate totals for standard metrics
        totals.outstandingShares += holder.holdings.outstanding;
        totals.asConvertedShares += holder.holdings.asConverted;
        totals.fullyDilutedShares += holder.holdings.fullyDiluted;
        totals.votingRights += holder.votingRights.votes;

        // Calculate voting power by class type and series
        Object.values(holder.holdings.byClass).forEach((cls) => {
            const className = cls.className;
            const classType = cls.type;
            const votingPower = cls.votingPower;

            // Add to total voting power
            votingTotals.total += votingPower;

            // Add to class-specific voting power
            if (classType === "COMMON") {
                votingTotals.common += votingPower;
            } else if (classType === "PREFERRED") {
                votingTotals.preferred += votingPower;
            }

            // Add to series-specific voting power
            if (!votingTotals.byClass[className]) {
                votingTotals.byClass[className] = 0;
            }
            votingTotals.byClass[className] += votingPower;
        });
    });

    // Second pass - calculate percentages for each holder
    Object.values(newState.holders).forEach((holder) => {
        // Standard percentages
        if (totals.outstandingShares > 0) {
            holder.holdings.outstandingPercentage = holder.holdings.outstanding / totals.outstandingShares;
        } else {
            holder.holdings.outstandingPercentage = 0;
        }

        if (totals.asConvertedShares > 0) {
            holder.holdings.asConvertedPercentage = holder.holdings.asConverted / totals.asConvertedShares;
        } else {
            holder.holdings.asConvertedPercentage = 0;
        }

        if (totals.fullyDilutedShares > 0) {
            holder.holdings.fullyDilutedPercentage = holder.holdings.fullyDiluted / totals.fullyDilutedShares;
        } else {
            holder.holdings.fullyDilutedPercentage = 0;
        }

        if (totals.votingRights > 0) {
            holder.votingRights.percentage = holder.votingRights.votes / totals.votingRights;
        } else {
            holder.votingRights.percentage = 0;
        }

        // Initialize voting rights structure to match UI table
        holder.votingRights.columns = {
            totalStockAsConverted: 0,
            allCommon: 0,
            allPreferred: 0,
            byClass: {},
        };

        // Calculate voting percentage for each column
        let commonVotingPower = 0;
        let preferredVotingPower = 0;
        const byClassVotingPower = {};

        // Calculate voting power by class
        Object.values(holder.holdings.byClass).forEach((cls) => {
            const className = cls.className;
            const classType = cls.type;
            const votingPower = cls.votingPower;

            // Add to relevant category
            if (classType === "COMMON") {
                commonVotingPower += votingPower;
            } else if (classType === "PREFERRED") {
                preferredVotingPower += votingPower;
            }

            // Add to class-specific voting power
            byClassVotingPower[className] = (byClassVotingPower[className] || 0) + votingPower;
        });

        // Calculate percentages for table columns

        // 1. Total Stock (as converted)
        if (votingTotals.total > 0) {
            holder.votingRights.columns.totalStockAsConverted = (holder.votingRights.votes / votingTotals.total) * 100;
        }

        // 2. All Common
        if (votingTotals.common > 0 && commonVotingPower > 0) {
            holder.votingRights.columns.allCommon = (commonVotingPower / votingTotals.common) * 100;
        }

        // 3. All Preferred (as converted)
        if (votingTotals.preferred > 0 && preferredVotingPower > 0) {
            holder.votingRights.columns.allPreferred = (preferredVotingPower / votingTotals.preferred) * 100;
        }

        // 4. Series-specific columns (Series Seed, Series A, etc.)
        Object.entries(byClassVotingPower).forEach(([className, power]) => {
            if (votingTotals.byClass[className] > 0 && power > 0) {
                if (!holder.votingRights.columns.byClass) {
                    holder.votingRights.columns.byClass = {};
                }

                holder.votingRights.columns.byClass[className] = (power / votingTotals.byClass[className]) * 100;
            }
        });
    });

    // Add totals to the state
    newState.totals = totals;
    newState.votingTotals = votingTotals;

    return newState;
};

/**
 * Format stakeholder view data for display
 * @param {Object} stakeholderViewState The stakeholder view state
 * @returns {Object} Formatted data ready for display
 */
export const formatStakeholderViewForDisplay = (stakeholderViewState) => {
    const formatNumber = (num) => Number(num.toFixed(2));

    // Calculate totals across all holders
    let totalOutstanding = 0;
    let totalAsConverted = 0;
    let totalFullyDiluted = 0;
    let totalVotingRights = 0;
    let totalSafes = 0;
    let totalNotes = 0;
    let totalConvertibles = 0;

    // Count stock classes and gather their data
    const stockClasses = {};

    // Process all holders
    Object.values(stakeholderViewState.holders).forEach((holder) => {
        totalOutstanding += holder.holdings.outstanding;
        totalAsConverted += holder.holdings.asConverted;
        totalFullyDiluted += holder.holdings.fullyDiluted;
        totalVotingRights += holder.votingRights.votes;

        // Process convertibles if available
        if (holder.convertibles) {
            // Sum SAFE amounts
            if (holder.convertibles.safes && holder.convertibles.safes.length > 0) {
                holder.convertibles.safes.forEach((safe) => {
                    totalSafes += Number(safe.amount);
                });
            }

            // Sum Note amounts
            if (holder.convertibles.notes && holder.convertibles.notes.length > 0) {
                holder.convertibles.notes.forEach((note) => {
                    totalNotes += Number(note.amount);
                });
            }

            // Sum all convertibles for total
            totalConvertibles = totalSafes + totalNotes;
        }

        // Add stock classes to the collection
        Object.entries(holder.holdings.byClass).forEach(([className, classData]) => {
            if (!stockClasses[className]) {
                stockClasses[className] = {
                    name: className,
                    type: classData.type,
                    outstanding: 0,
                    asConverted: 0,
                    fullyDiluted: 0,
                    votingPower: 0,
                };
            }

            stockClasses[className].outstanding += classData.outstanding;
            stockClasses[className].asConverted += classData.asConverted;
            stockClasses[className].fullyDiluted += classData.fullyDiluted;
            stockClasses[className].votingPower += classData.votingPower;
        });
    });

    // Build the formatted view
    const formattedView = {
        holders: {
            stakeholders: [],
            totals: {
                outstanding: totalOutstanding,
                asConverted: totalAsConverted,
                fullyDiluted: totalFullyDiluted,
                votingRights: totalVotingRights,
                convertibles: {
                    safes: totalSafes,
                    notes: totalNotes,
                    total: totalConvertibles,
                },
                // Add options pool info to totals
                optionsPool: stakeholderViewState.optionsPool
                    ? {
                          totalAuthorized: stakeholderViewState.optionsPool.totalAuthorized,
                          totalIssued: stakeholderViewState.optionsPool.totalIssued,
                          unallocated: stakeholderViewState.optionsPool.unallocated,
                      }
                    : null,
            },
            stockClasses: Object.values(stockClasses).map((cls) => ({
                name: cls.name,
                type: cls.type,
                outstanding: cls.outstanding,
                asConverted: cls.asConverted,
                fullyDiluted: cls.fullyDiluted,
                votingPower: cls.votingPower,
                votingPercentage: cls.votingPower > 0 ? formatNumber((cls.votingPower / totalVotingRights) * 100) : 0,
            })),
        },
    };

    // Process each stakeholder
    Object.values(stakeholderViewState.holders).forEach((holder) => {
        const formattedHolder = {
            id: holder.id,
            name: holder.name,
            relationship: holder.relationship,
            holdings: {
                outstanding: holder.holdings.outstanding,
                asConverted: holder.holdings.asConverted,
                fullyDiluted: holder.holdings.fullyDiluted,
                percentage: formatNumber((holder.holdings.fullyDiluted / totalFullyDiluted) * 100),
                classes: Object.values(holder.holdings.byClass).map((cls) => ({
                    name: cls.className,
                    type: cls.type,
                    stockClassId: cls.stockClassId,
                    outstanding: cls.outstanding,
                    asConverted: cls.asConverted,
                    fullyDiluted: cls.fullyDiluted,
                    isOption: cls.isOption || false,
                    isPlanAward: cls.isPlanAward || false,
                })),
                convertibles: holder.convertibles
                    ? {
                          safes: holder.convertibles.safes.map((safe) => ({
                              ...safe,
                              formattedAmount: `$${Number(safe.amount).toLocaleString()}`,
                          })),
                          notes: holder.convertibles.notes.map((note) => ({
                              ...note,
                              formattedAmount: `$${Number(note.amount).toLocaleString()}`,
                          })),
                          other: holder.convertibles.other,
                      }
                    : { safes: [], notes: [], other: [] },
            },
            votingRights: {
                votes: holder.votingRights.votes,
                percentage: (holder.votingRights.percentage * 100).toFixed(2),
                // Format the voting columns to match the UI table
                columns: {
                    totalStockAsConverted: holder.votingRights.columns.totalStockAsConverted.toFixed(2),
                    allCommon: holder.votingRights.columns.allCommon.toFixed(2),
                    allPreferred: holder.votingRights.columns.allPreferred.toFixed(2),
                    byClass: {},
                },
            },
        };

        // Format class-specific voting percentages
        if (holder.votingRights.columns.byClass) {
            Object.entries(holder.votingRights.columns.byClass).forEach(([className, percentage]) => {
                formattedHolder.votingRights.columns.byClass[className] = percentage.toFixed(2);
            });
        }

        formattedView.holders.stakeholders.push(formattedHolder);
    });

    // Sort holders by fully diluted shares (descending)
    formattedView.holders.stakeholders.sort((a, b) => b.holdings.fullyDiluted - a.holdings.fullyDiluted);

    return formattedView;
};

/**
 * Process stakeholder view data
 * @param {Object} issuerData Full issuer data including stakeholders, stock classes, etc.
 * @returns {Object} Processed stakeholder view data
 */
export const stakeholderViewStats = (issuerData) => {
    const { stockClasses, stockPlans, stakeholders, transactions } = issuerData;

    // Initialize state
    let state = stakeholderViewInitialState();

    // Process all transactions in order
    for (const transaction of transactions) {
        const stakeholder = stakeholders.find((s) => s._id === transaction.stakeholder_id);
        const stockClass = transaction.stock_class_id ? stockClasses.find((sc) => sc.id === transaction.stock_class_id) : null;
        const stockPlan = transaction.stock_plan_id ? stockPlans.find((sp) => sp._id === transaction.stock_plan_id) : null;

        switch (transaction.object_type) {
            case "TX_STOCK_ISSUANCE":
                if (stakeholder && stockClass) {
                    state = processStakeholderViewStockIssuance(state, transaction, stakeholder, stockClass);
                }
                break;
            case "TX_EQUITY_COMPENSATION_ISSUANCE":
                if (stakeholder) {
                    state = processStakeholderViewEquityCompIssuance(state, transaction, stakeholder, stockClass, stockPlan);
                }
                break;
            case "TX_WARRANT_ISSUANCE":
                if (stakeholder) {
                    state = processStakeholderViewWarrantIssuance(state, transaction, stakeholder, stockClass);
                }
                break;
            case "TX_CONVERTIBLE_ISSUANCE":
                if (stakeholder) {
                    state = processStakeholderViewConvertibleIssuance(state, transaction, stakeholder);
                }
                break;
            case "TX_EQUITY_COMPENSATION_EXERCISE":
                // For exercises, find the original equity issuance
                {
                    const equityIssuance = transactions.find(
                        (t) => t.object_type === "TX_EQUITY_COMPENSATION_ISSUANCE" && t.security_id === transaction.security_id
                    );

                    if (equityIssuance) {
                        state = processStakeholderViewEquityCompExercise(state, transaction, equityIssuance);
                    }
                }
                break;
            case "TX_STOCK_CANCELLATION":
                // For cancellations, we need to find the original issuance
                {
                    // Look up the original issuance by security_id instead of stock_issuance_id
                    const stockIssuance = transactions.find(
                        (t) =>
                            (t.object_type === "TX_STOCK_ISSUANCE" || t.object_type === "TX_EQUITY_COMPENSATION_ISSUANCE") &&
                            t.security_id === transaction.security_id
                    );

                    // Get the stock class for this cancellation
                    const cancellationStockClass = stockIssuance?.stock_class_id
                        ? stockClasses.find((sc) => sc.id === stockIssuance.stock_class_id)
                        : null;

                    if (stockIssuance && cancellationStockClass) {
                        state = processStakeholderViewStockCancellation(state, transaction, stockIssuance, cancellationStockClass);
                    }
                }
                break;
            default:
                // Other transaction types don't impact the stakeholder view directly
                break;
        }
    }

    // Calculate unallocated options from stock plans
    let totalAuthorizedOptions = 0;
    let totalIssuedOptions = 0;

    // For each plan, determine how many options are authorized
    if (stockPlans && stockPlans.length > 0) {
        stockPlans.forEach((plan) => {
            if (plan.initial_shares_reserved) {
                totalAuthorizedOptions += parseInt(plan.initial_shares_reserved);
            }
        });

        // Count issued equity compensation from transactions
        transactions.forEach((tx) => {
            if (tx.object_type === "TX_EQUITY_COMPENSATION_ISSUANCE" && tx.quantity) {
                totalIssuedOptions += parseInt(tx.quantity);
            }
        });
    }

    // Calculate unallocated options
    const unallocatedOptions = Math.max(0, totalAuthorizedOptions - totalIssuedOptions);

    // Store unallocated options in state
    if (!state.optionsPool) {
        state.optionsPool = {
            totalAuthorized: totalAuthorizedOptions,
            totalIssued: totalIssuedOptions,
            unallocated: unallocatedOptions,
        };
    }

    // Calculate percentages after all transactions are processed
    state = calculateStakeholderPercentages(state);

    // Format for display
    return formatStakeholderViewForDisplay(state);
};

export default stakeholderViewStats;
