// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {CapTable} from "./CapTable.sol";
import {IDiamondLoupe} from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";
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

    // Reference diamond to copy facets from
    address public immutable referenceDiamond;

    constructor(address _referenceDiamond) {
        require(_referenceDiamond != address(0), "Invalid referenceDiamond");
        referenceDiamond = _referenceDiamond;
    }

    function createCapTable(bytes16 id, uint256 initialSharesAuthorized) external returns (address) {
        require(id != bytes16(0) && initialSharesAuthorized != 0, "Invalid issuer params");

        console.log("createCapTable");
        console.log("msg.sender: ", msg.sender);
        console.log("address(this): ", address(this));

        // Deploy new DiamondCutFacet
        DiamondCutFacet diamondCutFacet = new DiamondCutFacet();

        // Make the factory the owner
        CapTable diamond = new CapTable(address(this), address(diamondCutFacet));

        // Get facet information from reference diamond
        IDiamondLoupe loupe = IDiamondLoupe(referenceDiamond);
        IDiamondLoupe.Facet[] memory existingFacets = loupe.facets();
        console.log("Reference diamond facets:", existingFacets.length);

        // Count valid facets (excluding DiamondCut)
        uint256 validFacetCount = 0;
        for (uint256 i = 0; i < existingFacets.length; i++) {
            bytes4 firstSelector = existingFacets[i].functionSelectors[0];
            // Skip if this is the DiamondCut facet
            if (firstSelector != DiamondCutFacet.diamondCut.selector) {
                validFacetCount++;
            }
        }

        // Create cuts array for valid facets
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](validFacetCount);
        uint256 cutIndex = 0;

        for (uint256 i = 0; i < existingFacets.length; i++) {
            bytes4 firstSelector = existingFacets[i].functionSelectors[0];
            // Skip if this is the DiamondCut facet
            if (firstSelector != DiamondCutFacet.diamondCut.selector) {
                cuts[cutIndex] = IDiamondCut.FacetCut({
                    facetAddress: existingFacets[i].facetAddress,
                    action: IDiamondCut.FacetCutAction.Add,
                    functionSelectors: existingFacets[i].functionSelectors
                });
                cutIndex++;
            }
        }

        // Perform the cuts
        console.log("Performing cuts with", validFacetCount, "facets");
        DiamondCutFacet(address(diamond)).diamondCut(cuts, address(0), "");

        // Initialize the issuer
        console.log("Initializing issuer");
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
