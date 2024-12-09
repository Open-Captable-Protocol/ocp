// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { AccessControlFacet } from "@facets/AccessControlFacet.sol";
import { StockClassFacet } from "@facets/StockClassFacet.sol";
import { StockFacet } from "@facets/StockFacet.sol";
import { EquityCompensationFacet } from "@facets/EquityCompensationFacet.sol";
import { StakeholderNFTFacet } from "@facets/StakeholderNFTFacet.sol";
import { StakeholderFacet } from "@facets/StakeholderFacet.sol";
import { StockPlanFacet } from "@facets/StockPlanFacet.sol";
import { IssueStockParams, IssueEquityCompensationParams } from "@libraries/Structs.sol";

contract AccessControlTest is DiamondTestBase {
    address admin;
    address operator;
    address investor;
    address unauthorized;

    function setUp() public override {
        super.setUp();

        // Set up test addresses
        admin = address(0x1);
        operator = address(0x2);
        investor = address(0x3);
        unauthorized = address(0x4);

        // contract owner is the FACTORY
        vm.startPrank(contractOwner);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.DEFAULT_ADMIN_ROLE, admin);
        AccessControlFacet(address(capTable)).transferAdmin(admin);
        vm.stopPrank();

        // Now have admin accept the role
        vm.startPrank(admin);
        AccessControlFacet(address(capTable)).acceptAdmin();
        AccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, operator);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.INVESTOR_ROLE, investor);
        vm.stopPrank();
    }

    function testStockClassFacetAccess() public {
        // Test createStockClass
        vm.startPrank(admin);
        StockClassFacet(address(capTable)).createStockClass(bytes16(keccak256("stockClass1")), "Common", 100, 1000);
        vm.stopPrank();

        // Test unauthorized access
        vm.startPrank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                AccessControl.AccessControlUnauthorized.selector, operator, AccessControl.DEFAULT_ADMIN_ROLE
            )
        );
        StockClassFacet(address(capTable)).createStockClass(bytes16(keccak256("stockClass2")), "Preferred", 100, 1000);
        vm.stopPrank();
    }

    function testStockFacetAccess() public {
        // Create a stakeholder and stock class first
        bytes16 stakeholderId = createStakeholder();
        bytes16 stockClassId = createStockClass();

        // Test issueStock with operator role
        vm.startPrank(operator);
        IssueStockParams memory params = IssueStockParams({
            stock_class_id: stockClassId,
            share_price: 1,
            quantity: 100,
            stakeholder_id: stakeholderId,
            security_id: bytes16(keccak256("security1")),
            custom_id: "custom_id",
            stock_legend_ids_mapping: "stock_legend_ids_mapping",
            security_law_exemptions_mapping: "security_law_exemptions_mapping"
        });
        StockFacet(address(capTable)).issueStock(params);
        vm.stopPrank();

        // Test unauthorized access
        vm.startPrank(investor);
        vm.expectRevert(
            abi.encodeWithSelector(
                AccessControl.AccessControlUnauthorized.selector, investor, AccessControl.OPERATOR_ROLE
            )
        );
        IssueStockParams memory params2 = IssueStockParams({
            stock_class_id: stockClassId,
            share_price: 1,
            quantity: 100,
            stakeholder_id: stakeholderId,
            security_id: bytes16(keccak256("security2")),
            custom_id: "custom_id",
            stock_legend_ids_mapping: "stock_legend_ids_mapping",
            security_law_exemptions_mapping: "security_law_exemptions_mapping"
        });
        StockFacet(address(capTable)).issueStock(params2);
        vm.stopPrank();
    }

    function testEquityCompensationFacetAccess() public {
        // Create a stakeholder first
        bytes16 stakeholderId = bytes16(keccak256("stakeholder1"));
        vm.startPrank(contractOwner);
        StakeholderFacet(address(capTable)).createStakeholder(stakeholderId);
        vm.stopPrank();

        // Create a stock class
        bytes16 stockClassId = bytes16(keccak256("stockClass1"));
        vm.startPrank(admin);
        StockClassFacet(address(capTable)).createStockClass(stockClassId, "Common", 100, 1000);
        vm.stopPrank();

        // Create a stock plan
        bytes16 stockPlanId = bytes16(keccak256("stockPlan1"));
        bytes16[] memory stockClassIds = new bytes16[](1);
        stockClassIds[0] = stockClassId;
        vm.startPrank(admin);
        StockPlanFacet(address(capTable)).createStockPlan(stockPlanId, stockClassIds, 1000);
        vm.stopPrank();

        // Test issueEquityCompensation
        vm.startPrank(operator);
        IssueEquityCompensationParams memory params = IssueEquityCompensationParams({
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            quantity: 100,
            security_id: bytes16(keccak256("security1")),
            compensation_type: "OPTION",
            exercise_price: 100,
            base_price: 100,
            expiration_date: "2025-01-01",
            custom_id: "custom_id",
            termination_exercise_windows_mapping: "termination_exercise_windows_mapping",
            security_law_exemptions_mapping: "security_law_exemptions_mapping"
        });
        EquityCompensationFacet(address(capTable)).issueEquityCompensation(params);
        vm.stopPrank();

        // Test unauthorized access
        vm.startPrank(investor);
        vm.expectRevert(
            abi.encodeWithSelector(
                AccessControl.AccessControlUnauthorized.selector, investor, AccessControl.OPERATOR_ROLE
            )
        );
        IssueEquityCompensationParams memory params2 = IssueEquityCompensationParams({
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            quantity: 100,
            security_id: bytes16(keccak256("security2")),
            compensation_type: "OPTION",
            exercise_price: 100,
            base_price: 100,
            expiration_date: "2025-01-01",
            custom_id: "custom_id",
            termination_exercise_windows_mapping: "termination_exercise_windows_mapping",
            security_law_exemptions_mapping: "security_law_exemptions_mapping"
        });
        EquityCompensationFacet(address(capTable)).issueEquityCompensation(params2);
        vm.stopPrank();
    }

    function testStakeholderNFTFacetAccess() public {
        // Create a stakeholder first and link it to the investor
        bytes16 stakeholderId = bytes16(keccak256("stakeholder1"));
        vm.startPrank(contractOwner);
        StakeholderFacet(address(capTable)).createStakeholder(stakeholderId);
        StakeholderFacet(address(capTable)).linkStakeholderAddress(stakeholderId, investor);
        vm.stopPrank();

        // Test mint
        vm.startPrank(investor);
        StakeholderNFTFacet(address(capTable)).mint();
        vm.stopPrank();

        // Test unauthorized access
        vm.startPrank(unauthorized);
        vm.expectRevert(
            abi.encodeWithSelector(
                AccessControl.AccessControlUnauthorized.selector, unauthorized, AccessControl.INVESTOR_ROLE
            )
        );
        StakeholderNFTFacet(address(capTable)).mint();
        vm.stopPrank();
    }

    function createStakeholder() public override returns (bytes16) {
        bytes16 stakeholderId = bytes16(keccak256("stakeholder1"));
        vm.startPrank(contractOwner);
        StakeholderFacet(address(capTable)).createStakeholder(stakeholderId);
        vm.stopPrank();
        return stakeholderId;
    }

    function createStockClass() public override returns (bytes16) {
        bytes16 stockClassId = bytes16(keccak256("stockClass1"));
        vm.startPrank(admin);
        StockClassFacet(address(capTable)).createStockClass(stockClassId, "Common", 100, 1000);
        vm.stopPrank();
        return stockClassId;
    }

    function testAdminTransfer() public {
        address newAdmin = address(0x123);

        // Try transfer from non-admin (should fail)
        vm.startPrank(unauthorized);
        vm.expectRevert(
            abi.encodeWithSelector(
                AccessControl.AccessControlUnauthorized.selector, unauthorized, AccessControl.DEFAULT_ADMIN_ROLE
            )
        );
        AccessControlFacet(address(capTable)).transferAdmin(newAdmin);
        vm.stopPrank();

        // Start admin transfer from current admin
        vm.startPrank(admin);
        AccessControlFacet(address(capTable)).transferAdmin(newAdmin);

        // Verify pending admin is set
        assertEq(AccessControlFacet(address(capTable)).getPendingAdmin(), newAdmin);
        vm.stopPrank();

        // Try accept from wrong address (should fail)
        vm.startPrank(unauthorized);
        vm.expectRevert(AccessControlFacet.AccessControlInvalidTransfer.selector);
        AccessControlFacet(address(capTable)).acceptAdmin();
        vm.stopPrank();

        // Accept transfer with new admin
        vm.startPrank(newAdmin);
        AccessControlFacet(address(capTable)).acceptAdmin();

        // Verify new admin is set
        assertEq(AccessControlFacet(address(capTable)).getAdmin(), newAdmin);

        // Verify old admin lost admin role
        assertFalse(AccessControlFacet(address(capTable)).hasRole(AccessControl.DEFAULT_ADMIN_ROLE, admin));

        // Verify new admin has admin role
        assertTrue(AccessControlFacet(address(capTable)).hasRole(AccessControl.DEFAULT_ADMIN_ROLE, newAdmin));

        // Verify new admin has operator and investor roles
        assertTrue(AccessControlFacet(address(capTable)).hasRole(AccessControl.OPERATOR_ROLE, newAdmin));
        assertTrue(AccessControlFacet(address(capTable)).hasRole(AccessControl.INVESTOR_ROLE, newAdmin));
        vm.stopPrank();
    }

    function testCannotTransferToZeroAddress() public {
        vm.startPrank(admin);
        vm.expectRevert(AccessControlFacet.AccessControlInvalidTransfer.selector);
        AccessControlFacet(address(capTable)).transferAdmin(address(0));
        vm.stopPrank();
    }

    function testPendingAdminClearedAfterTransfer() public {
        address newAdmin = address(0x123);

        // Start transfer
        vm.startPrank(admin);
        AccessControlFacet(address(capTable)).transferAdmin(newAdmin);
        assertEq(AccessControlFacet(address(capTable)).getPendingAdmin(), newAdmin);
        vm.stopPrank();

        // Complete transfer
        vm.startPrank(newAdmin);
        AccessControlFacet(address(capTable)).acceptAdmin();

        // Verify pending admin is cleared
        assertEq(AccessControlFacet(address(capTable)).getPendingAdmin(), address(0));
        vm.stopPrank();
    }

    function testOnlyOneAdminAtATime() public {
        address newAdmin = address(0x123);

        // Verify initial state
        assertTrue(AccessControlFacet(address(capTable)).hasRole(AccessControl.DEFAULT_ADMIN_ROLE, admin));
        assertEq(AccessControlFacet(address(capTable)).getAdmin(), admin);

        // Complete transfer
        vm.prank(admin);
        AccessControlFacet(address(capTable)).transferAdmin(newAdmin);

        vm.prank(newAdmin);
        AccessControlFacet(address(capTable)).acceptAdmin();

        // Verify only new admin has admin role
        assertFalse(AccessControlFacet(address(capTable)).hasRole(AccessControl.DEFAULT_ADMIN_ROLE, admin));
        assertTrue(AccessControlFacet(address(capTable)).hasRole(AccessControl.DEFAULT_ADMIN_ROLE, newAdmin));
        assertEq(AccessControlFacet(address(capTable)).getAdmin(), newAdmin);
    }
}
