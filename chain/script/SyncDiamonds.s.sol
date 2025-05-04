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
import { LibDeployment } from "./DeployFactory.s.sol";

contract SyncDiamondsScript is Script, SyncFacetsScript {
    using LibDeployment for *;

    function syncCapTable(address capTable) internal {
        address referenceDiamond = vm.envAddress("REFERENCE_DIAMOND");
        console.log("\nSyncing cap table:", capTable);

        // Get facets from reference diamond
        IDiamondLoupe.Facet[] memory referenceFacets = IDiamondLoupe(referenceDiamond).facets();

        // Get facets from cap table
        IDiamondLoupe.Facet[] memory capTableFacets = IDiamondLoupe(capTable).facets();

        // For each facet in reference diamond
        for (uint256 i = 0; i < referenceFacets.length; i++) {
            // Skip diamond cut facet
            if (referenceFacets[i].functionSelectors[0] == IDiamondCut.diamondCut.selector) {
                console.log("Skipping DiamondCut facet");
                continue;
            }

            // Find matching facet in cap table
            bool found = false;
            for (uint256 j = 0; j < capTableFacets.length; j++) {
                if (referenceFacets[i].functionSelectors[0] == capTableFacets[j].functionSelectors[0]) {
                    found = true;

                    // Check if facet address or selectors are different
                    bool needsUpdate = referenceFacets[i].facetAddress != capTableFacets[j].facetAddress;

                    // Check if selectors match exactly
                    bool selectorsMatch =
                        referenceFacets[i].functionSelectors.length == capTableFacets[j].functionSelectors.length;
                    if (selectorsMatch) {
                        for (uint256 k = 0; k < referenceFacets[i].functionSelectors.length; k++) {
                            if (referenceFacets[i].functionSelectors[k] != capTableFacets[j].functionSelectors[k]) {
                                selectorsMatch = false;
                                break;
                            }
                        }
                    }

                    if (!selectorsMatch || needsUpdate) {
                        LibDeployment.FacetType facetType =
                            LibDeployment.getFacetTypeFromSelector(referenceFacets[i].functionSelectors[0]);
                        string memory facetName = LibDeployment.getFacetCutInfo(facetType).name;
                        console.log(
                            "\nChange detected in facet",
                            facetName,
                            "due to:",
                            !selectorsMatch ? "selector mismatch" : "address mismatch"
                        );
                        console.log("\nUpdating facet:", facetName);

                        // Deploy new facet
                        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
                        address newFacet = LibDeployment.deployFacet(facetType);
                        vm.stopBroadcast();

                        console.log("New facet deployed at:", newFacet);

                        // Find new selectors that don't exist in current selectors
                        bytes4[] memory newSelectors = new bytes4[](referenceFacets[i].functionSelectors.length);
                        uint256 newSelectorCount = 0;

                        for (uint256 k = 0; k < referenceFacets[i].functionSelectors.length; k++) {
                            bool exists = false;
                            for (uint256 l = 0; l < capTableFacets[j].functionSelectors.length; l++) {
                                if (referenceFacets[i].functionSelectors[k] == capTableFacets[j].functionSelectors[l]) {
                                    exists = true;
                                    break;
                                }
                            }
                            if (!exists) {
                                newSelectors[newSelectorCount] = referenceFacets[i].functionSelectors[k];
                                newSelectorCount++;
                            }
                        }

                        // Add new selectors if any
                        if (newSelectorCount > 0) {
                            // Resize array to actual count
                            bytes4[] memory finalNewSelectors = new bytes4[](newSelectorCount);
                            for (uint256 k = 0; k < newSelectorCount; k++) {
                                finalNewSelectors[k] = newSelectors[k];
                            }

                            vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
                            IDiamondCut.FacetCut[] memory addCut = new IDiamondCut.FacetCut[](1);
                            addCut[0] = IDiamondCut.FacetCut({
                                facetAddress: newFacet,
                                action: IDiamondCut.FacetCutAction.Add,
                                functionSelectors: finalNewSelectors
                            });
                            IDiamondCut(capTable).diamondCut(addCut, address(0), "");
                            vm.stopBroadcast();
                            console.log("New selectors added successfully");
                        }

                        // Replace existing selectors
                        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
                        IDiamondCut.FacetCut[] memory replaceCut = new IDiamondCut.FacetCut[](1);
                        replaceCut[0] = IDiamondCut.FacetCut({
                            facetAddress: newFacet,
                            action: IDiamondCut.FacetCutAction.Replace,
                            functionSelectors: capTableFacets[j].functionSelectors
                        });
                        IDiamondCut(capTable).diamondCut(replaceCut, address(0), "");
                        vm.stopBroadcast();
                        console.log("Existing selectors replaced successfully");
                    }
                    break;
                }
            }
        }
        console.log("Cap table updated successfully");
    }

    function run() external override {
        console.log("SyncDiamondsScript started");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address factory = vm.envAddress("FACTORY_ADDRESS");

        vm.startBroadcast(deployerPrivateKey);
        uint256 capTableCount = CapTableFactory(factory).getCapTableCount();
        vm.stopBroadcast();

        for (uint256 i = 0; i < capTableCount; i++) {
            vm.startBroadcast(deployerPrivateKey);
            address capTable = CapTableFactory(factory).capTables(i);
            vm.stopBroadcast();
            syncCapTable(capTable);
        }

        console.log("\nSyncDiamondsScript completed");
    }

    struct CapTableChanges {
        address capTable;
        FacetHelper.FacetChange[] changes;
        uint256 changeCount;
    }

    function detectOutOfSyncCapTables() external returns (CapTableChanges[] memory, uint256) {
        address referenceDiamond = vm.envAddress("REFERENCE_DIAMOND");
        address factory = vm.envAddress("FACTORY_ADDRESS");

        console.log("Using factory address:", factory);

        // Get all deployed cap tables
        CapTableFactory capTableFactory = CapTableFactory(factory);

        uint256 count = capTableFactory.getCapTableCount();

        // Get reference diamond facets and hashes
        IDiamondLoupe.Facet[] memory referenceFacets = IDiamondLoupe(referenceDiamond).facets();
        FacetHelper.BytecodeHash[] memory referenceHashes = FacetHelper.getHashes(referenceFacets);

        // Pre-allocate max possible size
        CapTableChanges[] memory outOfSync = new CapTableChanges[](count);
        uint256 outOfSyncCount = 0;

        // Check each cap table
        for (uint256 i = 0; i < count; i++) {
            address capTable = capTableFactory.capTables(i);
            if (capTable == address(0)) {
                console.log("Skipping zero address cap table at index %d", i);
                continue;
            }

            // Get target facets and hashes
            IDiamondLoupe.Facet[] memory targetFacets = IDiamondLoupe(capTable).facets();
            FacetHelper.BytecodeHash[] memory targetHashes = FacetHelper.getHashes(targetFacets);

            // Detect changes
            (FacetHelper.FacetChange[] memory changes, uint256 changeCount) =
                FacetHelper.detectChanges(referenceFacets, targetFacets, referenceHashes, targetHashes);

            if (changeCount > 0) {
                outOfSync[outOfSyncCount] =
                    CapTableChanges({ capTable: capTable, changes: changes, changeCount: changeCount });
                outOfSyncCount++;

                // Log changes for this cap table
                console.log("\nCap table out of sync:", capTable);
                for (uint256 j = 0; j < changeCount; j++) {
                    FacetHelper.FacetChange memory change = changes[j];
                    string memory changeTypeStr = change.changeType == FacetHelper.ChangeType.Add
                        ? "Add"
                        : change.changeType == FacetHelper.ChangeType.Update ? "Update" : "Remove";

                    // Get facet type and name
                    LibDeployment.FacetType facetType = LibDeployment.getFacetTypeFromSelector(change.selector);
                    string memory facetName = LibDeployment.getFacetCutInfo(facetType).name;

                    console.log(
                        string.concat(changeTypeStr, " ", facetName, ":"),
                        change.newAddress == address(0) ? change.currentAddress : change.newAddress
                    );
                    console.log("  Function:", facetName);
                }
            }
        }

        return (outOfSync, outOfSyncCount);
    }
}
