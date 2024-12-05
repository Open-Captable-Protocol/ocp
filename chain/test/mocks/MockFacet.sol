// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockFacet {
    uint256 private value;

    function setValue(uint256 _value) external {
        value = _value;
    }

    function getValue() external view returns (uint256) {
        return value;
    }

    // New function for upgrade testing
    function getValuePlusOne() external view returns (uint256) {
        return value + 1;
    }
}
