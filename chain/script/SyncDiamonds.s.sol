// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import { CapTableFactory } from "@core/CapTableFactory.sol";
import { IDiamondLoupe } from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";
import { DiamondCutFacet } from "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import { IDiamondCut } from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { CapTable } from "@core/CapTable.sol";
import { SyncFacetsScript, FacetHelper } from "./SyncFacets.s.sol";

contract SyncDiamondsScript is Script, SyncFacetsScript {
    function run() external override {
        console.log("SyncDiamondsScript started");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address referenceDiamond = vm.envAddress("REFERENCE_DIAMOND");
        address factory = vm.envAddress("FACTORY_ADDRESS");

        // Get all deployed cap tables
        CapTableFactory capTableFactory = CapTableFactory(factory);
        uint256 count = capTableFactory.getCapTableCount();

        // Get reference diamond facets and hashes
        IDiamondLoupe.Facet[] memory referenceFacets = IDiamondLoupe(referenceDiamond).facets();
        FacetHelper.BytecodeHash[] memory referenceHashes = FacetHelper.getHashes(referenceFacets);

        vm.startBroadcast(deployerPrivateKey);

        // Sync each cap table using the same logic as SyncFacets
        for (uint256 i = 0; i < count; i++) {
            address capTable = capTableFactory.capTables(i);
            if (capTable == address(0)) continue; // Skip zero addresses
            console.log("\nSyncing cap table:", capTable);

            // Get target facets and hashes
            IDiamondLoupe.Facet[] memory targetFacets = IDiamondLoupe(capTable).facets();
            FacetHelper.BytecodeHash[] memory targetHashes = FacetHelper.getHashes(targetFacets);

            // Detect and apply changes
            (FacetHelper.FacetChange[] memory changes, uint256 changeCount) =
                FacetHelper.detectChanges(referenceFacets, targetFacets, referenceHashes, targetHashes);

            if (changeCount > 0) {
                for (uint256 j = 0; j < changeCount; j++) {
                    processChanges(changes[j], capTable, targetFacets, referenceFacets);
                }
                console.log("Cap table updated successfully");
            } else {
                console.log("Cap table already in sync");
            }
        }

        vm.stopBroadcast();
        console.log("\nSyncDiamondsScript completed");
    }
}
