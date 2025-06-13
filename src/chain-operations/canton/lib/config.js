import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export class TransferAgentConfig {
    constructor(isMainnet = false) {
        this.authUrl = 'https://auth.transfer-agent.xyz/application/o/token/';
        this.scope = 'daml_ledger_apia';

        if (isMainnet) {
            this.ledgerUrl = 'https://ledger-api.validator.transfer-agent.xyz/v2';
            this.clientId = this.audience = 'validator-mainnet-m2m';
            this.clientSecret = process.env.TRANSFER_AGENT_MAINNET_CLIENT_SECRET || '';
            this.fairmintPartyId = process.env.FAIRMINT_MAINNET_PARTY_ID || '';
            this.fairmintUserId = process.env.FAIRMINT_MAINNET_USER_ID || '';
        } else {
            this.ledgerUrl = 'https://ledger-api.validator.devnet.transfer-agent.xyz/v2';
            this.clientId = this.audience = 'validator-devnet-m2m';
            this.clientSecret = process.env.TRANSFER_AGENT_DEVNET_CLIENT_SECRET || '';
            this.fairmintPartyId = process.env.FAIRMINT_DEVNET_PARTY_ID || '';
            this.fairmintUserId = process.env.FAIRMINT_DEVNET_USER_ID || '';
        }

        if (!this.clientSecret) {
            throw new Error(`${isMainnet ? 'TRANSFER_AGENT_MAINNET_CLIENT_SECRET' : 'TRANSFER_AGENT_DEVNET_CLIENT_SECRET'} environment variable is not set`);
        }
        if (!this.fairmintPartyId) {
            throw new Error(`${isMainnet ? 'FAIRMINT_MAINNET_PARTY_ID' : 'FAIRMINT_DEVNET_PARTY_ID'} environment variable is not set`);
        }
        if (!this.fairmintUserId) {
            throw new Error(`${isMainnet ? 'FAIRMINT_MAINNET_USER_ID' : 'FAIRMINT_DEVNET_USER_ID'} environment variable is not set`);
        }
    }
} 