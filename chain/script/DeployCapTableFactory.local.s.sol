// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/core/CapTableFactory.sol";
import { DiamondCutFacet } from "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import { IssuerFacet } from "@facets/IssuerFacet.sol";
import { StakeholderFacet } from "@facets/StakeholderFacet.sol";
import { StockClassFacet } from "@facets/StockClassFacet.sol";
import { StockFacet } from "@facets/StockFacet.sol";
import { ConvertiblesFacet } from "@facets/ConvertiblesFacet.sol";
import { EquityCompensationFacet } from "@facets/EquityCompensationFacet.sol";
import { StockPlanFacet } from "@facets/StockPlanFacet.sol";
import { WarrantFacet } from "@facets/WarrantFacet.sol";
import { StakeholderNFTFacet } from "@facets/StakeholderNFTFacet.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { AccessControlFacet } from "@facets/AccessControlFacet.sol";

contract DeployDiamondCapTableScript is Script {
    function run() external {
        uint256 fairmintPrivateKey = vm.envUint("PRIVATE_KEY");
        address fairmintWallet = vm.addr(fairmintPrivateKey);
        if (fairmintWallet == address(0)) {
            revert("Invalid fairmint wallet");
        }

        console.log("Fairmint wallet:", fairmintWallet);

        vm.startBroadcast(fairmintWallet);

        // Deploy new facets if addresses not in env
        console.log("Deploying new facets...");
        address diamondCutFacet = address(new DiamondCutFacet());
        address issuerFacet = address(new IssuerFacet());
        address stakeholderFacet = address(new StakeholderFacet());
        address stockClassFacet = address(new StockClassFacet());
        address stockFacet = address(new StockFacet());
        address convertiblesFacet = address(new ConvertiblesFacet());
        address equityCompensationFacet = address(new EquityCompensationFacet());
        address stockPlanFacet = address(new StockPlanFacet());
        address warrantFacet = address(new WarrantFacet());
        address stakeholderNFTFacet = address(new StakeholderNFTFacet());
        address accessControlFacet = address(new AccessControlFacet());

        console.log("-------------------------------------------------");
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
        console.log("ACCESS_CONTROL_FACET=", accessControlFacet);
        console.log("-------------------------------------------------\n");

        // Deploy factory with facet addresses
        CapTableFactory factory = new CapTableFactory(
            fairmintWallet,
            diamondCutFacet,
            issuerFacet,
            stakeholderFacet,
            stockClassFacet,
            stockFacet,
            convertiblesFacet,
            equityCompensationFacet,
            stockPlanFacet,
            warrantFacet,
            stakeholderNFTFacet,
            accessControlFacet
        );

        console.log("\nFactory address:", address(factory));

        // Create cap table - factory will automatically transfer admin to fairmintWallet
        address diamond = factory.createCapTable("Test Cap Table", 1_000_000_000_000_000_000_000_000);

        // Just log the final state
        console.log("Diamond address:", diamond);
        console.log("Pending admin:", AccessControlFacet(diamond).getPendingAdmin());
        console.log("Current admin:", AccessControlFacet(diamond).getAdmin());

        vm.stopBroadcast();
    }
}
