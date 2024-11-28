// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {LibDiamond} from "diamond-3-hardhat/libraries/LibDiamond.sol";
import {StorageLib, Storage} from "@core/Storage.sol";
import {Issuer} from "@libraries/Structs.sol";
import {TxHelper, TxType} from "@libraries/TxHelper.sol";

contract IssuerFacet {
    error IssuerAlreadyInitialized();
    error InvalidSharesAuthorized();

    event IssuerAuthorizedSharesAdjusted(uint256 newSharesAuthorized);

    function initializeIssuer(bytes16 id, uint256 initial_shares_authorized) external {
        Storage storage ds = StorageLib.get();

        if (ds.issuer.shares_authorized != 0) {
            revert IssuerAlreadyInitialized();
        }

        ds.issuer = Issuer({id: id, shares_issued: 0, shares_authorized: initial_shares_authorized});
    }

    function adjustIssuerAuthorizedShares(uint256 newSharesAuthorized) external {
        Storage storage ds = StorageLib.get();

        ds.issuer.shares_authorized = newSharesAuthorized;

        emit IssuerAuthorizedSharesAdjusted(newSharesAuthorized);
        TxHelper.createTx(TxType.ISSUER_AUTHORIZED_SHARES_ADJUSTMENT, abi.encode(newSharesAuthorized));
    }
}
