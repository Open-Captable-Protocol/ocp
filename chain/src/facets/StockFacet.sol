// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "@core/Storage.sol";
import {
    StockActivePosition,
    StockClass,
    IssueStockParams,
    StockActivePositions,
    StockConsolidationTx,
    StockTransferTx
} from "@libraries/Structs.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { AccessControl } from "@libraries/AccessControl.sol";

contract StockFacet {
    /// @notice Issue new stock to a stakeholder
    /// @dev Only OPERATOR_ROLE can issue stock
    error InvalidSecurityId(bytes16 security_id);

    /// @dev Add these custom errors at the contract level
    error NoPositionsToConsolidate();
    error StockClassMismatch(bytes16 expected, bytes16 actual);
    error ZeroQuantityPosition(bytes16 security_id);

    function issueStock(IssueStockParams calldata params) external {
        Storage storage ds = StorageLib.get();

        if (!AccessControl.hasOperatorRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.OPERATOR_ROLE);
        }

        ValidationLib.validateStakeholder(params.stakeholder_id);
        ValidationLib.validateStockClass(params.stock_class_id);
        ValidationLib.validateQuantity(params.quantity);
        ValidationLib.validateAmount(params.share_price);
        ValidationLib.validateSharesAvailable(params.stock_class_id, params.quantity);

        // Get stock class for share tracking
        uint256 stockClassIdx = ds.stockClassIndex[params.stock_class_id] - 1;
        StockClass storage stockClass = ds.stockClasses[stockClassIdx];

        // Create and store position
        ds.stockActivePositions.securities[params.security_id] = StockActivePosition({
            stakeholder_id: params.stakeholder_id,
            stock_class_id: params.stock_class_id,
            quantity: params.quantity,
            share_price: params.share_price
        });

        // Track security IDs for this stakeholder
        ds.stockActivePositions.stakeholderToSecurities[params.stakeholder_id].push(params.security_id);

        // Add reverse mapping
        ds.stockActivePositions.securityToStakeholder[params.security_id] = params.stakeholder_id;

        // Update share counts
        stockClass.shares_issued += params.quantity;
        ds.issuer.shares_issued += params.quantity;

        // Store transaction - Include mapping fields in transaction data
        bytes memory txData = abi.encode(params);
        TxHelper.createTx(TxType.STOCK_ISSUANCE, txData);
    }

    /// @notice Get details of a stock position
    /// @dev Accessible to INVESTOR_ROLE and above
    function getStockPosition(bytes16 securityId) external view returns (StockActivePosition memory) {
        Storage storage ds = StorageLib.get();

        // Check that caller has at least investor role
        if (
            !AccessControl.hasAdminRole(msg.sender) && !AccessControl.hasOperatorRole(msg.sender)
                && !AccessControl.hasInvestorRole(msg.sender)
        ) {
            revert AccessControl.AccessControlUnauthorizedOrInvestor(msg.sender);
        }

        // If caller is an investor, they can only view their own positions
        if (
            AccessControl.hasInvestorRole(msg.sender) && !AccessControl.hasOperatorRole(msg.sender)
                && !AccessControl.hasAdminRole(msg.sender)
        ) {
            bytes16 stakeholderId = ds.stockActivePositions.securityToStakeholder[securityId];
            require(ds.addressToStakeholderId[msg.sender] == stakeholderId, "Can only view own positions"); // rewrite to custom error
        }

        return ds.stockActivePositions.securities[securityId];
    }

    /// @dev Private helper to get stakeholder securities
    function _getStakeholderSecurities(
        bytes16 stakeholder_id,
        bytes16 stock_class_id
    )
        private
        view
        returns (bytes16[] memory)
    {
        Storage storage ds = StorageLib.get();
        bytes16[] storage allSecurities = ds.stockActivePositions.stakeholderToSecurities[stakeholder_id];

        // First count matching securities
        uint256 matchCount = 0;
        for (uint256 i = 0; i < allSecurities.length; i++) {
            if (ds.stockActivePositions.securities[allSecurities[i]].stock_class_id == stock_class_id) {
                matchCount++;
            }
        }

        // Create array of matching securities
        bytes16[] memory matchingSecurities = new bytes16[](matchCount);
        uint256 matchIndex = 0;
        for (uint256 i = 0; i < allSecurities.length; i++) {
            if (ds.stockActivePositions.securities[allSecurities[i]].stock_class_id == stock_class_id) {
                matchingSecurities[matchIndex] = allSecurities[i];
                matchIndex++;
            }
        }

        return matchingSecurities;
    }

    /// @notice Get all security IDs for a stakeholder of a specific stock class
    /// @dev Accessible to INVESTOR_ROLE and above. Investors can only view their own positions
    function getStakeholderSecurities(
        bytes16 stakeholder_id,
        bytes16 stock_class_id
    )
        external
        view
        returns (bytes16[] memory)
    {
        Storage storage ds = StorageLib.get();

        // Check that caller has at least investor role
        if (
            !AccessControl.hasAdminRole(msg.sender) && !AccessControl.hasOperatorRole(msg.sender)
                && !AccessControl.hasInvestorRole(msg.sender)
        ) {
            revert AccessControl.AccessControlUnauthorizedOrInvestor(msg.sender);
        }

        // If caller is an investor, they can only view their own positions
        if (
            AccessControl.hasInvestorRole(msg.sender) && !AccessControl.hasOperatorRole(msg.sender)
                && !AccessControl.hasAdminRole(msg.sender)
        ) {
            require(ds.addressToStakeholderId[msg.sender] == stakeholder_id, "Can only view own positions"); // rewrite to custom error
        }

        return _getStakeholderSecurities(stakeholder_id, stock_class_id);
    }

    /// @dev Internal function to consolidate positions before transfer
    function _consolidatePositions(
        bytes16[] memory security_ids,
        bytes16 stakeholder_id,
        bytes16 stock_class_id
    )
        internal
        returns (bytes16)
    {
        Storage storage ds = StorageLib.get();

        // Check if there are positions to consolidate
        if (security_ids.length == 0) {
            revert NoPositionsToConsolidate();
        }

        // Initialize hash with base components
        bytes32 running_hash =
            keccak256(abi.encodePacked(block.timestamp, stakeholder_id, stock_class_id, "CONSOLIDATION"));

        uint256 total_quantity = 0;
        uint256 weighted_share_price = 0;

        // Calculate totals and weighted average price
        for (uint256 i = 0; i < security_ids.length; i++) {
            bytes16 security_id = security_ids[i];
            StockActivePosition storage position = ds.stockActivePositions.securities[security_id];

            // Check if position exists and has valid quantity
            if (position.quantity == 0) {
                revert ZeroQuantityPosition(security_id);
            }

            // Validate stock class
            if (position.stock_class_id != stock_class_id) {
                revert StockClassMismatch(stock_class_id, position.stock_class_id);
            }

            // Update running hash with each security ID
            running_hash = keccak256(abi.encodePacked(running_hash, security_id));

            weighted_share_price += position.share_price * position.quantity;
            total_quantity += position.quantity;
        }

        // Convert final hash to bytes16 for security ID
        bytes16 resulting_security_id = bytes16(running_hash);

        // Create consolidated position
        ds.stockActivePositions.securities[resulting_security_id] = StockActivePosition({
            stakeholder_id: stakeholder_id,
            stock_class_id: stock_class_id,
            quantity: total_quantity,
            share_price: total_quantity > 0 ? weighted_share_price / total_quantity : 0
        });

        // Update mappings
        ds.stockActivePositions.stakeholderToSecurities[stakeholder_id].push(resulting_security_id);
        ds.stockActivePositions.securityToStakeholder[resulting_security_id] = stakeholder_id;

        // Remove old positions
        for (uint256 i = 0; i < security_ids.length; i++) {
            removeSecurityFromStakeholder(ds.stockActivePositions, stakeholder_id, security_ids[i]);
        }

        // Record consolidation transaction

        StockConsolidationTx memory consolidationTx =
            StockConsolidationTx({ security_ids: security_ids, resulting_security_id: resulting_security_id });
        bytes memory consolidationData = abi.encode(consolidationTx);
        TxHelper.createTx(TxType.STOCK_CONSOLIDATION, consolidationData);

        return resulting_security_id;
    }

    /// @dev Helper function to remove a security from a stakeholder's array
    function removeSecurityFromStakeholder(
        StockActivePositions storage positions,
        bytes16 stakeholderId,
        bytes16 securityId
    )
        internal
    {
        bytes16[] storage securities = positions.stakeholderToSecurities[stakeholderId];
        for (uint256 i = 0; i < securities.length; i++) {
            if (securities[i] == securityId) {
                // Move the last element to the position being deleted
                securities[i] = securities[securities.length - 1];
                // Remove the last element
                securities.pop();
                break;
            }
        }
        // Clean up the security to stakeholder mapping
        delete positions.securityToStakeholder[securityId];
        // Clean up the security itself
        delete positions.securities[securityId];
    }

    /// @notice Transfer stock from one stakeholder to another
    /// @dev Only OPERATOR_ROLE can transfer stock
    function transferStock(
        bytes16 transferor_stakeholder_id,
        bytes16 transferee_stakeholder_id,
        bytes16 stock_class_id,
        uint256 quantity,
        uint256 share_price
    )
        external
    {
        Storage storage ds = StorageLib.get();

        // Validations
        if (!AccessControl.hasOperatorRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.OPERATOR_ROLE);
        }

        ValidationLib.validateStakeholder(transferor_stakeholder_id);
        ValidationLib.validateStakeholder(transferee_stakeholder_id);
        ValidationLib.validateStockClass(stock_class_id);
        ValidationLib.validateQuantity(quantity);
        ValidationLib.validateAmount(share_price);

        // First consolidate transferor's positions
        bytes16[] memory security_ids = _getStakeholderSecurities(transferor_stakeholder_id, stock_class_id);
        bytes16 consolidated_security_id =
            _consolidatePositions(security_ids, transferor_stakeholder_id, stock_class_id);

        // Get consolidated position
        StockActivePosition storage consolidated_position = ds.stockActivePositions.securities[consolidated_security_id];
        require(consolidated_position.quantity >= quantity, "Insufficient shares for transfer"); // rewrite to custom error

        // Generate new security IDs
        bytes16 transferee_security_id = bytes16(
            keccak256(
                abi.encodePacked(block.timestamp, consolidated_security_id, transferee_stakeholder_id, "TRANSFER")
            )
        );
        bytes16 remainder_security_id;

        // Create transferee position
        ds.stockActivePositions.securities[transferee_security_id] = StockActivePosition({
            stakeholder_id: transferee_stakeholder_id,
            stock_class_id: stock_class_id,
            quantity: quantity,
            share_price: share_price
        });

        // Update transferee mappings
        ds.stockActivePositions.stakeholderToSecurities[transferee_stakeholder_id].push(transferee_security_id);
        ds.stockActivePositions.securityToStakeholder[transferee_security_id] = transferee_stakeholder_id;

        // Handle remainder if partial transfer
        if (consolidated_position.quantity > quantity) {
            remainder_security_id = bytes16(
                keccak256(
                    abi.encodePacked(block.timestamp, consolidated_security_id, transferor_stakeholder_id, "REMAINDER")
                )
            );

            ds.stockActivePositions.securities[remainder_security_id] = StockActivePosition({
                stakeholder_id: transferor_stakeholder_id,
                stock_class_id: stock_class_id,
                quantity: consolidated_position.quantity - quantity,
                share_price: consolidated_position.share_price // Keep original price for remainder
             });

            // Update transferor mappings for remainder
            ds.stockActivePositions.stakeholderToSecurities[transferor_stakeholder_id].push(remainder_security_id);
            ds.stockActivePositions.securityToStakeholder[remainder_security_id] = transferor_stakeholder_id;
        }

        // Clean up consolidated position
        removeSecurityFromStakeholder(ds.stockActivePositions, transferor_stakeholder_id, consolidated_security_id);

        // Record transfer transaction
        bytes memory transferData = abi.encode(
            StockTransferTx({
                consolidated_security_id: consolidated_security_id,
                transferee_security_id: transferee_security_id,
                remainder_security_id: remainder_security_id,
                quantity: quantity,
                share_price: share_price
            })
        );
        TxHelper.createTx(TxType.STOCK_TRANSFER, transferData);
    }
}
