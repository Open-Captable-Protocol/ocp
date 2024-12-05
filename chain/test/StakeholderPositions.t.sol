// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import {
    StockActivePosition,
    WarrantActivePosition,
    ConvertibleActivePosition,
    EquityCompensationActivePosition,
    StakeholderPositions
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
        StockFacet(address(capTable)).issueStock(stockClassId, 1e18, 1000, stakeholderId, stockSecurityId);

        // Issue convertible
        convertibleSecurityId = 0xd3373e0a4dd940000000000000000002;
        ConvertiblesFacet(address(capTable)).issueConvertible(stakeholderId, 1000000, convertibleSecurityId);

        // Issue equity compensation
        equityCompSecurityId = 0xd3373e0a4dd940000000000000000003;
        EquityCompensationFacet(address(capTable)).issueEquityCompensation(
            stakeholderId, stockClassId, stockPlanId, 1000, equityCompSecurityId
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
        assertEq(positions.convertibles[0].investment_amount, 1000000);

        // Verify equity compensation position
        assertEq(positions.equityCompensations.length, 1);
        assertEq(positions.equityCompensations[0].stakeholder_id, stakeholderId);
        assertEq(positions.equityCompensations[0].quantity, 1000);
        assertEq(positions.equityCompensations[0].stock_class_id, stockClassId);
        assertEq(positions.equityCompensations[0].stock_plan_id, stockPlanId);
    }
}
