// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { EquityCompensationActivePosition, StockActivePosition } from "@libraries/Structs.sol";

contract DiamondEquityCompExerciseTest is DiamondTestBase {
    bytes16 stakeholderId;
    bytes16 stockClassId;
    bytes16 stockPlanId;
    bytes16 equityCompSecurityId;
    bytes16 stockSecurityId;
    uint256 constant EQUITY_COMP_QUANTITY = 1000;
    address stakeholderWallet;

    function setUp() public override {
        super.setUp();

        // Grant necessary roles
        vm.startPrank(contractOwner);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, address(this));
        vm.stopPrank();

        // Create prerequisites
        stakeholderId = createStakeholder();
        stakeholderWallet = address(0xF62849F9A0B5Bf2913b396098F7c7019b51A820a);
        linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Grant investor role to stakeholder
        vm.prank(contractOwner);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.INVESTOR_ROLE, stakeholderWallet);

        stockClassId = createStockClass();

        bytes16[] memory stockClassIds = new bytes16[](1);
        stockClassIds[0] = stockClassId;
        stockPlanId = createStockPlan(stockClassIds);

        // Issue equity compensation
        equityCompSecurityId = 0xd3373e0a4dd940000000000000000001;
        EquityCompensationFacet(address(capTable)).issueEquityCompensation(
            stakeholderId, stockClassId, stockPlanId, EQUITY_COMP_QUANTITY, equityCompSecurityId
        );

        // Issue resulting stock
        stockSecurityId = 0xd3373e0a4dd940000000000000000002;
        StockFacet(address(capTable)).issueStock(
            stockClassId,
            1e18, // share price
            EQUITY_COMP_QUANTITY,
            stakeholderId,
            stockSecurityId
        );
    }

    function testExerciseEquityCompensation() public {
        uint256 exerciseQuantity = 500;

        // Issue new stock position with exact quantity to exercise
        bytes16 newStockSecurityId = 0xd3373e0a4dd940000000000000000003;
        StockFacet(address(capTable)).issueStock(
            stockClassId,
            1e18, // share price
            exerciseQuantity, // Must match exercise quantity
            stakeholderId,
            newStockSecurityId
        );

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.EQUITY_COMPENSATION_EXERCISE, abi.encode(equityCompSecurityId, newStockSecurityId, exerciseQuantity)
        );

        // Exercise as stakeholder
        vm.prank(stakeholderWallet);
        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            equityCompSecurityId, newStockSecurityId, exerciseQuantity
        );

        // Verify equity comp position was updated
        EquityCompensationActivePosition memory position =
            EquityCompensationFacet(address(capTable)).getPosition(equityCompSecurityId);
        assertEq(position.quantity, EQUITY_COMP_QUANTITY - exerciseQuantity);
    }

    function testExerciseEquityCompensationFull() public {
        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.EQUITY_COMPENSATION_EXERCISE, abi.encode(equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY)
        );

        // Exercise as stakeholder
        vm.prank(stakeholderWallet);
        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY
        );

        // Verify position was removed
        EquityCompensationActivePosition memory position =
            EquityCompensationFacet(address(capTable)).getPosition(equityCompSecurityId);
        assertEq(position.quantity, 0);
    }

    function testFailInvalidEquityCompSecurity() public {
        bytes16 invalidSecurityId = 0xd3373e0a4dd940000000000000000099;

        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(invalidSecurityId, stockSecurityId, 500);
    }

    function testFailInvalidStockSecurity() public {
        bytes16 invalidStockId = 0xd3373e0a4dd940000000000000000099;

        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(equityCompSecurityId, invalidStockId, 500);
    }

    function testFailInsufficientShares() public {
        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY + 1
        );
    }

    function testFailWrongStakeholder() public {
        // Create a different stakeholder with unique ID
        bytes16 otherStakeholderId = createStakeholder();

        // Issue stock to different stakeholder
        bytes16 otherStockSecurityId = 0xd3373e0a4dd940000000000000000003;
        StockFacet(address(capTable)).issueStock(
            stockClassId,
            1e18, // share price
            500,
            otherStakeholderId,
            otherStockSecurityId
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                ValidationLib.InvalidSecurityStakeholder.selector, otherStockSecurityId, stakeholderId
            )
        );
        EquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            equityCompSecurityId, otherStockSecurityId, 500
        );
    }
}
