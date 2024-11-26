// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

enum TxType {
    INVALID,
    ISSUER_AUTHORIZED_SHARES_ADJUSTMENT,
    STOCK_CLASS_AUTHORIZED_SHARES_ADJUSTMENT,
    STOCK_ACCEPTANCE,
    STOCK_CANCELLATION,
    STOCK_ISSUANCE,
    STOCK_REISSUANCE,
    STOCK_REPURCHASE,
    STOCK_RETRACTION,
    STOCK_TRANSFER,
    CONVERTIBLE_ISSUANCE,
    EQUITY_COMPENSATION_ISSUANCE,
    STOCK_PLAN_POOL_ADJUSTMENT,
    WARRANT_ISSUANCE,
    EQUITY_COMPENSATION_EXERCISE
}

struct Tx {
    TxType txType;
    bytes txData;
}

library TxHelper {
    event TxCreated(TxType txType, bytes txData);

    function createTx(TxType txType, bytes memory txData) internal {
        emit TxCreated(txType, txData);
    }

    function generateDeterministicUniqueID(bytes16 stakeholderId, uint256 nonce) public view returns (bytes16) {
        bytes16 deterministicValue = bytes16(keccak256(abi.encodePacked(stakeholderId, block.timestamp, block.prevrandao, nonce)));
        return deterministicValue;
    }
}
