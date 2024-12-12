// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "@core/Storage.sol";
import {
    EquityCompensationActivePosition,
    StockActivePosition,
    IssueEquityCompensationParams
} from "@libraries/Structs.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { IEquityCompensationFacet } from "@interfaces/IEquityCompensationFacet.sol";

contract EquityCompensationFacet is IEquityCompensationFacet {
    /// @notice Issue equity compensation to a stakeholder
    /// @dev Only OPERATOR_ROLE can issue equity compensation
    function issueEquityCompensation(IssueEquityCompensationParams calldata params) external {
        Storage storage ds = StorageLib.get();

        if (!AccessControl.hasOperatorRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.OPERATOR_ROLE);
        }

        ValidationLib.validateStakeholder(params.stakeholder_id);
        ValidationLib.validateStockClass(params.stock_class_id);
        ValidationLib.validateQuantity(params.quantity);

        // Create and store position
        ds.equityCompensationActivePositions.securities[params.security_id] = EquityCompensationActivePosition({
            stakeholder_id: params.stakeholder_id,
            quantity: params.quantity,
            timestamp: uint40(block.timestamp),
            stock_class_id: params.stock_class_id,
            stock_plan_id: params.stock_plan_id
        });

        // Track security IDs for this stakeholder
        ds.equityCompensationActivePositions.stakeholderToSecurities[params.stakeholder_id].push(params.security_id);

        // Add reverse mapping
        ds.equityCompensationActivePositions.securityToStakeholder[params.security_id] = params.stakeholder_id;

        // Store transaction
        bytes memory txData = abi.encode(params);
        TxHelper.createTx(TxType.EQUITY_COMPENSATION_ISSUANCE, txData);
    }

    /// @notice Exercise equity compensation to convert it into stock
    /// @dev Only OPERATOR_ROLE can exercise equity compensation
    function exerciseEquityCompensation(
        bytes16 equity_comp_security_id,
        bytes16 resulting_stock_security_id,
        uint256 quantity
    )
        external
    {
        Storage storage ds = StorageLib.get();

        // Check that caller is an operator
        if (!AccessControl.hasOperatorRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.OPERATOR_ROLE);
        }

        // Validate equity compensation security exists and has sufficient quantity
        EquityCompensationActivePosition memory equityPosition =
            ds.equityCompensationActivePositions.securities[equity_comp_security_id];

        if (quantity == 0) {
            revert ValidationLib.InvalidQuantity();
        }
        if (equityPosition.quantity == 0) {
            revert ValidationLib.InvalidSecurity(equity_comp_security_id);
        }
        if (equityPosition.quantity < quantity) {
            revert ValidationLib.InsufficientShares();
        }

        // Validate stock position exists and belongs to same stakeholder
        StockActivePosition memory stockPosition = ds.stockActivePositions.securities[resulting_stock_security_id];
        if (stockPosition.stakeholder_id == bytes16(0)) {
            revert ValidationLib.InvalidSecurity(resulting_stock_security_id);
        }
        if (stockPosition.stakeholder_id != equityPosition.stakeholder_id) {
            revert ValidationLib.InvalidSecurityStakeholder(resulting_stock_security_id, equityPosition.stakeholder_id);
        }

        // Validate stock position quantity matches quantity to exercise
        if (stockPosition.quantity != quantity) {
            revert ValidationLib.InvalidQuantity();
        }

        // Update the equity compensation position
        if (equityPosition.quantity == quantity) {
            // If fully exercised, remove the position entirely
            delete ds.equityCompensationActivePositions.securities[equity_comp_security_id];
            delete ds.equityCompensationActivePositions.securityToStakeholder[equity_comp_security_id];

            // Find and remove the security ID from stakeholder's list
            bytes16[] storage stakeholderSecurities =
                ds.equityCompensationActivePositions.stakeholderToSecurities[equityPosition.stakeholder_id];
            for (uint256 i = 0; i < stakeholderSecurities.length; i++) {
                if (stakeholderSecurities[i] == equity_comp_security_id) {
                    stakeholderSecurities[i] = stakeholderSecurities[stakeholderSecurities.length - 1];
                    stakeholderSecurities.pop();
                    break;
                }
            }
        } else {
            // Partial exercise, just reduce the quantity
            ds.equityCompensationActivePositions.securities[equity_comp_security_id].quantity -= quantity;
        }

        // Emit transaction
        bytes memory txData = abi.encode(equity_comp_security_id, resulting_stock_security_id, quantity);
        TxHelper.createTx(TxType.EQUITY_COMPENSATION_EXERCISE, txData);
    }

    /// @notice Get details of an equity compensation position
    /// @dev Only OPERATOR_ROLE or the stakeholder who owns the position can view it
    function getPosition(bytes16 securityId) external view returns (EquityCompensationActivePosition memory) {
        Storage storage ds = StorageLib.get();

        EquityCompensationActivePosition memory position = ds.equityCompensationActivePositions.securities[securityId];

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
