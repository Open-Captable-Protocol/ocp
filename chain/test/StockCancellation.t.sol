// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { IssueStockParams, StockActivePosition } from "@libraries/Structs.sol";
import { IStockFacet } from "@interfaces/IStockFacet.sol";
import { IStakeholderFacet } from "@interfaces/IStakeholderFacet.sol";
import { IStockClassFacet } from "@interfaces/IStockClassFacet.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { StockFacet } from "@facets/StockFacet.sol";
import { IAccessControlFacet } from "@interfaces/IAccessControlFacet.sol";

contract DiamondStockCancellationTest is DiamondTestBase {
    address operator;
    address unauthorized;

    function setUp() public override {
        super.setUp();
        operator = makeAddr("operator");
        unauthorized = makeAddr("unauthorized");

        // Grant OPERATOR_ROLE to operator
        IAccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, operator);
    }

    function createStockClassAndStakeholder(uint256 sharesAuthorized) public returns (bytes16, bytes16) {
        bytes16 stakeholderId = 0xd3373e0a4dd940000000000000000005;
        bytes16 stockClassId = 0xd3373e0a4dd940000000000000000000;

        vm.expectEmit(true, false, false, false, address(capTable));
        emit StakeholderCreated(stakeholderId);
        IStakeholderFacet(address(capTable)).createStakeholder(stakeholderId);

        vm.expectEmit(true, true, false, false, address(capTable));
        emit StockClassCreated(stockClassId, "COMMON", 100, sharesAuthorized);
        IStockClassFacet(address(capTable)).createStockClass(stockClassId, "COMMON", 100, sharesAuthorized);

        return (stockClassId, stakeholderId);
    }

    function createStakeholder() public override returns (bytes16) {
        bytes16 stakeholderId = 0xd3373e0a4dd940000000000000000005;
        vm.expectEmit(true, false, false, false, address(capTable));
        emit StakeholderCreated(stakeholderId);
        IStakeholderFacet(address(capTable)).createStakeholder(stakeholderId);
        return stakeholderId;
    }

    function createStockClass(bytes16 stockClassId) public override returns (bytes16) {
        vm.expectEmit(true, true, false, false, address(capTable));
        emit StockClassCreated(stockClassId, "COMMON", 100, 100_000);
        IStockClassFacet(address(capTable)).createStockClass(stockClassId, "COMMON", 100, 100_000);
        return stockClassId;
    }

    function issueStock(bytes16 stockClassId, bytes16 stakeholderId, uint256 quantity) public returns (bytes16) {
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000010;
        uint256 sharePrice = 10_000_000_000;

        IssueStockParams memory params = IssueStockParams({
            id: id,
            stock_class_id: stockClassId,
            share_price: sharePrice,
            quantity: quantity,
            stakeholder_id: stakeholderId,
            security_id: securityId,
            custom_id: "STOCK_001",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });

        IStockFacet(address(capTable)).issueStock(params);
        return securityId;
    }

    function testFullCancellation() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 securityId = issueStock(stockClassId, stakeholderId, 1000);

        // Expect cancellation event
        vm.expectEmit(true, false, false, false, address(capTable));
        emit TxHelper.TxCreated(TxType.STOCK_CANCELLATION, ""); // Only check event type

        // Perform full cancellation
        bytes16 cancellationId = 0xd3373e0a4dd940000000000000000020;
        IStockFacet(address(capTable)).cancelStock(cancellationId, securityId, 1000);

        // Verify stakeholder has no shares
        bytes16[] memory securities =
            IStockFacet(address(capTable)).getStakeholderSecurities(stakeholderId, stockClassId);
        assertEq(securities.length, 0, "Stakeholder should have no securities");
    }

    function testPartialCancellation() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 securityId = issueStock(stockClassId, stakeholderId, 1000);

        // Expect both cancellation and issuance events
        vm.expectEmit(true, false, false, false, address(capTable));
        emit TxHelper.TxCreated(TxType.STOCK_ISSUANCE, ""); // Remainder issuance
        vm.expectEmit(true, false, false, false, address(capTable));
        emit TxHelper.TxCreated(TxType.STOCK_CANCELLATION, ""); // Cancellation

        // Perform partial cancellation
        bytes16 cancellationId = 0xd3373e0a4dd940000000000000000021;
        IStockFacet(address(capTable)).cancelStock(cancellationId, securityId, 500);

        // Verify stakeholder's remaining position
        bytes16[] memory securities =
            IStockFacet(address(capTable)).getStakeholderSecurities(stakeholderId, stockClassId);
        assertEq(securities.length, 1, "Stakeholder should have one security");

        StockActivePosition memory position = IStockFacet(address(capTable)).getStockPosition(securities[0]);
        assertEq(position.quantity, 500, "Incorrect remainder quantity");
        assertEq(position.share_price, 10_000_000_000, "Incorrect share price for remainder");
    }

    function test_RevertInvalidSecurityId() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 invalidSecurityId = 0xd3373e0a4dd940000000000000000099;
        bytes16 cancellationId = 0xd3373e0a4dd940000000000000000022;

        vm.expectRevert(abi.encodeWithSignature("ZeroQuantityPosition(bytes16)", invalidSecurityId));
        IStockFacet(address(capTable)).cancelStock(cancellationId, invalidSecurityId, 100);
    }

    function test_RevertInsufficientShares() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 securityId = issueStock(stockClassId, stakeholderId, 1000);
        bytes16 cancellationId = 0xd3373e0a4dd940000000000000000023;

        vm.expectRevert(
            abi.encodeWithSignature(
                "InsufficientSharesForCancellation(bytes16,uint256,uint256)", securityId, 1001, 1000
            )
        );
        IStockFacet(address(capTable)).cancelStock(cancellationId, securityId, 1001);
    }

    function test_RevertZeroQuantityCancellation() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 securityId = issueStock(stockClassId, stakeholderId, 1000);
        bytes16 cancellationId = 0xd3373e0a4dd940000000000000000024;

        vm.expectRevert(abi.encodeWithSignature("InvalidCancellationQuantity(bytes16,uint256)", securityId, 0));
        IStockFacet(address(capTable)).cancelStock(cancellationId, securityId, 0);
    }

    function test_RevertUnauthorizedCaller() public {
        // Create a stakeholder and stock class first
        bytes16 stakeholderId = createStakeholder();
        bytes16 stockClassId = createStockClass(bytes16(uint128(2)));
        bytes16 id1 = 0xd3373e0a4dd940000000000000000002;
        bytes16 cancellationId = 0xd3373e0a4dd940000000000000000025;

        // Test issueStock with operator role
        vm.startPrank(operator);
        IssueStockParams memory params = IssueStockParams({
            id: id1,
            stock_class_id: stockClassId,
            share_price: 1,
            quantity: 100,
            stakeholder_id: stakeholderId,
            security_id: bytes16(keccak256("security1")),
            custom_id: "custom_id",
            stock_legend_ids_mapping: "stock_legend_ids_mapping",
            security_law_exemptions_mapping: "security_law_exemptions_mapping"
        });
        IStockFacet(address(capTable)).issueStock(params);
        vm.stopPrank();

        // Test unauthorized access
        vm.startPrank(unauthorized);
        vm.expectRevert(
            abi.encodeWithSelector(
                AccessControl.AccessControlUnauthorized.selector, unauthorized, AccessControl.DEFAULT_ADMIN_ROLE
            )
        );
        IStockFacet(address(capTable)).cancelStock(cancellationId, id1, 50);
        vm.stopPrank();
    }
}
