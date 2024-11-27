// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "@core/Storage.sol";
import { StockClass } from "@libraries/Structs.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { LibDiamond } from "diamond-3-hardhat/libraries/LibDiamond.sol";
import { AccessControl } from "@libraries/AccessControl.sol";

contract StockClassFacet {
    event StockClassCreated(bytes16 indexed id, string indexed classType, uint256 indexed pricePerShare, uint256 initialSharesAuthorized);
    event StockClassAuthorizedSharesAdjusted(bytes16 indexed stockClassId, uint256 newSharesAuthorized);

    error StockClassAlreadyExists(bytes16 stock_class_id);
    error StockClassNotFound(bytes16 stock_class_id);
    error InvalidSharesAuthorized();

    /// @notice Create a new stock class
    /// @dev Only DEFAULT_ADMIN_ROLE can create stock classes
    function createStockClass(bytes16 _id, string memory _class_type, uint256 _price_per_share, uint256 _initial_share_authorized) external {
        Storage storage ds = StorageLib.get();

        // Check that caller has admin role
        if (!AccessControl.hasAdminRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.DEFAULT_ADMIN_ROLE);
        }

        if (ds.stockClassIndex[_id] > 0) {
            revert StockClassAlreadyExists(_id);
        }

        // Check that initial shares authorized don't exceed issuer's total authorized shares
        require(_initial_share_authorized <= ds.issuer.shares_authorized, "Exceeds issuer authorized shares");

        ds.stockClasses.push(
            StockClass({
                id: _id,
                class_type: _class_type,
                price_per_share: _price_per_share,
                shares_issued: 0,
                shares_authorized: _initial_share_authorized
            })
        );

        ds.stockClassIndex[_id] = ds.stockClasses.length;

        emit StockClassCreated(_id, _class_type, _price_per_share, _initial_share_authorized);
    }

    /// @notice Adjust the authorized shares for a stock class
    /// @dev Only DEFAULT_ADMIN_ROLE can adjust authorized shares
    function adjustAuthorizedShares(bytes16 stockClassId, uint256 newSharesAuthorized) external {
        Storage storage ds = StorageLib.get();

        // Check that caller has admin role
        if (!AccessControl.hasAdminRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.DEFAULT_ADMIN_ROLE);
        }

        uint256 stockClassIndex = ds.stockClassIndex[stockClassId];

        if (stockClassIndex == 0) {
            revert StockClassNotFound(stockClassId);
        }

        StockClass storage stockClass = ds.stockClasses[stockClassIndex - 1];

        // Check that new shares authorized don't exceed issuer's total authorized shares
        require(newSharesAuthorized <= ds.issuer.shares_authorized, "Exceeds issuer authorized shares");
        // Check that new shares authorized is not less than current shares issued
        require(newSharesAuthorized >= stockClass.shares_issued, "New shares authorized must be >= shares issued");

        stockClass.shares_authorized = newSharesAuthorized;

        emit StockClassAuthorizedSharesAdjusted(stockClassId, newSharesAuthorized);
        TxHelper.createTx(TxType.STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT, abi.encode(newSharesAuthorized));
    }
}
