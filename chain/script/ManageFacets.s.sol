// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import { IDiamondCut } from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { DiamondCutFacet } from "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import { IDiamondLoupe } from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";

contract ManagerFacetScript is Script {
    function addFacet(address diamond, address newFacet, bytes4[] memory selectors) public {
        // Create the cut struct
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: newFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: selectors
        });

        // Perform the cut
        console.log("facets length before: ", IDiamondLoupe(diamond).facets().length);
        DiamondCutFacet(diamond).diamondCut(cut, address(0), "");
        console.log("facets length after: ", IDiamondLoupe(diamond).facets().length);
    }

    function replaceFacet(address diamond, address newFacet, bytes4[] memory selectors) public {
        // Create the cut struct
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: newFacet,
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: selectors
        });

        // Perform the cut
        DiamondCutFacet(diamond).diamondCut(cut, address(0), "");
    }

    function removeFacet(address diamond, bytes4[] memory selectors) public {
        // Create the cut struct
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: address(0),
            action: IDiamondCut.FacetCutAction.Remove,
            functionSelectors: selectors
        });

        // Perform the cut
        DiamondCutFacet(diamond).diamondCut(cut, address(0), "");
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address referenceDiamond = vm.envAddress("REFERENCE_DIAMOND");
        if (deployerPrivateKey == 0) {
            revert("Missing PRIVATE_KEY in .env");
        }

        if (referenceDiamond == address(0)) {
            revert("Missing REFERENCE_DIAMOND in .env");
        }
        vm.startBroadcast(deployerPrivateKey);

        // Example: Deploy and add new facet
        // NewFacet newFacet = new NewFacet();
        // bytes4[] memory selectors = new bytes4[](1);
        // selectors[0] = NewFacet.newFunction.selector;
        // addFacet(referenceDiamond, address(newFacet), selectors);

        vm.stopBroadcast();
    }
}
