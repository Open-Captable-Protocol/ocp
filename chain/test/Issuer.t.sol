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
    IssueEquityCompensationParams,
    Issuer
} from "@libraries/Structs.sol";
import { IStockFacet } from "@interfaces/IStockFacet.sol";
import { IConvertiblesFacet } from "@interfaces/IConvertiblesFacet.sol";
import { IEquityCompensationFacet } from "@interfaces/IEquityCompensationFacet.sol";
import {ICapTable} from "../src/interfaces/ICapTable.sol";

contract IssuerTest is DiamondTestBase {

    function test_issuer() public {
        ICapTable ct = ICapTable(address(capTable));
        Issuer memory iss = ct.issuer();
        assertTrue(iss.id != bytes16(0));
        assertGt(iss.shares_authorized, 0);
        assertEq(iss.shares_issued, 0);
    }
}
