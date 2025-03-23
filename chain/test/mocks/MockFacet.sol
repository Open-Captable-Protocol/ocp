// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockFacet {
    uint256 private value;

    function getValuePlusOne() external view returns (uint256) {
        return value + 1;
    }
}

contract MockFacetV2 {
    uint256 private value;

    function getValuePlusTwo() external view returns (uint256) {
        return value + 2;
    }
}

interface IMockFacet {
    function getValuePlusOne() external view returns (uint256);
}

interface IMockFacetV2 {
    function getValuePlusTwo() external view returns (uint256);
}
