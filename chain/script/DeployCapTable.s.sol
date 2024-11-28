// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/core/CapTableFactory.sol";
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

contract DeployDiamondCapTableScript is Script {
    function deployInitialFacets(address _contractOwner) internal returns (address) {
        // Deploy all facets
        console.log("Deploying facets...");
        DiamondCutFacet diamondCutFacet = new DiamondCutFacet();
        DiamondLoupeFacet diamondLoupeFacet = new DiamondLoupeFacet();
        IssuerFacet issuerFacet = new IssuerFacet();
        StakeholderFacet stakeholderFacet = new StakeholderFacet();
        StockClassFacet stockClassFacet = new StockClassFacet();
        StockFacet stockFacet = new StockFacet();
        ConvertiblesFacet convertiblesFacet = new ConvertiblesFacet();
        EquityCompensationFacet equityCompensationFacet = new EquityCompensationFacet();
        StockPlanFacet stockPlanFacet = new StockPlanFacet();
        WarrantFacet warrantFacet = new WarrantFacet();
        StakeholderNFTFacet stakeholderNFTFacet = new StakeholderNFTFacet();

        // Create reference diamond with deployer as owner
        // address deployer = vm.addr(vm.envUint("PRIVATE_KEY"));
        // console.log("Deployer address:", deployer);

        // Create the diamond with deployer as owner
        CapTable referenceDiamond = new CapTable(_contractOwner, address(diamondCutFacet));
        console.log("Reference diamond created at:", address(referenceDiamond));

        // Create cuts array for all facets
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](10);

        // Add DiamondLoupe functions
        bytes4[] memory loupeSelectors = new bytes4[](5);
        loupeSelectors[0] = DiamondLoupeFacet.facets.selector;
        loupeSelectors[1] = DiamondLoupeFacet.facetFunctionSelectors.selector;
        loupeSelectors[2] = DiamondLoupeFacet.facetAddresses.selector;
        loupeSelectors[3] = DiamondLoupeFacet.facetAddress.selector;
        loupeSelectors[4] = DiamondLoupeFacet.supportsInterface.selector;

        // Add issuer functions
        bytes4[] memory issuerSelectors = new bytes4[](2);
        issuerSelectors[0] = IssuerFacet.initializeIssuer.selector;
        issuerSelectors[1] = IssuerFacet.adjustIssuerAuthorizedShares.selector;

        // Add stakeholder functions
        bytes4[] memory stakeholderSelectors = new bytes4[](3);
        stakeholderSelectors[0] = StakeholderFacet.createStakeholder.selector;
        stakeholderSelectors[1] = StakeholderFacet.getStakeholderPositions.selector;
        stakeholderSelectors[2] = StakeholderFacet.linkStakeholderAddress.selector;

        // Add stock class functions
        bytes4[] memory stockClassSelectors = new bytes4[](2);
        stockClassSelectors[0] = StockClassFacet.createStockClass.selector;
        stockClassSelectors[1] = StockClassFacet.adjustAuthorizedShares.selector;

        // Add stock functions
        bytes4[] memory stockSelectors = new bytes4[](1);
        stockSelectors[0] = StockFacet.issueStock.selector;

        // Add convertible functions
        bytes4[] memory convertibleSelectors = new bytes4[](2);
        convertibleSelectors[0] = ConvertiblesFacet.issueConvertible.selector;
        convertibleSelectors[1] = ConvertiblesFacet.getConvertiblePosition.selector;

        // Add equity compensation functions
        bytes4[] memory equityCompensationSelectors = new bytes4[](3);
        equityCompensationSelectors[0] = EquityCompensationFacet.issueEquityCompensation.selector;
        equityCompensationSelectors[1] = EquityCompensationFacet.getPosition.selector;
        equityCompensationSelectors[2] = EquityCompensationFacet.exerciseEquityCompensation.selector;

        // Add stock plan functions
        bytes4[] memory stockPlanSelectors = new bytes4[](2);
        stockPlanSelectors[0] = StockPlanFacet.createStockPlan.selector;
        stockPlanSelectors[1] = StockPlanFacet.adjustStockPlanPool.selector;

        // Add warrant functions
        bytes4[] memory warrantSelectors = new bytes4[](2);
        warrantSelectors[0] = WarrantFacet.issueWarrant.selector;
        warrantSelectors[1] = WarrantFacet.getWarrantPosition.selector;

        // Add NFT functions
        bytes4[] memory nftSelectors = new bytes4[](2);
        nftSelectors[0] = StakeholderNFTFacet.mint.selector;
        nftSelectors[1] = StakeholderNFTFacet.tokenURI.selector;

        // Create the cuts
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(diamondLoupeFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: loupeSelectors
        });

        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: address(issuerFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: issuerSelectors
        });

        cuts[2] = IDiamondCut.FacetCut({
            facetAddress: address(stakeholderFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stakeholderSelectors
        });

        cuts[3] = IDiamondCut.FacetCut({
            facetAddress: address(stockClassFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockClassSelectors
        });

        cuts[4] = IDiamondCut.FacetCut({
            facetAddress: address(stockFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockSelectors
        });

        cuts[5] = IDiamondCut.FacetCut({
            facetAddress: address(convertiblesFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: convertibleSelectors
        });

        cuts[6] = IDiamondCut.FacetCut({
            facetAddress: address(equityCompensationFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: equityCompensationSelectors
        });

        cuts[7] = IDiamondCut.FacetCut({
            facetAddress: address(stockPlanFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockPlanSelectors
        });

        cuts[8] = IDiamondCut.FacetCut({
            facetAddress: address(warrantFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: warrantSelectors
        });

        cuts[9] = IDiamondCut.FacetCut({
            facetAddress: address(stakeholderNFTFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: nftSelectors
        });

        // Perform the cuts
        DiamondCutFacet(address(referenceDiamond)).diamondCut(cuts, address(0), "");

        return address(referenceDiamond);
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        if (deployerPrivateKey == 0) {
            revert("Missing PRIVATE_KEY in .env");
        }
        console.log("Deploying DiamondCapTable system to Base Sepolia");

        vm.startBroadcast(deployerPrivateKey);

        // Try to get addresses from env
        address referenceDiamond = vm.envOr("REFERENCE_DIAMOND", address(0));
        address deployer = vm.addr(deployerPrivateKey);

        // Deploy new facets if addresses not in env
        if (referenceDiamond == address(0)) {
            referenceDiamond = deployInitialFacets(deployer);
        }

        console.log("------- New Facet Addresses (Add to .env) -------");
        console.log("REFERENCE_DIAMOND=", referenceDiamond);
        console.log("-------------------------------------------------");

        // Deploy factory with facet addresses
        CapTableFactory factory = new CapTableFactory(referenceDiamond);

        factory.createCapTable(bytes16("TEST"), 1_000_000);
        console.log("\nCapTableFactory deployed at:", address(factory));

        vm.stopBroadcast();
    }

    function runProduction() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        console.log("Deploying DiamondCapTable system to Base Sepolia");

        vm.startBroadcast(deployerPrivateKey);

        // Try to get addresses from env
        address referenceDiamond = vm.envOr("REFERENCE_DIAMOND", address(0));

        // Deploy new facets if addresses not in env
        if (referenceDiamond == address(0)) {
            revert("Missing REFERENCE_DIAMOND in .env");
        }
        // Deploy factory with facet addresses
        CapTableFactory factory = new CapTableFactory(referenceDiamond);

        console.log("\nCapTableFactory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}
