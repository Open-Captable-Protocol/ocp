// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import {
    StockActivePosition,
    WarrantActivePosition,
    ConvertibleActivePosition,
    EquityCompensationActivePosition,
    StakeholderPositions,
    IssueStockParams
} from "@libraries/Structs.sol";

contract DiamondStakeholderPositionsTest is DiamondTestBase {
    bytes16 stakeholderId;
    bytes16 stockClassId;
    bytes16 stockPlanId;
    bytes16 equityCompSecurityId;
    bytes16 stockSecurityId;
    bytes16 convertibleSecurityId;

    function setUp() public override {
        super.setUp();
        stakeholderId = createStakeholder();
        stockClassId = createStockClass();

        bytes16[] memory stockClassIds = new bytes16[](1);
        stockClassIds[0] = stockClassId;
        stockPlanId = createStockPlan(stockClassIds);

        // Issue stock
        stockSecurityId = 0xd3373e0a4dd940000000000000000001;
        IssueStockParams memory params = IssueStockParams({
            stock_class_id: stockClassId,
            share_price: 1e18,
            quantity: 1000,
            stakeholder_id: stakeholderId,
            security_id: stockSecurityId,
            custom_id: "STOCK_POS_001",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        StockFacet(address(capTable)).issueStock(params);

        // Issue convertible
        convertibleSecurityId = 0xd3373e0a4dd940000000000000000002;
        ConvertiblesFacet(address(capTable)).issueConvertible(
            stakeholderId,
            1_000_000,
            convertibleSecurityId,
            "SAFE",
            1,
            "CONV_POS_001",
            "REG_D",
            "CONVERSION_ON_NEXT_EQUITY"
        );

        // Issue equity compensation
        equityCompSecurityId = 0xd3373e0a4dd940000000000000000003;
        EquityCompensationFacet(address(capTable)).issueEquityCompensation(
            stakeholderId,
            stockClassId,
            stockPlanId,
            1000,
            equityCompSecurityId,
            "ISO",
            1e18,
            1e18,
            "2025-12-31",
            "EQCOMP_POS_001",
            "90_DAYS",
            "REG_D"
        );
    }

    function testGetStakeholderPositions() public {
        StakeholderPositions memory positions =
            StakeholderFacet(address(capTable)).getStakeholderPositions(stakeholderId);

        // Verify stock position
        assertEq(positions.stocks.length, 1);
        assertEq(positions.stocks[0].stakeholder_id, stakeholderId);
        assertEq(positions.stocks[0].stock_class_id, stockClassId);
        assertEq(positions.stocks[0].quantity, 1000);
        assertEq(positions.stocks[0].share_price, 1e18);

        // Verify convertible position
        assertEq(positions.convertibles.length, 1);
        assertEq(positions.convertibles[0].stakeholder_id, stakeholderId);
        assertEq(positions.convertibles[0].investment_amount, 1_000_000);

        // Verify equity compensation position
        assertEq(positions.equityCompensations.length, 1);
        assertEq(positions.equityCompensations[0].stakeholder_id, stakeholderId);
        assertEq(positions.equityCompensations[0].quantity, 1000);
        assertEq(positions.equityCompensations[0].stock_class_id, stockClassId);
        assertEq(positions.equityCompensations[0].stock_plan_id, stockPlanId);
    }
}
