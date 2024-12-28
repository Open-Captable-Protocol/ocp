// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import { MockFacet, MockFacetV2 } from "./mocks/MockFacet.sol";
import { SyncFacetsScript, FacetHelper } from "../script/SyncFacets.s.sol";
import { LibDeployment } from "../script/DeployFactory.s.sol";
import { IDiamondLoupe } from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";

contract SyncFacetsTest is Test, SyncFacetsScript {
    MockFacet public mockFacet;
    MockFacetV2 public mockFacetV2;
    address public contractOwner;
    address public localDiamond;
    address public remoteDiamond;

    function setUp() public {
        contractOwner = address(this);

        // Deploy two separate diamonds for comparison
        localDiamond = LibDeployment.deployInitialFacets(contractOwner);
        remoteDiamond = LibDeployment.deployInitialFacets(contractOwner);

        // Deploy mock facets
        mockFacet = new MockFacet();
        mockFacetV2 = new MockFacetV2();
    }

    enum MockFacetType {
        MockFacet,
        MockFacetV2
    }

    function getFacetCutInfo(MockFacetType facetType) internal pure returns (LibDeployment.FacetCutInfo memory info) {
        if (facetType == MockFacetType.MockFacet) {
            bytes4[] memory selectors = new bytes4[](1);
            selectors[0] = MockFacet.getValuePlusOne.selector;
            return LibDeployment.FacetCutInfo({ name: "MockFacet", selectors: selectors });
        }
        if (facetType == MockFacetType.MockFacetV2) {
            bytes4[] memory selectors = new bytes4[](1);
            selectors[0] = MockFacetV2.getValuePlusTwo.selector;
            return LibDeployment.FacetCutInfo({ name: "MockFacetV2", selectors: selectors });
        }
        revert("Unknown facet type");
    }

    function testDetectNoChanges() public {
        // Get facets from both diamonds
        IDiamondLoupe.Facet[] memory localFacets = IDiamondLoupe(localDiamond).facets();
        IDiamondLoupe.Facet[] memory remoteFacets = IDiamondLoupe(remoteDiamond).facets();

        // Get hashes
        FacetHelper.BytecodeHash[] memory localHashes = FacetHelper.getHashes(localFacets);
        FacetHelper.BytecodeHash[] memory remoteHashes = FacetHelper.getHashes(remoteFacets);

        // Detect changes
        (, uint256 changeCount) = FacetHelper.detectChanges(localFacets, remoteFacets, localHashes, remoteHashes);

        assertEq(changeCount, 0, "Should detect no changes between identical diamonds");
    }

    function testDetectAddedFacet() public {
        // Add mock facet to local diamond only
        bytes4[] memory selectors = getFacetCutInfo(MockFacetType.MockFacet).selectors;
        addFacet(localDiamond, address(mockFacet), selectors);

        // Get facets from both diamonds
        IDiamondLoupe.Facet[] memory localFacets = IDiamondLoupe(localDiamond).facets();
        IDiamondLoupe.Facet[] memory remoteFacets = IDiamondLoupe(remoteDiamond).facets();

        // Get hashes
        FacetHelper.BytecodeHash[] memory localHashes = FacetHelper.getHashes(localFacets);
        FacetHelper.BytecodeHash[] memory remoteHashes = FacetHelper.getHashes(remoteFacets);

        // Detect changes
        (FacetHelper.FacetChange[] memory changes, uint256 changeCount) =
            FacetHelper.detectChanges(localFacets, remoteFacets, localHashes, remoteHashes);

        assertTrue(changeCount > 0, "Should detect added facet");
        assertEq(uint8(changes[0].changeType), uint8(FacetHelper.ChangeType.Add), "Should be an Add change");
    }

    function testDetectUpdatedFacet() public {
        // First add the same facet to both diamonds
        bytes4[] memory selectors = getFacetCutInfo(MockFacetType.MockFacet).selectors;

        console.log("Adding to local diamond:", address(mockFacet));
        addFacet(localDiamond, address(mockFacet), selectors);

        console.log("Adding to remote diamond:", address(mockFacet));
        addFacet(remoteDiamond, address(mockFacet), selectors);

        console.log("Replacing in local diamond with:", address(mockFacetV2));
        replaceFacet(localDiamond, address(mockFacetV2), selectors);

        // Get facets and verify they exist
        IDiamondLoupe.Facet[] memory localFacets = IDiamondLoupe(localDiamond).facets();
        IDiamondLoupe.Facet[] memory remoteFacets = IDiamondLoupe(remoteDiamond).facets();

        // Get hashes
        FacetHelper.BytecodeHash[] memory localHashes = FacetHelper.getHashes(localFacets);
        FacetHelper.BytecodeHash[] memory remoteHashes = FacetHelper.getHashes(remoteFacets);

        // Print hashes for debugging
        for (uint256 i = 0; i < localHashes.length; i++) {
            console.log("Local hash for", localHashes[i].facetAddress, ":");
            console.logBytes32(localHashes[i].hash);
        }

        // Detect changes
        (FacetHelper.FacetChange[] memory changes, uint256 changeCount) =
            FacetHelper.detectChanges(localFacets, remoteFacets, localHashes, remoteHashes);

        console.log("changeCount", changeCount);

        assertTrue(changeCount > 0, "Should detect updated facet");
        assertEq(uint8(changes[0].changeType), uint8(FacetHelper.ChangeType.Update), "Should be an Update change");
        assertEq(changes[0].currentAddress, address(mockFacet), "Current address should be original facet");
        assertEq(changes[0].newAddress, address(mockFacetV2), "New address should be updated facet");
    }

    function testDetectRemovedFacet() public {
        // Add facet only to remote diamond (so it will be detected as needing removal)
        bytes4[] memory selectors = getFacetCutInfo(MockFacetType.MockFacet).selectors;
        addFacet(remoteDiamond, address(mockFacet), selectors);

        // Get facets from both diamonds
        IDiamondLoupe.Facet[] memory localFacets = IDiamondLoupe(localDiamond).facets();
        IDiamondLoupe.Facet[] memory remoteFacets = IDiamondLoupe(remoteDiamond).facets();

        // Get hashes
        FacetHelper.BytecodeHash[] memory localHashes = FacetHelper.getHashes(localFacets);
        FacetHelper.BytecodeHash[] memory remoteHashes = FacetHelper.getHashes(remoteFacets);

        // Detect changes
        (FacetHelper.FacetChange[] memory changes, uint256 changeCount) =
            FacetHelper.detectChanges(localFacets, remoteFacets, localHashes, remoteHashes);

        assertTrue(changeCount > 0, "Should detect removed facet");
        assertEq(uint8(changes[0].changeType), uint8(FacetHelper.ChangeType.Remove), "Should be a Remove change");
        assertEq(changes[0].currentAddress, address(mockFacet), "Current address should be the facet to remove");
    }

    function testEndToEndSync() public {
        // Add mock facet to local diamond
        bytes4[] memory selectors = getFacetCutInfo(MockFacetType.MockFacetV2).selectors;

        console.log("Adding to local diamond:", address(mockFacetV2));
        addFacet(localDiamond, address(mockFacetV2), selectors);

        // Get initial state
        IDiamondLoupe.Facet[] memory localFacets = IDiamondLoupe(localDiamond).facets();
        IDiamondLoupe.Facet[] memory remoteFacets = IDiamondLoupe(remoteDiamond).facets();

        // Get hashes
        FacetHelper.BytecodeHash[] memory localHashes = FacetHelper.getHashes(localFacets);
        FacetHelper.BytecodeHash[] memory remoteHashes = FacetHelper.getHashes(remoteFacets);

        // Detect changes
        (FacetHelper.FacetChange[] memory changes, uint256 changeCount) =
            FacetHelper.detectChanges(localFacets, remoteFacets, localHashes, remoteHashes);

        // Process changes
        assertTrue(changeCount > 0, "Should detect changes");

        for (uint256 i = 0; i < changeCount; i++) {
            processChanges(changes[i], remoteDiamond, remoteFacets, localFacets);
        }

        // Verify sync
        IDiamondLoupe.Facet[] memory updatedRemoteFacets = IDiamondLoupe(remoteDiamond).facets();
        FacetHelper.BytecodeHash[] memory updatedRemoteHashes = FacetHelper.getHashes(updatedRemoteFacets);

        // Check no more changes needed
        (, uint256 remainingChanges) =
            FacetHelper.detectChanges(localFacets, updatedRemoteFacets, localHashes, updatedRemoteHashes);

        assertEq(remainingChanges, 0, "Should have no remaining changes after sync");

        // Test functionality through interface
        bytes memory calldata1 = abi.encodeWithSelector(MockFacetV2.getValuePlusTwo.selector);
        (bool success, bytes memory result) = remoteDiamond.call(calldata1);
        require(success, "Call failed");
        assertEq(abi.decode(result, (uint256)), 2, "getValuePlusTwo should return 2");
    }
}
