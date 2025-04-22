/**
 * Convertibles Processor Module
 *
 * This module is responsible for processing convertible securities (SAFEs and Notes)
 * within the stakeholder view state machine.
 */

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

    // Extract convertible details - enhanced with additional fields
    const {
        id,
        convertible_type,
        investment_amount,
        date,
        conversion_triggers = [],
        custom_id,
        board_approval_date,
        security_law_exemptions = [],
        pro_rata,
        consideration_text,
        seniority,
        comments = [],
    } = transaction;

    // Get monetary value
    const amount = investment_amount?.amount || 0;
    const currency = investment_amount?.currency || "USD";

    // Extract conversion details from triggers (val cap, discount)
    let valuationCap = null;
    let discount = null;
    let conversionTiming = null;
    let conversionMfn = false;

    // Process conversion mechanism details
    const { extractedValuationCap, extractedDiscount, extractedTiming, extractedMfn, interestRates, maturityDate, interestCalculationMethod } =
        processConversionTriggers(conversion_triggers);

    // Use extracted values
    valuationCap = extractedValuationCap;
    discount = extractedDiscount;
    conversionTiming = extractedTiming;
    conversionMfn = extractedMfn;

    // Format security law exemptions
    const formattedExemptions = security_law_exemptions.map((exemption) => ({
        description: exemption.description || "",
        jurisdiction: exemption.jurisdiction || "",
    }));

    // Determine if there are side letters based on comments
    const hasSideLetters = comments.some((comment) => comment.toLowerCase().includes("side letter") || comment.toLowerCase().includes("sideletter"));

    // Process conversion triggers with more detail
    const formattedTriggers = conversion_triggers.map((trigger) => ({
        id: trigger.trigger_id || "",
        nickname: trigger.nickname || "",
        type: trigger.type || "",
        description: trigger.trigger_description || "",
        condition: trigger.trigger_condition || "",
        date: trigger.trigger_date || null,
        // Add conversion mechanism details
        mechanism: trigger.conversion_right?.conversion_mechanism?.type || "",
        timing: conversionTiming,
        mfn: conversionMfn,
        converts_to_future: trigger.conversion_right?.converts_to_future_round || false,
    }));

    // Build convertible object - enhanced with all additional fields
    const convertibleItem = {
        id,
        customId: custom_id || id.substring(0, 8),
        amount,
        currency,
        date,
        boardApprovalDate: board_approval_date || null,
        valuationCap,
        discount,
        valuationMethod: conversionTiming || "POST_MONEY", // Default to POST_MONEY if not specified
        considerationText: consideration_text || "",
        proRata: pro_rata || null,
        seniority: seniority || null,
        exemptions: formattedExemptions,
        hasSideLetters,
        comments: comments || [],
        conversionTriggers: formattedTriggers,
        convertibleType: convertible_type,
        // Note-specific fields
        interestRates,
        maturityDate,
        interestCalculationMethod,
        // Track whether this is still outstanding (will be true for all in this function)
        isOutstanding: true,
        // Default for unconverted convertibles
        conversionDate: null,
        sharesIssued: null,
        conversionPrice: null,
        convertedClass: null,
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
 * Process conversion triggers to extract important details
 *
 * @param {Array} conversion_triggers - Array of conversion triggers
 * @returns {Object} Extracted information from conversion triggers
 */
const processConversionTriggers = (conversion_triggers) => {
    let extractedValuationCap = null;
    let extractedDiscount = null;
    let extractedTiming = null;
    let extractedMfn = false;
    let interestRates = [];
    let maturityDate = null;
    let interestCalculationMethod = null;

    // Process each trigger
    conversion_triggers.forEach((trigger) => {
        // Check for maturity date in AUTOMATIC_ON_DATE triggers (for notes)
        if (trigger.type === "AUTOMATIC_ON_DATE" && trigger.trigger_date) {
            maturityDate = trigger.trigger_date;
        }

        // Process direct conversion mechanism if available
        if (trigger.conversion_mechanism) {
            // Extract valuation cap if present
            if (trigger.conversion_mechanism.valuation_cap) {
                extractedValuationCap = trigger.conversion_mechanism.valuation_cap.amount;
            }

            // Extract discount if present
            if (trigger.conversion_mechanism.type === "DISCOUNT_CONVERSION" && trigger.conversion_mechanism.discount) {
                extractedDiscount = trigger.conversion_mechanism.discount;
            }

            // Extract conversion timing
            if (trigger.conversion_mechanism.conversion_timing) {
                extractedTiming = trigger.conversion_mechanism.conversion_timing;
            }

            // Extract MFN status
            if (trigger.conversion_mechanism.conversion_mfn !== undefined) {
                extractedMfn = trigger.conversion_mechanism.conversion_mfn;
            }

            // Extract interest rates for notes
            if (trigger.conversion_mechanism.type === "CONVERTIBLE_NOTE_CONVERSION" && trigger.conversion_mechanism.interest_rates) {
                interestRates = trigger.conversion_mechanism.interest_rates.map((rate) => ({
                    rate: rate.rate,
                    startDate: rate.accrual_start_date,
                    endDate: rate.accrual_end_date || null,
                }));

                // Extract interest calculation details
                const method = [];
                if (trigger.conversion_mechanism.day_count_convention) {
                    method.push(trigger.conversion_mechanism.day_count_convention);
                }
                if (trigger.conversion_mechanism.interest_accrual_period) {
                    method.push(trigger.conversion_mechanism.interest_accrual_period);
                }
                if (trigger.conversion_mechanism.compounding_type) {
                    method.push(trigger.conversion_mechanism.compounding_type);
                }

                interestCalculationMethod = method.join(", ");
            }
        }

        // Check for conversion right structure (this is the actual path in OCP data)
        if (trigger.conversion_right && trigger.conversion_right.conversion_mechanism) {
            const mechanism = trigger.conversion_right.conversion_mechanism;

            // Extract valuation cap
            if (mechanism.conversion_valuation_cap) {
                extractedValuationCap = mechanism.conversion_valuation_cap.amount;
            }

            // Extract discount
            if (mechanism.type === "DISCOUNT_CONVERSION" && mechanism.discount) {
                extractedDiscount = mechanism.discount;
            } else if (mechanism.type === "SAFE_CONVERSION" && mechanism.discount) {
                extractedDiscount = mechanism.discount;
            }

            // Extract conversion timing
            if (mechanism.conversion_timing) {
                extractedTiming = mechanism.conversion_timing;
            }

            // Extract MFN status
            if (mechanism.conversion_mfn !== undefined) {
                extractedMfn = mechanism.conversion_mfn;
            }

            // Extract interest rates for notes
            if (mechanism.type === "CONVERTIBLE_NOTE_CONVERSION" && mechanism.interest_rates) {
                interestRates = mechanism.interest_rates.map((rate) => ({
                    rate: rate.rate,
                    startDate: rate.accrual_start_date,
                    endDate: rate.accrual_end_date || null,
                }));

                // Extract interest calculation details
                const method = [];
                if (mechanism.day_count_convention) {
                    method.push(mechanism.day_count_convention);
                }
                if (mechanism.interest_accrual_period) {
                    method.push(mechanism.interest_accrual_period);
                }
                if (mechanism.compounding_type) {
                    method.push(mechanism.compounding_type);
                }

                interestCalculationMethod = method.join(", ") || "Simple";
            }
        }
    });

    return {
        extractedValuationCap,
        extractedDiscount,
        extractedTiming,
        extractedMfn,
        interestRates,
        maturityDate,
        interestCalculationMethod,
    };
};

/**
 * Format convertible securities for display
 *
 * @param {Object} convertibles - Raw convertibles data
 * @returns {Object} Formatted convertibles data ready for display
 */
export const formatConvertiblesForDisplay = (convertibles) => {
    if (!convertibles) {
        return { safes: [], notes: [], other: [] };
    }

    // Format SAFEs
    const formattedSafes = convertibles.safes
        ? convertibles.safes.map((safe) => ({
              ...safe,
              formattedAmount: `$${Number(safe.amount).toLocaleString()}`,
              formattedValuationCap: safe.valuationCap ? `$${Number(safe.valuationCap).toLocaleString()}` : "",
              formattedDiscount: safe.discount ? `${Number(safe.discount * 100).toFixed(2)}%` : "",
              formattedDate: safe.date ? new Date(safe.date).toISOString().split("T")[0] : "",
              formattedBoardApprovalDate: safe.boardApprovalDate ? new Date(safe.boardApprovalDate).toISOString().split("T")[0] : "",
              formattedExemptions: safe.exemptions?.map((e) => `${e.description} (${e.jurisdiction})`).join("; ") || "",
              basisOfIssuance: `Simple Agreement for Future Equity, dated ${safe.date ? new Date(safe.date).toISOString().split("T")[0] : "N/A"}`,
              sideLetter: safe.hasSideLetters ? "Y" : "N",
              outstanding: safe.isOutstanding ? "Y" : "N",
          }))
        : [];

    // Format Notes
    const formattedNotes = convertibles.notes
        ? convertibles.notes.map((note) => {
              // Calculate principal and interest if we have all required data
              let principalAndInterest = null;
              if (note.amount && note.interestRates && note.interestRates.length > 0 && note.date) {
                  // Get primary interest rate
                  const primaryRate = note.interestRates[0].rate;
                  const amount = Number(note.amount);
                  const issueDate = new Date(note.date);
                  const maturityDate = note.maturityDate ? new Date(note.maturityDate) : new Date();
                  const years = (maturityDate - issueDate) / (365 * 24 * 60 * 60 * 1000);

                  // Simple calculation (not accounting for compounding)
                  principalAndInterest = amount * (1 + Number(primaryRate) * years);
              }

              return {
                  ...note,
                  formattedAmount: `$${Number(note.amount).toLocaleString()}`,
                  formattedValuationCap: note.valuationCap ? `$${Number(note.valuationCap).toLocaleString()}` : "",
                  formattedDiscount: note.discount ? `${Number(note.discount * 100).toFixed(2)}%` : "",
                  formattedDate: note.date ? new Date(note.date).toISOString().split("T")[0] : "",
                  formattedBoardApprovalDate: note.boardApprovalDate ? new Date(note.boardApprovalDate).toISOString().split("T")[0] : "",
                  formattedMaturityDate: note.maturityDate ? new Date(note.maturityDate).toISOString().split("T")[0] : "",
                  formattedExemptions: note.exemptions?.map((e) => `${e.description} (${e.jurisdiction})`).join("; ") || "",
                  formattedInterestRate: note.interestRates && note.interestRates.length > 0 ? note.interestRates[0].rate : null,
                  principalAndInterest,
                  basisOfIssuance: `Convertible Promissory Note, dated ${note.date ? new Date(note.date).toISOString().split("T")[0] : "N/A"}`,
                  sideLetter: note.hasSideLetters ? "Y" : "N",
                  outstanding: note.isOutstanding ? "Y" : "N",
              };
          })
        : [];

    return {
        safes: formattedSafes,
        notes: formattedNotes,
        other: convertibles.other || [],
    };
};

// Export the module
export default {
    processStakeholderViewConvertibleIssuance,
    formatConvertiblesForDisplay,
};
