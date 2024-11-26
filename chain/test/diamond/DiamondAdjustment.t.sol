// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DiamondTestBase.sol";
import { TxHelper, TxType } from "@diamond/DiamondTxHelper.sol";

contract DiamondAdjustmentTest is DiamondTestBase {
    bytes16 public stockClassId;
    bytes16 public stockPlanId;

    function setUp() public override {
        super.setUp();
        stockClassId = createStockClass();
        bytes16[] memory stockClassIds = new bytes16[](1);
        stockClassIds[0] = stockClassId;
        stockPlanId = createStockPlan(stockClassIds);
    }

    function test_AdjustIssuerAuthorizedShares() public {
        uint256 newSharesAuthorized = 2000000;

        // Expect both events in order
        vm.expectEmit(true, false, false, true, address(diamond));
        emit IssuerAuthorizedSharesAdjusted(newSharesAuthorized);

        vm.expectEmit(true, true, false, true, address(diamond));
        emit TxHelper.TxCreated(TxType.ISSUER_AUTHORIZED_SHARES_ADJUSTMENT, abi.encode(newSharesAuthorized));

        IssuerFacet(payable(address(diamond))).adjustAuthorizedShares(newSharesAuthorized);
    }

    function test_AdjustStockClassAuthorizedShares() public {
        uint256 newSharesAuthorized = 2000000;

        vm.expectEmit(true, true, false, true, address(diamond));
        emit StockClassAuthorizedSharesAdjusted(stockClassId, newSharesAuthorized);

        vm.expectEmit(true, true, false, true, address(diamond));
        emit TxHelper.TxCreated(TxType.STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT, abi.encode(newSharesAuthorized));

        StockClassFacet(payable(address(diamond))).adjustAuthorizedShares(stockClassId, newSharesAuthorized);
    }

    function test_AdjustStockPlanPool() public {
        uint256 newSharesReserved = 200000;

        vm.expectEmit(true, true, false, true, address(diamond));
        emit TxHelper.TxCreated(TxType.STOCK_PLAN_POOL_ADJUSTMENT, abi.encode(newSharesReserved));

        StockPlanFacet(payable(address(diamond))).adjustStockPlanPool(stockPlanId, newSharesReserved);
    }

    function test_RevertWhen_AdjustingNonExistentStockClass() public {
        bytes16 invalidStockClassId = 0xd3373e0a4dd940000000000000000099;
        uint256 newSharesAuthorized = 2000000;

        vm.expectRevert(abi.encodeWithSelector(StockClassFacet.StockClassNotFound.selector, invalidStockClassId));
        StockClassFacet(payable(address(diamond))).adjustAuthorizedShares(invalidStockClassId, newSharesAuthorized);
    }

    function test_RevertWhen_AdjustingNonExistentStockPlan() public {
        bytes16 invalidStockPlanId = 0xd3373e0a4dd940000000000000000099;
        uint256 newSharesReserved = 200000;

        vm.expectRevert(abi.encodeWithSelector(StockPlanFacet.StockPlanNotFound.selector, invalidStockPlanId));
        StockPlanFacet(payable(address(diamond))).adjustStockPlanPool(invalidStockPlanId, newSharesReserved);
    }
}
