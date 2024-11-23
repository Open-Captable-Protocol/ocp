// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { LibDiamond } from "diamond-3-hardhat/libraries/LibDiamond.sol";
import { IDiamondCut } from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { Diamond } from "diamond-3-hardhat/Diamond.sol";
import "forge-std/console.sol";

contract DiamondCapTable is Diamond {
    constructor(address _contractOwner, address _diamondCutFacet) Diamond(_contractOwner, _diamondCutFacet) {}
}
