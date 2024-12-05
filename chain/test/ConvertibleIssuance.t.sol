// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { ConvertibleActivePosition } from "@libraries/Structs.sol";

contract DiamondConvertibleIssuanceTest is DiamondTestBase {
    function testIssueConvertible() public {
        bytes16 stakeholderId = createStakeholder();
        uint256 investmentAmount = 1_000_000;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        vm.expectEmit(true, true, false, true, address(capTable));
        emit TxHelper.TxCreated(
            TxType.CONVERTIBLE_ISSUANCE,
            abi.encode(
                stakeholderId, investmentAmount, securityId, "SAFE", "CONVERSION_ON_NEXT_EQUITY", 1, "REG_D", "CONV_001"
            )
        );

        ConvertiblesFacet(address(capTable)).issueConvertible(
            stakeholderId,
            investmentAmount,
            securityId,
            "SAFE", // convertible_type
            1, // seniority
            "CONV_001", // custom_id
            "REG_D", // security_law_exemptions_mapping
            "CONVERSION_ON_NEXT_EQUITY" // conversion_triggers_mapping
        );

        // Verify position was created correctly
        ConvertibleActivePosition memory position =
            ConvertiblesFacet(address(capTable)).getConvertiblePosition(securityId);
        assertEq(position.investment_amount, investmentAmount);
        assertEq(position.stakeholder_id, stakeholderId);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        ConvertiblesFacet(address(capTable)).issueConvertible(
            invalidStakeholderId, 1_000_000, securityId, "SAFE", 1, "CONV_002", "REG_D", "CONVERSION_ON_NEXT_EQUITY"
        );
    }

    function testFailZeroAmount() public {
        bytes16 stakeholderId = createStakeholder();
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        ConvertiblesFacet(address(capTable)).issueConvertible(
            stakeholderId, 0, securityId, "SAFE", 1, "CONV_003", "REG_D", "CONVERSION_ON_NEXT_EQUITY"
        );
    }
}
