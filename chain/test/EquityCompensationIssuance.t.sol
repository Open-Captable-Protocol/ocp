// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { EquityCompensationActivePosition, IssueEquityCompensationParams } from "@libraries/Structs.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { IEquityCompensationFacet } from "@interfaces/IEquityCompensationFacet.sol";

contract DiamondEquityCompensationIssuanceTest is DiamondTestBase {
    bytes16 stakeholderId;
    bytes16 stockClassId;
    bytes16 stockPlanId;

    function setUp() public override {
        super.setUp();

        // Grant necessary roles
        vm.startPrank(contractOwner);
        IAccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, address(this));
        vm.stopPrank();

        stakeholderId = createStakeholder();
        stockClassId = createStockClass();

        // Create array properly
        bytes16[] memory stockClassIds = new bytes16[](1);
        stockClassIds[0] = stockClassId;
        stockPlanId = createStockPlan(stockClassIds);
    }

    function testIssueEquityCompensation() public {
        uint256 quantity = 1000;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000002;
        IssueEquityCompensationParams memory params = IssueEquityCompensationParams({
            id: id,
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            quantity: quantity,
            security_id: securityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_001",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(TxType.EQUITY_COMPENSATION_ISSUANCE, abi.encode(params));

        IEquityCompensationFacet(address(capTable)).issueEquityCompensation(params);

        // Verify position was created correctly
        EquityCompensationActivePosition memory position =
            IEquityCompensationFacet(address(capTable)).getPosition(securityId);
        assertEq(position.quantity, quantity);
        assertEq(position.stakeholder_id, stakeholderId);
        assertEq(position.stock_class_id, stockClassId);
        assertEq(position.stock_plan_id, stockPlanId);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000002;

        IssueEquityCompensationParams memory params = IssueEquityCompensationParams({
            id: id,
            stakeholder_id: invalidStakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            quantity: 1000,
            security_id: securityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_002",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });
        IEquityCompensationFacet(address(capTable)).issueEquityCompensation(params);
    }

    function testFailInvalidStockClass() public {
        bytes16 invalidStockClassId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000002;

        IssueEquityCompensationParams memory params = IssueEquityCompensationParams({
            id: id,
            stakeholder_id: stakeholderId,
            stock_class_id: invalidStockClassId,
            stock_plan_id: stockPlanId,
            quantity: 1000,
            security_id: securityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_003",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });
        IEquityCompensationFacet(address(capTable)).issueEquityCompensation(params);
    }

    function testFailZeroQuantity() public {
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000002;

        IssueEquityCompensationParams memory params = IssueEquityCompensationParams({
            id: id,
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            quantity: 0,
            security_id: securityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_005",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });
        IEquityCompensationFacet(address(capTable)).issueEquityCompensation(params);
    }
}
