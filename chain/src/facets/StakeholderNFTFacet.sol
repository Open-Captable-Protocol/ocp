// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import "openzeppelin-contracts/contracts/utils/Base64.sol";
import {StorageLib, Storage} from "@core/Storage.sol";
import {
    StakeholderPositions,
    StockActivePosition,
    WarrantActivePosition,
    ConvertibleActivePosition,
    EquityCompensationActivePosition
} from "@libraries/Structs.sol";
import {ValidationLib} from "@libraries/ValidationLib.sol";
import {StakeholderFacet} from "@facets/StakeholderFacet.sol";
import {AccessControl} from "@libraries/AccessControl.sol";

contract StakeholderNFTFacet is ERC721 {
    error NotStakeholder();
    error AlreadyMinted();
    error URIQueryForNonexistentToken();

    constructor() ERC721("Stakeholder Position", "STKPOS") {}

    /// @notice Mint an NFT representing a stakeholder's position
    /// @dev Only stakeholders with INVESTOR_ROLE can mint their own NFT
    function mint() external {
        Storage storage ds = StorageLib.get();

        // Verify caller has investor role
        if (!AccessControl.hasInvestorRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.INVESTOR_ROLE);
        }

        // Get stakeholder ID from msg.sender
        bytes16 stakeholderId = ds.addressToStakeholderId[msg.sender];

        if (ds.stakeholderIndex[stakeholderId] == 0) {
            revert NotStakeholder();
        }

        // Use stakeholderId as tokenId
        uint256 tokenId = uint256(bytes32(stakeholderId));
        if (_exists(tokenId)) {
            revert AlreadyMinted();
        }

        _mint(msg.sender, tokenId);
    }

    /// @notice Get the URI for a token, containing metadata about stakeholder positions
    /// @dev Only OPERATOR_ROLE or the token owner can view the token URI
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();

        // Allow operators and admins to view any token URI
        if (!AccessControl.hasOperatorRole(msg.sender) && !AccessControl.hasAdminRole(msg.sender)) {
            // For non-operators, verify caller is the token owner (investor)
            if (ownerOf(tokenId) != msg.sender) {
                revert AccessControl.AccessControlUnauthorizedOrInvestor(msg.sender);
            }
        }

        bytes16 stakeholderId = bytes16(uint128(tokenId));
        StakeholderPositions memory positions = StakeholderFacet(address(this)).getStakeholderPositions(stakeholderId);

        return string(
            abi.encodePacked(
                "data:application/json;base64,",
                Base64.encode(
                    bytes(
                        abi.encodePacked(
                            '{"name":"Stakeholder Position #',
                            toString(tokenId),
                            '","description":"This NFT represents all active positions for this stakeholder.",',
                            '"attributes":',
                            _getAttributesJson(positions),
                            "}"
                        )
                    )
                )
            )
        );
    }

    function _getAttributesJson(StakeholderPositions memory positions) internal pure returns (string memory) {
        // Convert positions to JSON format
        return string(
            abi.encodePacked(
                "[",
                _getStockPositionsJson(positions.stocks),
                ",",
                _getWarrantPositionsJson(positions.warrants),
                ",",
                _getConvertiblePositionsJson(positions.convertibles),
                ",",
                _getEquityCompPositionsJson(positions.equityCompensations),
                "]"
            )
        );
    }

    // Helper functions for JSON conversion
    function _getStockPositionsJson(StockActivePosition[] memory positions) internal pure returns (string memory) {
        if (positions.length == 0) return '{"trait_type": "Stock Positions", "value": "0"}';

        return
            string(abi.encodePacked('{"trait_type": "Stock Positions", "value": "', toString(positions.length), '"}'));
    }

    function _getWarrantPositionsJson(WarrantActivePosition[] memory positions) internal pure returns (string memory) {
        if (positions.length == 0) return '{"trait_type": "Warrant Positions", "value": "0"}';

        return
            string(abi.encodePacked('{"trait_type": "Warrant Positions", "value": "', toString(positions.length), '"}'));
    }

    function _getConvertiblePositionsJson(ConvertibleActivePosition[] memory positions)
        internal
        pure
        returns (string memory)
    {
        if (positions.length == 0) return '{"trait_type": "Convertible Positions", "value": "0"}';

        return string(
            abi.encodePacked('{"trait_type": "Convertible Positions", "value": "', toString(positions.length), '"}')
        );
    }

    function _getEquityCompPositionsJson(EquityCompensationActivePosition[] memory positions)
        internal
        pure
        returns (string memory)
    {
        if (positions.length == 0) return '{"trait_type": "Equity Compensation Positions", "value": "0"}';

        return string(
            abi.encodePacked(
                '{"trait_type": "Equity Compensation Positions", "value": "', toString(positions.length), '"}'
            )
        );
    }

    function toString(uint256 value) internal pure returns (string memory) {
        // Convert uint to string
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
