// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StockActivePositions, ConvertibleActivePositions, EquityCompensationActivePositions, WarrantActivePositions, Issuer, StockClass, StockPlan } from "@libraries/Structs.sol";
struct Storage {
    Issuer issuer;
    bytes16[] stakeholders;
    mapping(bytes16 => uint256) stakeholderIndex;
    StockClass[] stockClasses;
    mapping(bytes16 => uint256) stockClassIndex;
    StockPlan[] stockPlans;
    mapping(bytes16 => uint256) stockPlanIndex;
    StockActivePositions stockActivePositions;
    ConvertibleActivePositions convertibleActivePositions;
    EquityCompensationActivePositions equityCompensationActivePositions;
    WarrantActivePositions warrantActivePositions;
    mapping(address => bytes16) addressToStakeholderId;
}

library StorageLib {
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.storage");

    /// @notice Get the diamond storage
    /// @return ds The diamond storage
    function get() internal pure returns (Storage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}
