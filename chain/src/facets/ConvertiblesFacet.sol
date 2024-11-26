// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { StorageLib, Storage } from "@core/Storage.sol";
import { ConvertibleActivePosition } from "@libraries/Structs.sol";
import { TxHelper, TxType } from "@libraries/DiamondTxHelper.sol";
import { ValidationLib } from "@libraries/ValidationLib.sol";

contract ConvertiblesFacet {
    function issueConvertible(bytes16 stakeholder_id, uint256 investment_amount, bytes16 security_id) external {
        Storage storage ds = StorageLib.get();
        ds.nonce++;

        ValidationLib.validateStakeholder(stakeholder_id);
        ValidationLib.validateAmount(investment_amount);

        // Create and store position
        ds.convertibleActivePositions.securities[security_id] = ConvertibleActivePosition({
            stakeholder_id: stakeholder_id,
            investment_amount: investment_amount
        });

        // Track security IDs for this stakeholder
        ds.convertibleActivePositions.stakeholderToSecurities[stakeholder_id].push(security_id);

        // Add reverse mapping
        ds.convertibleActivePositions.securityToStakeholder[security_id] = stakeholder_id;

        // Store transaction
        bytes memory txData = abi.encode(stakeholder_id, investment_amount, security_id);
        TxHelper.createTx(TxType.CONVERTIBLE_ISSUANCE, txData);
    }

    function getConvertiblePosition(bytes16 securityId) external view returns (ConvertibleActivePosition memory) {
        Storage storage ds = StorageLib.get();
        return ds.convertibleActivePositions.securities[securityId];
    }
}
