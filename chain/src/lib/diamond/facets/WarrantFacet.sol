// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "../Storage.sol";
import { WarrantActivePosition } from "../Structs.sol";
import { TxHelper, TxType } from "../DiamondTxHelper.sol";
import { ValidationLib } from "../libraries/ValidationLib.sol";

contract WarrantFacet {
    function issueWarrant(bytes16 stakeholder_id, uint256 quantity, bytes16 security_id) external {
        Storage storage ds = StorageLib.get();
        ds.nonce++;

        ValidationLib.validateStakeholder(stakeholder_id);
        ValidationLib.validateQuantity(quantity);

        // Create and store position
        ds.warrantActivePositions.securities[security_id] = WarrantActivePosition({ stakeholder_id: stakeholder_id, quantity: quantity });

        // Track security IDs for this stakeholder
        ds.warrantActivePositions.stakeholderToSecurities[stakeholder_id].push(security_id);

        // Add reverse mapping
        ds.warrantActivePositions.securityToStakeholder[security_id] = stakeholder_id;

        // Store transaction
        bytes memory txData = abi.encode(stakeholder_id, quantity, security_id);
        TxHelper.createTx(TxType.WARRANT_ISSUANCE, txData);
    }

    function getWarrantPosition(bytes16 securityId) external view returns (WarrantActivePosition memory) {
        Storage storage ds = StorageLib.get();
        return ds.warrantActivePositions.securities[securityId];
    }
}
