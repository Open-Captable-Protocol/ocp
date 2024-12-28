// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { StakeholderPositions } from "@libraries/Structs.sol";
import { IssueStockParams } from "@libraries/Structs.sol";
import { IStakeholderNFTFacet } from "@interfaces/IStakeholderNFTFacet.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { IStockFacet } from "@interfaces/IStockFacet.sol";

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
        IAccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, address(this));
        IAccessControlFacet(address(capTable)).grantRole(AccessControl.INVESTOR_ROLE, stakeholderWallet);
        IAccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, stakeholderWallet);
        vm.stopPrank();

        // Create a stock class and issue some stock for the NFT metadata
        bytes16 stockClassId = createStockClass();
        bytes16 stockSecurityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 stockId = 0xd3373e0a4dd940000000000000000011;
        IssueStockParams memory params = IssueStockParams({
            id: stockId,
            stock_class_id: stockClassId,
            share_price: 1e18,
            quantity: 1000,
            stakeholder_id: stakeholderId,
            security_id: stockSecurityId,
            custom_id: "custom_id",
            stock_legend_ids_mapping: "stock_legend_ids_mapping",
            security_law_exemptions_mapping: "security_law_exemptions_mapping"
        });
        IStockFacet(address(capTable)).issueStock(params);
    }

    function testLinkStakeholderAddress() public {
        // Link the address
        linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Verify the link was created by trying to mint
        vm.prank(stakeholderWallet);
        IStakeholderNFTFacet(address(capTable)).mint();

        // If we get here without reverting, the link worked
        assertTrue(true, "Link successful - NFT minted");
    }

    function testMintNFT() public {
        // Link address first
        linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Mint NFT
        vm.prank(stakeholderWallet);
        IStakeholderNFTFacet(address(capTable)).mint();
    }

    function testFailMintWithoutLink() public {
        // Try to mint without linking - should fail
        vm.prank(stakeholderWallet);
        IStakeholderNFTFacet(address(capTable)).mint();
    }

    function testFailDoubleMint() public {
        // Link address first
        linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // First mint
        vm.prank(stakeholderWallet);
        IStakeholderNFTFacet(address(capTable)).mint();

        // Try to mint again - should fail
        vm.prank(stakeholderWallet);
        IStakeholderNFTFacet(address(capTable)).mint();
    }

    function testTokenURI() public {
        // Link address and mint NFT
        linkStakeholderAddress(stakeholderId, stakeholderWallet);

        vm.startPrank(stakeholderWallet);

        // Mint NFT
        IStakeholderNFTFacet(address(capTable)).mint();

        vm.stopPrank();

        // Get tokenId from stakeholderId
        uint256 tokenId = uint256(bytes32(stakeholderId));

        // Get URI as stakeholderWallet (token owner)
        string memory uri = IStakeholderNFTFacet(address(capTable)).tokenURI(tokenId);

        // Basic validation of URI format
        assertTrue(bytes(uri).length > 0, "URI should not be empty");

        // Also check positions exist

        StakeholderPositions memory positions =
            IStakeholderFacet(address(capTable)).getStakeholderPositions(stakeholderId);

        assertTrue(positions.stocks.length > 0, "Should have stock positions");
    }
}
