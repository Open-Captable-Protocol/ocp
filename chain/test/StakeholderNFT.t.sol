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
        stakeholderId = createStakeholder();
        stakeholderWallet = address(0xBEEF);

        // Issue some positions to the stakeholder
        bytes16 stockClassId = createStockClass();
        bytes16 stockSecurityId = 0xd3373e0a4dd940000000000000000001;
        StockFacet(address(capTable)).issueStock(stockClassId, 1e18, 1000, stakeholderId, stockSecurityId);
    }

    function testLinkStakeholderAddress() public {
        // Link the address
        StakeholderFacet(address(capTable)).linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Verify the link was created by trying to mint (which requires a valid link)
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();

        // If we get here without reverting, the link worked
        assertTrue(true, "Link successful - NFT minted");
    }

    function testMintNFT() public {
        // Link address first
        StakeholderFacet(address(capTable)).linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Mint NFT
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();
    }

    function testFailMintWithoutLink() public {
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();
    }

    function testFailDoubleMint() public {
        // Link address first
        StakeholderFacet(address(capTable)).linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // First mint
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();

        // Try to mint again - should fail
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();
    }

    function testTokenURI() public {
        // Link address first
        StakeholderFacet(address(capTable)).linkStakeholderAddress(stakeholderId, stakeholderWallet);

        // Mint NFT
        vm.prank(stakeholderWallet);
        StakeholderNFTFacet(address(capTable)).mint();

        // Get tokenId from stakeholderId
        uint256 tokenId = uint256(bytes32(stakeholderId));

        // Get URI
        string memory uri = StakeholderNFTFacet(address(capTable)).tokenURI(tokenId);
        console.log("Token URI:", uri);

        // Let's also log the positions directly
        StakeholderPositions memory positions =
            StakeholderFacet(address(capTable)).getStakeholderPositions(stakeholderId);

        console.log("\nActive Positions:");
        console.log("Stock Positions:", positions.stocks.length);
        if (positions.stocks.length > 0) {
            for (uint256 i = 0; i < positions.stocks.length; i++) {
                console.log("  Stock Position", i);
                console.log("    Quantity:", positions.stocks[i].quantity);
                console.log("    Share Price:", positions.stocks[i].share_price);
            }
        }

        console.log("Warrant Positions:", positions.warrants.length);
        console.log("Convertible Positions:", positions.convertibles.length);
        console.log("Equity Compensation Positions:", positions.equityCompensations.length);
    }
}
