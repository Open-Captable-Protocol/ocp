// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/lib/diamond/DiamondCapTableFactory.sol";
import { DiamondCutFacet } from "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import { IssuerFacet } from "../src/lib/diamond/facets/IssuerFacet.sol";
import { StakeholderFacet } from "../src/lib/diamond/facets/StakeholderFacet.sol";
import { StockClassFacet } from "../src/lib/diamond/facets/StockClassFacet.sol";
import { StockFacet } from "../src/lib/diamond/facets/StockFacet.sol";
import { ConvertiblesFacet } from "../src/lib/diamond/facets/ConvertiblesFacet.sol";
import { EquityCompensationFacet } from "../src/lib/diamond/facets/EquityCompensationFacet.sol";
import { StockPlanFacet } from "../src/lib/diamond/facets/StockPlanFacet.sol";
import { WarrantFacet } from "../src/lib/diamond/facets/WarrantFacet.sol";

contract DeployDiamondCapTableScript is Script {
    // Anvil's first default account private key
    uint256 constant ANVIL_PRIVATE_KEY = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address deployer;

    function setUp() public {
        console.log("Setting up DiamondCapTable deployment");
        deployer = vm.addr(ANVIL_PRIVATE_KEY);
        console.log("Deployer address:", deployer);
    }

    function run() external {
        console.log("Deploying DiamondCapTable system");

        vm.startBroadcast(ANVIL_PRIVATE_KEY);

        // Deploy the factory
        DiamondCapTableFactory factory = new DiamondCapTableFactory();
        console.log("DiamondCapTableFactory deployed at:", address(factory));
        vm.stopBroadcast();
    }
}
