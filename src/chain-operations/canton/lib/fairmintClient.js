import { TransferAgentClient } from './client.js';
import { TransferAgentConfig } from './config.js';

// Application specific constants
const TEMPLATES = {
    FAIRMINT_ADMIN_SERVICE: '#OpenCapTable-v00:FairmintAdminService:FairmintAdminService'
};

export class FairmintClient {
    constructor(config) {
        this.client = new TransferAgentClient(config);
    }

    async createFairmintAdminService() {
        const response = await this.client.createCommand({
            templateId: TEMPLATES.FAIRMINT_ADMIN_SERVICE,
            createArguments: {
                fairmint: this.client.getFairmintPartyId(),
            },
            actAs: [this.client.getFairmintPartyId()],
        });
        console.debug(`Created FairmintAdminService with contract ID: ${response.contractId}`);
        return response;
    }

    async authorizeIssuer(contractId, issuerPartyId) {
        const response = await this.client.exerciseCommand({
            templateId: TEMPLATES.FAIRMINT_ADMIN_SERVICE,
            contractId,
            choice: 'AuthorizeIssuer',
            choiceArgument: {
                issuer: issuerPartyId
            },
            actAs: [this.client.getFairmintPartyId()]
        });

        // Extract the IssuerAuthorization contract ID from the response
        const authorizationContractId = response.transactionTree.eventsById['#' + response.transactionTree.updateId + ':0'].ExercisedTreeEvent.exerciseResult;
        console.debug(`Successfully authorized issuer with contract ID: ${authorizationContractId}`);
        return authorizationContractId;
    }

    async createParty(partyIdHint) {
        const response = await this.client.createParty(partyIdHint);
        console.debug(`${response.isNewParty ? 'Created' : 'Reused'} party for ${partyIdHint} with ID: ${response.partyId}`);
        return response;
    }

    async acceptIssuerAuthorization(authorizationContractId, name, authorizedShares, issuerPartyId) {
        const response = await this.client.exerciseCommand({
            templateId: '#OpenCapTable-v00:IssuerAuthorization:IssuerAuthorization',
            contractId: authorizationContractId,
            choice: 'CreateIssuer',
            choiceArgument: {
                name,
                authorizedShares: authorizedShares.toString()
            },
            actAs: [issuerPartyId]
        });

        // Extract the Issuer contract ID from the response
        const issuerContractId = response.transactionTree.eventsById['#' + response.transactionTree.updateId + ':1'].CreatedTreeEvent.value.contractId;
        console.debug(`Successfully created issuer with contract ID: ${issuerContractId}`);
        return issuerContractId;
    }

    async createStockClass(issuerContractId, stockClassType, shares, issuerPartyId) {
        const response = await this.client.exerciseCommand({
            templateId: '#OpenCapTable-v00:Issuer:Issuer',
            contractId: issuerContractId,
            choice: 'CreateStockClass',
            choiceArgument: {
                stockClassType,
                shares: shares.toString()
            },
            actAs: [issuerPartyId]
        });

        // Extract both the StockClass and updated Issuer contract IDs from the response
        const stockClassContractId = response.transactionTree.eventsById['#' + response.transactionTree.updateId + ':2'].CreatedTreeEvent.value.contractId;
        const updatedIssuerContractId = response.transactionTree.eventsById['#' + response.transactionTree.updateId + ':1'].CreatedTreeEvent.value.contractId;
        console.debug(`Created stock class with contract ID: ${stockClassContractId}`);
        return { stockClassContractId, updatedIssuerContractId };
    }

    async proposeIssueStock(stockClassContractId, recipientPartyId, quantity, issuerPartyId) {
        const response = await this.client.exerciseCommand({
            templateId: '#OpenCapTable-v00:StockClass:StockClass',
            contractId: stockClassContractId,
            choice: 'ProposeIssueStock',
            choiceArgument: {
                recipient: recipientPartyId,
                quantity: quantity.toString()
            },
            actAs: [issuerPartyId]
        });

        // Extract both the IssueStockClassProposal and updated StockClass contract IDs from the response
        const proposalContractId = response.transactionTree.eventsById['#' + response.transactionTree.updateId + ':1'].CreatedTreeEvent.value.contractId;
        const updatedStockClassContractId = response.transactionTree.eventsById['#' + response.transactionTree.updateId + ':2'].CreatedTreeEvent.value.contractId;
        console.debug(`Proposed stock issuance to ${recipientPartyId} with proposal ID: ${proposalContractId}`);
        return { proposalContractId, updatedStockClassContractId };
    }

    async acceptIssueStockProposal(proposalContractId, recipientPartyId) {
        const response = await this.client.exerciseCommand({
            templateId: '#OpenCapTable-v00:StockClass:IssueStockClassProposal',
            contractId: proposalContractId,
            choice: 'AcceptIssueStockProposal',
            choiceArgument: {},
            actAs: [recipientPartyId]
        });

        // Extract the StockPosition contract ID from the response
        const stockPositionContractId = response.transactionTree.eventsById['#' + response.transactionTree.updateId + ':1'].CreatedTreeEvent.value.contractId;
        console.debug(`${recipientPartyId} accepted stock issuance and received position with ID: ${stockPositionContractId}`);
        return stockPositionContractId;
    }

    async proposeTransfer(stockPositionContractId, recipientPartyId, quantity, ownerPartyId) {
        const response = await this.client.exerciseCommand({
            templateId: '#OpenCapTable-v00:StockPosition:StockPosition',
            contractId: stockPositionContractId,
            choice: 'ProposeTransfer',
            choiceArgument: {
                recipient: recipientPartyId,
                quantityToTransfer: quantity.toString()
            },
            actAs: [ownerPartyId]
        });

        // Extract both the TransferProposal and updated StockPosition contract IDs from the response
        const transferProposalContractId = response.transactionTree.eventsById['#' + response.transactionTree.updateId + ':1'].CreatedTreeEvent.value.contractId;
        const updatedStockPositionContractId = response.transactionTree.eventsById['#' + response.transactionTree.updateId + ':2'].CreatedTreeEvent.value.contractId;
        console.debug(`${ownerPartyId} proposed transfer to ${recipientPartyId} with proposal ID: ${transferProposalContractId}`);
        return { transferProposalContractId, updatedStockPositionContractId };
    }

    async acceptTransfer(transferProposalContractId, recipientPartyId) {
        const response = await this.client.exerciseCommand({
            templateId: '#OpenCapTable-v00:StockPosition:StockTransferProposal',
            contractId: transferProposalContractId,
            choice: 'AcceptTransfer',
            choiceArgument: {},
            actAs: [recipientPartyId]
        });

        // Extract the new StockPosition contract ID from the response
        const stockPositionContractId = response.transactionTree.eventsById['#' + response.transactionTree.updateId + ':1'].CreatedTreeEvent.value.contractId;
        console.debug(`${recipientPartyId} accepted transfer and received position with ID: ${stockPositionContractId}`);
        return stockPositionContractId;
    }
} 