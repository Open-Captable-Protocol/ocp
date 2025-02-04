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
        stockClassId = createStockClass(bytes16(uint128(9)));
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

    function test_RevertInvalidTransferor() public {
        bytes16 invalidTransferorId = bytes16(uint128(transferorId) + 100);

        vm.expectRevert(abi.encodeWithSignature("NoStakeholder(bytes16)", invalidTransferorId));
        IStockFacet(address(capTable)).transferStock(
            invalidTransferorId, transfereeId, stockClassId, INITIAL_SHARES, SHARE_PRICE
        );
    }

    function test_RevertInvalidTransferee() public {
        bytes16 invalidTransfereeId = bytes16(uint128(transfereeId) + 100);

        vm.expectRevert(abi.encodeWithSignature("NoStakeholder(bytes16)", invalidTransfereeId));
        IStockFacet(address(capTable)).transferStock(
            transferorId, invalidTransfereeId, stockClassId, INITIAL_SHARES, SHARE_PRICE
        );
    }

    function test_RevertInsufficientShares() public {
        vm.expectRevert("Insufficient shares for transfer");
        IStockFacet(address(capTable)).transferStock(
            transferorId,
            transfereeId,
            stockClassId,
            INITIAL_SHARES + 1, // Try to transfer more than available
            SHARE_PRICE
        );
    }

    function test_RevertUnauthorizedCaller() public {
        // Switch to a non-operator address
        address nonOperator = address(0x123);
        vm.startPrank(nonOperator);

        vm.expectRevert(
            abi.encodeWithSignature(
                "AccessControlUnauthorized(address,bytes32)", nonOperator, keccak256("OPERATOR_ROLE")
            )
        );
        IStockFacet(address(capTable)).transferStock(
            transferorId, transfereeId, stockClassId, INITIAL_SHARES, SHARE_PRICE
        );

        vm.stopPrank();
    }

    function testConsolidationHash() public {
        // Issue a second position to the same transferor
        bytes16 secondSecurityId = bytes16(uint128(transferorId) + 4);
        IssueStockParams memory params = IssueStockParams({
            id: bytes16(uint128(transferorId) + 5),
            stock_class_id: stockClassId,
            share_price: SHARE_PRICE * 2, // Different price
            quantity: INITIAL_SHARES,
            stakeholder_id: transferorId,
            security_id: secondSecurityId,
            custom_id: "STOCK_002",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        IStockFacet(address(capTable)).issueStock(params);

        // Get initial securities
        bytes16[] memory initialSecurities =
            IStockFacet(address(capTable)).getStakeholderSecurities(transferorId, stockClassId);
        assertEq(initialSecurities.length, 2, "Should have two initial securities");

        // Perform transfer to trigger consolidation
        IStockFacet(address(capTable)).transferStock(
            transferorId, transfereeId, stockClassId, INITIAL_SHARES, SHARE_PRICE
        );

        // Get resulting securities after consolidation
        bytes16[] memory resultingSecurities =
            IStockFacet(address(capTable)).getStakeholderSecurities(transferorId, stockClassId);
        assertEq(resultingSecurities.length, 1, "Should have one remaining security after partial transfer");

        // The resulting security ID should be different from both initial securities
        assertTrue(
            resultingSecurities[0] != initialSecurities[0] && resultingSecurities[0] != initialSecurities[1],
            "Consolidated security ID should be unique"
        );
    }

    function test_RevertConsolidateEmptyPositions() public {
        // Create a stakeholder with no positions
        bytes16 emptyStakeholderId = bytes16(uint128(transferorId) + 6);
        IStakeholderFacet(address(capTable)).createStakeholder(emptyStakeholderId);

        vm.expectRevert(abi.encodeWithSignature("NoPositionsToConsolidate()"));
        IStockFacet(address(capTable)).transferStock(
            emptyStakeholderId, transfereeId, stockClassId, INITIAL_SHARES, SHARE_PRICE
        );
    }

    function test_RevertConsolidateZeroQuantityPosition() public {
        // First transfer all shares to make position zero
        IStockFacet(address(capTable)).transferStock(
            transferorId, transfereeId, stockClassId, INITIAL_SHARES, SHARE_PRICE
        );

        // Attempt another transfer with the same transferor
        vm.expectRevert(abi.encodeWithSignature("NoPositionsToConsolidate()"));
        IStockFacet(address(capTable)).transferStock(
            transferorId, transfereeId, stockClassId, INITIAL_SHARES, SHARE_PRICE
        );
    }

    // function test_RevertConsolidateMismatchedStockClass() public {
    //     // Create a different stock class
    //     bytes16 differentStockClassId = createStockClass(bytes16(uint128(19)));

    //     // Issue a position with different stock class
    //     bytes16 secondSecurityId = bytes16(uint128(transferorId) + 4);
    //     IssueStockParams memory params = IssueStockParams({
    //         id: bytes16(uint128(transferorId) + 5),
    //         stock_class_id: differentStockClassId,
    //         share_price: SHARE_PRICE,
    //         quantity: INITIAL_SHARES,
    //         stakeholder_id: transferorId,
    //         security_id: secondSecurityId,
    //         custom_id: "STOCK_002",
    //         stock_legend_ids_mapping: "LEGEND_1",
    //         security_law_exemptions_mapping: "REG_D"
    //     });
    //     IStockFacet(address(capTable)).issueStock(params);

    //     console.log("differentStockClassId");
    //     console.logBytes16(differentStockClassId);
    //     vm.expectRevert(abi.encodeWithSignature("StockClassAlreadyExists(bytes16)", differentStockClassId));
    //     IStockFacet(address(capTable)).transferStock(
    //         transferorId, transfereeId, differentStockClassId, INITIAL_SHARES, SHARE_PRICE
    //     );
    // }

    function testConsolidationWeightedPrice() public {
        // Issue a second position with different price
        bytes16 secondSecurityId = bytes16(uint128(transferorId) + 4);
        IssueStockParams memory params = IssueStockParams({
            id: bytes16(uint128(transferorId) + 5),
            stock_class_id: stockClassId,
            share_price: SHARE_PRICE * 2, // Double the price
            quantity: INITIAL_SHARES * 2, // Double the quantity
            stakeholder_id: transferorId,
            security_id: secondSecurityId,
            custom_id: "STOCK_002",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        IStockFacet(address(capTable)).issueStock(params);

        // Calculate expected weighted average: (1000*100 + 2000*200) / (1000 + 2000)
        uint256 expectedPrice =
            (INITIAL_SHARES * SHARE_PRICE + INITIAL_SHARES * 2 * SHARE_PRICE * 2) / (INITIAL_SHARES * 3);

        // Trigger consolidation via transfer
        IStockFacet(address(capTable)).transferStock(
            transferorId, transfereeId, stockClassId, INITIAL_SHARES, SHARE_PRICE
        );

        // Get the remaining position
        bytes16[] memory securities =
            IStockFacet(address(capTable)).getStakeholderSecurities(transferorId, stockClassId);
        assertEq(securities.length, 1, "Should have one remaining security");

        StockActivePosition memory position = IStockFacet(address(capTable)).getStockPosition(securities[0]);
        assertEq(position.share_price, expectedPrice, "Weighted average price should be correct");
    }

    function testConsolidationWithExtremeQuantities() public {
        uint256 largeAmount = type(uint128).max;
        uint256 veryLargeAmount = type(uint256).max;

        // Adjust issuer authorized shares to handle large quantities
        IIssuerFacet(address(capTable)).adjustIssuerAuthorizedShares(issuerId, veryLargeAmount);
        IStockClassFacet(address(capTable)).adjustAuthorizedShares(
            bytes16(uint128(transferorId) + 100), stockClassId, veryLargeAmount
        );

        bytes16 smallSecurityId = bytes16(uint128(transferorId) + 4);
        IssueStockParams memory smallParams = IssueStockParams({
            id: bytes16(uint128(transferorId) + 5),
            stock_class_id: stockClassId,
            share_price: SHARE_PRICE,
            quantity: 1, // Minimum quantity
            stakeholder_id: transferorId,
            security_id: smallSecurityId,
            custom_id: "STOCK_SMALL",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        IStockFacet(address(capTable)).issueStock(smallParams);

        // Issue a position with large quantity
        bytes16 largeSecurityId = bytes16(uint128(transferorId) + 6);
        IssueStockParams memory largeParams = IssueStockParams({
            id: bytes16(uint128(transferorId) + 7),
            stock_class_id: stockClassId,
            share_price: SHARE_PRICE,
            quantity: largeAmount,
            stakeholder_id: transferorId,
            security_id: largeSecurityId,
            custom_id: "STOCK_LARGE",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        IStockFacet(address(capTable)).issueStock(largeParams);

        // Trigger consolidation by transferring the smallest amount
        IStockFacet(address(capTable)).transferStock(transferorId, transfereeId, stockClassId, 1, SHARE_PRICE);

        // Verify the consolidated position
        bytes16[] memory securities =
            IStockFacet(address(capTable)).getStakeholderSecurities(transferorId, stockClassId);
        StockActivePosition memory position = IStockFacet(address(capTable)).getStockPosition(securities[0]);

        // Calculate expected: initial + small + large - transferred
        uint256 expectedQuantity = INITIAL_SHARES + largeAmount; // Add the large amount first
        expectedQuantity = expectedQuantity + 1 - 1; // Then add small and subtract transferred amount

        assertEq(position.quantity, expectedQuantity, "Should handle large quantities correctly");
    }
}
