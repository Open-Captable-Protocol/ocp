// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { AccessControlFacet } from "@facets/AccessControlFacet.sol";

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
        vm.startPrank(contractOwner);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.DEFAULT_ADMIN_ROLE, admin);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, operator);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.INVESTOR_ROLE, investor);
        vm.stopPrank();
    }

    function testStockClassFacetAccess() public {
        // Test createStockClass
        vm.startPrank(admin);
        stockClassFacet.createStockClass(bytes16(keccak256("stockClass1")), "Common", 100, 1000);
        vm.stopPrank();

        // Test unauthorized access
        vm.startPrank(operator);
        vm.expectRevert(abi.encodeWithSelector(AccessControl.AccessControlUnauthorized.selector, operator, AccessControl.DEFAULT_ADMIN_ROLE));
        stockClassFacet.createStockClass(bytes16(keccak256("stockClass2")), "Preferred", 100, 1000);
        vm.stopPrank();
    }

    function testStockFacetAccess() public {
        // Test issueStock
        vm.startPrank(operator);
        stockFacet.issueStock(bytes16(keccak256("stakeholder1")), 1, 100, bytes16(keccak256("security1")), "");
        vm.stopPrank();

        // Test unauthorized access
        vm.startPrank(investor);
        vm.expectRevert(abi.encodeWithSelector(AccessControl.AccessControlUnauthorized.selector, investor, AccessControl.OPERATOR_ROLE));
        stockFacet.issueStock(bytes16(keccak256("stakeholder2")), 1, 100, bytes16(keccak256("security2")), "");
        vm.stopPrank();
    }

    function testEquityCompensationFacetAccess() public {
        // Test issueEquityCompensation
        vm.startPrank(operator);
        equityCompensationFacet.issueEquityCompensation(
            bytes16(keccak256("stakeholder1")),
            bytes16(keccak256("stockClass1")),
            bytes16(keccak256("stockPlan1")),
            100,
            bytes16(keccak256("security1"))
        );
        vm.stopPrank();

        // Test unauthorized access
        vm.startPrank(investor);
        vm.expectRevert(abi.encodeWithSelector(AccessControl.AccessControlUnauthorized.selector, investor, AccessControl.OPERATOR_ROLE));
        equityCompensationFacet.issueEquityCompensation(
            bytes16(keccak256("stakeholder2")),
            bytes16(keccak256("stockClass2")),
            bytes16(keccak256("stockPlan2")),
            100,
            bytes16(keccak256("security2"))
        );
        vm.stopPrank();
    }

    function testStakeholderNFTFacetAccess() public {
        // Test mint
        vm.startPrank(investor);
        stakeholderNFTFacet.mint();
        vm.stopPrank();

        // Test unauthorized access
        vm.startPrank(unauthorized);
        vm.expectRevert(abi.encodeWithSelector(AccessControl.AccessControlUnauthorized.selector, unauthorized, AccessControl.INVESTOR_ROLE));
        stakeholderNFTFacet.mint();
        vm.stopPrank();
    }
}
