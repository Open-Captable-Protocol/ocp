// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DiamondTestBase.sol";
import { StorageLib } from "@diamond/Storage.sol";
import { TxHelper, TxType } from "@diamond/DiamondTxHelper.sol";
import { ValidationLib } from "@diamond/libraries/ValidationLib.sol";
import { EquityCompensationActivePosition, StockActivePosition } from "@diamond/Structs.sol";

contract DiamondEquityCompExerciseTest is DiamondTestBase {
    bytes16 stakeholderId;
    bytes16 stockClassId;
    bytes16 stockPlanId;
    bytes16 equityCompSecurityId;
    bytes16 stockSecurityId;
    uint256 constant EQUITY_COMP_QUANTITY = 1000;

    function setUp() public override {
        super.setUp();

        // Create prerequisites
        stakeholderId = createStakeholder();
        stockClassId = createStockClass();

        bytes16[] memory stockClassIds = new bytes16[](1);
        stockClassIds[0] = stockClassId;
        stockPlanId = createStockPlan(stockClassIds);

        // Issue equity compensation
        equityCompSecurityId = 0xd3373e0a4dd940000000000000000001;
        EquityCompensationFacet(address(diamond)).issueEquityCompensation(
            stakeholderId,
            stockClassId,
            stockPlanId,
            EQUITY_COMP_QUANTITY,
            equityCompSecurityId
        );

        // Issue resulting stock
        stockSecurityId = 0xd3373e0a4dd940000000000000000002;
        StockFacet(address(diamond)).issueStock(
            stockClassId,
            1e18, // share price
            EQUITY_COMP_QUANTITY,
            stakeholderId,
            stockSecurityId
        );
    }

    function testExerciseEquityCompensation() public {
        uint256 exerciseQuantity = 500;

        vm.expectEmit(true, true, false, true, address(diamond));
        emit TxHelper.TxCreated(TxType.EQUITY_COMPENSATION_EXERCISE, abi.encode(equityCompSecurityId, stockSecurityId, exerciseQuantity));

        EquityCompensationFacet(address(diamond)).exerciseEquityCompensation(equityCompSecurityId, stockSecurityId, exerciseQuantity);

        // Verify equity comp position was updated
        EquityCompensationActivePosition memory position = EquityCompensationFacet(address(diamond)).getPosition(equityCompSecurityId);
        assertEq(position.quantity, EQUITY_COMP_QUANTITY - exerciseQuantity);
    }

    function testExerciseEquityCompensationFull() public {
        vm.expectEmit(true, true, false, true, address(diamond));
        emit TxHelper.TxCreated(TxType.EQUITY_COMPENSATION_EXERCISE, abi.encode(equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY));

        EquityCompensationFacet(address(diamond)).exerciseEquityCompensation(equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY);

        // Verify position was removed
        EquityCompensationActivePosition memory position = EquityCompensationFacet(address(diamond)).getPosition(equityCompSecurityId);
        assertEq(position.quantity, 0);
    }

    function testFailInvalidEquityCompSecurity() public {
        bytes16 invalidSecurityId = 0xd3373e0a4dd940000000000000000099;

        EquityCompensationFacet(address(diamond)).exerciseEquityCompensation(invalidSecurityId, stockSecurityId, 500);
    }

    function testFailInvalidStockSecurity() public {
        bytes16 invalidStockId = 0xd3373e0a4dd940000000000000000099;

        EquityCompensationFacet(address(diamond)).exerciseEquityCompensation(equityCompSecurityId, invalidStockId, 500);
    }

    function testFailInsufficientShares() public {
        EquityCompensationFacet(address(diamond)).exerciseEquityCompensation(equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY + 1);
    }
}
