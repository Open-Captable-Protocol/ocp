// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "../Storage.sol";
import { StockPlan } from "../Structs.sol";
import { LibDiamond } from "diamond-3-hardhat/libraries/LibDiamond.sol";
import { TxHelper, TxType } from "../DiamondTxHelper.sol";

contract StockPlanFacet {
    event StockPlanCreated(bytes16 indexed id);
    event StockPlanSharesReservedAdjusted(bytes16 indexed id, uint256 newSharesReserved);

    error StockPlanAlreadyExists(bytes16 stock_plan_id);
    error InvalidStockClass(bytes16 stock_class_id);
    error StockPlanNotFound(bytes16 stock_plan_id);

    function createStockPlan(bytes16 _id, bytes16[] memory _stock_class_ids, uint256 _shares_reserved) external {
        Storage storage ds = StorageLib.get();

        if (ds.stockPlanIndex[_id] > 0) {
            revert StockPlanAlreadyExists(_id);
        }

        // Verify all stock classes exist
        for (uint256 i = 0; i < _stock_class_ids.length; i++) {
            if (ds.stockClassIndex[_stock_class_ids[i]] == 0) {
                revert InvalidStockClass(_stock_class_ids[i]);
            }
        }

        ds.stockPlans.push(StockPlan({ stock_class_ids: _stock_class_ids, shares_reserved: _shares_reserved }));
        ds.stockPlanIndex[_id] = ds.stockPlans.length;

        emit StockPlanCreated(_id);
    }

    function adjustStockPlanPool(bytes16 stockPlanId, uint256 newSharesReserved) external {
        LibDiamond.enforceIsContractOwner();

        Storage storage ds = StorageLib.get();
        uint256 stockPlanIndex = ds.stockPlanIndex[stockPlanId];

        if (stockPlanIndex == 0) {
            revert StockPlanNotFound(stockPlanId);
        }

        StockPlan storage stockPlan = ds.stockPlans[stockPlanIndex - 1];
        stockPlan.shares_reserved = newSharesReserved;

        TxHelper.createTx(TxType.STOCK_PLAN_POOL_ADJUSTMENT, abi.encode(newSharesReserved));
    }
}
