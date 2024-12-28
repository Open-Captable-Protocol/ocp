// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { WarrantActivePosition, IssueWarrantParams } from "@libraries/Structs.sol";
import { IWarrantFacet } from "@interfaces/IWarrantFacet.sol";

contract DiamondWarrantIssuanceTest is DiamondTestBase {
    function testIssueWarrant() public {
        bytes16 stakeholderId = createStakeholder();
        uint256 quantity = 1000;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000002;

        IssueWarrantParams memory params = IssueWarrantParams({
            id: id,
            stakeholder_id: stakeholderId,
            quantity: quantity,
            security_id: securityId,
            purchase_price: 1e18,
            custom_id: "WARRANT_001",
            security_law_exemptions_mapping: "REG_D",
            exercise_triggers_mapping: "TIME_BASED"
        });
        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(TxType.WARRANT_ISSUANCE, abi.encode(params));

        IWarrantFacet(address(capTable)).issueWarrant(params);

        // Verify position was created correctly
        WarrantActivePosition memory position = IWarrantFacet(address(capTable)).getWarrantPosition(securityId);
        assertEq(position.quantity, quantity);
        assertEq(position.stakeholder_id, stakeholderId);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000002;

        IssueWarrantParams memory params = IssueWarrantParams({
            id: id,
            stakeholder_id: invalidStakeholderId,
            quantity: 1000,
            security_id: securityId,
            purchase_price: 1e18,
            custom_id: "WARRANT_002",
            security_law_exemptions_mapping: "REG_D",
            exercise_triggers_mapping: "TIME_BASED"
        });
        IWarrantFacet(address(capTable)).issueWarrant(params);
    }

    function testFailZeroQuantity() public {
        bytes16 stakeholderId = createStakeholder();
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 id = 0xd3373e0a4dd940000000000000000002;

        IssueWarrantParams memory params = IssueWarrantParams({
            id: id,
            stakeholder_id: stakeholderId,
            quantity: 0,
            security_id: securityId,
            purchase_price: 1e18,
            custom_id: "WARRANT_003",
            security_law_exemptions_mapping: "REG_D",
            exercise_triggers_mapping: "TIME_BASED"
        });
        IWarrantFacet(address(capTable)).issueWarrant(params);
    }
}
