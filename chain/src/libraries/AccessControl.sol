// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Storage, StorageLib} from "@core/Storage.sol";

library AccessControl {
    // Role definitions - matching AccessControlFacet
    bytes32 internal constant DEFAULT_ADMIN_ROLE = 0x00;
    bytes32 internal constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 internal constant INVESTOR_ROLE = keccak256("INVESTOR_ROLE");

    error AccessControlUnauthorized(address account, bytes32 role);
    error AccessControlUnauthorizedOrInvestor(address account);

    /// @dev Helper to check if an account has admin role
    function hasAdminRole(address account) internal view returns (bool) {
        return StorageLib.get().roles[DEFAULT_ADMIN_ROLE][account];
    }

    /// @dev Helper to check if an account has operator role
    function hasOperatorRole(address account) internal view returns (bool) {
        return StorageLib.get().roles[OPERATOR_ROLE][account];
    }

    /// @dev Helper to check if an account has investor role
    function hasInvestorRole(address account) internal view returns (bool) {
        return StorageLib.get().roles[INVESTOR_ROLE][account];
    }
}
