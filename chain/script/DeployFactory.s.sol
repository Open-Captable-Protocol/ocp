// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import { MockFacet, MockFacetV2 } from "../test/mocks/MockFacet.sol";
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
    uint256 constant FACET_COUNT = 11; // Number of enum values FacetType

    enum FacetType {
        DiamondLoupe,
        Issuer,
        Stakeholder,
        StockClass,
        Stock,
        Convertibles,
        EquityCompensation,
        StockPlan,
        Warrant,
        StakeholderNFT,
        AccessControl,
        MockFacet,
        MockFacetV2
    }

    struct FacetCutInfo {
        string name;
        bytes4[] selectors;
    }

    function getFacetCutInfo(FacetType facetType) internal pure returns (FacetCutInfo memory info) {
        if (facetType == FacetType.DiamondLoupe) {
            bytes4[] memory selectors = new bytes4[](5);
            selectors[0] = DiamondLoupeFacet.facets.selector;
            selectors[1] = DiamondLoupeFacet.facetFunctionSelectors.selector;
            selectors[2] = DiamondLoupeFacet.facetAddresses.selector;
            selectors[3] = DiamondLoupeFacet.facetAddress.selector;
            selectors[4] = DiamondLoupeFacet.supportsInterface.selector;
            return FacetCutInfo({ name: "DiamondLoupeFacet", selectors: selectors });
        }
        if (facetType == FacetType.Issuer) {
            bytes4[] memory selectors = new bytes4[](2);
            selectors[0] = IssuerFacet.initializeIssuer.selector;
            selectors[1] = IssuerFacet.adjustIssuerAuthorizedShares.selector;
            return FacetCutInfo({ name: "IssuerFacet", selectors: selectors });
        }
        if (facetType == FacetType.Stakeholder) {
            bytes4[] memory selectors = new bytes4[](3);
            selectors[0] = StakeholderFacet.createStakeholder.selector;
            selectors[1] = StakeholderFacet.getStakeholderPositions.selector;
            selectors[2] = StakeholderFacet.linkStakeholderAddress.selector;
            return FacetCutInfo({ name: "StakeholderFacet", selectors: selectors });
        }
        if (facetType == FacetType.StockClass) {
            bytes4[] memory selectors = new bytes4[](2);
            selectors[0] = StockClassFacet.createStockClass.selector;
            selectors[1] = StockClassFacet.adjustAuthorizedShares.selector;
            return FacetCutInfo({ name: "StockClassFacet", selectors: selectors });
        }
        if (facetType == FacetType.Stock) {
            bytes4[] memory selectors = new bytes4[](2);
            selectors[0] = StockFacet.issueStock.selector;
            selectors[1] = StockFacet.getStockPosition.selector;
            return FacetCutInfo({ name: "StockFacet", selectors: selectors });
        }
        if (facetType == FacetType.Convertibles) {
            bytes4[] memory selectors = new bytes4[](2);
            selectors[0] = ConvertiblesFacet.issueConvertible.selector;
            selectors[1] = ConvertiblesFacet.getConvertiblePosition.selector;
            return FacetCutInfo({ name: "ConvertiblesFacet", selectors: selectors });
        }
        if (facetType == FacetType.EquityCompensation) {
            bytes4[] memory selectors = new bytes4[](3);
            selectors[0] = EquityCompensationFacet.issueEquityCompensation.selector;
            selectors[1] = EquityCompensationFacet.getPosition.selector;
            selectors[2] = EquityCompensationFacet.exerciseEquityCompensation.selector;
            return FacetCutInfo({ name: "EquityCompensationFacet", selectors: selectors });
        }
        if (facetType == FacetType.StockPlan) {
            bytes4[] memory selectors = new bytes4[](2);
            selectors[0] = StockPlanFacet.createStockPlan.selector;
            selectors[1] = StockPlanFacet.adjustStockPlanPool.selector;
            return FacetCutInfo({ name: "StockPlanFacet", selectors: selectors });
        }
        if (facetType == FacetType.Warrant) {
            bytes4[] memory selectors = new bytes4[](2);
            selectors[0] = WarrantFacet.issueWarrant.selector;
            selectors[1] = WarrantFacet.getWarrantPosition.selector;
            return FacetCutInfo({ name: "WarrantFacet", selectors: selectors });
        }
        if (facetType == FacetType.StakeholderNFT) {
            bytes4[] memory selectors = new bytes4[](2);
            selectors[0] = StakeholderNFTFacet.mint.selector;
            selectors[1] = StakeholderNFTFacet.tokenURI.selector;
            return FacetCutInfo({ name: "StakeholderNFTFacet", selectors: selectors });
        }
        if (facetType == FacetType.AccessControl) {
            bytes4[] memory selectors = new bytes4[](8);
            selectors[0] = AccessControlFacet.grantRole.selector;
            selectors[1] = AccessControlFacet.revokeRole.selector;
            selectors[2] = AccessControlFacet.hasRole.selector;
            selectors[3] = AccessControlFacet.initializeAccessControl.selector;
            selectors[4] = AccessControlFacet.transferAdmin.selector;
            selectors[5] = AccessControlFacet.acceptAdmin.selector;
            selectors[6] = AccessControlFacet.getAdmin.selector;
            selectors[7] = AccessControlFacet.getPendingAdmin.selector;
            return FacetCutInfo({ name: "AccessControlFacet", selectors: selectors });
        }
        if (facetType == FacetType.MockFacet) {
            bytes4[] memory selectors = new bytes4[](1);
            selectors[0] = MockFacet.getValuePlusOne.selector;
            return FacetCutInfo({ name: "MockFacet", selectors: selectors });
        }
        if (facetType == FacetType.MockFacetV2) {
            bytes4[] memory selectors = new bytes4[](1);
            selectors[0] = MockFacetV2.getValuePlusTwo.selector;
            return FacetCutInfo({ name: "MockFacetV2", selectors: selectors });
        }
        revert("Unknown facet type");
    }

    function getFacetTypeFromSelector(bytes4 selector) internal pure returns (FacetType) {
        if (selector == DiamondLoupeFacet.facets.selector) return FacetType.DiamondLoupe;
        if (selector == IssuerFacet.initializeIssuer.selector) return FacetType.Issuer;
        if (selector == StakeholderFacet.createStakeholder.selector) return FacetType.Stakeholder;
        if (selector == StockClassFacet.createStockClass.selector) return FacetType.StockClass;
        if (selector == StockFacet.issueStock.selector) return FacetType.Stock;
        if (selector == ConvertiblesFacet.issueConvertible.selector) return FacetType.Convertibles;
        if (selector == EquityCompensationFacet.issueEquityCompensation.selector) return FacetType.EquityCompensation;
        if (selector == StockPlanFacet.createStockPlan.selector) return FacetType.StockPlan;
        if (selector == WarrantFacet.issueWarrant.selector) return FacetType.Warrant;
        if (selector == StakeholderNFTFacet.mint.selector) return FacetType.StakeholderNFT;
        if (selector == AccessControlFacet.grantRole.selector) return FacetType.AccessControl;
        if (selector == MockFacet.getValuePlusOne.selector) return FacetType.MockFacet;
        if (selector == MockFacetV2.getValuePlusTwo.selector) return FacetType.MockFacetV2;
        revert("Unknown selector");
    }

    function deployFacet(FacetType facetType) internal returns (address) {
        address facetAddress;
        if (facetType == FacetType.DiamondLoupe) {
            facetAddress = address(new DiamondLoupeFacet());
            console.log("DIAMOND_LOUPE_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.Issuer) {
            facetAddress = address(new IssuerFacet());
            console.log("ISSUER_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.Stakeholder) {
            facetAddress = address(new StakeholderFacet());
            console.log("STAKEHOLDER_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.StockClass) {
            facetAddress = address(new StockClassFacet());
            console.log("STOCK_CLASS_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.Stock) {
            facetAddress = address(new StockFacet());
            console.log("STOCK_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.Convertibles) {
            facetAddress = address(new ConvertiblesFacet());
            console.log("CONVERTIBLES_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.EquityCompensation) {
            facetAddress = address(new EquityCompensationFacet());
            console.log("EQUITY_COMPENSATION_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.StockPlan) {
            facetAddress = address(new StockPlanFacet());
            console.log("STOCK_PLAN_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.Warrant) {
            facetAddress = address(new WarrantFacet());
            console.log("WARRANT_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.StakeholderNFT) {
            facetAddress = address(new StakeholderNFTFacet());
            console.log("STAKEHOLDER_NFT_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.AccessControl) {
            facetAddress = address(new AccessControlFacet());
            console.log("ACCESS_CONTROL_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.MockFacet) {
            facetAddress = address(new MockFacet());
            console.log("MOCK_FACET=", facetAddress);
            return facetAddress;
        }
        if (facetType == FacetType.MockFacetV2) {
            facetAddress = address(new MockFacetV2());
            console.log("MOCK_FACET_V2=", facetAddress);
            return facetAddress;
        }
        revert("Unknown facet type");
    }

    function deployInitialFacets(address owner) internal returns (address) {
        console.log("\n\nDeploying facets...");
        console.log("owner(this): ", address(this));

        // Deploy all facets
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](FACET_COUNT); // Change from FACET_COUNT to actual number of cuts

        // ------------------- Diamond Loupe Facet -------------------
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: LibDeployment.deployFacet(FacetType.DiamondLoupe),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: LibDeployment.getFacetCutInfo(FacetType.DiamondLoupe).selectors
        });

        // ------------------- Issuer Facet -------------------
        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: LibDeployment.deployFacet(FacetType.Issuer),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: LibDeployment.getFacetCutInfo(FacetType.Issuer).selectors
        });

        // ------------------- Stakeholder Facet -------------------
        cuts[2] = IDiamondCut.FacetCut({
            facetAddress: LibDeployment.deployFacet(FacetType.Stakeholder),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: LibDeployment.getFacetCutInfo(FacetType.Stakeholder).selectors
        });

        // ------------------- Stock Class Facet -------------------
        cuts[3] = IDiamondCut.FacetCut({
            facetAddress: LibDeployment.deployFacet(FacetType.StockClass),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: LibDeployment.getFacetCutInfo(FacetType.StockClass).selectors
        });

        // ------------------- Stock Facet -------------------
        cuts[4] = IDiamondCut.FacetCut({
            facetAddress: LibDeployment.deployFacet(FacetType.Stock),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: LibDeployment.getFacetCutInfo(FacetType.Stock).selectors
        });

        // ------------------- Convertibles Facet -------------------
        cuts[5] = IDiamondCut.FacetCut({
            facetAddress: LibDeployment.deployFacet(FacetType.Convertibles),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: LibDeployment.getFacetCutInfo(FacetType.Convertibles).selectors
        });
        cuts[5].functionSelectors[0] = ConvertiblesFacet.issueConvertible.selector;
        cuts[5].functionSelectors[1] = ConvertiblesFacet.getConvertiblePosition.selector;

        // ------------------- Equity Compensation Facet -------------------
        cuts[6] = IDiamondCut.FacetCut({
            facetAddress: LibDeployment.deployFacet(FacetType.EquityCompensation),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: LibDeployment.getFacetCutInfo(FacetType.EquityCompensation).selectors
        });

        // ------------------- Stock Plan Facet -------------------
        cuts[7] = IDiamondCut.FacetCut({
            facetAddress: LibDeployment.deployFacet(FacetType.StockPlan),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: LibDeployment.getFacetCutInfo(FacetType.StockPlan).selectors
        });

        // ------------------- Warrant Facet -------------------
        cuts[8] = IDiamondCut.FacetCut({
            facetAddress: LibDeployment.deployFacet(FacetType.Warrant),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: LibDeployment.getFacetCutInfo(FacetType.Warrant).selectors
        });

        // ------------------- Stakeholder NFT Facet -------------------
        cuts[9] = IDiamondCut.FacetCut({
            facetAddress: LibDeployment.deployFacet(FacetType.StakeholderNFT),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: LibDeployment.getFacetCutInfo(FacetType.StakeholderNFT).selectors
        });

        // ------------------- Access Control Facet -------------------
        cuts[10] = IDiamondCut.FacetCut({
            facetAddress: LibDeployment.deployFacet(FacetType.AccessControl),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: LibDeployment.getFacetCutInfo(FacetType.AccessControl).selectors
        });

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
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        if (bytes(privateKeyStr).length == 0) {
            revert("Missing PRIVATE_KEY in .env");
        }
        // Remove any whitespace and ensure 0x prefix
        if (bytes(privateKeyStr)[0] != "0" || bytes(privateKeyStr)[1] != "x") {
            revert("PRIVATE_KEY must start with 0x");
        }
        uint256 deployerPrivateKey = vm.parseUint(privateKeyStr);
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
        console.log("\n------- Factory Address (add to .env) -------");
        console.log("FACTORY_ADDRESS=", address(factory));
        console.log("-------------------------------------------------");

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
