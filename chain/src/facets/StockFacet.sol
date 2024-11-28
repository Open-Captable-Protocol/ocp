// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "@core/Storage.sol";
import { StockActivePosition, StockClass } from "@libraries/Structs.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";

contract StockFacet {
    function issueStock(
        bytes16 stock_class_id,
        uint256 share_price,
        uint256 quantity,
        bytes16 stakeholder_id,
        bytes16 security_id
    )
        external
    {
        Storage storage ds = StorageLib.get();

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

    function getStockPosition(bytes16 securityId) external view returns (StockActivePosition memory) {
        Storage storage ds = StorageLib.get();
        return ds.stockActivePositions.securities[securityId];
    }
}
