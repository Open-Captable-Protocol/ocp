/**
 * StakeholderView Processors Module Index
 *
 * This file exports all the individual processors used in the stakeholder view
 * state machine. Breaking these into individual files makes the codebase more
 * maintainable and easier to test.
 */

import convertiblesProcessor from "./convertiblesProcessor";
import warrantsProcessor from "./warrantsProcessor";
import * as stocksProcessor from "./stocksProcessor";

export { convertiblesProcessor, warrantsProcessor, stocksProcessor };

// Re-export individual functions for direct imports
export const { processStakeholderViewConvertibleIssuance, formatConvertiblesForDisplay } = convertiblesProcessor;

export const { processStakeholderViewWarrantIssuance, formatWarrantsForDisplay } = warrantsProcessor;

export const {
    processStocksData,
    processStockIssuance,
    processStockCancellation,
    processStockTransfer,
    processEquityCompensationIssuance,
    processEquityCompensationExercise,
    formatStocksForDisplay,
} = stocksProcessor;
