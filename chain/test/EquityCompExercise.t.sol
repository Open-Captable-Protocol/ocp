// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import {
    EquityCompensationActivePosition,
    StockActivePosition,
    IssueEquityCompensationParams,
    IssueStockParams
} from "@libraries/Structs.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { IAccessControlFacet } from "@interfaces/IAccessControlFacet.sol";
import { IStockFacet } from "@interfaces/IStockFacet.sol";
import { IEquityCompensationFacet } from "@interfaces/IEquityCompensationFacet.sol";

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
        IAccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, address(this));
        vm.stopPrank();

        // Create prerequisites
        stakeholderId = createStakeholder();
        stakeholderWallet = address(0xF62849F9A0B5Bf2913b396098F7c7019b51A820a);
        linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Grant investor role to stakeholder
        vm.prank(contractOwner);
        IAccessControlFacet(address(capTable)).grantRole(AccessControl.INVESTOR_ROLE, stakeholderWallet);

        stockClassId = createStockClass();

        bytes16[] memory stockClassIds = new bytes16[](1);
        stockClassIds[0] = stockClassId;
        stockPlanId = createStockPlan(stockClassIds);

        // Issue equity compensation
        equityCompSecurityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 equityCompensationId = 0xd3373e0a4dd940000000000000000012;
        IssueEquityCompensationParams memory equityParams = IssueEquityCompensationParams({
            id: equityCompensationId,
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            quantity: EQUITY_COMP_QUANTITY,
            security_id: equityCompSecurityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_EX_001",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });
        IEquityCompensationFacet(address(capTable)).issueEquityCompensation(equityParams);

        // Issue resulting stock
        stockSecurityId = 0xd3373e0a4dd940000000000000000002;
        bytes16 stockId = 0xd3373e0a4dd940000000000000000011;
        IssueStockParams memory params = IssueStockParams({
            id: stockId,
            stock_class_id: stockClassId,
            share_price: 1e18,
            quantity: EQUITY_COMP_QUANTITY,
            stakeholder_id: stakeholderId,
            security_id: stockSecurityId,
            custom_id: "STOCK_EX_001",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        IStockFacet(address(capTable)).issueStock(params);
    }

    function testExerciseEquityCompensation() public {
        uint256 exerciseQuantity = 500;
        bytes16 exerciseId = 0xd3373e0a4dd940000000000000000113;

        // Issue new stock position with exact quantity to exercise
        bytes16 newStockSecurityId = 0xd3373e0a4dd940000000000000000003;
        bytes16 newStockId = 0xd3373e0a4dd940000000000000000013;
        IssueStockParams memory exerciseParams = IssueStockParams({
            id: newStockId,
            stock_class_id: stockClassId,
            share_price: 1e18,
            quantity: exerciseQuantity,
            stakeholder_id: stakeholderId,
            security_id: newStockSecurityId,
            custom_id: "STOCK_EX_002",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        IStockFacet(address(capTable)).issueStock(exerciseParams);

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.EQUITY_COMPENSATION_EXERCISE,
            abi.encode(exerciseId, equityCompSecurityId, newStockSecurityId, exerciseQuantity)
        );

        // Exercise as operator
        IEquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            exerciseId, equityCompSecurityId, newStockSecurityId, exerciseQuantity
        );

        // Verify equity comp position was updated
        EquityCompensationActivePosition memory position =
            IEquityCompensationFacet(address(capTable)).getPosition(equityCompSecurityId);
        assertEq(position.quantity, EQUITY_COMP_QUANTITY - exerciseQuantity);
    }

    function testExerciseEquityCompensationFull() public {
        bytes16 exerciseId = bytes16(keccak256("EXERCISE_FULL"));

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.EQUITY_COMPENSATION_EXERCISE,
            abi.encode(exerciseId, equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY)
        );

        // Exercise as operator
        IEquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            exerciseId, equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY
        );

        // Verify position was removed
        EquityCompensationActivePosition memory position =
            IEquityCompensationFacet(address(capTable)).getPosition(equityCompSecurityId);
        assertEq(position.quantity, 0);
    }

    function testFailNonOperatorExercise() public {
        address nonOperator = address(0x129);
        vm.prank(nonOperator);
        bytes16 exerciseId = bytes16(keccak256("NON_OPERATOR"));
        IEquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            exerciseId, equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY
        );
    }

    function testFailInvalidEquityCompSecurity() public {
        bytes16 invalidSecurityId = 0xd3373e0a4dd940000000000000000099;
        bytes16 exerciseId = bytes16(keccak256("INVALID_EXERCISE_1"));

        IEquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            exerciseId, invalidSecurityId, stockSecurityId, 500
        );
    }

    function testFailInvalidStockSecurity() public {
        bytes16 invalidStockId = 0xd3373e0a4dd940000000000000000099;
        bytes16 exerciseId = bytes16(keccak256("INVALID_EXERCISE_2"));

        IEquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            exerciseId, equityCompSecurityId, invalidStockId, 500
        );
    }

    function testFailInsufficientShares() public {
        bytes16 exerciseId = bytes16(keccak256("INSUFFICIENT_SHARES"));

        IEquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            exerciseId, equityCompSecurityId, stockSecurityId, EQUITY_COMP_QUANTITY + 1
        );
    }

    function testFailWrongStakeholder() public {
        // Create a different stakeholder with unique ID
        bytes16 otherStakeholderId = createStakeholder();
        bytes16 exerciseId = bytes16(keccak256("WRONG_STAKEHOLDER"));

        // Issue stock to different stakeholder
        bytes16 otherStockSecurityId = 0xd3373e0a4dd940000000000000000003;
        bytes16 otherStockId = 0xd3373e0a4dd940000000000000000013;
        IssueStockParams memory otherParams = IssueStockParams({
            id: otherStockId,
            stock_class_id: stockClassId,
            share_price: 1e18,
            quantity: 500,
            stakeholder_id: otherStakeholderId,
            security_id: otherStockSecurityId,
            custom_id: "STOCK_EX_003",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        IStockFacet(address(capTable)).issueStock(otherParams);

        // Should fail when trying to exercise equity compensation with stock belonging to different stakeholder
        // even though caller is an operator
        vm.expectRevert(
            abi.encodeWithSelector(
                ValidationLib.InvalidSecurityStakeholder.selector, otherStockSecurityId, stakeholderId
            )
        );
        IEquityCompensationFacet(address(capTable)).exerciseEquityCompensation(
            exerciseId, equityCompSecurityId, otherStockSecurityId, 500
        );
    }
}
