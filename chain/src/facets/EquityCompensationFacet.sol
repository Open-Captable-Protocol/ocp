// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "@core/Storage.sol";
import { EquityCompensationActivePosition, StockActivePosition } from "@libraries/Structs.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";

contract EquityCompensationFacet {
    function issueEquityCompensation(
        bytes16 stakeholder_id,
        bytes16 stock_class_id,
        bytes16 stock_plan_id,
        uint256 quantity,
        bytes16 security_id
    ) external {
        Storage storage ds = StorageLib.get();
        ds.nonce++;

        ValidationLib.validateStakeholder(stakeholder_id);
        ValidationLib.validateStockClass(stock_class_id);
        ValidationLib.validateStockPlan(stock_plan_id);
        ValidationLib.validateQuantity(quantity);

        // Create and store position
        ds.equityCompensationActivePositions.securities[security_id] = EquityCompensationActivePosition({
            stakeholder_id: stakeholder_id,
            quantity: quantity,
            timestamp: uint40(block.timestamp),
            stock_class_id: stock_class_id,
            stock_plan_id: stock_plan_id
        });

        // Track security IDs for this stakeholder
        ds.equityCompensationActivePositions.stakeholderToSecurities[stakeholder_id].push(security_id);

        // Add reverse mapping
        ds.equityCompensationActivePositions.securityToStakeholder[security_id] = stakeholder_id;

        // Store transaction
        bytes memory txData = abi.encode(stakeholder_id, stock_class_id, stock_plan_id, quantity, security_id);
        TxHelper.createTx(TxType.EQUITY_COMPENSATION_ISSUANCE, txData);
    }

    function exerciseEquityCompensation(bytes16 equity_comp_security_id, bytes16 resulting_stock_security_id, uint256 quantity) external {
        Storage storage ds = StorageLib.get();
        ds.nonce++;

        // Validate equity compensation security exists and has sufficient quantity
        EquityCompensationActivePosition memory equityPosition = ds.equityCompensationActivePositions.securities[equity_comp_security_id];

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
            bytes16[] storage stakeholderSecurities = ds.equityCompensationActivePositions.stakeholderToSecurities[equityPosition.stakeholder_id];
            for (uint i = 0; i < stakeholderSecurities.length; i++) {
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

    function getPosition(bytes16 securityId) external view returns (EquityCompensationActivePosition memory) {
        Storage storage ds = StorageLib.get();
        return ds.equityCompensationActivePositions.securities[securityId];
    }
}
