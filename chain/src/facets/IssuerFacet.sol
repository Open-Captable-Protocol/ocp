// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { LibDiamond } from "diamond-3-hardhat/libraries/LibDiamond.sol";
import { StorageLib, Storage } from "@core/Storage.sol";
import { Issuer } from "@libraries/Structs.sol";
import { TxHelper, TxType } from "@libraries/TxHelper.sol";
import { AccessControl } from "@libraries/AccessControl.sol";

contract IssuerFacet {
    error IssuerAlreadyInitialized();
    error InvalidSharesAuthorized();

    event IssuerAuthorizedSharesAdjusted(uint256 newSharesAuthorized);

    /// @notice Initialize the issuer with initial shares authorized
    /// @dev Can only be called once by an admin during setup
    function initializeIssuer(bytes16 id, uint256 initial_shares_authorized) external {
        Storage storage ds = StorageLib.get();

        // Check that caller has admin role
        if (!AccessControl.hasAdminRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.DEFAULT_ADMIN_ROLE);
        }

        if (ds.issuer.shares_authorized != 0) {
            revert IssuerAlreadyInitialized();
        }

        ds.issuer = Issuer({ id: id, shares_issued: 0, shares_authorized: initial_shares_authorized });
    }

    /// @notice Adjust the total number of authorized shares for the issuer
    /// @dev Only DEFAULT_ADMIN_ROLE can adjust authorized shares
    function adjustIssuerAuthorizedShares(bytes16 id, uint256 newSharesAuthorized) external {
        Storage storage ds = StorageLib.get();

        // Check that caller has admin role
        if (!AccessControl.hasAdminRole(msg.sender)) {
            revert AccessControl.AccessControlUnauthorized(msg.sender, AccessControl.DEFAULT_ADMIN_ROLE);
        }

        // Check that new shares authorized is not less than current shares issued
        require(newSharesAuthorized >= ds.issuer.shares_issued, "New shares authorized must be >= shares issued");

        ds.issuer.shares_authorized = newSharesAuthorized;

        emit IssuerAuthorizedSharesAdjusted(newSharesAuthorized);
        TxHelper.createTx(TxType.ISSUER_AUTHORIZED_SHARES_ADJUSTMENT, abi.encode(id, newSharesAuthorized));
    }
}
