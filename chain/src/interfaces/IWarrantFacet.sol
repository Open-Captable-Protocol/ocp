// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { WarrantActivePosition, IssueWarrantParams } from "@libraries/Structs.sol";

interface IWarrantFacet {
    /// @notice Issue a new warrant to a stakeholder
    /// @dev Only OPERATOR_ROLE can issue warrants
    /// @param params Parameters for issuing the warrant including stakeholder ID, quantity, etc.
    function issueWarrant(IssueWarrantParams calldata params) external;

    /// @notice Get details of a warrant position
    /// @dev Only OPERATOR_ROLE or the stakeholder who owns the position can view it
    /// @param securityId The ID of the warrant security to get details for
    /// @return The warrant position details
    function getWarrantPosition(bytes16 securityId) external view returns (WarrantActivePosition memory);
}
