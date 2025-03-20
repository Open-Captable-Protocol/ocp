/* eslint-disable no-case-declarations */

import { Log, AbiCoder, Block, ethers } from "ethers";
import getProvider from "../chain-operations/getProvider";
import get from "lodash/get.js";
import { handleStockPlan, txMapper, txTypes } from "../chain-operations/transactionHandlers";
import { handleStakeholder, handleStockClass } from "../chain-operations/transactionHandlers";
import Issuer from "../db/objects/Issuer";
import { TxCreated, StakeholderCreated, StockClassCreated, StockPlanCreated } from "../chain-operations/topics";

const TOPICS = { TxCreated, StakeholderCreated, StockClassCreated, StockPlanCreated };

const abiCoder = new AbiCoder();

// Create a map to store providers and their active listeners
const providers = new Map<string, ethers.Provider>();
const activeListeners = new Map<string, boolean>();
const watchedAddressesByChain = new Map<string, Set<string>>();

// Function to get or create provider for a chain
const getChainProvider = (chainId: string): ethers.Provider => {
    if (!providers.has(chainId)) {
        providers.set(chainId, getProvider(chainId) as ethers.Provider);
    }
    return providers.get(chainId)!;
};

// Function to add new addresses to watch for a specific chain
export const addAddressesToWatch = async (chainId: string, addresses: string | string[]) => {
    const addressArray = Array.isArray(addresses) ? addresses : [addresses];

    if (!watchedAddressesByChain.has(chainId)) {
        watchedAddressesByChain.set(chainId, new Set());
    }

    const chainAddresses = watchedAddressesByChain.get(chainId)!;
    addressArray.forEach((address) => chainAddresses.add(address.toLowerCase()));

    // Always reload the listener with all addresses
    await setupChainListener(chainId, Array.from(chainAddresses));
};

// Function to setup a single chain listener
const setupChainListener = async (chainId: string, addresses: string[]) => {
    console.log("Setting up chain listener for chain", chainId, "with addresses", addresses);
    const provider = getChainProvider(chainId);

    if (addresses.length > 0) {
        // Remove any existing listener for this chain
        if (activeListeners.get(chainId)) {
            await provider.removeAllListeners();
        }

        // Set up new listener
        await provider.on(
            {
                address: addresses,
                topics: [Object.values(TOPICS)],
            },
            async (log: Log) => {
                const block = await provider.getBlock(log.blockNumber!);
                if (block) {
                    handleEventType(log, block, log.address);
                }
            }
        );

        activeListeners.set(chainId, true);
        console.log(` Chain ${chainId}: Listening to ${addresses.length} contracts`);
    }
};

// Function to start listening for all chains
export const startListener = async (contracts: { address: string; chain_id: number }[]) => {
    // Group contracts by chain
    const contractsByChain = contracts.reduce((acc, { address, chain_id }) => {
        if (!acc[chain_id]) acc[chain_id] = [];
        acc[chain_id].push(address);
        return acc;
    }, {} as Record<number, string[]>);

    // Start one listener per chain
    for (const [chainId, addresses] of Object.entries(contractsByChain)) {
        // Add addresses to watch list
        if (!watchedAddressesByChain.has(chainId)) {
            watchedAddressesByChain.set(chainId, new Set());
        }
        addresses.forEach((addr) => watchedAddressesByChain.get(chainId)!.add(addr.toLowerCase()));

        const contracts = Array.from(watchedAddressesByChain.get(chainId) || []);
        // Setup single listener for this chain
        await setupChainListener(chainId, contracts);
    }
};

export const reamoveAllListeners = async () => {
    for (const [chainId, provider] of providers.entries()) {
        console.log(`Removing listeners for chain ${chainId}...`);
        await provider.removeAllListeners();
        providers.delete(chainId);
        activeListeners.set(chainId, false);
    }
};

// Update handleEventType to include chainId
const handleEventType = async (log: Log, block: Block, deployed_to: string) => {
    const topic = get(log, "topics.0", null);
    console.log(" | Handling event type", topic);
    switch (topic) {
        case TOPICS.StockClassCreated:
            const stockClassIdBytes = get(log, "topics.1", null);
            if (!stockClassIdBytes) {
                console.error("No stock class id found");
                return;
            }
            const [stockClassIdBytes16] = abiCoder.decode(["bytes16"], stockClassIdBytes);
            await handleStockClass(stockClassIdBytes16, log.transactionHash);
            break;

        case TOPICS.StakeholderCreated:
            const stakeholderIdBytes = get(log, "topics.1", null);
            if (!stakeholderIdBytes) {
                console.error("No stakeholder id found");
                return;
            }
            const [stakeholderIdBytes16] = abiCoder.decode(["bytes16"], stakeholderIdBytes);
            await handleStakeholder(stakeholderIdBytes16, log.transactionHash);
            break;

        case TOPICS.TxCreated:
            console.log(" | TxCreated event");
            const issuer = await Issuer.findOne({ deployed_to });
            if (!issuer) {
                console.error("No issuer found");
                return;
            }
            const issuerId = issuer._id;
            const decoded = abiCoder.decode(["uint8", "bytes"], log.data);
            console.log(" | Decoded data", decoded);
            const txTypeIdx = decoded[0] as number;
            const txData = decoded[1] as string;

            const txType = txTypes[txTypeIdx];
            // @ts-ignore
            const [structType, handleFunc] = txMapper[txTypeIdx];
            console.log(" | Struct type", structType);
            const _structType = Array.isArray(structType) ? structType : [structType];
            const decodedData = abiCoder.decode(_structType, txData);

            const _tx = {
                type: txType,
                timestamp: block.timestamp,
                data: Array.isArray(structType) ? decodedData : decodedData[0], // TODO: Handle multiple structs
            };

            if (handleFunc) {
                console.log("Handling transaction:", txType);
                console.log(" | Transaction data", _tx.data);
                await handleFunc(_tx.data, issuerId, _tx.timestamp, log.transactionHash);
                console.log(" | Transaction handled:", txType);
            } else {
                console.error("Invalid transaction type: ", txType);
                throw new Error(`Invalid transaction type: "${txType}"`);
            }
            break;
        case TOPICS.StockPlanCreated:
            console.log(" | StockPlanCreated event");
            console.log(" | topics", log.topics);
            const stockPlanIdBytes = get(log, "topics.1", null);
            const sharesReservedBytes = get(log, "data", null);
            if (!stockPlanIdBytes || !sharesReservedBytes) {
                console.error("No stock plan id found");
                return;
            }
            const [stockPlanIdBytes16] = abiCoder.decode(["bytes16"], stockPlanIdBytes);
            const [sharesReserved] = abiCoder.decode(["uint256"], sharesReservedBytes);
            console.log(" | stockPlanIdBytes16", stockPlanIdBytes16);
            console.log(" | sharesReserved", sharesReserved);
            await handleStockPlan(stockPlanIdBytes16, sharesReserved, log.transactionHash);
            break;

        default:
            console.warn(`Unhandled topic ${topic} for address: ${deployed_to}`);
    }
};
