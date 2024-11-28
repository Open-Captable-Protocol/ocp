// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CapTable} from "./CapTable.sol";
import {DiamondCutFacet} from "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import {IDiamondCut} from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import {IssuerFacet} from "@facets/IssuerFacet.sol";
import {StakeholderFacet} from "@facets/StakeholderFacet.sol";
import {StockClassFacet} from "@facets/StockClassFacet.sol";
import {StockFacet} from "@facets/StockFacet.sol";
import {ConvertiblesFacet} from "@facets/ConvertiblesFacet.sol";
import {EquityCompensationFacet} from "@facets/EquityCompensationFacet.sol";
import {StockPlanFacet} from "@facets/StockPlanFacet.sol";
import {WarrantFacet} from "@facets/WarrantFacet.sol";
import {StakeholderNFTFacet} from "@facets/StakeholderNFTFacet.sol";
import "forge-std/console.sol";

contract CapTableFactory {
    event CapTableCreated(address indexed capTable, bytes16 indexed issuerId);

    address[] public capTables;

    // Store facet addresses
    address public immutable diamondCutFacet;
    address public immutable issuerFacet;
    address public immutable stakeholderFacet;
    address public immutable stockClassFacet;
    address public immutable stockFacet;
    address public immutable convertiblesFacet;
    address public immutable equityCompensationFacet;
    address public immutable stockPlanFacet;
    address public immutable warrantFacet;
    address public immutable stakeholderNFTFacet;

    constructor(
        address _diamondCutFacet,
        address _issuerFacet,
        address _stakeholderFacet,
        address _stockClassFacet,
        address _stockFacet,
        address _convertiblesFacet,
        address _equityCompensationFacet,
        address _stockPlanFacet,
        address _warrantFacet,
        address _stakeholderNFTFacet
    ) {
        require(_diamondCutFacet != address(0), "Invalid diamondCutFacet");
        diamondCutFacet = _diamondCutFacet;
        issuerFacet = _issuerFacet;
        stakeholderFacet = _stakeholderFacet;
        stockClassFacet = _stockClassFacet;
        stockFacet = _stockFacet;
        convertiblesFacet = _convertiblesFacet;
        equityCompensationFacet = _equityCompensationFacet;
        stockPlanFacet = _stockPlanFacet;
        warrantFacet = _warrantFacet;
        stakeholderNFTFacet = _stakeholderNFTFacet;
    }

    function createCapTable(bytes16 id, uint256 initialSharesAuthorized) external returns (address) {
        require(id != bytes16(0) && initialSharesAuthorized != 0, "Invalid issuer params");

        // Deploy Diamond with factory as the owner
        console.log("inside createCapTable");
        console.log("msg.sender: ", msg.sender);
        console.log("factory address (this): ", address(this));

        // Make the factory the owner, not msg.sender
        CapTable diamond = new CapTable(address(this), diamondCutFacet);

        // Create facet cuts in memory
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](9);

        // IssuerFacet
        bytes4[] memory issuerSelectors = new bytes4[](2);
        issuerSelectors[0] = IssuerFacet.initializeIssuer.selector;
        issuerSelectors[1] = IssuerFacet.adjustIssuerAuthorizedShares.selector;
        cuts[0] = IDiamondCut.FacetCut({
            facetAddress: issuerFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: issuerSelectors
        });

        // StakeholderFacet
        bytes4[] memory stakeholderSelectors = new bytes4[](3);
        stakeholderSelectors[0] = StakeholderFacet.createStakeholder.selector;
        stakeholderSelectors[1] = StakeholderFacet.linkStakeholderAddress.selector;
        stakeholderSelectors[2] = StakeholderFacet.getStakeholderPositions.selector;
        cuts[1] = IDiamondCut.FacetCut({
            facetAddress: stakeholderFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stakeholderSelectors
        });

        // StockClassFacet
        bytes4[] memory stockClassSelectors = new bytes4[](2);
        stockClassSelectors[0] = StockClassFacet.createStockClass.selector;
        stockClassSelectors[1] = StockClassFacet.adjustAuthorizedShares.selector;
        cuts[2] = IDiamondCut.FacetCut({
            facetAddress: stockClassFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockClassSelectors
        });

        // StockFacet
        bytes4[] memory stockSelectors = new bytes4[](1);
        stockSelectors[0] = StockFacet.issueStock.selector;
        cuts[3] = IDiamondCut.FacetCut({
            facetAddress: stockFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockSelectors
        });

        // ConvertiblesFacet
        bytes4[] memory convertibleSelectors = new bytes4[](2);
        convertibleSelectors[0] = ConvertiblesFacet.issueConvertible.selector;
        convertibleSelectors[1] = ConvertiblesFacet.getConvertiblePosition.selector;
        cuts[4] = IDiamondCut.FacetCut({
            facetAddress: convertiblesFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: convertibleSelectors
        });

        // EquityCompensationFacet
        bytes4[] memory equityCompensationSelectors = new bytes4[](3);
        equityCompensationSelectors[0] = EquityCompensationFacet.issueEquityCompensation.selector;
        equityCompensationSelectors[1] = EquityCompensationFacet.getPosition.selector;
        equityCompensationSelectors[2] = EquityCompensationFacet.exerciseEquityCompensation.selector;
        cuts[5] = IDiamondCut.FacetCut({
            facetAddress: equityCompensationFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: equityCompensationSelectors
        });

        // StockPlanFacet
        bytes4[] memory stockPlanSelectors = new bytes4[](2);
        stockPlanSelectors[0] = StockPlanFacet.createStockPlan.selector;
        stockPlanSelectors[1] = StockPlanFacet.adjustStockPlanPool.selector;
        cuts[6] = IDiamondCut.FacetCut({
            facetAddress: stockPlanFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stockPlanSelectors
        });

        // WarrantFacet
        bytes4[] memory warrantSelectors = new bytes4[](2);
        warrantSelectors[0] = WarrantFacet.issueWarrant.selector;
        warrantSelectors[1] = WarrantFacet.getWarrantPosition.selector;
        cuts[7] = IDiamondCut.FacetCut({
            facetAddress: warrantFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: warrantSelectors
        });

        // StakeholderNFTFacet
        bytes4[] memory stakeholderNFTSelectors = new bytes4[](2);
        stakeholderNFTSelectors[0] = StakeholderNFTFacet.mint.selector;
        stakeholderNFTSelectors[1] = StakeholderNFTFacet.tokenURI.selector;
        cuts[8] = IDiamondCut.FacetCut({
            facetAddress: stakeholderNFTFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: stakeholderNFTSelectors
        });

        // Perform the cuts
        DiamondCutFacet(address(diamond)).diamondCut(cuts, address(0), "");

        // Initialize the issuer
        IssuerFacet(address(diamond)).initializeIssuer(id, initialSharesAuthorized);

        // Store the new cap table
        capTables.push(address(diamond));

        emit CapTableCreated(address(diamond), id);
        return address(diamond);
    }

    function getCapTableCount() external view returns (uint256) {
        return capTables.length;
    }
}
