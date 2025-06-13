import axios from 'axios';
import { TransferAgentConfig } from './config.js';
import * as fs from 'fs';
import * as path from 'path';

export class TransferAgentClient {
    constructor(config) {
        this.config = config;
        this.bearerToken = null;
        this.sequenceNumber = 1;
        this.axiosInstance = axios.create();
        this.logDir = path.join(process.cwd(), 'logs');
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    getFairmintPartyId() {
        return this.config.fairmintPartyId;
    }

    async logRequestResponse(url, request, response) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const logFile = path.join(this.logDir, `request-${timestamp}.json`);

        const logData = {
            timestamp,
            url,
            request,
            response
        };

        fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
    }

    async makePostRequest(url, data, headers) {
        try {
            const response = await this.axiosInstance.post(url, data, { headers });
            await this.logRequestResponse(url, data, response.data);
            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorData = error.response?.data;

                // Check for security-sensitive error
                if (errorData?.cause === "A security-sensitive error has been received") {
                    // Clear the bearer token to force re-authentication
                    this.bearerToken = null;

                    // Get new headers with fresh authentication
                    const newHeaders = await this.getHeaders();

                    // Retry the request once with new authentication
                    try {
                        const retryResponse = await this.axiosInstance.post(url, data, { headers: newHeaders });
                        await this.logRequestResponse(url, data, retryResponse.data);
                        return retryResponse.data;
                    } catch (retryError) {
                        // If retry fails, log and throw the original error
                        await this.logRequestResponse(url, data, {
                            error: axios.isAxiosError(retryError) ? retryError.response?.data || retryError.message : retryError
                        });
                        throw error;
                    }
                }

                await this.logRequestResponse(url, data, {
                    error: errorData || error.message
                });
                throw error;
            }
            throw error;
        }
    }

    async authenticate() {
        const formData = new URLSearchParams();
        formData.append('grant_type', 'client_credentials');
        formData.append('client_id', this.config.clientId);
        formData.append('client_secret', this.config.clientSecret);
        formData.append('audience', this.config.audience);
        formData.append('scope', this.config.scope);

        try {
            const response = await this.makePostRequest(
                this.config.authUrl,
                formData.toString(),
                {
                    'Content-Type': 'application/x-www-form-urlencoded',
                }
            );

            this.bearerToken = response.access_token;
            return this.bearerToken;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(`Authentication failed: ${error.response?.data || error.message}`);
            }
            throw error;
        }
    }

    async getHeaders() {
        if (!this.bearerToken) {
            await this.authenticate();
        }

        return {
            'Authorization': `Bearer ${this.bearerToken}`,
            'Content-Type': 'application/json',
        };
    }

    async createCommand(params) {
        const command = {
            commands: [{
                CreateCommand: {
                    templateId: params.templateId,
                    createArguments: params.createArguments,
                },
            }],
            commandId: this.sequenceNumber.toString(),
            actAs: params.actAs,
        };

        this.sequenceNumber++;

        try {
            const headers = await this.getHeaders();
            const response = await this.makePostRequest(
                `${this.config.ledgerUrl}/commands/submit-and-wait-for-transaction-tree`,
                command,
                headers
            );

            return {
                contractId: response.transactionTree.eventsById['#' + response.transactionTree.updateId + ':0'].CreatedTreeEvent.value.contractId,
                updateId: response.transactionTree.updateId
            };
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorData = error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message;
                throw new Error(`Failed to create command: ${errorData}`);
            }
            throw error;
        }
    }

    async exerciseCommand(params) {
        const command = {
            commands: [{
                ExerciseCommand: {
                    templateId: params.templateId,
                    contractId: params.contractId,
                    choice: params.choice,
                    choiceArgument: params.choiceArgument
                }
            }],
            commandId: this.sequenceNumber.toString(),
            actAs: params.actAs
        };

        this.sequenceNumber++;

        try {
            const headers = await this.getHeaders();
            const response = await this.makePostRequest(
                `${this.config.ledgerUrl}/commands/submit-and-wait-for-transaction-tree`,
                command,
                headers
            );
            return response;
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorData = error.response?.data ? JSON.stringify(error.response.data, null, 2) : error.message;
                throw new Error(`Failed to exercise command: ${errorData}`);
            }
            throw error;
        }
    }

    async createParty(partyIdHint) {
        try {
            const headers = await this.getHeaders();
            const response = await this.makePostRequest(
                `${this.config.ledgerUrl}/parties`,
                {
                    partyIdHint: `FM:${partyIdHint}`,
                    displayName: partyIdHint,
                    identityProviderId: ""
                },
                headers
            );

            const partyId = response.partyDetails.party;

            // Set user rights for the newly created party
            await this.setUserRights(partyId);

            return {partyId, isNewParty: true};
        } catch (error) {
            if (axios.isAxiosError(error)) {
                const errorData = error.response?.data;
                // Check if this is a "party already exists" error
                if (errorData?.cause?.includes('Party already exists')) {
                    // Look up the party ID from the ledger
                    const parties = await this.getParties();
                    const existingParty = parties.partyDetails.find(p => p.party.startsWith(`FM:${partyIdHint}`));
                    if (existingParty) {
                        // Set user rights for the newly created party
                        await this.setUserRights(existingParty.party);

                        return { partyId: existingParty.party, isNewParty: false };
                    }
                }
                const errorMessage = errorData ? JSON.stringify(errorData, null, 2) : error.message;
                throw new Error(`Failed to create party: ${errorMessage}`);
            }
            throw error;
        }
    }

    async setUserRights(partyId) {
        const headers = await this.getHeaders();
        await this.makePostRequest(
            `${this.config.ledgerUrl}/users/${this.config.fairmintUserId}/rights`,
            {
                userId: this.config.fairmintUserId,
                rights: [
                    {
                        type: "CanActAs",
                        party: partyId
                    },
                    {
                        type: "CanReadAs",
                        party: partyId
                    }
                ]
            },
            headers
        );
    }

    async getParties() {
        const headers = await this.getHeaders();
        return await this.makePostRequest(
            `${this.config.ledgerUrl}/parties`,
            {},
            headers
        );
    }

    async getEventsByContractId(contractId) {
        const headers = await this.getHeaders();
        return await this.makePostRequest(
            `${this.config.ledgerUrl}/events/contract/${contractId}`,
            {},
            headers
        );
    }

    async getTransactionTreeByOffset(offset) {
        const headers = await this.getHeaders();
        return await this.makePostRequest(
            `${this.config.ledgerUrl}/transactions/tree/${offset}`,
            {},
            headers
        );
    }
} 