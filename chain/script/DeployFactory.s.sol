// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import { CapTableFactory } from "@core/CapTableFactory.sol";
import { CapTable } from "@core/CapTable.sol";
import { DiamondCutFacet } from "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import { IssuerFacet } from "@facets/IssuerFacet.sol";
import { DiamondLoupeFacet } from "diamond-3-hardhat/facets/DiamondLoupeFacet.sol";
import { IDiamondCut } from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
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

library LibDeployment {
    struct FacetDeployment {
        address facetAddress;
        bytes4[] selectors;
    }

    function deployInitialFacets(address owner) public returns (address) {
        console.log("\n\nDeploying facets...");
        console.log("address(this): ", address(this));
        // Deploy all facets
        console.log("Deploying facets...");
        FacetDeployment[] memory deployments = new FacetDeployment[](11);

        // ------------------- Diamond Loupe Facet -------------------
        deployments[0] = FacetDeployment({ facetAddress: address(new DiamondLoupeFacet()), selectors: new bytes4[](5) });
        deployments[0].selectors[0] = DiamondLoupeFacet.facets.selector;
        deployments[0].selectors[1] = DiamondLoupeFacet.facetFunctionSelectors.selector;
        deployments[0].selectors[2] = DiamondLoupeFacet.facetAddresses.selector;
        deployments[0].selectors[3] = DiamondLoupeFacet.facetAddress.selector;
        deployments[0].selectors[4] = DiamondLoupeFacet.supportsInterface.selector;

        // ------------------- Issuer Facet -------------------
        deployments[1] = FacetDeployment({ facetAddress: address(new IssuerFacet()), selectors: new bytes4[](2) });
        deployments[1].selectors[0] = IssuerFacet.initializeIssuer.selector;
        deployments[1].selectors[1] = IssuerFacet.adjustIssuerAuthorizedShares.selector;

        // ------------------- Stakeholder Facet -------------------
        deployments[2] = FacetDeployment({ facetAddress: address(new StakeholderFacet()), selectors: new bytes4[](3) });
        deployments[2].selectors[0] = StakeholderFacet.createStakeholder.selector;
        deployments[2].selectors[1] = StakeholderFacet.getStakeholderPositions.selector;
        deployments[2].selectors[2] = StakeholderFacet.linkStakeholderAddress.selector;

        // ------------------- Stock Class Facet -------------------
        deployments[3] = FacetDeployment({ facetAddress: address(new StockClassFacet()), selectors: new bytes4[](2) });
        deployments[3].selectors[0] = StockClassFacet.createStockClass.selector;
        deployments[3].selectors[1] = StockClassFacet.adjustAuthorizedShares.selector;

        // ------------------- Stock Facet -------------------
        deployments[4] = FacetDeployment({ facetAddress: address(new StockFacet()), selectors: new bytes4[](1) });
        deployments[4].selectors[0] = StockFacet.issueStock.selector;

        // ------------------- Convertibles Facet -------------------
        deployments[5] = FacetDeployment({ facetAddress: address(new ConvertiblesFacet()), selectors: new bytes4[](2) });
        deployments[5].selectors[0] = ConvertiblesFacet.issueConvertible.selector;
        deployments[5].selectors[1] = ConvertiblesFacet.getConvertiblePosition.selector;

        // ------------------- Equity Compensation Facet -------------------
        deployments[6] =
            FacetDeployment({ facetAddress: address(new EquityCompensationFacet()), selectors: new bytes4[](3) });
        deployments[6].selectors[0] = EquityCompensationFacet.issueEquityCompensation.selector;
        deployments[6].selectors[1] = EquityCompensationFacet.getPosition.selector;
        deployments[6].selectors[2] = EquityCompensationFacet.exerciseEquityCompensation.selector;

        // ------------------- Stock Plan Facet -------------------
        deployments[7] = FacetDeployment({ facetAddress: address(new StockPlanFacet()), selectors: new bytes4[](2) });
        deployments[7].selectors[0] = StockPlanFacet.createStockPlan.selector;
        deployments[7].selectors[1] = StockPlanFacet.adjustStockPlanPool.selector;

        // ------------------- Warrant Facet -------------------
        deployments[8] = FacetDeployment({ facetAddress: address(new WarrantFacet()), selectors: new bytes4[](2) });
        deployments[8].selectors[0] = WarrantFacet.issueWarrant.selector;
        deployments[8].selectors[1] = WarrantFacet.getWarrantPosition.selector;

        // ------------------- Stakeholder NFT Facet -------------------
        deployments[9] =
            FacetDeployment({ facetAddress: address(new StakeholderNFTFacet()), selectors: new bytes4[](2) });
        deployments[9].selectors[0] = StakeholderNFTFacet.mint.selector;
        deployments[9].selectors[1] = StakeholderNFTFacet.tokenURI.selector;

        // ------------------- Access Control Facet -------------------
        deployments[10] =
            FacetDeployment({ facetAddress: address(new AccessControlFacet()), selectors: new bytes4[](8) });
        deployments[10].selectors[0] = AccessControlFacet.grantRole.selector;
        deployments[10].selectors[1] = AccessControlFacet.revokeRole.selector;
        deployments[10].selectors[2] = AccessControlFacet.hasRole.selector;
        deployments[10].selectors[3] = AccessControlFacet.initializeAccessControl.selector;
        deployments[10].selectors[4] = AccessControlFacet.transferAdmin.selector;
        deployments[10].selectors[5] = AccessControlFacet.acceptAdmin.selector;
        deployments[10].selectors[6] = AccessControlFacet.getAdmin.selector;
        deployments[10].selectors[7] = AccessControlFacet.getPendingAdmin.selector;

        // Create reference diamond
        CapTable referenceDiamond = new CapTable(owner, address(new DiamondCutFacet()));

        // Convert deployments to cuts
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](deployments.length);
        for (uint256 i = 0; i < deployments.length; i++) {
            cuts[i] = IDiamondCut.FacetCut({
                facetAddress: deployments[i].facetAddress,
                action: IDiamondCut.FacetCutAction.Add,
                functionSelectors: deployments[i].selectors
            });
        }

        // Perform the cuts
        DiamondCutFacet(address(referenceDiamond)).diamondCut(cuts, address(0), "");
        console.log("Cuts completed for reference diamond at:", address(referenceDiamond));
        return address(referenceDiamond);
    }
}

