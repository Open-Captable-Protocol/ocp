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
import { StakeholderNFTFacet } from "../src/lib/diamond/facets/StakeholderNFTFacet.sol";

contract DeployDiamondCapTableScript is Script {
    function setUp() public {
        // Setup for Base Sepolia deployment
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        console.log("Deploying DiamondCapTable system to Base Sepolia");

        vm.startBroadcast(deployerPrivateKey);

        // Try to get addresses from env
        address diamondCutFacet = vm.envOr("DIAMOND_CUT_FACET", address(0));
        address issuerFacet = vm.envOr("ISSUER_FACET", address(0));
        address stakeholderFacet = vm.envOr("STAKEHOLDER_FACET", address(0));
        address stockClassFacet = vm.envOr("STOCK_CLASS_FACET", address(0));
        address stockFacet = vm.envOr("STOCK_FACET", address(0));
        address convertiblesFacet = vm.envOr("CONVERTIBLES_FACET", address(0));
        address equityCompensationFacet = vm.envOr("EQUITY_COMPENSATION_FACET", address(0));
        address stockPlanFacet = vm.envOr("STOCK_PLAN_FACET", address(0));
        address warrantFacet = vm.envOr("WARRANT_FACET", address(0));
        address stakeholderNFTFacet = vm.envOr("STAKEHOLDER_NFT_FACET", address(0));

        // Deploy new facets if addresses not in env
        if (diamondCutFacet == address(0)) {
            console.log("Deploying new facets...");
            diamondCutFacet = address(new DiamondCutFacet());
            issuerFacet = address(new IssuerFacet());
            stakeholderFacet = address(new StakeholderFacet());
            stockClassFacet = address(new StockClassFacet());
            stockFacet = address(new StockFacet());
            convertiblesFacet = address(new ConvertiblesFacet());
            equityCompensationFacet = address(new EquityCompensationFacet());
            stockPlanFacet = address(new StockPlanFacet());
            warrantFacet = address(new WarrantFacet());
            stakeholderNFTFacet = address(new StakeholderNFTFacet());

            console.log("------- New Facet Addresses (Add to .env) -------");
            console.log("DIAMOND_CUT_FACET=", diamondCutFacet);
            console.log("ISSUER_FACET=", issuerFacet);
            console.log("STAKEHOLDER_FACET=", stakeholderFacet);
            console.log("STOCK_CLASS_FACET=", stockClassFacet);
            console.log("STOCK_FACET=", stockFacet);
            console.log("CONVERTIBLES_FACET=", convertiblesFacet);
            console.log("EQUITY_COMPENSATION_FACET=", equityCompensationFacet);
            console.log("STOCK_PLAN_FACET=", stockPlanFacet);
            console.log("WARRANT_FACET=", warrantFacet);
            console.log("STAKEHOLDER_NFT_FACET=", stakeholderNFTFacet);
        } else {
            console.log("Using existing facets from .env");
        }

        // Deploy factory with facet addresses
        DiamondCapTableFactory factory = new DiamondCapTableFactory(
            diamondCutFacet,
            issuerFacet,
            stakeholderFacet,
            stockClassFacet,
            stockFacet,
            convertiblesFacet,
            equityCompensationFacet,
            stockPlanFacet,
            warrantFacet,
            stakeholderNFTFacet
        );

        console.log("DiamondCapTableFactory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}
