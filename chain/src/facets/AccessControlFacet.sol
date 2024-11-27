// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { Storage, StorageLib } from "@core/Storage.sol";
import { AccessControlUpgradeable } from "openzeppelin/access/AccessControlUpgradeable.sol";

contract AccessControlFacet is AccessControlUpgradeable {
    // Role definitions
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE"); // For protocols and issuer
    bytes32 public constant INVESTOR_ROLE = keccak256("INVESTOR_ROLE"); // For shareholders/stakeholders

    // Error definitions from AccessControl
    error AccessControlUnauthorizedAccount(address account, bytes32 role);
    error AccessControlBadConfirmation();

    /// @notice Initialize the access control system
    /// @dev Sets up initial roles. The deployer (CapTableFactory) gets admin role
    function initializeAccessControl() external {
        Storage storage ds = StorageLib.get();

        // Set up admin role for the deployer (factory)
        ds.roles[DEFAULT_ADMIN_ROLE][msg.sender] = true;
        emit RoleGranted(DEFAULT_ADMIN_ROLE, msg.sender, msg.sender);

        // Set up role admins
        ds.roleAdmin[OPERATOR_ROLE] = DEFAULT_ADMIN_ROLE;
        emit RoleAdminChanged(OPERATOR_ROLE, bytes32(0), DEFAULT_ADMIN_ROLE);

        ds.roleAdmin[INVESTOR_ROLE] = DEFAULT_ADMIN_ROLE;
        emit RoleAdminChanged(INVESTOR_ROLE, bytes32(0), DEFAULT_ADMIN_ROLE);
    }

    /// @dev Override hasRole to use diamond storage
    function hasRole(bytes32 role, address account) public view virtual override returns (bool) {
        return StorageLib.get().roles[role][account];
    }

    /// @dev Override getRoleAdmin to use diamond storage
    function getRoleAdmin(bytes32 role) public view virtual override returns (bytes32) {
        return StorageLib.get().roleAdmin[role];
    }

    /// @notice Grants `role` to `account`
    /// @dev Caller must have admin role for `role`
    function grantRole(bytes32 role, address account) public virtual override {
        if (!hasRole(getRoleAdmin(role), msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, getRoleAdmin(role));
        }
        _grantRole(role, account);
    }

    /// @notice Revokes `role` from `account`
    /// @dev Caller must have admin role for `role`
    function revokeRole(bytes32 role, address account) public virtual override {
        if (!hasRole(getRoleAdmin(role), msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, getRoleAdmin(role));
        }
        _revokeRole(role, account);
    }

    /// @notice Revokes `role` from the calling account
    /// @dev Calling account must be granted `role`
    function renounceRole(bytes32 role, address account) public virtual override {
        if (account != msg.sender) {
            revert AccessControlBadConfirmation();
        }
        _revokeRole(role, account);
    }

    /// @notice Sets `adminRole` as `role`'s admin role
    /// @dev Caller must have admin role
    function setRoleAdmin(bytes32 role, bytes32 adminRole) public virtual {
        if (!hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert AccessControlUnauthorizedAccount(msg.sender, DEFAULT_ADMIN_ROLE);
        }
        _setRoleAdmin(role, adminRole);
    }

    /// @dev Override _grantRole to use diamond storage
    function _grantRole(bytes32 role, address account) internal virtual override {
        Storage storage ds = StorageLib.get();
        if (!ds.roles[role][account]) {
            ds.roles[role][account] = true;
            emit RoleGranted(role, account, msg.sender);
        }
    }

    /// @dev Override _revokeRole to use diamond storage
    function _revokeRole(bytes32 role, address account) internal virtual override {
        Storage storage ds = StorageLib.get();
        if (ds.roles[role][account]) {
            ds.roles[role][account] = false;
            emit RoleRevoked(role, account, msg.sender);
        }
    }

    /// @dev Override _setRoleAdmin to use diamond storage
    function _setRoleAdmin(bytes32 role, bytes32 adminRole) internal virtual override {
        Storage storage ds = StorageLib.get();
        bytes32 previousAdminRole = ds.roleAdmin[role];
        ds.roleAdmin[role] = adminRole;
        emit RoleAdminChanged(role, previousAdminRole, adminRole);
    }
}
