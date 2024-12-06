// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { CapTable } from "./CapTable.sol";
import { IDiamondLoupe } from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";
import { DiamondCutFacet } from "@facets/DiamondCutFacet.sol";
import { IDiamondCut } from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { IssuerFacet } from "@facets/IssuerFacet.sol";
import { StakeholderFacet } from "@facets/StakeholderFacet.sol";
import { StockClassFacet } from "@facets/StockClassFacet.sol";
import { StockFacet } from "@facets/StockFacet.sol";
import { ConvertiblesFacet } from "@facets/ConvertiblesFacet.sol";
import { EquityCompensationFacet } from "@facets/EquityCompensationFacet.sol";
import { StockPlanFacet } from "@facets/StockPlanFacet.sol";
import { WarrantFacet } from "@facets/WarrantFacet.sol";
import { StakeholderNFTFacet } from "@facets/StakeholderNFTFacet.sol";
import { AccessControlFacet } from "@facets/AccessControlFacet.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import "forge-std/console.sol";

contract CapTableFactory {
    event CapTableCreated(address indexed capTable, bytes16 indexed issuerId);

    address public newAdmin; // new admin to transfer ownership to

    address[] public capTables;

    // Reference diamond to copy facets from
    address public immutable referenceDiamond;

    constructor(address _newAdmin, address _referenceDiamond) {
        require(_newAdmin != address(0), "Invalid new admin");
        require(_referenceDiamond != address(0), "Invalid referenceDiamond");
        referenceDiamond = _referenceDiamond;
        newAdmin = _newAdmin;
    }

    function createCapTable(bytes16 id, uint256 initialSharesAuthorized) external returns (address) {
        require(id != bytes16(0) && initialSharesAuthorized != 0, "Invalid issuer params");

        console.log("createCapTable");
        console.log("msg.sender: ", msg.sender);
        console.log("address(this): ", address(this));

        // Deploy new DiamondCutFacet
        DiamondCutFacet diamondCutFacet = new DiamondCutFacet();

        // Make the factory the owner
        CapTable diamond = new CapTable(address(diamondCutFacet));

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

        console.log("Starting access control initialization");
        // Initialize access control first - this makes the factory the admin
        AccessControlFacet(address(diamond)).initializeAccessControl();

        // Since factory is now admin, it can grant roles to newAdmin and diamond
        // console.log("Granting newAdmin DEFAULT_ADMIN_ROLE");
        // console.log("newAdmin: ", newAdmin);
        AccessControlFacet(address(diamond)).grantRole(AccessControl.OPERATOR_ROLE, address(diamond));

        // Initialize the issuer
        console.log("Initializing issuer");
        IssuerFacet(address(diamond)).initializeIssuer(id, initialSharesAuthorized);

        // Store the new cap table
        capTables.push(address(diamond));

        emit CapTableCreated(address(diamond), id);
        console.log("newAdmin: ", newAdmin);
        console.log("msg.sender: ", msg.sender);
        console.log("address(this): ", address(this));

        // Only transfer admin if newAdmin is not the same as msg.sender
        AccessControlFacet(address(diamond)).transferAdmin(newAdmin);
        return address(diamond);
    }

    function getCapTableCount() external view returns (uint256) {
        return capTables.length;
    }

    // Only factory admin can change the new admin address
    function setNewAdmin(address _newAdmin) external {
        require(_newAdmin != address(0), "Invalid new admin");
        // Add access control if needed
        newAdmin = _newAdmin;
    }
}
