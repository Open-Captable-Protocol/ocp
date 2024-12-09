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

    function deployInitialFacets(address owner) internal returns (address) {
        console.log("\n\nDeploying facets...");
        console.log("address(this): ", address(this));
        // Deploy all facets
        console.log("Deploying facets...");
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](11);

        // ------------------- Diamond Loupe Facet -------------------
        bytes4[] memory loupeSelectors = new bytes4[](5);
        loupeSelectors[0] = DiamondLoupeFacet.facets.selector;
        loupeSelectors[1] = DiamondLoupeFacet.facetFunctionSelectors.selector;
        loupeSelectors[2] = DiamondLoupeFacet.facetAddresses.selector;
        loupeSelectors[3] = DiamondLoupeFacet.facetAddress.selector;
        loupeSelectors[4] = DiamondLoupeFacet.supportsInterface.selector;
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(new DiamondLoupeFacet()),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: loupeSelectors
        });

        // ------------------- Issuer Facet -------------------
        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(new IssuerFacet()),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: new bytes4[](2)
        });
        cuts[1].functionSelectors[0] = IssuerFacet.initializeIssuer.selector;
        cuts[1].functionSelectors[1] = IssuerFacet.adjustIssuerAuthorizedShares.selector;

        // ------------------- Stakeholder Facet -------------------
        cuts[2] = IDiamondCut.FacetCut({
            facetAddress: address(new StakeholderFacet()),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: new bytes4[](3)
        });
        cuts[2].functionSelectors[0] = StakeholderFacet.createStakeholder.selector;
        cuts[2].functionSelectors[1] = StakeholderFacet.getStakeholderPositions.selector;
        cuts[2].functionSelectors[2] = StakeholderFacet.linkStakeholderAddress.selector;

        // ------------------- Stock Class Facet -------------------
        cuts[3] = IDiamondCut.FacetCut({
            facetAddress: address(new StockClassFacet()),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: new bytes4[](2)
        });
        cuts[3].functionSelectors[0] = StockClassFacet.createStockClass.selector;
        cuts[3].functionSelectors[1] = StockClassFacet.adjustAuthorizedShares.selector;

        // ------------------- Stock Facet -------------------
        cuts[4] = IDiamondCut.FacetCut({
            facetAddress: address(new StockFacet()),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: new bytes4[](1)
        });
        cuts[4].functionSelectors[0] = StockFacet.issueStock.selector;

        // ------------------- Convertibles Facet -------------------
        cuts[5] = IDiamondCut.FacetCut({
            facetAddress: address(new ConvertiblesFacet()),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: new bytes4[](2)
        });
        cuts[5].functionSelectors[0] = ConvertiblesFacet.issueConvertible.selector;
        cuts[5].functionSelectors[1] = ConvertiblesFacet.getConvertiblePosition.selector;

        // ------------------- Equity Compensation Facet -------------------
        cuts[6] = IDiamondCut.FacetCut({
            facetAddress: address(new EquityCompensationFacet()),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: new bytes4[](3)
        });
        cuts[6].functionSelectors[0] = EquityCompensationFacet.issueEquityCompensation.selector;
        cuts[6].functionSelectors[1] = EquityCompensationFacet.getPosition.selector;
        cuts[6].functionSelectors[2] = EquityCompensationFacet.exerciseEquityCompensation.selector;

        // ------------------- Stock Plan Facet -------------------
        cuts[7] = IDiamondCut.FacetCut({
            facetAddress: address(new StockPlanFacet()),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: new bytes4[](2)
        });
        cuts[7].functionSelectors[0] = StockPlanFacet.createStockPlan.selector;
        cuts[7].functionSelectors[1] = StockPlanFacet.adjustStockPlanPool.selector;

        // ------------------- Warrant Facet -------------------
        cuts[8] = IDiamondCut.FacetCut({
            facetAddress: address(new WarrantFacet()),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: new bytes4[](2)
        });
        cuts[8].functionSelectors[0] = WarrantFacet.issueWarrant.selector;
        cuts[8].functionSelectors[1] = WarrantFacet.getWarrantPosition.selector;

        // ------------------- Stakeholder NFT Facet -------------------
        cuts[9] = IDiamondCut.FacetCut({
            facetAddress: address(new StakeholderNFTFacet()),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: new bytes4[](2)
        });
        cuts[9].functionSelectors[0] = StakeholderNFTFacet.mint.selector;
        cuts[9].functionSelectors[1] = StakeholderNFTFacet.tokenURI.selector;

        // ------------------- Access Control Facet -------------------
        cuts[10] = IDiamondCut.FacetCut({
            facetAddress: address(new AccessControlFacet()),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: new bytes4[](8)
        });
        cuts[10].functionSelectors[0] = AccessControlFacet.grantRole.selector;
        cuts[10].functionSelectors[1] = AccessControlFacet.revokeRole.selector;
        cuts[10].functionSelectors[2] = AccessControlFacet.hasRole.selector;
        cuts[10].functionSelectors[3] = AccessControlFacet.initializeAccessControl.selector;
        cuts[10].functionSelectors[4] = AccessControlFacet.transferAdmin.selector;
        cuts[10].functionSelectors[5] = AccessControlFacet.acceptAdmin.selector;
        cuts[10].functionSelectors[6] = AccessControlFacet.getAdmin.selector;
        cuts[10].functionSelectors[7] = AccessControlFacet.getPendingAdmin.selector;

        // Create reference diamond
        CapTable referenceDiamond = new CapTable(owner, address(new DiamondCutFacet()));

        // Perform the cuts
        DiamondCutFacet(address(referenceDiamond)).diamondCut(cuts, address(0), "");
        console.log("Cuts completed for reference diamond at:", address(referenceDiamond));
        return address(referenceDiamond);
    }
}

contract DeployFactoryScript is Script {
    // runs locally on anvil
    function run() external {
        console.log("Deploying factory on anvil");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        if (deployerPrivateKey == 0) {
            revert("Missing PRIVATE_KEY in .env");
        }
        address deployerWallet = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerWallet);

        // Try to get addresses from env
        address referenceDiamond = vm.envOr("REFERENCE_DIAMOND", address(0));
        console.log("deployerWallet: ", deployerWallet);

        // Deploy new facets if addresses not in env
        if (referenceDiamond == address(0)) {
            console.log("Deploying new facets");
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
