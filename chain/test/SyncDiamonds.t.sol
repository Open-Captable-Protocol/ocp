// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { console } from "forge-std/console.sol";
import { CapTableFactory } from "@core/CapTableFactory.sol";
import { CapTable } from "@core/CapTable.sol";
import { LibDeployment } from "../script/DeployFactory.s.sol";
import { SyncDiamondsScript, SyncFacetsScript, FacetHelper } from "../script/SyncDiamonds.s.sol";
import { IDiamondCut } from "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { IDiamondLoupe } from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";
import { MockFacet, MockFacetV2, IMockFacet, IMockFacetV2 } from "./mocks/MockFacet.sol";

contract SyncDiamondsTest is Test {
    address deployer;
    address referenceDiamond;
    CapTableFactory factory;
    address[] capTables;
    MockFacet mockFacet;
    MockFacetV2 mockFacetV2;
    SyncDiamondsScript syncScript;

    function setUp() public {
        deployer = makeAddr("deployer");
        vm.startPrank(deployer);

        // Deploy factory and reference diamond
        referenceDiamond = LibDeployment.deployInitialFacets(deployer);
        factory = new CapTableFactory(referenceDiamond);

        // Create a few cap tables
        for (uint256 i = 0; i < 3; i++) {
            bytes16 id = bytes16(keccak256(abi.encodePacked("TEST", i)));
            address capTable = factory.createCapTable(id, 1_000_000);
            capTables.push(capTable);
        }

        // Deploy mock facets
        mockFacet = new MockFacet();
        mockFacetV2 = new MockFacetV2();

        // Initialize sync script
        syncScript = new SyncDiamondsScript();

        vm.stopPrank();
    }

    function test_SyncPropagatesLogicChanges() public {
        // 1. Add initial mock facet to reference diamond
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = MockFacet.getValuePlusOne.selector;

        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: address(mockFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: selectors
        });

        vm.startPrank(deployer);
        IDiamondCut(referenceDiamond).diamondCut(cut, address(0), "");
        vm.stopPrank();

        // 2. Set up environment for sync script
        vm.setEnv("REFERENCE_DIAMOND", vm.toString(referenceDiamond));
        vm.setEnv("FACTORY_ADDRESS", vm.toString(address(factory)));
        vm.setEnv("PRIVATE_KEY", vm.toString(uint256(keccak256(abi.encodePacked("deployer")))));

        // Run sync script
        syncScript.run();

        // 3. Verify all cap tables have initial behavior
        for (uint256 i = 0; i < capTables.length; i++) {
            IMockFacet facet = IMockFacet(capTables[i]);
            assertEq(facet.getValuePlusOne(), 1, "Initial value should be 1");
        }

        // 4. Update reference diamond with new implementation
        selectors[0] = MockFacetV2.getValuePlusTwo.selector;
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: address(mockFacetV2),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: selectors
        });

        vm.startPrank(deployer);
        IDiamondCut(referenceDiamond).diamondCut(cut, address(0), "");
        vm.stopPrank();

        // 5. Verify reference diamond has both behaviors but cap tables only have old behavior
        assertEq(IMockFacet(referenceDiamond).getValuePlusOne(), 1, "Reference diamond should maintain old value");
        assertEq(IMockFacetV2(referenceDiamond).getValuePlusTwo(), 2, "Reference diamond should have new value");

        for (uint256 i = 0; i < capTables.length; i++) {
            IMockFacet facet = IMockFacet(capTables[i]);
            assertEq(facet.getValuePlusOne(), 1, "Cap tables should still have old value");
            vm.expectRevert(); // getValuePlusTwo shouldn't exist yet
            IMockFacetV2(capTables[i]).getValuePlusTwo();
        }

        // 6. Sync diamonds and verify both functions propagated
        syncScript.run();
        for (uint256 i = 0; i < capTables.length; i++) {
            IMockFacet facetV1 = IMockFacet(capTables[i]);
            IMockFacetV2 facetV2 = IMockFacetV2(capTables[i]);
            assertEq(facetV1.getValuePlusOne(), 1, "Cap table should maintain old value after sync");
            assertEq(facetV2.getValuePlusTwo(), 2, "Cap table should have new value after sync");
        }
    }

    // Sync partial cap tables for example syncing 3 captables but only 2 are synced
    // script should only sync the 2 cap tables upon next run it should sync all
    function test_SyncMultipleFacetChanges() public {
        vm.startPrank(deployer);

        // 1. Add initial mock facet to reference diamond
        bytes4[] memory selectors = new bytes4[](1);
        selectors[0] = MockFacet.getValuePlusOne.selector;

        IDiamondCut.FacetCut[] memory cut = new IDiamondCut.FacetCut[](1);
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: address(mockFacet),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: selectors
        });
        IDiamondCut(referenceDiamond).diamondCut(cut, address(0), "");
        vm.stopPrank();

        // 2. Sync first cap table only
        vm.setEnv("REFERENCE_DIAMOND", vm.toString(referenceDiamond));
        vm.setEnv("FACTORY_ADDRESS", vm.toString(address(factory)));
        vm.setEnv("PRIVATE_KEY", vm.toString(uint256(keccak256(abi.encodePacked("deployer")))));

        // Mock syncing only first cap table by temporarily modifying factory state
        vm.mockCall(address(factory), abi.encodeWithSignature("capTables(uint256)", 1), abi.encode(address(0)));
        vm.mockCall(address(factory), abi.encodeWithSignature("capTables(uint256)", 2), abi.encode(address(0)));
        syncScript.run();
        vm.clearMockedCalls();

        assertEq(IMockFacet(capTables[0]).getValuePlusOne(), 1, "First cap table should have initial value");
        vm.expectRevert(); // Second cap table shouldn't have the facet
        IMockFacet(capTables[1]).getValuePlusOne();

        // 3. Add V2 facet to reference diamond
        vm.startPrank(deployer);
        selectors[0] = MockFacetV2.getValuePlusTwo.selector;
        cut[0] = IDiamondCut.FacetCut({
            facetAddress: address(mockFacetV2),
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: selectors
        });
        IDiamondCut(referenceDiamond).diamondCut(cut, address(0), "");
        vm.stopPrank();

        // 4. Sync second cap table only
        vm.mockCall(address(factory), abi.encodeWithSignature("capTables(uint256)", 0), abi.encode(address(0)));
        vm.mockCall(address(factory), abi.encodeWithSignature("capTables(uint256)", 2), abi.encode(address(0)));
        syncScript.run();
        vm.clearMockedCalls();

        // 5. Verify different states
        assertEq(IMockFacet(referenceDiamond).getValuePlusOne(), 1, "Reference diamond should have V1");
        assertEq(IMockFacetV2(referenceDiamond).getValuePlusTwo(), 2, "Reference diamond should have V2");

        assertEq(IMockFacet(capTables[0]).getValuePlusOne(), 1, "First cap table should have V1");
        vm.expectRevert(); // First cap table shouldn't have V2 yet
        IMockFacetV2(capTables[0]).getValuePlusTwo();

        // Second cap table should have both V1 and V2 since it's syncing from reference diamond
        assertEq(IMockFacet(capTables[1]).getValuePlusOne(), 1, "Second cap table should have V1");
        assertEq(IMockFacetV2(capTables[1]).getValuePlusTwo(), 2, "Second cap table should have V2");

        vm.expectRevert(); // Third cap table shouldn't have either facet
        IMockFacet(capTables[2]).getValuePlusOne();
        vm.expectRevert();
        IMockFacetV2(capTables[2]).getValuePlusTwo();

        // 6. Sync all cap tables and verify final state
        syncScript.run();
        vm.clearMockedCalls();

        // Verify all cap tables have both facets after final sync
        for (uint256 i = 0; i < 3; i++) {
            assertEq(
                IMockFacet(capTables[i]).getValuePlusOne(),
                1,
                string.concat("Cap table ", vm.toString(i), " should have V1")
            );
            assertEq(
                IMockFacetV2(capTables[i]).getValuePlusTwo(),
                2,
                string.concat("Cap table ", vm.toString(i), " should have V2")
            );
        }
    }
}
