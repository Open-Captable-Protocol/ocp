// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {StorageLib, Storage} from "@core/Storage.sol";
import {StockActivePosition, StockClass} from "@libraries/Structs.sol";
import {TxHelper, TxType} from "@libraries/TxHelper.sol";
import {ValidationLib} from "@libraries/ValidationLib.sol";
import {AccessControl} from "@libraries/AccessControl.sol";

contract StockFacet {
    /// @notice Issue new stock to a stakeholder
    /// @dev Only OPERATOR_ROLE can issue stock
    function issueStock(
        bytes16 stock_class_id,
        uint256 share_price,
        uint256 quantity,
        bytes16 stakeholder_id,
        bytes16 security_id
    ) external {
        Storage storage ds = StorageLib.get();

        if (!AccessControl.hasOperatorRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.OPERATOR_ROLE);
        }

        ValidationLib.validateStakeholder(stakeholder_id);
        ValidationLib.validateStockClass(stock_class_id);
        ValidationLib.validateQuantity(quantity);
        ValidationLib.validateAmount(share_price);
        ValidationLib.validateSharesAvailable(stock_class_id, quantity);

        // Get stock class for share tracking
        uint256 stockClassIdx = ds.stockClassIndex[stock_class_id] - 1;
        StockClass storage stockClass = ds.stockClasses[stockClassIdx];

        // Create and store position
        ds.stockActivePositions.securities[security_id] = StockActivePosition({
            stakeholder_id: stakeholder_id,
            stock_class_id: stock_class_id,
            quantity: quantity,
            share_price: share_price
        });

        // Track security IDs for this stakeholder
        ds.stockActivePositions.stakeholderToSecurities[stakeholder_id].push(security_id);

        // Add reverse mapping
        ds.stockActivePositions.securityToStakeholder[security_id] = stakeholder_id;

        // Update share counts
        stockClass.shares_issued += quantity;
        ds.issuer.shares_issued += quantity;

        // Store transaction - Match test order: stockClassId, sharePrice, quantity, stakeholderId, securityId
        bytes memory txData = abi.encode(stock_class_id, share_price, quantity, stakeholder_id, security_id);
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
            require(ds.addressToStakeholderId[msg.sender] == stakeholderId, "Can only view own positions");
        }

        return ds.stockActivePositions.securities[securityId];
    }
}
