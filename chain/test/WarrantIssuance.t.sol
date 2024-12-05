// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { WarrantActivePosition } from "@libraries/Structs.sol";

contract DiamondWarrantIssuanceTest is DiamondTestBase {
    function testIssueWarrant() public {
        bytes16 stakeholderId = createStakeholder();
        uint256 quantity = 1000;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.WARRANT_ISSUANCE,
            abi.encode(stakeholderId, quantity, securityId, 1e18, "WARRANT_001", "REG_D", "TIME_BASED")
        );

        WarrantFacet(address(capTable)).issueWarrant(
            stakeholderId,
            quantity,
            securityId,
            1e18, // purchase_price
            "WARRANT_001", // custom_id
            "REG_D", // security_law_exemptions_mapping
            "TIME_BASED" // exercise_triggers_mapping
        );

        // Verify position was created correctly
        WarrantActivePosition memory position = WarrantFacet(address(capTable)).getWarrantPosition(securityId);
        assertEq(position.quantity, quantity);
        assertEq(position.stakeholder_id, stakeholderId);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        // Just let it fail without expectRevert
        WarrantFacet(address(capTable)).issueWarrant(
            invalidStakeholderId, 1000, securityId, 1e18, "WARRANT_002", "REG_D", "TIME_BASED"
        );
    }

    function testFailZeroQuantity() public {
        bytes16 stakeholderId = createStakeholder();
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        // Just let it fail without expectRevert
        WarrantFacet(address(capTable)).issueWarrant(
            stakeholderId, 0, securityId, 1e18, "WARRANT_003", "REG_D", "TIME_BASED"
        );
    }
}
