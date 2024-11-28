// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {CapTableFactory} from "@core/CapTableFactory.sol";
import {IDiamondLoupe} from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";
import {DiamondCutFacet} from "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import {IDiamondCut} from "diamond-3-hardhat/interfaces/IDiamondCut.sol";

contract SyncDiamondsScript is Script {
    function syncDiamond(address targetDiamond, address referenceDiamond) public {
        IDiamondLoupe loupe = IDiamondLoupe(referenceDiamond);
        IDiamondLoupe targetLoupe = IDiamondLoupe(targetDiamond);

        // Get all facets from reference
        IDiamondLoupe.Facet[] memory referenceFacets = loupe.facets();

        // Get all facets from target
        IDiamondLoupe.Facet[] memory targetFacets = targetLoupe.facets();

        console.log("target facets length: ", targetFacets.length);
        console.log("reference facets length: ", referenceFacets.length);

        // Compare and create necessary cuts
        for (uint256 i = 0; i < referenceFacets.length; i++) {
            address refFacetAddr = referenceFacets[i].facetAddress;
            bytes4[] memory refSelectors = referenceFacets[i].functionSelectors;

            // Check if any of these selectors already exist in target
            bool[] memory selectorExists = new bool[](refSelectors.length);
            uint256 newSelectorsCount = 0;

            for (uint256 k = 0; k < refSelectors.length; k++) {
                bytes4 selector = refSelectors[k];
                bool exists = false;

                // Check if selector exists in any target facet
                for (uint256 j = 0; j < targetFacets.length; j++) {
                    bytes4[] memory targetSelectors = targetFacets[j].functionSelectors;
                    for (uint256 m = 0; m < targetSelectors.length; m++) {
                        if (targetSelectors[m] == selector) {
                            exists = true;
                            break;
                        }
                    }
                    if (exists) break;
                }

                selectorExists[k] = exists;
                if (!exists) newSelectorsCount++;
            }

            // If we found new selectors, add them
            if (newSelectorsCount > 0) {
                bytes4[] memory newSelectors = new bytes4[](newSelectorsCount);
                uint256 index = 0;
                for (uint256 k = 0; k < refSelectors.length; k++) {
                    if (!selectorExists[k]) {
                        newSelectors[index] = refSelectors[k];
                        console.log("Adding selector:", uint32(refSelectors[k]));
                        index++;
                    }
                }

                console.log("Adding", newSelectorsCount, "new selectors for facet:", refFacetAddr);
                IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
                cut[0] = IDiamondCut.FacetCut({
                    facetAddress: refFacetAddr,
                    action: IDiamondCut.FacetCutAction.Add,
                    functionSelectors: newSelectors
                });
                DiamondCutFacet(targetDiamond).diamondCut(cut, address(0), "");
                console.log("Successfully added selectors");
            }
        }
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address referenceDiamond = vm.envAddress("REFERENCE_DIAMOND");
        address factory = vm.envAddress("FACTORY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);

        // Get all deployed cap tables
        CapTableFactory capTableFactory = CapTableFactory(factory);
        uint256 count = capTableFactory.getCapTableCount();

        // Sync each cap table
        for (uint256 i = 0; i < count; i++) {
            address capTable = capTableFactory.capTables(i);
            syncDiamond(capTable, referenceDiamond);
            console.log("Synced cap table:", capTable);
        }

        vm.stopBroadcast();
    }
}
