// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IDiamondLoupe } from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";
import { IDiamondCut } from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { IIssuerFacet } from "@interfaces/IIssuerFacet.sol";
import { IAccessControlFacet } from "@interfaces/IAccessControlFacet.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { ICapTableInitializer } from "@interfaces/ICapTableInitializer.sol";
import { CapTable } from "./CapTable.sol";

contract CapTableInitializer is ICapTableInitializer {
    address public immutable referenceDiamond;

    constructor(address _referenceDiamond) {
        require(_referenceDiamond != address(0), "Invalid referenceDiamond");
        referenceDiamond = _referenceDiamond;
    }

    function initialize(address diamond, bytes16 id, uint256 initialSharesAuthorized, address owner) external {
        // Get facet information from reference diamond
        IDiamondLoupe loupe = IDiamondLoupe(referenceDiamond);
        IDiamondLoupe.Facet[] memory existingFacets = loupe.facets();

        // Create cuts array for all facets except DiamondCut
        IDiamondCut.FacetCut[] memory cuts = new IDiamondCut.FacetCut[](existingFacets.length - 1);
        uint256 cutIndex = 0;

        for (uint256 i = 0; i < existingFacets.length; i++) {
            bytes4 firstSelector = existingFacets[i].functionSelectors[0];
            // Skip if this is the DiamondCut facet
            if (firstSelector != IDiamondCut.diamondCut.selector) {
                cuts[cutIndex] = IDiamondCut.FacetCut({
                    facetAddress: existingFacets[i].facetAddress,
                    action: IDiamondCut.FacetCutAction.Add,
                    functionSelectors: existingFacets[i].functionSelectors
                });
                cutIndex++;
            }
        }

        // Perform the cuts
        IDiamondCut(diamond).diamondCut(cuts, address(0), "");

        // Initialize access control first - this makes the factory the admin
        IAccessControlFacet(diamond).initializeAccessControl();

        // Grant the diamond the OPERATOR_ROLE - Necessary for the NFT facet to work
        IAccessControlFacet(diamond).grantRole(AccessControl.OPERATOR_ROLE, diamond);

        // Initialize the issuer
        IIssuerFacet(diamond).initializeIssuer(id, initialSharesAuthorized);

        // Transfer Diamond ownership to owner
        CapTable(payable(diamond)).transferOwner(owner);
        // Transfer AccessControlFacet admin to owner
        IAccessControlFacet(diamond).transferAdmin(owner);
    }
}
