// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import {StorageLib} from "@core/Storage.sol";
import {TxHelper, TxType} from "@libraries/TxHelper.sol";

contract DiamondStockIssuanceTest is DiamondTestBase {
    function createStockClassAndStakeholder(uint256 sharesAuthorized) public returns (bytes16, bytes16) {
        bytes16 stakeholderId = 0xd3373e0a4dd940000000000000000005;
        bytes16 stockClassId = 0xd3373e0a4dd940000000000000000000;

        vm.expectEmit(true, false, false, false, address(capTable));
        emit StakeholderCreated(stakeholderId);
        StakeholderFacet(payable(address(capTable))).createStakeholder(stakeholderId);

        vm.expectEmit(true, true, false, false, address(capTable));
        emit StockClassCreated(stockClassId, "COMMON", 100, sharesAuthorized);
        StockClassFacet(payable(address(capTable))).createStockClass(stockClassId, "COMMON", 100, sharesAuthorized);

        return (stockClassId, stakeholderId);
    }

    function testIssueStock() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);

        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        uint256 sharePrice = 10_000_000_000;
        uint256 quantity = 1000;

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.STOCK_ISSUANCE, abi.encode(stockClassId, sharePrice, quantity, stakeholderId, securityId)
        );

        StockFacet(address(capTable)).issueStock(stockClassId, sharePrice, quantity, stakeholderId, securityId);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = 0xd3373e0a4dd940000000000000000099;
        bytes16 stockClassId = 0xd3373e0a4dd940000000000000000000;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        StockFacet(address(capTable)).issueStock(stockClassId, 10_000_000_000, 1000, invalidStakeholderId, securityId);
    }

    function testFailInvalidStockClass() public {
        (, bytes16 stakeholderId) = createStockClassAndStakeholder(100_000);
        bytes16 invalidStockClassId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        StockFacet(address(capTable)).issueStock(invalidStockClassId, 10_000_000_000, 1000, stakeholderId, securityId);
    }

    function testFailInsufficientIssuerShares() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100);
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        StockFacet(address(capTable)).issueStock(stockClassId, 10_000_000_000, 1000, stakeholderId, securityId);
    }

    function testFailInsufficientStockClassShares() public {
        (bytes16 stockClassId, bytes16 stakeholderId) = createStockClassAndStakeholder(100);
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        StockFacet(address(capTable)).issueStock(stockClassId, 10_000_000_000, 101, stakeholderId, securityId);
    }
}
