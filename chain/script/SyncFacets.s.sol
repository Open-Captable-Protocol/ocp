// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import { IDiamondCut } from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { IDiamondLoupe } from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";
import { LibDeployment } from "./DeployFactory.s.sol";
import { DiamondLoupeFacet } from "diamond-3-hardhat/facets/DiamondLoupeFacet.sol";
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

library FacetHelper {
    enum ChangeType {
        Update,
        Add,
        Remove
    }

    struct FacetChange {
        bytes4 selector;
        address currentAddress;
        address newAddress;
        ChangeType changeType;
        bytes32 localCodeHash;
        bytes32 remoteCodeHash;
    }

    // Instead of mapping, use arrays and addresses
    struct BytecodeHash {
        address facetAddress;
        bytes32 hash;
    }

    function getFacetSelectors(
        IDiamondLoupe.Facet[] memory facets,
        bytes4 selector
    )
        internal
        pure
        returns (bytes4[] memory)
    {
        for (uint256 i = 0; i < facets.length; i++) {
            if (facets[i].functionSelectors[0] == selector) {
                return facets[i].functionSelectors;
            }
        }
        revert("Facet not found");
    }

    function getFacetBytecode(address facet) internal view returns (bytes memory) {
        uint256 size;
        assembly {
            size := extcodesize(facet)
        }
        bytes memory code = new bytes(size);
        assembly {
            extcodecopy(facet, add(code, 0x20), 0, size)
        }
        return code;
    }

    function getHashes(IDiamondLoupe.Facet[] memory facets) internal view returns (FacetHelper.BytecodeHash[] memory) {
        FacetHelper.BytecodeHash[] memory hashes = new FacetHelper.BytecodeHash[](facets.length);

        for (uint256 i = 0; i < facets.length; i++) {
            bytes memory code = FacetHelper.getFacetBytecode(facets[i].facetAddress);
            hashes[i] = FacetHelper.BytecodeHash({ facetAddress: facets[i].facetAddress, hash: keccak256(code) });
        }
        return hashes;
    }

    function getHash(BytecodeHash[] memory hashes, address facetAddress) internal pure returns (bytes32) {
        for (uint256 i = 0; i < hashes.length; i++) {
            if (hashes[i].facetAddress == facetAddress) {
                return hashes[i].hash;
            }
        }
        return bytes32(0);
    }

    function detectChanges(
        IDiamondLoupe.Facet[] memory localFacets,
        IDiamondLoupe.Facet[] memory deployedFacets,
        BytecodeHash[] memory localHashes,
        BytecodeHash[] memory remoteHashes
    )
        internal
        view
        returns (FacetChange[] memory changes, uint256 changeCount)
    {
        changes = new FacetChange[](localFacets.length + deployedFacets.length);

        // Compare facets
        for (uint256 i = 0; i < deployedFacets.length; i++) {
            // Skip diamond cut facet
            if (deployedFacets[i].functionSelectors[0] == IDiamondCut.diamondCut.selector) {
                console.log("Skipping DiamondCut facet");
                continue;
            }

            // Find matching facet by first selector
            bool found = false;
            for (uint256 j = 0; j < localFacets.length; j++) {
                if (deployedFacets[i].functionSelectors[0] == localFacets[j].functionSelectors[0]) {
                    found = true;

                    // Check if selectors match exactly
                    bool selectorsMatch =
                        deployedFacets[i].functionSelectors.length == localFacets[j].functionSelectors.length;
                    if (selectorsMatch) {
                        for (uint256 k = 0; k < deployedFacets[i].functionSelectors.length; k++) {
                            if (deployedFacets[i].functionSelectors[k] != localFacets[j].functionSelectors[k]) {
                                selectorsMatch = false;
                                break;
                            }
                        }
                    }

                    // Force update if selectors don't match or if code hash is different
                    bytes32 localHash = getHash(localHashes, localFacets[j].facetAddress);
                    bytes32 remoteHash = getHash(remoteHashes, deployedFacets[i].facetAddress);

                    if (!selectorsMatch || localHash != remoteHash) {
                        LibDeployment.FacetType facetType =
                            LibDeployment.getFacetTypeFromSelector(deployedFacets[i].functionSelectors[0]);
                        string memory facetName = LibDeployment.getFacetCutInfo(facetType).name;
                        console.log(
                            "\nForce updating facet",
                            facetName,
                            "due to:",
                            !selectorsMatch ? "selector mismatch" : "code change"
                        );

                        changes[changeCount] = FacetChange({
                            selector: deployedFacets[i].functionSelectors[0],
                            currentAddress: deployedFacets[i].facetAddress,
                            newAddress: localFacets[j].facetAddress,
                            changeType: ChangeType.Update,
                            localCodeHash: localHash,
                            remoteCodeHash: remoteHash
                        });
                        changeCount++;
                    }
                    break;
                }
            }

            // If not found in local, it needs to be removed
            if (!found) {
                changes[changeCount] = FacetChange({
                    selector: deployedFacets[i].functionSelectors[0],
                    currentAddress: deployedFacets[i].facetAddress,
                    newAddress: address(0),
                    changeType: ChangeType.Remove,
                    localCodeHash: bytes32(0),
                    remoteCodeHash: bytes32(0)
                });
                changeCount++;
            }
        }

        // Check for new facets
        for (uint256 i = 0; i < localFacets.length; i++) {
            if (localFacets[i].functionSelectors[0] == IDiamondCut.diamondCut.selector) {
                continue;
            }

            bool exists = false;
            for (uint256 j = 0; j < deployedFacets.length; j++) {
                if (localFacets[i].functionSelectors[0] == deployedFacets[j].functionSelectors[0]) {
                    exists = true;
                    break;
                }
            }

            if (!exists) {
                changes[changeCount] = FacetChange({
                    selector: localFacets[i].functionSelectors[0],
                    currentAddress: address(0),
                    newAddress: localFacets[i].facetAddress,
                    changeType: ChangeType.Add,
                    localCodeHash: bytes32(0),
                    remoteCodeHash: bytes32(0)
                });
                changeCount++;
            }
        }
    }
}

