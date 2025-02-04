// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "forge-std/console.sol";
import "@core/CapTable.sol";
import { CapTableFactory } from "@core/CapTableFactory.sol";
import { IIssuerFacet } from "@interfaces/IIssuerFacet.sol";
import { IStakeholderFacet } from "@interfaces/IStakeholderFacet.sol";
import { IStockClassFacet } from "@interfaces/IStockClassFacet.sol";
import { IStockPlanFacet } from "@interfaces/IStockPlanFacet.sol";
import { IAccessControlFacet } from "@interfaces/IAccessControlFacet.sol";
import "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import "diamond-3-hardhat/facets/DiamondLoupeFacet.sol";
import "diamond-3-hardhat/interfaces/IDiamondCut.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { LibDeployment } from "../script/DeployFactory.s.sol";
import { IStockFacet } from "@interfaces/IStockFacet.sol";
import { IConvertiblesFacet } from "@interfaces/IConvertiblesFacet.sol";
import { IEquityCompensationFacet } from "@interfaces/IEquityCompensationFacet.sol";
import { IWarrantFacet } from "@interfaces/IWarrantFacet.sol";
import { IStakeholderNFTFacet } from "@interfaces/IStakeholderNFTFacet.sol";

contract DiamondTestBase is Test {
    uint256 public issuerInitialSharesAuthorized = 1_000_000;
    bytes16 public issuerId = 0xd3373e0a4dd9430f8a563281f2800e1e;
    address public contractOwner;
    address public referenceDiamond;
    CapTable public capTable;
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

        // Use the deployment script's function
        referenceDiamond = LibDeployment.deployInitialFacets(contractOwner);

        // Create factory using reference diamond
        factory = new CapTableFactory(referenceDiamond);

        // Create a new cap table for testing
        capTable = CapTable(payable(factory.createCapTable(issuerId, issuerInitialSharesAuthorized)));
        console.log("capTable: ", address(capTable));
        IAccessControlFacet(address(capTable)).acceptAdmin();
    }

    // Common helper functions
    function createStakeholder() public virtual returns (bytes16) {
        bytes16 stakeholderId = 0xd3373e0a4dd940000000000000000005;

        vm.expectEmit(true, false, false, false, address(capTable));
        emit StakeholderCreated(stakeholderId);

        IStakeholderFacet(address(capTable)).createStakeholder(stakeholderId);

        return stakeholderId;
    }

    // Helper function to create a stock class for testing
    function createStockClass(bytes16 stockClassId) public virtual returns (bytes16) {
        // bytes16 stockClassId = 0xd3373e0a4dd940000000000000000019;
        string memory classType = "COMMON";
        uint256 pricePerShare = 1e18;
        uint256 initialSharesAuthorized = 1_000_000;

        vm.expectEmit(true, true, true, true, address(capTable));
        emit StockClassCreated(stockClassId, classType, pricePerShare, initialSharesAuthorized);

        IStockClassFacet(address(capTable)).createStockClass(
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

        IStockPlanFacet(address(capTable)).createStockPlan(stockPlanId, stockClassIds, sharesReserved);

        return stockPlanId;
    }

    // Add this helper function alongside the other helpers
    function linkStakeholderAddress(bytes16 _stakeholderId, address _wallet) public {
        IStakeholderFacet(address(capTable)).linkStakeholderAddress(_stakeholderId, _wallet);
    }
}
