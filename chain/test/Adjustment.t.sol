// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { IIssuerFacet } from "@interfaces/IIssuerFacet.sol";
import { IStockClassFacet } from "@interfaces/IStockClassFacet.sol";
import { IStockPlanFacet } from "@interfaces/IStockPlanFacet.sol";

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
        bytes16 issuerAdjustmentId = bytes16(keccak256("ADJUSTMENT_1"));
        uint256 newSharesAuthorized = 2_000_000;

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.ISSUER_AUTHORIZED_SHARES_ADJUSTMENT, abi.encode(issuerAdjustmentId, issuerId, newSharesAuthorized)
        );

        IIssuerFacet(address(capTable)).adjustIssuerAuthorizedShares(issuerAdjustmentId, newSharesAuthorized);
    }

    function test_AdjustStockClassAuthorizedShares() public {
        uint256 newSharesAuthorized = 2_000_000;
        bytes16 stockClassAdjustmentId = bytes16(keccak256("ADJUSTMENT_1"));

        IIssuerFacet(address(capTable)).adjustIssuerAuthorizedShares(stockClassAdjustmentId, newSharesAuthorized);

        uint256 newStockClassSharesAuthorized = 1_999_999;

        IStockClassFacet(address(capTable)).adjustAuthorizedShares(
            stockClassAdjustmentId, stockClassId, newStockClassSharesAuthorized
        );
    }

    function test_AdjustStockPlanPool() public {
        uint256 newSharesReserved = 200_000;
        bytes16 stockPlanAdjustmentId = bytes16(keccak256("STOCK_PLAN_ADJ_1"));

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.STOCK_PLAN_POOL_ADJUSTMENT, abi.encode(stockPlanAdjustmentId, stockPlanId, newSharesReserved)
        );

        IStockPlanFacet(address(capTable)).adjustStockPlanPool(stockPlanAdjustmentId, stockPlanId, newSharesReserved);
    }

    function test_RevertWhen_AdjustingNonExistentStockClass() public {
        bytes16 invalidStockClassId = 0xd3373e0a4dd940000000000000000099;
        bytes16 stockClassAdjustmentId = bytes16(keccak256("INVALID_ADJ_1"));
        uint256 newSharesAuthorized = 2_000_000;

        vm.expectRevert(abi.encodeWithSelector(IStockClassFacet.StockClassNotFound.selector, invalidStockClassId));
        IStockClassFacet(address(capTable)).adjustAuthorizedShares(
            stockClassAdjustmentId, invalidStockClassId, newSharesAuthorized
        );
    }

    function test_RevertWhen_AdjustingNonExistentStockPlan() public {
        bytes16 invalidStockPlanId = 0xd3373e0a4dd940000000000000000099;
        bytes16 stockPlanAdjustmentId = bytes16(keccak256("INVALID_PLAN_ADJ_1"));
        uint256 newSharesReserved = 200_000;

        vm.expectRevert(abi.encodeWithSelector(IStockPlanFacet.StockPlanNotFound.selector, invalidStockPlanId));
        IStockPlanFacet(address(capTable)).adjustStockPlanPool(
            stockPlanAdjustmentId, invalidStockPlanId, newSharesReserved
        );
    }
}
