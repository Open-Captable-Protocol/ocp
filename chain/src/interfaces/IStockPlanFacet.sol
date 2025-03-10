// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StockPlan } from "@libraries/Structs.sol";

interface IStockPlanFacet {
    /// @notice Emitted when a new stock plan is created
    event StockPlanCreated(bytes16 indexed id, uint256 shares_reserved);

    /// @notice Emitted when a stock plan's reserved shares are adjusted
    event StockPlanSharesReservedAdjusted(bytes16 indexed id, uint256 newSharesReserved);

    /// @notice Thrown when attempting to create a stock plan that already exists
    error StockPlanAlreadyExists(bytes16 stock_plan_id);

    /// @notice Thrown when referencing an invalid stock class
    error InvalidStockClass(bytes16 stock_class_id);

    /// @notice Thrown when attempting to operate on a non-existent stock plan
    error StockPlanNotFound(bytes16 stock_plan_id);

    /// @notice Create a new stock plan with specified stock classes and reserved shares
    /// @dev Only OPERATOR_ROLE can create stock plans
    /// @param id Unique identifier for the stock plan
    /// @param stock_class_ids Array of stock class IDs that can be issued under this plan
    /// @param shares_reserved Number of shares reserved for this plan
    function createStockPlan(bytes16 id, bytes16[] memory stock_class_ids, uint256 shares_reserved) external;

    /// @notice Adjust the number of shares reserved in a stock plan
    /// @dev Only OPERATOR_ROLE can adjust stock plan pools
    /// @param id Unique identifier for the stock plan
    /// @param stockPlanId ID of the stock plan to adjust
    /// @param newSharesReserved New number of shares reserved for the plan
    function adjustStockPlanPool(bytes16 id, bytes16 stockPlanId, uint256 newSharesReserved) external;
}
