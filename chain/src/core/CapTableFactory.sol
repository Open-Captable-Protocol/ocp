// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { CapTable } from "./CapTable.sol";
import { DiamondCutFacet } from "diamond-3-hardhat/facets/DiamondCutFacet.sol";
import { Ownable } from "openzeppelin-contracts/contracts/access/Ownable.sol";
import { ICapTableInitializer } from "@interfaces/ICapTableInitializer.sol";

contract CapTableFactory is Ownable {
    event CapTableCreated(address indexed capTable, bytes16 indexed issuerId);

    address[] public capTables;
    address public immutable initializer;

    constructor(address _initializer) {
        require(_initializer != address(0), "Invalid initializer");
        initializer = _initializer;
    }

    function createCapTable(bytes16 id, uint256 initialSharesAuthorized) external onlyOwner returns (address) {
        require(id != bytes16(0) && initialSharesAuthorized != 0, "Invalid issuer params");

        // Deploy new DiamondCutFacet
        DiamondCutFacet diamondCutFacet = new DiamondCutFacet();

        // Create CapTable with factory as initial owner
        CapTable diamond = new CapTable(address(this), address(diamondCutFacet));

        // Initialize the cap table using the initializer
        ICapTableInitializer(initializer).initialize(address(diamond), id, initialSharesAuthorized, msg.sender);

        // Store the new cap table
        capTables.push(address(diamond));

        emit CapTableCreated(address(diamond), id);
        return address(diamond);
    }

    function getCapTableCount() external view returns (uint256) {
        return capTables.length;
    }
}
