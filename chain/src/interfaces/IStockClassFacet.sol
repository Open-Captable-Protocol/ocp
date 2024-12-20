// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StockClass } from "@libraries/Structs.sol";

interface IStockClassFacet {
    /// @notice Emitted when a new stock class is created
    event StockClassCreated(bytes16 indexed id, string indexed classType, uint256 indexed pricePerShare, uint256 initialSharesAuthorized);

    /// @notice Emitted when a stock class's authorized shares are adjusted
    event StockClassAuthorizedSharesAdjusted(bytes16 indexed stockClassId, uint256 newSharesAuthorized);

    /// @notice Thrown when attempting to create a stock class that already exists
    error StockClassAlreadyExists(bytes16 stock_class_id);

    /// @notice Thrown when attempting to operate on a non-existent stock class
    error StockClassNotFound(bytes16 stock_class_id);

    /// @notice Thrown when invalid shares authorized value is provided
    error InvalidSharesAuthorized();

    /// @notice Create a new stock class
    /// @dev Only DEFAULT_ADMIN_ROLE can create stock classes
    /// @param _id Unique identifier for the stock class
    /// @param _class_type Type of the stock class (e.g., "Common", "Preferred")
    /// @param _price_per_share Price per share in the smallest unit
    /// @param _initial_share_authorized Initial number of shares authorized for this class
    function createStockClass(bytes16 _id, string memory _class_type, uint256 _price_per_share, uint256 _initial_share_authorized) external;

    /// @notice Adjust the authorized shares for a stock class
    /// @dev Only DEFAULT_ADMIN_ROLE can adjust authorized shares
    /// @param id The unique identifier for the tx
    /// @param stockClassId ID of the stock class to adjust
    /// @param newSharesAuthorized New total number of authorized shares
    function adjustAuthorizedShares(bytes16 id, bytes16 stockClassId, uint256 newSharesAuthorized) external;
}
