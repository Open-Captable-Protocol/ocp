// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IAccessControlUpgradeable } from
    "openzeppelin-contracts-upgradeable/contracts/access/IAccessControlUpgradeable.sol";

interface IAccessControlFacet is IAccessControlUpgradeable {
    /// @notice Error definitions from AccessControl
    error AccessControlUnauthorized(address account, bytes32 role);
    error AccessControlBadConfirmation();
    error AccessControlInvalidTransfer();

    /// @notice Initialize the access control system
    /// @dev Sets up initial roles. The deployer (CapTableFactory) gets admin role
    function initializeAccessControl() external;

    /// @notice Initiates transfer of admin role to a new account
    /// @dev Only current admin can initiate transfer
    /// @param newAdmin Address of the new admin
    function transferAdmin(address newAdmin) external;

    /// @notice Accepts admin role transfer
    /// @dev Must be called by the pending admin
    function acceptAdmin() external;

    /// @notice Returns the current admin address
    /// @return The address of the current admin
    function getAdmin() external view returns (address);

    /// @notice Returns the pending admin address
    /// @return The address of the pending admin
    function getPendingAdmin() external view returns (address);

    /// @notice Role definitions
    /// @return The OPERATOR_ROLE hash
    function OPERATOR_ROLE() external view returns (bytes32);

    /// @notice Role definitions
    /// @return The INVESTOR_ROLE hash
    function INVESTOR_ROLE() external view returns (bytes32);

    /// @notice Returns whether an account has a role
    /// @param role The role to check
    /// @param account The account to check
    function hasRole(bytes32 role, address account) external view override returns (bool);

    /// @notice Returns the admin role for a role
    /// @param role The role to check
    function getRoleAdmin(bytes32 role) external view override returns (bytes32);

    /// @notice Grants a role to an account
    /// @param role The role to grant
    /// @param account The account to grant the role to
    function grantRole(bytes32 role, address account) external override;

    /// @notice Revokes a role from an account
    /// @param role The role to revoke
    /// @param account The account to revoke the role from
    function revokeRole(bytes32 role, address account) external override;

    /// @notice Renounces a role for the calling account
    /// @param role The role to renounce
    /// @param account The account to renounce the role for
    function renounceRole(bytes32 role, address account) external override;
}
