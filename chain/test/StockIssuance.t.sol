// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { IssueStockParams } from "@libraries/Structs.sol";
import { IStockFacet } from "@interfaces/IStockFacet.sol";

contract DiamondStockIssuanceTest is DiamondTestBase {
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

    function testIssueStock() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000010;
        uint256 sharePrice = 10_000_000_000;
        uint256 quantity = 1000;

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

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(TxType.STOCK_ISSUANCE, abi.encode(params));

        IStockFacet(address(capTable)).issueStock(params);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = 0xd3373e0a4dd940000000000000000099;
        bytes16 stockClassId = 0xd3373e0a4dd940000000000000000000;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000002;

        IssueStockParams memory params = IssueStockParams({
            id: id,
            stock_class_id: stockClassId,
            share_price: 10_000_000_000,
            quantity: 1000,
            stakeholder_id: invalidStakeholderId,
            security_id: securityId,
            custom_id: "STOCK_002",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });

        IStockFacet(address(capTable)).issueStock(params);
    }

    function testFailInvalidStockClass() public {
        (, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 invalidStockClassId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000002;

        IssueStockParams memory params = IssueStockParams({
            id: id,
            stock_class_id: invalidStockClassId,
            share_price: 10_000_000_000,
            quantity: 1000,
            stakeholder_id: stakeholderId,
            security_id: securityId,
            custom_id: "STOCK_003",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });

        IStockFacet(address(capTable)).issueStock(params);
    }

    function testFailInsufficientIssuerShares() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100);
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000002;

        IssueStockParams memory params = IssueStockParams({
            id: id,
            stock_class_id: stockClassId,
            share_price: 10_000_000_000,
            quantity: 1000,
            stakeholder_id: stakeholderId,
            security_id: securityId,
            custom_id: "STOCK_004",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });

        IStockFacet(address(capTable)).issueStock(params);
    }

    function testFailInsufficientStockClassShares() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100);
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000002;

        IssueStockParams memory params = IssueStockParams({
            id: id,
            stock_class_id: stockClassId,
            share_price: 10_000_000_000,
            quantity: 101,
            stakeholder_id: stakeholderId,
            security_id: securityId,
            custom_id: "STOCK_005",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });

        IStockFacet(address(capTable)).issueStock(params);
    }
}
