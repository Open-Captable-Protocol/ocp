// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { EquityCompensationActivePosition } from "@libraries/Structs.sol";

contract DiamondEquityCompensationIssuanceTest is DiamondTestBase {
    bytes16 stakeholderId;
    bytes16 stockClassId;
    bytes16 stockPlanId;

    function setUp() public override {
        super.setUp();

        // Grant necessary roles
        vm.startPrank(contractOwner);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, address(this));
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

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.EQUITY_COMPENSATION_ISSUANCE,
            abi.encode(
                stakeholderId,
                stockClassId,
                stockPlanId,
                quantity,
                securityId,
                "ISO",
                1e18,
                1e18,
                "2025-12-31",
                "EQCOMP_001",
                "90_DAYS",
                "REG_D"
            )
        );

        EquityCompensationFacet(address(capTable)).issueEquityCompensation(
            stakeholderId,
            stockClassId,
            stockPlanId,
            quantity,
            securityId,
            "ISO", // compensation_type
            1e18, // exercise_price
            1e18, // base_price
            "2025-12-31", // expiration_date
            "EQCOMP_001", // custom_id
            "90_DAYS", // termination_exercise_windows_mapping
            "REG_D" // security_law_exemptions_mapping
        );

        // Verify position was created correctly
        EquityCompensationActivePosition memory position =
            EquityCompensationFacet(address(capTable)).getPosition(securityId);
        assertEq(position.quantity, quantity);
        assertEq(position.stakeholder_id, stakeholderId);
        assertEq(position.stock_class_id, stockClassId);
        assertEq(position.stock_plan_id, stockPlanId);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        EquityCompensationFacet(address(capTable)).issueEquityCompensation(
            invalidStakeholderId,
            stockClassId,
            stockPlanId,
            1000,
            securityId,
            "ISO",
            1e18,
            1e18,
            "2025-12-31",
            "EQCOMP_002",
            "90_DAYS",
            "REG_D"
        );
    }

    function testFailInvalidStockClass() public {
        bytes16 invalidStockClassId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        EquityCompensationFacet(address(capTable)).issueEquityCompensation(
            stakeholderId,
            invalidStockClassId,
            stockPlanId,
            1000,
            securityId,
            "ISO",
            1e18,
            1e18,
            "2025-12-31",
            "EQCOMP_003",
            "90_DAYS",
            "REG_D"
        );
    }

    function testFailZeroQuantity() public {
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        EquityCompensationFacet(address(capTable)).issueEquityCompensation(
            stakeholderId,
            stockClassId,
            stockPlanId,
            0,
            securityId,
            "ISO",
            1e18,
            1e18,
            "2025-12-31",
            "EQCOMP_005",
            "90_DAYS",
            "REG_D"
        );
    }
}
