// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { StockIssuance, ActivePosition, ShareNumbersIssued, ActivePositions, SecIdsStockClass, Issuer, StockClass, StockIssuanceParams, StockParams } from "./Structs.sol";
import "./TxHelper.sol";
import "./DeterministicUUID.sol"; // TOOD: migrate
import "./DeleteContext.sol";
import "../transactions/StockIssuanceTX.sol";
import "../transactions/StockTransferTX.sol";
import "../transactions/StockCancellationTX.sol";
import "../transactions/StockReissuanceTX.sol";
import "../transactions/StockRepurchaseTX.sol";
import "../transactions/StockRetractionTX.sol";
import "../transactions/StockAcceptanceTX.sol";

library StockLib {
    event StockIssuanceCreated(StockIssuance issuance);
    event StockTransferCreated(StockTransfer transfer);
    event StockCancellationCreated(StockCancellation cancellation);
    event StockReissuanceCreated(StockReissuance reissuance);
    event StockRepurchaseCreated(StockRepurchase repurchase);
    event StockRetractionCreated(StockRetraction retraction);
    event StockAcceptanceCreated(StockAcceptance acceptance);

    function createStockIssuanceByTA(
        uint256 nonce,
        StockIssuanceParams memory issuanceParams,
        ActivePositions storage positions,
        SecIdsStockClass storage activeSecs,
        address[] storage transactions,
        Issuer storage issuer,
        StockClass storage stockClass
    ) external {
        require(issuanceParams.quantity > 0, "Invalid quantity");
        require(issuanceParams.share_price > 0, "Invalid price");

        StockIssuance memory issuance = TxHelper.createStockIssuanceStruct(issuanceParams, nonce);
        TxHelper._updateContext(issuance, positions, activeSecs, issuer, stockClass);
        _issueStock(issuance, transactions);
    }

    function transferStock(
        StockTransferParams memory params,
        ActivePositions storage positions,
        SecIdsStockClass storage activeSecs,
        address[] storage transactions,
        Issuer storage issuer,
        StockClass storage stockClass
    ) external {
        // Checks related to transaction validity
        require(params.is_buyer_verified, "Buyer unverified");
        require(params.quantity > 0, "Invalid quantity");
        require(params.share_price > 0, "Invalid price");

        require(
            activeSecs.activeSecurityIdsByStockClass[params.transferor_stakeholder_id][params.stock_class_id].length > 0,
            "No active security ids found"
        );
        bytes16[] memory activeSecurityIDs = activeSecs.activeSecurityIdsByStockClass[params.transferor_stakeholder_id][params.stock_class_id];

        uint256 sum = 0;
        uint256 numSecurityIds = 0;

        for (uint256 index = 0; index < activeSecurityIDs.length; index++) {
            ActivePosition memory activePosition = positions.activePositions[params.transferor_stakeholder_id][activeSecurityIDs[index]];
            sum += activePosition.quantity;

            if (sum >= params.quantity) {
                numSecurityIds += 1;
                break;
            } else {
                numSecurityIds += 1;
            }
        }

        require(params.quantity <= sum, "insufficient shares");

        uint256 remainingQuantity = params.quantity; // This will keep track of the remaining quantity to be transferred

        for (uint256 index = 0; index < numSecurityIds; index++) {
            ActivePosition memory activePosition = positions.activePositions[params.transferor_stakeholder_id][activeSecurityIDs[index]];

            uint256 transferQuantity; // This will be the quantity to transfer in this iteration

            if (activePosition.quantity <= remainingQuantity) {
                transferQuantity = activePosition.quantity;
            } else {
                transferQuantity = remainingQuantity;
            }

            StockTransferParams memory newParams = params;
            newParams.quantity = transferQuantity;

            _transferSingleStock(newParams, activeSecurityIDs[index], positions, activeSecs, transactions, issuer, stockClass);

            remainingQuantity -= transferQuantity; // Reduce the remaining quantity

            // If there's no more quantity left to transfer, break out of the loop
            if (remainingQuantity == 0) {
                break;
            }
        }
    }

    function cancelStockByTA(
        StockParamsQuantity memory params,
        ActivePositions storage positions,
        SecIdsStockClass storage activeSecs,
        address[] storage transactions,
        Issuer storage issuer,
        StockClass storage stockClass
    ) external {
        ActivePosition memory activePosition = positions.activePositions[params.stakeholder_id][params.security_id];

        require(activePosition.quantity >= params.quantity, "Insufficient shares");

        uint256 remainingQuantity = activePosition.quantity - params.quantity;
        bytes16 balance_security_id = "";

        if (remainingQuantity > 0) {
            // issue balance
            params.nonce++;

            StockTransferParams memory transferParams = StockTransferParams(
                params.stakeholder_id,
                bytes16(0),
                params.stock_class_id,
                true,
                remainingQuantity,
                activePosition.share_price,
                params.nonce
            );
            StockIssuance memory balanceIssuance = TxHelper.createStockIssuanceStructForTransfer(transferParams, transferParams.stock_class_id);

            TxHelper._updateContext(balanceIssuance, positions, activeSecs, issuer, stockClass);
            _issueStock(balanceIssuance, transactions);

            balance_security_id = balanceIssuance.security_id;
        }

        params.nonce++;
        StockCancellation memory cancellation = TxHelper.createStockCancellationStruct(
            params.nonce,
            params.quantity,
            params.comments,
            params.security_id,
            params.reason_text,
            balance_security_id
        );

        _cancelStock(cancellation, transactions);

        issuer.shares_issued = issuer.shares_issued - params.quantity;
        stockClass.shares_issued = stockClass.shares_issued - params.quantity;

        DeleteContext.deleteActivePosition(params.stakeholder_id, params.security_id, positions);
        DeleteContext.deleteActiveSecurityIdsByStockClass(params.stakeholder_id, params.stock_class_id, params.security_id, activeSecs);
    }

    function reissueStockByTA(
        StockParams memory params,
        uint256 nonce,
        bytes16[] memory resulting_security_ids,
        ActivePositions storage positions,
        SecIdsStockClass storage activeSecs,
        address[] storage transactions,
        Issuer storage issuer,
        StockClass storage stockClass
    ) external {
        ActivePosition memory activePosition = positions.activePositions[params.stakeholder_id][params.security_id];

        nonce++;
        StockReissuance memory reissuance = TxHelper.createStockReissuanceStruct(
            nonce,
            params.comments,
            params.security_id,
            resulting_security_ids,
            params.reason_text
        );

        _reissueStock(reissuance, transactions);

        issuer.shares_issued = issuer.shares_issued - activePosition.quantity;
        stockClass.shares_issued = stockClass.shares_issued - activePosition.quantity;

        DeleteContext.deleteActivePosition(params.stakeholder_id, params.security_id, positions);
        DeleteContext.deleteActiveSecurityIdsByStockClass(params.stakeholder_id, params.stock_class_id, params.security_id, activeSecs);
    }

    function repurchaseStockByTA(
        StockParamsQuantity memory params,
        uint256 price,
        ActivePositions storage positions,
        SecIdsStockClass storage activeSecs,
        address[] storage transactions,
        Issuer storage issuer,
        StockClass storage stockClass
    ) external {
        ActivePosition memory activePosition = positions.activePositions[params.stakeholder_id][params.security_id];

        require(activePosition.quantity >= params.quantity, "Insufficient shares");

        uint256 remainingQuantity = activePosition.quantity - params.quantity;
        bytes16 balance_security_id = "";

        if (remainingQuantity > 0) {
            // issue balance
            params.nonce++;

            StockTransferParams memory transferParams = StockTransferParams(
                params.stakeholder_id,
                bytes16(0),
                params.stock_class_id,
                true,
                remainingQuantity,
                activePosition.share_price,
                params.nonce
            );
            StockIssuance memory balanceIssuance = TxHelper.createStockIssuanceStructForTransfer(transferParams, transferParams.stock_class_id);

            TxHelper._updateContext(balanceIssuance, positions, activeSecs, issuer, stockClass);
            _issueStock(balanceIssuance, transactions);

            balance_security_id = balanceIssuance.security_id;
        }

        params.nonce++;
        StockRepurchase memory repurchase = TxHelper.createStockRepurchaseStruct(params, price);

        _repurchaseStock(repurchase, transactions);

        issuer.shares_issued = issuer.shares_issued - params.quantity;
        stockClass.shares_issued = stockClass.shares_issued - params.quantity;

        DeleteContext.deleteActivePosition(params.stakeholder_id, params.security_id, positions);
        DeleteContext.deleteActiveSecurityIdsByStockClass(params.stakeholder_id, params.stock_class_id, params.security_id, activeSecs);
    }

    function retractStockIssuanceByTA(
        StockParams memory params,
        uint256 nonce,
        ActivePositions storage positions,
        SecIdsStockClass storage activeSecs,
        address[] storage transactions,
        Issuer storage issuer,
        StockClass storage stockClass
    ) external {
        ActivePosition memory activePosition = positions.activePositions[params.stakeholder_id][params.security_id];

        //TODO: require active position exists.

        StockRetraction memory retraction = TxHelper.createStockRetractionStruct(nonce, params.comments, params.security_id, params.reason_text);
        _retractStock(retraction, transactions);

        issuer.shares_issued = issuer.shares_issued - activePosition.quantity;
        stockClass.shares_issued = stockClass.shares_issued - activePosition.quantity;

        DeleteContext.deleteActivePosition(params.stakeholder_id, params.security_id, positions);
        DeleteContext.deleteActiveSecurityIdsByStockClass(params.stakeholder_id, params.stock_class_id, params.security_id, activeSecs);
    }

    function acceptStockByTA(uint256 nonce, bytes16 securityId, string[] memory comments, address[] storage transactions) external {
        StockAcceptance memory acceptance = TxHelper.createStockAcceptanceStruct(nonce, comments, securityId);

        _acceptStock(acceptance, transactions);
    }

    // isBuyerVerified is a placeholder for a signature, account or hash that confirms the buyer's identity.
    function _transferSingleStock(
        StockTransferParams memory params,
        bytes16 securityId,
        ActivePositions storage positions,
        SecIdsStockClass storage activeSecs,
        address[] storage transactions,
        Issuer storage issuer,
        StockClass storage stockClass
    ) internal {
        bytes16 transferorSecurityId = securityId;
        ActivePosition memory transferorActivePosition = positions.activePositions[params.transferor_stakeholder_id][transferorSecurityId];

        require(transferorActivePosition.quantity >= params.quantity, "Insufficient shares");

        params.nonce++;
        StockIssuance memory transfereeIssuance = TxHelper.createStockIssuanceStructForTransfer(params, params.stock_class_id);

        TxHelper._updateContext(transfereeIssuance, positions, activeSecs, issuer, stockClass);
        _issueStock(transfereeIssuance, transactions);

        uint256 balanceForTransferor = transferorActivePosition.quantity - params.quantity;

        bytes16 balance_security_id = "";

        params.quantity = balanceForTransferor;
        params.share_price = transferorActivePosition.share_price;
        if (balanceForTransferor > 0) {
            params.nonce++;
            StockIssuance memory transferorBalanceIssuance = TxHelper.createStockIssuanceStructForTransfer(params, securityId);

            TxHelper._updateContext(transferorBalanceIssuance, positions, activeSecs, issuer, stockClass);
            _issueStock(transferorBalanceIssuance, transactions);

            balance_security_id = transferorBalanceIssuance.security_id;
        }

        params.nonce++;
        StockTransfer memory transfer = TxHelper.createStockTransferStruct(
            params.nonce,
            params.quantity,
            transferorSecurityId,
            transfereeIssuance.security_id,
            balance_security_id
        );
        _transferStock(transfer, transactions);

        issuer.shares_issued = issuer.shares_issued - transferorActivePosition.quantity;
        stockClass.shares_issued = stockClass.shares_issued - transferorActivePosition.quantity;

        DeleteContext.deleteActivePosition(params.transferor_stakeholder_id, transferorSecurityId, positions);
        DeleteContext.deleteActiveSecurityIdsByStockClass(params.transferor_stakeholder_id, params.stock_class_id, transferorSecurityId, activeSecs);
    }

    function _issueStock(StockIssuance memory issuance, address[] storage transactions) internal {
        StockIssuanceTx issuanceTx = new StockIssuanceTx(issuance);
        transactions.push(address(issuanceTx));
        emit StockIssuanceCreated(issuance);
    }

    function _cancelStock(StockCancellation memory cancellation, address[] storage transactions) internal {
        StockCancellationTx cancellationTx = new StockCancellationTx(cancellation);
        transactions.push(address(cancellationTx));
        emit StockCancellationCreated(cancellation);
    }

    function _transferStock(StockTransfer memory transfer, address[] storage transactions) internal {
        StockTransferTx transferTx = new StockTransferTx(transfer);
        transactions.push(address(transferTx));
        emit StockTransferCreated(transfer);
    }

    function _reissueStock(StockReissuance memory reissuance, address[] storage transactions) internal {
        StockReissuanceTx reissuanceTx = new StockReissuanceTx(reissuance);
        transactions.push(address(reissuanceTx));
        emit StockReissuanceCreated(reissuance);
    }

    function _repurchaseStock(StockRepurchase memory repurchase, address[] storage transactions) internal {
        StockRepurchaseTx repurchaseTx = new StockRepurchaseTx(repurchase);
        transactions.push(address(repurchaseTx));
        emit StockRepurchaseCreated(repurchase);
    }

    function _retractStock(StockRetraction memory retraction, address[] storage transactions) internal {
        StockRetractionTx retractionTx = new StockRetractionTx(retraction);
        transactions.push(address(retractionTx));
        emit StockRetractionCreated(retraction);
    }

    function _acceptStock(StockAcceptance memory acceptance, address[] storage transactions) internal {
        StockAcceptanceTx acceptanceTx = new StockAcceptanceTx(acceptance);
        transactions.push(address(acceptanceTx));
        emit StockAcceptanceCreated(acceptance);
    }
}
