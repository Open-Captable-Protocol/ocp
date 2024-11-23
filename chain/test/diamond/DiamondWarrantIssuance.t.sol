// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DiamondTestBase.sol";
import { StorageLib } from "@diamond/Storage.sol";
import { TxHelper, TxType } from "@diamond/DiamondTxHelper.sol";
import { ValidationLib } from "@diamond/libraries/ValidationLib.sol";
import { WarrantActivePosition } from "@diamond/Structs.sol";

contract DiamondWarrantIssuanceTest is DiamondTestBase {
    function testIssueWarrant() public {
        bytes16 stakeholderId = createStakeholder();
        uint256 quantity = 1000;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        vm.expectEmit(true, true, false, true, address(diamond));
        emit TxHelper.TxCreated(TxType.WARRANT_ISSUANCE, abi.encode(stakeholderId, quantity, securityId));

        WarrantFacet(address(diamond)).issueWarrant(stakeholderId, quantity, securityId);

        // Verify position was created correctly
        WarrantActivePosition memory position = WarrantFacet(address(diamond)).getWarrantPosition(securityId);
        assertEq(position.quantity, quantity);
        assertEq(position.stakeholder_id, stakeholderId);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        // Just let it fail without expectRevert
        WarrantFacet(address(diamond)).issueWarrant(invalidStakeholderId, 1000, securityId);
    }

    function testFailZeroQuantity() public {
        bytes16 stakeholderId = createStakeholder();
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        // Just let it fail without expectRevert
        WarrantFacet(address(diamond)).issueWarrant(stakeholderId, 0, securityId);
    }
}
