// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { EquityCompensationActivePosition, IssueEquityCompensationParams } from "@libraries/Structs.sol";

interface IEquityCompensationFacet {
    /// @notice Issue equity compensation to a stakeholder
    /// @dev Only OPERATOR_ROLE can issue equity compensation
    /// @param params Parameters for issuing the equity compensation
    function issueEquityCompensation(IssueEquityCompensationParams calldata params) external;

    /// @notice Exercise equity compensation to convert it into stock
    /// @dev Only the stakeholder who owns the equity compensation can exercise it
    /// @param id The ID of the equity compensation security
    /// @param equity_comp_security_id The ID of the equity compensation security to exercise
    /// @param resulting_stock_security_id The ID of the stock security that will result from the exercise
    /// @param quantity The number of shares to exercise
    function exerciseEquityCompensation(
        bytes16 id,
        bytes16 equity_comp_security_id,
        bytes16 resulting_stock_security_id,
        uint256 quantity
    )
        external;

    /// @notice Get details of an equity compensation position
    /// @dev Only OPERATOR_ROLE or the stakeholder who owns the position can view it
    /// @param securityId The ID of the equity compensation security to get details for
    /// @return The equity compensation position details
    function getPosition(bytes16 securityId) external view returns (EquityCompensationActivePosition memory);
}
