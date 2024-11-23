// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "../Storage.sol";

contract StakeholderFacet {
    event StakeholderCreated(bytes16 indexed id);
    error StakeholderAlreadyExists(bytes16 stakeholder_id);

    function createStakeholder(bytes16 _id) external {
        Storage storage ds = StorageLib.get();

        if (ds.stakeholderIndex[_id] > 0) {
            revert StakeholderAlreadyExists(_id);
        }

        ds.stakeholders.push(_id);
        ds.stakeholderIndex[_id] = ds.stakeholders.length;

        emit StakeholderCreated(_id);
    }
}