contract DeployFactoryScript is Script {
    // Struct to hold facet deployment info
    struct FacetDeployment {
        address facetAddress;
        bytes4[] selectors;
    }

    // Struct to organize facet cut data
    struct FacetCutData {
        string name; // For logging/debugging
        address facetAddress;
        bytes4[] selectors;
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        if (deployerPrivateKey == 0) {
            revert("Missing PRIVATE_KEY in .env");
        }
        address deployerWallet = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerWallet);

        // Try to get addresses from env
        address referenceDiamond = vm.envOr("REFERENCE_DIAMOND", address(0));

        // Deploy new facets if addresses not in env
        if (referenceDiamond == address(0)) {
            referenceDiamond = LibDeployment.deployInitialFacets(deployerWallet);
        }

        console.log("------- New Facet Addresses (Add to .env) -------");
        console.log("REFERENCE_DIAMOND=", referenceDiamond);
        console.log("-------------------------------------------------");

        // Deploy factory with facet addresses
        CapTableFactory factory = new CapTableFactory(referenceDiamond);

        address capTable = factory.createCapTable(bytes16("TEST"), 1_000_000);
        console.log("\nCapTableFactory deployed at:", address(factory));
        console.log("CapTable deployed at:", capTable);
        vm.stopPrank();
        console.log("Diamond admin after accepting:", AccessControlFacet(capTable).getAdmin());
        // Verify factory is no longer admin
        console.log(
            "Factory is admin:",
            AccessControlFacet(capTable).hasRole(AccessControl.DEFAULT_ADMIN_ROLE, address(factory))
        );

        vm.stopBroadcast();
    }

    function runProduction() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        if (deployerPrivateKey == 0) {
            revert("Missing PRIVATE_KEY in .env");
        }
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deploying DiamondCapTable system to Base Sepolia");

        vm.startBroadcast(deployer);

        // Try to get addresses from env
        address referenceDiamond = vm.envOr("REFERENCE_DIAMOND", address(0));

        // Deploy new facets if addresses not in env
        if (referenceDiamond == address(0)) {
            revert("Missing REFERENCE_DIAMOND in .env");
        }
        // Deploy factory with facet addresses
        CapTableFactory factory = new CapTableFactory(referenceDiamond);

        console.log("\nCapTableFactory deployed at:", address(factory));

        vm.stopPrank();
        // console.log("Diamond admin after accepting:", AccessControlFacet(diamond).getAdmin());
        // Verify factory is no longer admin
        // console.log(
        //     "Factory is admin:", AccessControlFacet(diamond).hasRole(AccessControl.DEFAULT_ADMIN_ROLE, address(factory))
        // );
        vm.stopPrank();
        vm.stopBroadcast();
    }
}
