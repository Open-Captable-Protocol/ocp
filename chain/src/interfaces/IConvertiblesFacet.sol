// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { ConvertibleActivePosition, IssueConvertibleParams } from "@libraries/Structs.sol";

interface IConvertiblesFacet {
    /// @notice Issue a new convertible security to a stakeholder
    /// @dev Only OPERATOR_ROLE can issue convertibles
    /// @param params Parameters for issuing the convertible including stakeholder ID, investment amount, etc.
    function issueConvertible(IssueConvertibleParams calldata params) external;

    /// @notice Get details of a convertible position
    /// @dev Only OPERATOR_ROLE or the stakeholder who owns the position can view it
    /// @param securityId The ID of the convertible security to get details for
    /// @return The convertible position details
    function getConvertiblePosition(bytes16 securityId) external view returns (ConvertibleActivePosition memory);
}
