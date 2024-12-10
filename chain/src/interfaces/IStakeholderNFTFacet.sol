// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IERC721 } from "openzeppelin-contracts/contracts/token/ERC721/IERC721.sol";

interface IStakeholderNFTFacet is IERC721 {
    /// @notice Error thrown when caller is not a stakeholder
    error NotStakeholder();
    /// @notice Error thrown when NFT is already minted for stakeholder
    error AlreadyMinted();
    /// @notice Error thrown when querying URI for non-existent token
    error URIQueryForNonexistentToken();

    /// @notice Mint an NFT representing a stakeholder's position
    /// @dev Only stakeholders with INVESTOR_ROLE can mint their own NFT
    function mint() external;

    /// @notice Get the URI for a token, containing metadata about stakeholder positions
    /// @dev Only OPERATOR_ROLE or the token owner can view the token URI
    /// @param tokenId The ID of the token to get URI for
    /// @return The token URI containing metadata about stakeholder positions
    function tokenURI(uint256 tokenId) external view returns (string memory);
}
