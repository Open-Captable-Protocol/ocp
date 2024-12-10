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
}
