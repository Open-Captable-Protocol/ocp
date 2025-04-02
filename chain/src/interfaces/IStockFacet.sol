// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StockActivePosition, IssueStockParams } from "@libraries/Structs.sol";

interface IStockFacet {
    /// @notice Issue new stock to a stakeholder
    /// @dev Only OPERATOR_ROLE can issue stock
    /// @param params Parameters for issuing stock including stakeholder ID, stock class ID, quantity, etc.
    function issueStock(IssueStockParams calldata params) external;

    /// @notice Get details of a stock position
    /// @dev Accessible to INVESTOR_ROLE and above. Investors can only view their own positions
    /// @param securityId The ID of the security to get details for
    /// @return The stock position details
    function getStockPosition(bytes16 securityId) external view returns (StockActivePosition memory);

    /// @notice Get all security IDs for a stakeholder of a specific stock class
    /// @dev Accessible to INVESTOR_ROLE and above. Investors can only view their own positions
    /// @param stakeholder_id The stakeholder to get securities for
    /// @param stock_class_id The stock class to filter by
    /// @return Array of security IDs belonging to the stakeholder for the given stock class
    function getStakeholderSecurities(
        bytes16 stakeholder_id,
        bytes16 stock_class_id
    )
        external
        view
        returns (bytes16[] memory);

    /// @notice Transfer stock from one stakeholder to another
    /// @dev Only OPERATOR_ROLE can transfer stock
    /// @param transferor_stakeholder_id The stakeholder transferring the stock
    /// @param transferee_stakeholder_id The stakeholder receiving the stock
    /// @param stock_class_id The stock class being transferred
    /// @param quantity The number of shares to transfer
    /// @param share_price The price per share for the transfer
    function transferStock(
        bytes16 transferor_stakeholder_id,
        bytes16 transferee_stakeholder_id,
        bytes16 stock_class_id,
        uint256 quantity,
        uint256 share_price
    )
        external;

    /// @notice Cancel stock from a stakeholder
    /// @dev Only OPERATOR_ROLE can cancel stock
    /// @param security_id The ID of the security to cancel
    /// @param quantity The quantity of shares to cancel
    function cancelStock(bytes16 security_id, uint256 quantity) external;
}
