// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./DiamondTestBase.sol";
import { StorageLib } from "@diamond/Storage.sol";
import { TxHelper, TxType } from "@diamond/DiamondTxHelper.sol";
import { ValidationLib } from "@diamond/libraries/ValidationLib.sol";
import { StakeholderPositions } from "@diamond/Structs.sol";
import { StakeholderNFTFacet } from "@diamond/facets/StakeholderNFTFacet.sol";

contract DiamondStakeholderNFTTest is DiamondTestBase {
    bytes16 stakeholderId;
    address stakeholderWallet;

    function setUp() public override {
        super.setUp();
        stakeholderId = createStakeholder();
        stakeholderWallet = address(0xBEEF);

        // Issue some positions to the stakeholder
        bytes16 stockClassId = createStockClass();
        bytes16 stockSecurityId = 0xd3373e0a4dd940000000000000000001;
        StockFacet(address(diamond)).issueStock(stockClassId, 1e18, 1000, stakeholderId, stockSecurityId);
    }

    function testLinkStakeholderAddress() public {
        // Link the address
        StakeholderFacet(address(diamond)).linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Verify the link was created by trying to mint (which requires a valid link)
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(diamond)).mint();

        // If we get here without reverting, the link worked
        assertTrue(true, "Link successful - NFT minted");
    }

    function testMintNFT() public {
        // Link address first
        StakeholderFacet(address(diamond)).linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Mint NFT
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(diamond)).mint();
    }

    function testFailMintWithoutLink() public {
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(diamond)).mint();
    }

    function testFailDoubleMint() public {
        // Link address first
        StakeholderFacet(address(diamond)).linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // First mint
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(diamond)).mint();

        // Try to mint again - should fail
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(diamond)).mint();
    }
}
