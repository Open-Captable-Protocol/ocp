// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "@core/Storage.sol";
import { ConvertibleActivePosition, IssueConvertibleParams } from "@libraries/Structs.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { IConvertiblesFacet } from "@interfaces/IConvertiblesFacet.sol";

contract ConvertiblesFacet is IConvertiblesFacet {
    function issueConvertible(IssueConvertibleParams calldata params) external {
        Storage storage ds = StorageLib.get();

        if (!AccessControl.hasOperatorRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.OPERATOR_ROLE);
        }

        ValidationLib.validateStakeholder(params.stakeholder_id);
        ValidationLib.validateAmount(params.investment_amount);

        // Create and store position
        ds.convertibleActivePositions.securities[params.security_id] = ConvertibleActivePosition({
            stakeholder_id: params.stakeholder_id,
            investment_amount: params.investment_amount
        });

        // Track security IDs for this stakeholder
        ds.convertibleActivePositions.stakeholderToSecurities[params.stakeholder_id].push(params.security_id);

        // Add reverse mapping
        ds.convertibleActivePositions.securityToStakeholder[params.security_id] = params.stakeholder_id;

        // Emit transaction
        bytes memory txData = abi.encode(params);
        TxHelper.createTx(TxType.CONVERTIBLE_ISSUANCE, txData);
    }

    /// @notice Get details of a convertible position
    /// @dev Only OPERATOR_ROLE or the stakeholder who owns the position can view it
    function getConvertiblePosition(bytes16 securityId) external view returns (ConvertibleActivePosition memory) {
        Storage storage ds = StorageLib.get();

        ConvertibleActivePosition memory position = ds.convertibleActivePositions.securities[securityId];

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
