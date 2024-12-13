// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "@core/Storage.sol";
import { StockActivePosition, StockClass, IssueStockParams } from "@libraries/Structs.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { AccessControl } from "@libraries/AccessControl.sol";

contract StockFacet {
    /// @notice Issue new stock to a stakeholder
    /// @dev Only OPERATOR_ROLE can issue stock
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
            require(ds.addressToStakeholderId[msg.sender] == stakeholderId, "Can only view own positions");
        }

        return ds.stockActivePositions.securities[securityId];
    }
}
