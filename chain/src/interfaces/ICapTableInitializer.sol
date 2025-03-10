// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ICapTableInitializer {
    function initialize(address diamond, bytes16 id, uint256 initialSharesAuthorized, address owner) external;
}
