// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "@core/Storage.sol";
import { StockClass } from "@libraries/Structs.sol";

library ValidationLib {
    error NoStakeholder(bytes16 stakeholder_id);
    error InvalidStockClass(bytes16 stock_class_id);
    error InvalidStockPlan(bytes16 stock_plan_id);
    error InvalidQuantity();
    error InvalidAmount();
    error InvalidSecurity(bytes16 security_id);
    error InvalidSecurityStakeholder(bytes16 security_id, bytes16 stakeholder_id);
    error InsufficientShares();

    function validateStakeholder(bytes16 stakeholder_id) internal view {
        Storage storage ds = StorageLib.get();
        if (ds.stakeholderIndex[stakeholder_id] == 0) {
            revert NoStakeholder(stakeholder_id);
        }
    }

    function validateStockClass(bytes16 stock_class_id) internal view {
        Storage storage ds = StorageLib.get();
        if (ds.stockClassIndex[stock_class_id] == 0) {
            revert InvalidStockClass(stock_class_id);
        }
    }

    function validateStockPlan(bytes16 stock_plan_id) internal view {
        Storage storage ds = StorageLib.get();
        if (ds.stockPlanIndex[stock_plan_id] == 0) {
            revert InvalidStockPlan(stock_plan_id);
        }
    }

    function validateQuantity(uint256 quantity) internal pure {
        if (quantity == 0) revert InvalidQuantity();
    }

    function validateAmount(uint256 amount) internal pure {
        if (amount == 0) revert InvalidAmount();
    }

    function validateSharesAvailable(bytes16 stock_class_id, uint256 quantity) internal view {
        Storage storage ds = StorageLib.get();
        uint256 stockClassIdx = ds.stockClassIndex[stock_class_id] - 1;
        StockClass storage stockClass = ds.stockClasses[stockClassIdx];

        require(ds.issuer.shares_issued + quantity <= ds.issuer.shares_authorized, "Issuer: Insufficient shares authorized");
        require(stockClass.shares_issued + quantity <= stockClass.shares_authorized, "StockClass: Insufficient shares authorized");
    }
}
