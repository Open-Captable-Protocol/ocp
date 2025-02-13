// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { CapTable } from "./CapTable.sol";
import { IDiamondLoupe } from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";
import { DiamondCutFacet } from "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import { IDiamondCut } from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { IssuerFacet } from "@facets/IssuerFacet.sol";
import { AccessControlFacet } from "@facets/AccessControlFacet.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { Ownable } from "openzeppelin-contracts/contracts/access/Ownable.sol";
import { DiamondLoupeFacet } from "diamond-3-hardhat/facets/DiamondLoupeFacet.sol";

contract CapTableFactory is Ownable {
    event CapTableCreated(address indexed capTable, bytes16 indexed issuerId);

    address[] public capTables;

    // Reference diamond to copy facets from
    address public immutable referenceDiamond;

    constructor(address _referenceDiamond) {
        require(_referenceDiamond != address(0), "Invalid referenceDiamond");
        referenceDiamond = _referenceDiamond;
    }

    function createCapTable(bytes16 id, uint256 initialSharesAuthorized) external onlyOwner returns (address) {
        require(id != bytes16(0) && initialSharesAuthorized != 0, "Invalid issuer params");

        // Get DiamondCutFacet address from reference diamond using loupe
        DiamondLoupeFacet loupe = DiamondLoupeFacet(referenceDiamond);
        address diamondCutFacet = loupe.facetAddress(IDiamondCut.diamondCut.selector);

        // Create CapTable with factory as initial owner
        CapTable diamond = new CapTable(address(this), diamondCutFacet);

        // Get facet information from reference diamond
        IDiamondLoupe.Facet[] memory existingFacets = loupe.facets();

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
        DiamondCutFacet(address(diamond)).diamondCut(cuts, address(0), "");

        // Initialize access control first - this makes the factory the admin
        AccessControlFacet(address(diamond)).initializeAccessControl();

        // Grant the diamond the OPERATOR_ROLE - Necessary for the NFT facet to work
        AccessControlFacet(address(diamond)).grantRole(AccessControl.OPERATOR_ROLE, address(diamond));

        // Initialize the issuer
        IssuerFacet(address(diamond)).initializeIssuer(id, initialSharesAuthorized);

        // Store the new cap table
        capTables.push(address(diamond));

        emit CapTableCreated(address(diamond), id);

        // Transfer Diamond ownership to msg.sender
        CapTable(payable(diamond)).transferOwner(msg.sender);
        // Transfer AccessControlFacet admin to msg.sender
        AccessControlFacet(address(diamond)).transferAdmin(msg.sender);

        return address(diamond);
    }

    function getCapTableCount() external view returns (uint256) {
        return capTables.length;
    }
}
