// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IActivePositionNFT {
    function mintPosition(address to, uint256 tokenId, bytes16 stakeholderId, bytes16 stockClassId, uint256 quantity, uint256 sharePrice) external;

    function updatePosition(uint256 tokenId, uint256 newQuantity, uint256 newSharePrice) external;

    function getTokenByStakeholder(bytes16 stakeholderId) external view returns (uint256);
}