contract SyncFacetsScript is Script {
    using FacetHelper for *;
    using LibDeployment for *;

    // Core facet operations
    function addFacet(address diamond, address newFacet, bytes4[] memory selectors) public {
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: newFacet,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: selectors
        });
        IDiamondCut(diamond).diamondCut(cut, address(0), "");
    }

    function replaceFacet(address diamond, address newFacet, bytes4[] memory selectors) public {
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: newFacet,
            action: IDiamondCut.FacetCutAction.Replace,
            functionSelectors: selectors
        });

        try IDiamondCut(diamond).diamondCut(cut, address(0), "") {
            console.log("Facet replaced successfully");
        } catch Error(string memory reason) {
            console.log("Failed to replace facet:", reason);
            revert(reason);
        } catch (bytes memory) {
            console.log("Failed to replace facet (no reason)");
            revert("Unknown error during facet replacement");
        }
    }

    function removeFacet(address diamond, bytes4[] memory selectors) public {
        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: address(0),
            action: IDiamondCut.FacetCutAction.Remove,
            functionSelectors: selectors
        });
        IDiamondCut(diamond).diamondCut(cut, address(0), "");
    }

    function processChanges(
        FacetHelper.FacetChange memory change,
        address referenceDiamond,
        IDiamondLoupe.Facet[] memory deployedFacets,
        IDiamondLoupe.Facet[] memory localFacets
    )
        internal
    {
        LibDeployment.FacetType facetType = LibDeployment.getFacetTypeFromSelector(change.selector);
        string memory facetName = LibDeployment.getFacetCutInfo(facetType).name;

        if (change.changeType == FacetHelper.ChangeType.Remove) {
            console.log("\nRemoving facet:", facetName);
            bytes4[] memory selectors = FacetHelper.getFacetSelectors(deployedFacets, change.selector);
            removeFacet(referenceDiamond, selectors);
        } else if (change.changeType == FacetHelper.ChangeType.Add) {
            console.log("\nAdding facet:", facetName);
            address newFacet = LibDeployment.deployFacet(facetType);
            bytes4[] memory selectors = FacetHelper.getFacetSelectors(localFacets, change.selector);
            addFacet(referenceDiamond, newFacet, selectors);
        } else if (change.changeType == FacetHelper.ChangeType.Update) {
            console.log("\nUpdating facet:", facetName);
            address newFacet = LibDeployment.deployFacet(facetType);
            bytes4[] memory selectors = FacetHelper.getFacetSelectors(deployedFacets, change.selector);
            replaceFacet(referenceDiamond, newFacet, selectors);
        }
    }

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address referenceDiamond = vm.envAddress("REFERENCE_DIAMOND");
        string memory LOCAL_RPC = vm.envOr("LOCAL_RPC", string("http://localhost:8546"));
        string memory REMOTE_RPC = vm.envOr("REMOTE_RPC", string("http://localhost:8545"));
        console.log("LOCAL_RPC: %s", LOCAL_RPC);
        console.log("REMOTE_RPC: %s", REMOTE_RPC);

        // Deploy locally to get latest implementations
        uint256 localFork = vm.createFork(LOCAL_RPC);
        vm.selectFork(localFork);
        address localDiamond = LibDeployment.deployInitialFacets(address(this));
        IDiamondLoupe.Facet[] memory localFacets = IDiamondLoupe(localDiamond).facets();
        console.log("\nNumber of local facets: ", localFacets.length);

        // Get deployed facets from remote
        uint256 remoteFork = vm.createFork(REMOTE_RPC);
        vm.selectFork(remoteFork);
        IDiamondLoupe.Facet[] memory deployedFacets = IDiamondLoupe(referenceDiamond).facets();
        console.log("Number of deployed facets: ", deployedFacets.length);

        // Pre-compute all bytecode hashes once
        vm.selectFork(localFork);
        FacetHelper.BytecodeHash[] memory localHashes = FacetHelper.getHashes(localFacets);
        vm.selectFork(remoteFork);
        FacetHelper.BytecodeHash[] memory remoteHashes = FacetHelper.getHashes(deployedFacets);

        // Now we can do pure comparison
        (FacetHelper.FacetChange[] memory changes, uint256 changeCount) =
            FacetHelper.detectChanges(localFacets, deployedFacets, localHashes, remoteHashes);

        if (changeCount > 0) {
            console.log("\n=== Processing Changes ===");
            vm.selectFork(remoteFork);
            vm.startBroadcast(deployerPrivateKey);

            for (uint256 i = 0; i < changeCount; i++) {
                processChanges(changes[i], referenceDiamond, deployedFacets, localFacets);
            }

            vm.stopBroadcast();
            console.log("\n=== Changes Completed ===");
        }
    }
}
