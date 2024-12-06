// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "./TestBase.sol";
import "./mocks/MockFacet.sol";
import { ManageFacetScript } from "../script/ManageFacets.s.sol";
import { SyncDiamondsScript } from "../script/SyncDiamonds.s.sol";
import { IDiamondLoupe } from "diamond-3-hardhat/interfaces/IDiamondLoupe.sol";
import { DeployFactoryScript } from "../script/DeployFactory.s.sol";

contract ManageFacetTest is Test, DeployFactoryScript {
    MockFacet public mockFacet;
    MockFacet public mockFacetV2;
    ManageFacetScript public manager;
    SyncDiamondsScript public syncer;
    address public contractOwner;
    address public referenceDiamond;
    CapTableFactory public factory;
    address public capTable;
    address public capTable2;

    function setUp() public {
        console.log("starting setUp");
        contractOwner = address(this);
        console.log("contractOwner: ", contractOwner);

        // Use the deployment script's function
        referenceDiamond = deployInitialFacets();

        // Create factory using reference diamond
        factory = new CapTableFactory(contractOwner, referenceDiamond);

        // Create a new cap table for testing
        capTable = factory.createCapTable(bytes16(uint128(1)), 1_000_000);
        console.log("capTable: ", capTable);
        console.log("referenceDiamond: ", referenceDiamond);

        // Create a second cap table for testing
        capTable2 = factory.createCapTable(bytes16(uint128(2)), 1_000_000);
        console.log("capTable2: ", capTable2);

        mockFacet = new MockFacet();
        mockFacetV2 = new MockFacet();
        manager = new ManageFacetScript();
        syncer = new SyncDiamondsScript();
        console.log("done setUp");
    }

    function testAddFacet() public {
        // Create selectors for mock facet
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = MockFacet.setValue.selector;
        selectors[1] = MockFacet.getValue.selector;

        // Add the facet
        console.log("referenceDiamond: ", referenceDiamond);
        console.log("address(capTable): ", address(capTable));
        manager.addFacet(address(capTable), address(mockFacet), selectors);

        // Verify facet was added
        IDiamondLoupe.Facet[] memory facets = IDiamondLoupe(address(capTable)).facets();
        bool found = false;
        for (uint256 i = 0; i < facets.length; i++) {
            if (facets[i].facetAddress == address(mockFacet)) {
                found = true;
                assertEq(facets[i].functionSelectors.length, 2);
                break;
            }
        }
        assertTrue(found, "Facet not found after addition");

        // Test functionality
        MockFacet(address(capTable)).setValue(42);
        assertEq(MockFacet(address(capTable)).getValue(), 42);
    }

    function testReplaceFacet() public {
        // First add the original facet
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = MockFacet.setValue.selector;
        selectors[1] = MockFacet.getValue.selector;
        manager.addFacet(address(capTable), address(mockFacet), selectors);

        // Set initial value
        MockFacet(address(capTable)).setValue(42);
        assertEq(MockFacet(address(capTable)).getValue(), 42);

        // Replace with V2
        manager.replaceFacet(address(capTable), address(mockFacetV2), selectors);

        // Verify value persists after upgrade (storage remains unchanged)
        assertEq(MockFacet(address(capTable)).getValue(), 42);
    }

    function testRemoveFacet() public {
        // First add the facet
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = MockFacet.setValue.selector;
        selectors[1] = MockFacet.getValue.selector;
        manager.addFacet(address(capTable), address(mockFacet), selectors);

        // Remove the facet
        manager.removeFacet(address(capTable), selectors);

        // Verify facet was removed
        IDiamondLoupe.Facet[] memory facets = IDiamondLoupe(address(capTable)).facets();
        for (uint256 i = 0; i < facets.length; i++) {
            // check that the facet address is not the one we removed
            assertFalse(facets[i].facetAddress == address(mockFacet), "Facet still exists after removal");
        }

        // Verify function calls revert
        vm.expectRevert("Diamond: Function does not exist");
        MockFacet(address(capTable)).setValue(42);
    }

    function testUpgradeWithNewFunction() public {
        // First add original facet with basic functions
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = MockFacet.setValue.selector;
        selectors[1] = MockFacet.getValue.selector;
        manager.addFacet(address(capTable), address(mockFacet), selectors);

        // Set initial value
        MockFacet(address(capTable)).setValue(42);

        // Add new function from V2
        bytes4[] memory newSelectors = new bytes4[](1);
        newSelectors[0] = MockFacet.getValuePlusOne.selector;
        manager.addFacet(address(capTable), address(mockFacetV2), newSelectors);

        // Test old and new functionality
        assertEq(MockFacet(address(capTable)).getValue(), 42);
        assertEq(MockFacet(address(capTable)).getValuePlusOne(), 43);
    }

    function testSyncDiamonds() public {
        // Add mock facet to reference diamond
        bytes4[] memory selectors = new bytes4[](2);
        selectors[0] = MockFacet.setValue.selector;
        selectors[1] = MockFacet.getValue.selector;

        // Create new cap table (won't have mock facet yet)
        address newCapTable = factory.createCapTable(bytes16(uint128(2)), 1_000_000);

        // Store the mock facet address for later comparison
        address mockFacetAddr = address(new MockFacet());
        manager.addFacet(referenceDiamond, mockFacetAddr, selectors);

        // Sync the new cap table with reference
        console.log("syncing newCapTable: ", newCapTable);
        syncer.syncDiamond(newCapTable, referenceDiamond);
        console.log("done syncing");

        // Verify mock facet was added to new cap table by checking selectors
        IDiamondLoupe.Facet[] memory facets = IDiamondLoupe(newCapTable).facets();
        bool found = false;
        for (uint256 i = 0; i < facets.length; i++) {
            bytes4[] memory facetSelectors = facets[i].functionSelectors;
            bool hasSetValue = false;
            bool hasGetValue = false;

            for (uint256 j = 0; j < facetSelectors.length; j++) {
                if (facetSelectors[j] == MockFacet.setValue.selector) hasSetValue = true;
                if (facetSelectors[j] == MockFacet.getValue.selector) hasGetValue = true;
            }

            if (hasSetValue && hasGetValue) {
                found = true;
                break;
            }
        }
        assertTrue(found, "Mock facet selectors not synced to new cap table");

        // Test the functionality
        MockFacet(newCapTable).setValue(42);
        assertEq(MockFacet(newCapTable).getValue(), 42, "Mock facet functionality not working");
    }
}
