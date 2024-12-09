// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { ConvertibleActivePosition, IssueConvertibleParams } from "@libraries/Structs.sol";

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

        IssueConvertibleParams memory params = IssueConvertibleParams({
            stakeholder_id: stakeholderId,
            investment_amount: investmentAmount,
            security_id: securityId,
            convertible_type: "SAFE",
            seniority: 1,
            custom_id: "CONV_001",
            security_law_exemptions_mapping: "REG_D",
            conversion_triggers_mapping: "CONVERSION_ON_NEXT_EQUITY"
        });
        ConvertiblesFacet(address(capTable)).issueConvertible(params);

        // Verify position was created correctly
        ConvertibleActivePosition memory position =
            ConvertiblesFacet(address(capTable)).getConvertiblePosition(securityId);
        assertEq(position.investment_amount, investmentAmount);
        assertEq(position.stakeholder_id, stakeholderId);
    }

    function testFailInvalidStakeholder() public {
        bytes16 invalidStakeholderId = 0xd3373e0a4dd940000000000000000099;
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        IssueConvertibleParams memory params = IssueConvertibleParams({
            stakeholder_id: invalidStakeholderId,
            investment_amount: 1_000_000,
            security_id: securityId,
            convertible_type: "SAFE",
            seniority: 1,
            custom_id: "CONV_002",
            security_law_exemptions_mapping: "REG_D",
            conversion_triggers_mapping: "CONVERSION_ON_NEXT_EQUITY"
        });
        ConvertiblesFacet(address(capTable)).issueConvertible(params);
    }

    function testFailZeroAmount() public {
        bytes16 stakeholderId = createStakeholder();
        bytes16 securityId = 0xd3373e0a4dd940000000000000000001;

        IssueConvertibleParams memory params = IssueConvertibleParams({
            stakeholder_id: stakeholderId,
            investment_amount: 0,
            security_id: securityId,
            convertible_type: "SAFE",
            seniority: 1,
            custom_id: "CONV_003",
            security_law_exemptions_mapping: "REG_D",
            conversion_triggers_mapping: "CONVERSION_ON_NEXT_EQUITY"
        });
        ConvertiblesFacet(address(capTable)).issueConvertible(params);
    }
}
