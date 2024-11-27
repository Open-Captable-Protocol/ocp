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

        // Grant roles
        // Note: contractOwner already has DEFAULT_ADMIN_ROLE from TestBase.setUp()
        vm.startPrank(contractOwner);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.DEFAULT_ADMIN_ROLE, admin);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, admin); // Admin needs OPERATOR_ROLE too
        vm.stopPrank();

        // Now use admin to grant other roles
        vm.startPrank(admin);
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
        vm.expectRevert(abi.encodeWithSelector(AccessControl.AccessControlUnauthorized.selector, operator, AccessControl.DEFAULT_ADMIN_ROLE));
        StockClassFacet(address(capTable)).createStockClass(bytes16(keccak256("stockClass2")), "Preferred", 100, 1000);
        vm.stopPrank();
    }

    function testStockFacetAccess() public {
        // Create a stakeholder and stock class first
        bytes16 stakeholderId = createStakeholder();
        bytes16 stockClassId = createStockClass();

        // Test issueStock with operator role
        vm.startPrank(operator);
        StockFacet(address(capTable)).issueStock(
            stockClassId, // stock_class_id
            1, // share_price
            100, // quantity
            stakeholderId, // stakeholder_id
            bytes16(keccak256("security1")) // security_id
        );
        vm.stopPrank();

        // Test unauthorized access
        vm.startPrank(investor);
        vm.expectRevert(abi.encodeWithSelector(AccessControl.AccessControlUnauthorized.selector, investor, AccessControl.OPERATOR_ROLE));
        StockFacet(address(capTable)).issueStock(
            stockClassId, // stock_class_id
            1, // share_price
            100, // quantity
            stakeholderId, // stakeholder_id
            bytes16(keccak256("security2")) // security_id
        );
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
        EquityCompensationFacet(address(capTable)).issueEquityCompensation(
            stakeholderId,
            stockClassId,
            stockPlanId,
            100,
            bytes16(keccak256("security1"))
        );
        vm.stopPrank();

        // Test unauthorized access
        vm.startPrank(investor);
        vm.expectRevert(abi.encodeWithSelector(AccessControl.AccessControlUnauthorized.selector, investor, AccessControl.OPERATOR_ROLE));
        EquityCompensationFacet(address(capTable)).issueEquityCompensation(
            stakeholderId,
            stockClassId,
            stockPlanId,
            100,
            bytes16(keccak256("security2"))
        );
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
        vm.expectRevert(abi.encodeWithSelector(AccessControl.AccessControlUnauthorized.selector, unauthorized, AccessControl.INVESTOR_ROLE));
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
}
