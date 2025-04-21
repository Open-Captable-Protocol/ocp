// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { DiamondTestBase } from "@test/TestBase.sol";
import { StorageLib } from "@core/Storage.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";
import { StakeholderPositions } from "@libraries/Structs.sol";
import { IssueStockParams } from "@libraries/Structs.sol";
import { IStakeholderNFTFacet } from "@interfaces/IStakeholderNFTFacet.sol";
import { AccessControl } from "@libraries/AccessControl.sol";
import { IStockFacet } from "@interfaces/IStockFacet.sol";
import { IERC721Receiver } from "openzeppelin-contracts/contracts/token/ERC721/IERC721Receiver.sol";
import { IAccessControlFacet } from "@interfaces/IAccessControlFacet.sol";
import { IStakeholderFacet } from "@interfaces/IStakeholderFacet.sol";
import "forge-std/console.sol";

contract ERC721Receiver is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract DiamondStakeholderNFTTest is DiamondTestBase {
    bytes16 _stakeholderId;
    address _stakeholderWallet;
    ERC721Receiver _nftReceiver;

    function setUp() public override {
        super.setUp();

        // Create stakeholder and set wallet (but don't link yet)
        _stakeholderId = createStakeholder();
        _nftReceiver = new ERC721Receiver();
        _stakeholderWallet = address(_nftReceiver);

        // Grant necessary roles
        vm.startPrank(contractOwner);
        IAccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, address(this));
        IAccessControlFacet(address(capTable)).grantRole(AccessControl.INVESTOR_ROLE, _stakeholderWallet);
        IAccessControlFacet(address(capTable)).grantRole(AccessControl.OPERATOR_ROLE, _stakeholderWallet);
        vm.stopPrank();

        // Create a stock class and issue some stock for the NFT metadata
        bytes16 stockClassId = createStockClass(bytes16(uint128(1)));
        bytes16 stockSecurityId = 0xd3373e0a4dd940000000000000000001;
        bytes16 stockId = 0xd3373e0a4dd940000000000000000011;
        IssueStockParams memory params = IssueStockParams({
            id: stockId,
            stock_class_id: stockClassId,
            share_price: 1e18,
            quantity: 1000,
            stakeholder_id: _stakeholderId,
            security_id: stockSecurityId,
            custom_id: "custom_id",
            stock_legend_ids_mapping: "stock_legend_ids_mapping",
            security_law_exemptions_mapping: "security_law_exemptions_mapping"
        });
        IStockFacet(address(capTable)).issueStock(params);
    }

    function testLinkStakeholderAddress() public {
        // Link the address
        linkStakeholderAddress(_stakeholderId, _stakeholderWallet);

        // Verify the link was created by trying to mint
        vm.prank(_stakeholderWallet);
        IStakeholderNFTFacet(address(capTable)).mint();

        // If we get here without reverting, the link worked
        assertTrue(true, "Link successful - NFT minted");
    }

    function testMintNFT() public {
        // Link address first
        linkStakeholderAddress(_stakeholderId, _stakeholderWallet);

        // Mint NFT
        vm.prank(_stakeholderWallet);
        IStakeholderNFTFacet(address(capTable)).mint();
    }

    function testRevertMintWithoutLink() public {
        // Try to mint without linking - should fail
        vm.prank(_stakeholderWallet);
        vm.expectRevert(abi.encodeWithSignature("NotStakeholder()"));
        IStakeholderNFTFacet(address(capTable)).mint();
    }

    function testRevertDoubleMint() public {
        // Link address first
        linkStakeholderAddress(_stakeholderId, _stakeholderWallet);

        // First mint
        vm.prank(_stakeholderWallet);
        IStakeholderNFTFacet(address(capTable)).mint();

        // Try to mint again - should fail
        vm.prank(_stakeholderWallet);
        vm.expectRevert(IStakeholderNFTFacet.AlreadyMinted.selector);
        IStakeholderNFTFacet(address(capTable)).mint();
    }

    function testTokenURI() public {
        // Link address first
        linkStakeholderAddress(_stakeholderId, _stakeholderWallet);

        // Mint the NFT
        vm.prank(_stakeholderWallet);
        IStakeholderNFTFacet(address(capTable)).mint();

        // Get tokenId from stakeholderId
        uint256 tokenId = uint256(bytes32(_stakeholderId));

        // Verify token exists
        address owner = IStakeholderNFTFacet(address(capTable)).ownerOf(tokenId);
        assertTrue(owner == _stakeholderWallet, "Token should exist");

        // Get URI as stakeholderWallet (token owner)
        string memory uri = IStakeholderNFTFacet(address(capTable)).tokenURI(tokenId);
        assertTrue(bytes(uri).length > 0, "URI should not be empty");

        // Also check positions exist
        StakeholderPositions memory positions =
            IStakeholderFacet(address(capTable)).getStakeholderPositions(_stakeholderId);
        assertTrue(positions.stocks.length > 0, "Should have stock positions");
    }
}
