// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "@core/Storage.sol";
import { WarrantActivePosition, IssueWarrantParams } from "@libraries/Structs.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { AccessControl } from "@libraries/AccessControl.sol";

contract WarrantFacet {
    function issueWarrant(IssueWarrantParams calldata params) external {
        Storage storage ds = StorageLib.get();

        if (!AccessControl.hasOperatorRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.OPERATOR_ROLE);
        }

        ValidationLib.validateStakeholder(params.stakeholder_id);
        ValidationLib.validateQuantity(params.quantity);

        // Create and store position
        ds.warrantActivePositions.securities[params.security_id] =
            WarrantActivePosition({ stakeholder_id: params.stakeholder_id, quantity: params.quantity });

        // Track security IDs for this stakeholder
        ds.warrantActivePositions.stakeholderToSecurities[params.stakeholder_id].push(params.security_id);

        // Add reverse mapping
        ds.warrantActivePositions.securityToStakeholder[params.security_id] = params.stakeholder_id;

        // Store transaction
        bytes memory txData = abi.encode(params);
        TxHelper.createTx(TxType.WARRANT_ISSUANCE, txData);
    }

    /// @notice Get details of a warrant position
    /// @dev Only OPERATOR_ROLE or the stakeholder who owns the position can view it
    function getWarrantPosition(bytes16 securityId) external view returns (WarrantActivePosition memory) {
        Storage storage ds = StorageLib.get();

        WarrantActivePosition memory position = ds.warrantActivePositions.securities[securityId];

        // Allow operators and admins to view any position
        if (AccessControl.hasOperatorRole(msg.sender) || AccessControl.hasAdminRole(msg.sender)) {
            return position;
        }

        // Otherwise, verify caller is the stakeholder who owns this position
        bytes16 stakeholderId = ds.addressToStakeholderId[msg.sender];
        if (stakeholderId != position.stakeholder_id) {
            revert AccessControl.AccessControlUnauthorizedOrInvestor(msg.sender);
        }

        return position;
    }
}
