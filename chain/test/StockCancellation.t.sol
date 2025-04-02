// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { IssueStockParams, StockActivePosition } from "@libraries/Structs.sol";
import { IStockFacet } from "@interfaces/IStockFacet.sol";
import { IIssuerFacet } from "@interfaces/IIssuerFacet.sol";
import { IStockClassFacet } from "@interfaces/IStockClassFacet.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { StockFacet } from "@facets/StockFacet.sol";

contract DiamondStockCancellationTest is DiamondTestBase {
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
        IStockFacet(address(capTable)).cancelStock(securityId, 1000);

        // Verify stakeholder has no shares
        bytes16[] memory securities =
            IStockFacet(address(capTable)).getStakeholderSecurities(stakeholderId, stockClassId);
        assertEq(securities.length, 0, "Stakeholder should have no securities");
    }

    function testPartialCancellation() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 securityId = issueStock(stockClassId, stakeholderId, 1000);

        // Perform partial cancellation
        IStockFacet(address(capTable)).cancelStock(securityId, 500);

        // Verify stakeholder's remaining position
        bytes16[] memory securities =
            IStockFacet(address(capTable)).getStakeholderSecurities(stakeholderId, stockClassId);
        assertEq(securities.length, 1, "Stakeholder should have one security");

        StockActivePosition memory position = IStockFacet(address(capTable)).getStockPosition(securities[0]);
        assertEq(position.quantity, 500, "Incorrect remainder quantity");
    }

    function test_RevertInvalidSecurityId() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 invalidSecurityId = 0xd3373e0a4dd940000000000000000099;

        vm.expectRevert(abi.encodeWithSignature("ZeroQuantityPosition(bytes16)", invalidSecurityId));
        IStockFacet(address(capTable)).cancelStock(invalidSecurityId, 100);
    }

    function test_RevertInsufficientShares() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 securityId = issueStock(stockClassId, stakeholderId, 1000);

        vm.expectRevert(
            abi.encodeWithSignature(
                "InsufficientSharesForCancellation(bytes16,uint256,uint256)", securityId, 1001, 1000
            )
        );
        IStockFacet(address(capTable)).cancelStock(securityId, 1001);
    }

    function test_RevertZeroQuantityCancellation() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 securityId = issueStock(stockClassId, stakeholderId, 1000);

        vm.expectRevert(abi.encodeWithSignature("InvalidCancellationQuantity(bytes16,uint256)", securityId, 0));
        IStockFacet(address(capTable)).cancelStock(securityId, 0);
    }

    function test_RevertUnauthorizedCaller() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 securityId = issueStock(stockClassId, stakeholderId, 1000);

        // Switch to a non-operator address
        address nonOperator = address(0x123);
        vm.startPrank(nonOperator);

        vm.expectRevert(
            abi.encodeWithSignature(
                "AccessControlUnauthorized(address,bytes32)", nonOperator, keccak256("OPERATOR_ROLE")
            )
        );
        IStockFacet(address(capTable)).cancelStock(securityId, 100);

        vm.stopPrank();
    }
}
