// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@core/CapTable.sol";
import { CapTableFactory } from "@core/CapTableFactory.sol";
import "@facets/IssuerFacet.sol";
import { CapTable } from "@core/CapTable.sol";
import { StakeholderFacet } from "@facets/StakeholderFacet.sol";
import { StockClassFacet } from "@facets/StockClassFacet.sol";
import { StockFacet } from "@facets/StockFacet.sol";
import { ConvertiblesFacet } from "@facets/ConvertiblesFacet.sol";
import { EquityCompensationFacet } from "@facets/EquityCompensationFacet.sol";
import { StockPlanFacet } from "@facets/StockPlanFacet.sol";
import "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import "diamond-3-hardhat/facets/DiamondLoupeFacet.sol";
import "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { WarrantFacet } from "@facets/WarrantFacet.sol";
import { StakeholderNFTFacet } from "@facets/StakeholderNFTFacet.sol";
import { AccessControlFacet } from "@facets/AccessControlFacet.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import "../script/DeployFactory.s.sol";

contract DiamondTestBase is Test, DeployFactoryScript {
    uint256 public issuerInitialSharesAuthorized = 1_000_000;
    bytes16 public issuerId = 0xd3373e0a4dd9430f8a563281f2800e1e;
    address public contractOwner;
    address public referenceDiamond;
    CapTable public capTable;
    WarrantFacet public warrantFacet;
    StakeholderNFTFacet public stakeholderNFTFacet;
    AccessControlFacet public accessControlFacet;
    CapTableFactory public factory;

    event StockIssued(
        bytes16 indexed stakeholderId, bytes16 indexed stockClassId, uint256 quantity, uint256 sharePrice
    );
    event StakeholderCreated(bytes16 indexed id);
    event StockClassCreated(
        bytes16 indexed id, string indexed classType, uint256 indexed pricePerShare, uint256 initialSharesAuthorized
    );
    event StockPlanCreated(bytes16 indexed id, uint256 shares_reserved);
    // TOOD: figure out if should use the facets' events?
    event IssuerAuthorizedSharesAdjusted(uint256 newSharesAuthorized);
    event StockClassAuthorizedSharesAdjusted(bytes16 indexed stockClassId, uint256 newSharesAuthorized);
    event StockPlanSharesReservedAdjusted(bytes16 indexed id, uint256 newSharesReserved);

    function setUp() public virtual {
        contractOwner = address(this);
        console.log("contractOwner: ", contractOwner);

        // Use the deployment script's function
        referenceDiamond = deployInitialFacets(contractOwner);

        // Create factory using reference diamond
        factory = new CapTableFactory(contractOwner, referenceDiamond);

        // Create a new cap table for testing
        capTable = CapTable(payable(factory.createCapTable(issuerId, issuerInitialSharesAuthorized)));
        console.log("capTable: ", address(capTable));
        AccessControlFacet(address(capTable)).acceptAdmin();
    }

    // Common helper functions
    function createStakeholder() public virtual returns (bytes16) {
        bytes16 stakeholderId = 0xd3373e0a4dd940000000000000000005;

        // Debug log before creation
        console.log("Before creation - index:", StorageLib.get().stakeholderIndex[stakeholderId]);

        vm.expectEmit(true, false, false, false, address(capTable));
        emit StakeholderCreated(stakeholderId);

        // Call through the diamond proxy instead of using delegatecall
        StakeholderFacet(address(capTable)).createStakeholder(stakeholderId);

        // Debug log after creation
        console.log("After creation - index:", StorageLib.get().stakeholderIndex[stakeholderId]);

        return stakeholderId;
    }

    // Helper function to create a stock class for testing
    function createStockClass() public virtual returns (bytes16) {
        bytes16 stockClassId = 0xd3373e0a4dd940000000000000000006;
        string memory classType = "COMMON";
        uint256 pricePerShare = 1e18;
        uint256 initialSharesAuthorized = 1_000_000;

        vm.expectEmit(true, true, true, true, address(capTable));
        emit StockClassCreated(stockClassId, classType, pricePerShare, initialSharesAuthorized);

        StockClassFacet(payable(address(capTable))).createStockClass(
            stockClassId, classType, pricePerShare, initialSharesAuthorized
        );

        return stockClassId;
    }

    // Helper function to create a stock plan for testing
    function createStockPlan(bytes16[] memory stockClassIds) public returns (bytes16) {
        bytes16 stockPlanId = 0xd3373e0a4dd940000000000000000007;
        uint256 sharesReserved = 100_000;

        vm.expectEmit(true, false, false, true, address(capTable));
        emit StockPlanCreated(stockPlanId, sharesReserved);

        StockPlanFacet(payable(address(capTable))).createStockPlan(stockPlanId, stockClassIds, sharesReserved);

        return stockPlanId;
    }

    // Add this helper function alongside the other helpers
    function linkStakeholderAddress(bytes16 _stakeholderId, address _wallet) public {
        StakeholderFacet(payable(address(capTable))).linkStakeholderAddress(_stakeholderId, _wallet);
    }
}
