// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { IssueStockParams, StockActivePosition } from "@libraries/Structs.sol";
import { IStockFacet } from "@interfaces/IStockFacet.sol";

contract DiamondStockTransferTest is DiamondTestBase {
    bytes16 public transferorId;
    bytes16 public transfereeId;
    bytes16 public stockClassId;
    bytes16 public securityId;
    uint256 public constant INITIAL_SHARES = 1000;
    uint256 public constant SHARE_PRICE = 100;

    function setUp() public override {
        super.setUp();

        // Create stock class and stakeholders
        stockClassId = createStockClass();
        transferorId = createStakeholder();
        transfereeId = bytes16(uint128(transferorId) + 1); // Create a different ID
        IStakeholderFacet(address(capTable)).createStakeholder(transfereeId);

        // Issue initial shares to transferor
        securityId = bytes16(uint128(transferorId) + 2); // Create a different ID
        IssueStockParams memory params = IssueStockParams({
            id: bytes16(uint128(transferorId) + 3),
            stock_class_id: stockClassId,
            share_price: SHARE_PRICE,
            quantity: INITIAL_SHARES,
            stakeholder_id: transferorId,
            security_id: securityId,
            custom_id: "STOCK_001",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });

        IStockFacet(address(capTable)).issueStock(params);
    }

    function testFullTransfer() public {
        // Expect consolidation and transfer events
        vm.expectEmit(true, false, false, false, address(capTable));
        emit TxHelper.TxCreated(TxType.STOCK_CONSOLIDATION, ""); // Only check event type

        vm.expectEmit(true, false, false, false, address(capTable));
        emit TxHelper.TxCreated(TxType.STOCK_TRANSFER, ""); // Only check event type

        // Perform full transfer
        IStockFacet(address(capTable)).transferStock(
            transferorId,
            transfereeId,
            stockClassId,
            INITIAL_SHARES,
            SHARE_PRICE * 2 // New price for transfer
        );

        // Verify transferor has no shares
        bytes16[] memory transferorSecurities =
            IStockFacet(address(capTable)).getStakeholderSecurities(transferorId, stockClassId);
        assertEq(transferorSecurities.length, 0, "Transferor should have no securities");

        // Verify transferee has the shares
        bytes16[] memory transfereeSecurities =
            IStockFacet(address(capTable)).getStakeholderSecurities(transfereeId, stockClassId);
        assertEq(transfereeSecurities.length, 1, "Transferee should have one security");

        // Check the transferred position
        StockActivePosition memory position = IStockFacet(address(capTable)).getStockPosition(transfereeSecurities[0]);
        assertEq(position.quantity, INITIAL_SHARES, "Incorrect transfer quantity");
        assertEq(position.share_price, SHARE_PRICE * 2, "Incorrect transfer price");
    }

    function testPartialTransfer() public {
        uint256 transferAmount = INITIAL_SHARES / 2;

        // Perform partial transfer
        IStockFacet(address(capTable)).transferStock(
            transferorId, transfereeId, stockClassId, transferAmount, SHARE_PRICE * 2
        );

        // Verify transferor's remaining position
        bytes16[] memory transferorSecurities =
            IStockFacet(address(capTable)).getStakeholderSecurities(transferorId, stockClassId);
        assertEq(transferorSecurities.length, 1, "Transferor should have one security");

        StockActivePosition memory transferorPosition =
            IStockFacet(address(capTable)).getStockPosition(transferorSecurities[0]);
        assertEq(transferorPosition.quantity, INITIAL_SHARES - transferAmount, "Incorrect remainder quantity");
        assertEq(transferorPosition.share_price, SHARE_PRICE, "Remainder price should not change");

        // Verify transferee's new position
        bytes16[] memory transfereeSecurities =
            IStockFacet(address(capTable)).getStakeholderSecurities(transfereeId, stockClassId);
        assertEq(transfereeSecurities.length, 1, "Transferee should have one security");

        StockActivePosition memory transfereePosition =
            IStockFacet(address(capTable)).getStockPosition(transfereeSecurities[0]);
        assertEq(transfereePosition.quantity, transferAmount, "Incorrect transfer quantity");
        assertEq(transfereePosition.share_price, SHARE_PRICE * 2, "Incorrect transfer price");
    }

    function testFailInvalidTransferor() public {
        bytes16 invalidTransferorId = bytes16(uint128(transferorId) + 100);

        IStockFacet(address(capTable)).transferStock(
            invalidTransferorId, transfereeId, stockClassId, INITIAL_SHARES, SHARE_PRICE
        );
    }

    function testFailInvalidTransferee() public {
        bytes16 invalidTransfereeId = bytes16(uint128(transfereeId) + 100);

        IStockFacet(address(capTable)).transferStock(
            transferorId, invalidTransfereeId, stockClassId, INITIAL_SHARES, SHARE_PRICE
        );
    }

    function testFailInsufficientShares() public {
        IStockFacet(address(capTable)).transferStock(
            transferorId,
            transfereeId,
            stockClassId,
            INITIAL_SHARES + 1, // Try to transfer more than available
            SHARE_PRICE
        );
    }

    function testFailUnauthorizedCaller() public {
        // Switch to a non-operator address
        address nonOperator = address(0x123);
        vm.startPrank(nonOperator);

        IStockFacet(address(capTable)).transferStock(
            transferorId, transfereeId, stockClassId, INITIAL_SHARES, SHARE_PRICE
        );

        vm.stopPrank();
    }
}
