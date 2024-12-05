// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import {StorageLib} from "@core/Storage.sol";
import {TxHelper, TxType} from "@libraries/TxHelper.sol";
import {ValidationLib} from "@libraries/ValidationLib.sol";
import {StakeholderPositions} from "@libraries/Structs.sol";
import {StakeholderNFTFacet} from "@facets/StakeholderNFTFacet.sol";

contract DiamondStakeholderNFTTest is DiamondTestBase {
    bytes16 stakeholderId;
    address stakeholderWallet;

    function setUp() public override {
        super.setUp();

        // Create stakeholder and set wallet (but don't link yet)
        stakeholderId = createStakeholder();
        stakeholderWallet = address(0xF62849F9A0B5Bf2913b396098F7c7019b51A820a);

        // Grant necessary roles
        vm.startPrank(contractOwner);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, address(this));
        AccessControlFacet(address(capTable)).grantRole(AccessControl.INVESTOR_ROLE, stakeholderWallet);
        AccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, stakeholderWallet);
        vm.stopPrank();

        // Create a stock class and issue some stock for the NFT metadata
        bytes16 stockClassId = createStockClass();
        bytes16 stockSecurityId = 0xd3373e0a4dd940000000000000000001;
        StockFacet(address(capTable)).issueStock(stockClassId, 1e18, 1000, stakeholderId, stockSecurityId);
    }

    function testLinkStakeholderAddress() public {
        // Link the address
        linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Verify the link was created by trying to mint
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();

        // If we get here without reverting, the link worked
        assertTrue(true, "Link successful - NFT minted");
    }

    function testMintNFT() public {
        // Link address first
        linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Mint NFT
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();
    }

    function testFailMintWithoutLink() public {
        // Try to mint without linking - should fail
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();
    }

    function testFailDoubleMint() public {
        // Link address first
        linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // First mint
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();

        // Try to mint again - should fail
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();
    }

    function testTokenURI() public {
        // Link address and mint NFT
        linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Mint NFT
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();

        // Get tokenId from stakeholderId
        uint256 tokenId = uint256(bytes32(stakeholderId));

        // Get URI as stakeholderWallet (token owner)
        vm.startPrank(stakeholderWallet);
        string memory uri = StakeholderNFTFacet(address(capTable)).tokenURI(tokenId);
        vm.stopPrank();

        // Basic validation of URI format
        assertTrue(bytes(uri).length > 0, "URI should not be empty");

        // Also check positions exist
        vm.startPrank(stakeholderWallet);

        StakeholderPositions memory positions =
            StakeholderFacet(address(capTable)).getStakeholderPositions(stakeholderId);
        vm.stopPrank();
        assertTrue(positions.stocks.length > 0, "Should have stock positions");
    }
}
