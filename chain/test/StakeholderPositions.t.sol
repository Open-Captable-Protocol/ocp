// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import {
    StockActivePosition,
    WarrantActivePosition,
    ConvertibleActivePosition,
    EquityCompensationActivePosition,
    StakeholderPositions,
    IssueStockParams,
    IssueConvertibleParams,
    IssueEquityCompensationParams
} from "@libraries/Structs.sol";
import { IStockFacet } from "@interfaces/IStockFacet.sol";
import { IConvertiblesFacet } from "@interfaces/IConvertiblesFacet.sol";
import { IEquityCompensationFacet } from "@interfaces/IEquityCompensationFacet.sol";

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
        stockClassId = createStockClass(bytes16(uint128(12)));

        bytes16[] memory stockClassIds = new bytes16[](1);
        stockClassIds[0] = stockClassId;
        stockPlanId = createStockPlan(stockClassIds);

        // Issue stock
        stockSecurityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 stockId = 0xd3373e0a4dd940000000000000000011;
        IssueStockParams memory params = IssueStockParams({
            id: stockId,
            stock_class_id: stockClassId,
            share_price: 1e18,
            quantity: 1000,
            stakeholder_id: stakeholderId,
            security_id: stockSecurityId,
            custom_id: "STOCK_POS_001",
            stock_legend_ids_mapping: "LEGEND_1",
            security_law_exemptions_mapping: "REG_D"
        });
        IStockFacet(address(capTable)).issueStock(params);

        // Issue convertible
        convertibleSecurityId = 0xd3373e0a4dd940000000000000000002;
        bytes16 convertibleId = 0xd3373e0a4dd940000000000000000012;

        IssueConvertibleParams memory convertibleParams = IssueConvertibleParams({
            id: convertibleId,
            stakeholder_id: stakeholderId,
            investment_amount: 1_000_000,
            security_id: convertibleSecurityId,
            convertible_type: "SAFE",
            seniority: 1,
            custom_id: "CONV_POS_001",
            security_law_exemptions_mapping: "REG_D",
            conversion_triggers_mapping: "CONVERSION_ON_NEXT_EQUITY"
        });
        IConvertiblesFacet(address(capTable)).issueConvertible(convertibleParams);

        // Issue equity compensation
        equityCompSecurityId = 0xd3373e0a4dd940000000000000000003;
        bytes16 equityCompensationId = 0xd3373e0a4dd940000000000000000013;

        IssueEquityCompensationParams memory equityParams = IssueEquityCompensationParams({
            id: equityCompensationId,
            stakeholder_id: stakeholderId,
            stock_class_id: stockClassId,
            stock_plan_id: stockPlanId,
            quantity: 1000,
            security_id: equityCompSecurityId,
            compensation_type: "ISO",
            exercise_price: 1e18,
            base_price: 1e18,
            expiration_date: "2025-12-31",
            custom_id: "EQCOMP_POS_001",
            termination_exercise_windows_mapping: "90_DAYS",
            security_law_exemptions_mapping: "REG_D"
        });
        IEquityCompensationFacet(address(capTable)).issueEquityCompensation(equityParams);
    }

    function testGetStakeholderId(address wallet) public {
        /* Ensure we can set & get the stakeholderId for a wallet */
        vm.assume(wallet != address(0));
        IStakeholderFacet sf = IStakeholderFacet(address(capTable));

        // Raise if ensure=True
        vm.expectRevert(abi.encodeWithSelector(IStakeholderFacet.NoStakeholder.selector));
        sf.getStakeholderId(wallet, true);

        // Return bytes16(0) if ensure=False
        bytes16 id = sf.getStakeholderId(wallet, false);
        assertEq(id, bytes16(0));

        // Link the address
        linkStakeholderAddress(stakeholderId, wallet);

        // Ensure it exists
        id = sf.getStakeholderId(wallet, true);
        assertNotEq(id, bytes16(0));

        // Ensure it returns a non-0 idx
        assertGt(sf.getStakeholderIndex(id), 0);
    }

    function testGetStakeholderPositions() public {
        StakeholderPositions memory positions =
            IStakeholderFacet(address(capTable)).getStakeholderPositions(stakeholderId);

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
