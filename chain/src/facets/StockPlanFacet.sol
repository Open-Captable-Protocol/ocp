// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "@core/Storage.sol";
import { StockPlan } from "@libraries/Structs.sol";
import { LibDiamond } from "diamond-3-hardhat/libraries/LibDiamond.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { AccessControl } from "@libraries/AccessControl.sol";

contract StockPlanFacet {
    event StockPlanCreated(bytes16 indexed id, uint256 shares_reserved);
    event StockPlanSharesReservedAdjusted(bytes16 indexed id, uint256 newSharesReserved);

    error StockPlanAlreadyExists(bytes16 stock_plan_id);
    error InvalidStockClass(bytes16 stock_class_id);
    error StockPlanNotFound(bytes16 stock_plan_id);

    /// @notice Create a new stock plan with specified stock classes and reserved shares
    /// @dev Only OPERATOR_ROLE can create stock plans
    function createStockPlan(bytes16 id, bytes16[] memory stock_class_ids, uint256 shares_reserved) external {
        Storage storage ds = StorageLib.get();

        if (!AccessControl.hasOperatorRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.OPERATOR_ROLE);
        }

        if (ds.stockPlanIndex[id] > 0) {
            revert StockPlanAlreadyExists(id);
        }

        // Verify all stock classes exist
        for (uint256 i = 0; i < stock_class_ids.length; i++) {
            if (ds.stockClassIndex[stock_class_ids[i]] == 0) {
                revert InvalidStockClass(stock_class_ids[i]);
            }
        }

        ds.stockPlans.push(StockPlan({ stock_class_ids: stock_class_ids, shares_reserved: shares_reserved }));
        ds.stockPlanIndex[id] = ds.stockPlans.length;

        emit StockPlanCreated(id, shares_reserved);
    }

    /// @notice Adjust the number of shares reserved in a stock plan
    /// @dev Only OPERATOR_ROLE can adjust stock plan pools
    function adjustStockPlanPool(bytes16 stockPlanId, uint256 newSharesReserved) external {
        Storage storage ds = StorageLib.get();

        if (!AccessControl.hasOperatorRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.OPERATOR_ROLE);
        }

        uint256 stockPlanIndex = ds.stockPlanIndex[stockPlanId];

        if (stockPlanIndex == 0) {
            revert StockPlanNotFound(stockPlanId);
        }

        StockPlan storage stockPlan = ds.stockPlans[stockPlanIndex - 1];
        stockPlan.shares_reserved = newSharesReserved;

        TxHelper.createTx(TxType.STOCK_PLAN_POOL_ADJUSTMENT, abi.encode(stockPlanId, newSharesReserved));
    }
}
