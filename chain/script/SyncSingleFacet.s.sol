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

contract SyncSingleFacetScript is Script {
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

    function upgradeSingleFacet(LibDeployment.FacetType facetType) public {
        address referenceDiamond = vm.envAddress("REFERENCE_DIAMOND");
        // solhint-disable func-name-mixedcase
        string memory RPC_URL = vm.envOr("RPC_URL", string("http://localhost:8545"));
        console.log("RPC_URL: %s", RPC_URL);

        // Get deployed facets
        uint256 fork = vm.createFork(RPC_URL);
        vm.selectFork(fork);
        IDiamondLoupe.Facet[] memory deployedFacets = IDiamondLoupe(referenceDiamond).facets();

        // Find the facet we want to upgrade
        bytes4 targetSelector = LibDeployment.getFacetCutInfo(facetType).selectors[0];
        address currentFacetAddress = address(0);
        bytes4[] memory currentSelectors;

        // Find current facet address and selectors
        for (uint256 i = 0; i < deployedFacets.length; i++) {
            if (deployedFacets[i].functionSelectors[0] == targetSelector) {
                currentFacetAddress = deployedFacets[i].facetAddress;
                currentSelectors = deployedFacets[i].functionSelectors;
                break;
            }
        }

        if (currentFacetAddress == address(0)) {
            revert("Facet not found in deployed diamond");
        }

        // Deploy new facet on the same chain
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
        address newFacet = LibDeployment.deployFacet(facetType);
        vm.stopBroadcast();

        console.log("New facet deployed at:", newFacet);

        // Verify the new facet has code
        uint256 codeSize;
        assembly {
            codeSize := extcodesize(newFacet)
        }
        require(codeSize > 0, "New facet has no code");

        // Get all selectors for the facet type
        LibDeployment.FacetCutInfo memory info = LibDeployment.getFacetCutInfo(facetType);

        // Find new selectors that don't exist in current selectors
        bytes4[] memory newSelectors = new bytes4[](info.selectors.length);
        uint256 newSelectorCount = 0;

        for (uint256 i = 0; i < info.selectors.length; i++) {
            bool exists = false;
            if (currentSelectors.length > 0) {
                for (uint256 j = 0; j < currentSelectors.length; j++) {
                    if (info.selectors[i] == currentSelectors[j]) {
                        exists = true;
                        break;
                    }
                }
            }
            if (!exists) {
                newSelectors[newSelectorCount] = info.selectors[i];
                newSelectorCount++;
            }
        }

        // Resize newSelectors array to actual count
        bytes4[] memory finalNewSelectors = new bytes4[](newSelectorCount);
        for (uint256 i = 0; i < newSelectorCount; i++) {
            finalNewSelectors[i] = newSelectors[i];
        }

        if (newSelectorCount > 0) {
            console.log("Adding new selectors...");
            vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
            addFacet(referenceDiamond, newFacet, finalNewSelectors);
            vm.stopBroadcast();
            console.log("New selectors added successfully");
        }

        if (currentSelectors.length > 0) {
            console.log("Replacing existing selectors...");
            vm.startBroadcast(vm.envUint("PRIVATE_KEY"));
            replaceFacet(referenceDiamond, newFacet, currentSelectors);
            vm.stopBroadcast();
            console.log("Existing selectors replaced successfully");
        }
    }

    function _getBytecode(address addr) internal view returns (bytes memory) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        bytes memory code = new bytes(size);
        assembly {
            extcodecopy(addr, add(code, 0x20), 0, size)
        }
        return code;
    }

    function run() external virtual {
        // Example usage:
        // forge script script/SyncSingleFacet.s.sol:SyncSingleFacetScript --sig "upgradeSingleFacet(uint8)" 4 --broadcast --rpc-url $RPC_URL
        // Where 4 is the enum value for StockFacet
        upgradeSingleFacet(LibDeployment.FacetType.Warrant);
    }
}
