/* eslint-disable no-case-declarations */

import { Log, AbiCoder, Block, ethers } from "ethers";
import getProvider from "../chain-operations/getProvider";
import get from "lodash/get.js";
import { handleStockPlan, txMapper, txTypes } from "../chain-operations/transactionHandlers";
import { handleStakeholder, handleStockClass } from "../chain-operations/transactionHandlers";
import Issuer from "../db/objects/Issuer";

const TOPICS = {
    // TODO: automatically generate these topics from the events in the contract
    TxCreated: ethers.id("TxCreated(uint8,bytes)"),
    StakeholderCreated: "0x53df47344d1cdf2ddb4901af5df61e37e14606bb7c8cc004d65c7c83ab3d0693",
    StockClassCreated: "0xc7496d70298fcc793e1d058617af680232585e302f0185b14bba498b247a9c1d",
    StockPlanCreated: ethers.id("StockPlanCreated(bytes16,uint256)"),
    // IssuerCreated: "0xb8cbde9f597f493a1b4d1c4db5fded9cd26293080750a0df6b7e7097f4b680dd", // We don't receive this event because by time an issuer is created and we add it to the listener we have already missed it.
};

const abiCoder = new AbiCoder();

// Create a map to store providers and their active listeners
const providers = new Map<number, ethers.Provider>();
const activeListeners = new Map<number, boolean>();
const watchedAddressesByChain = new Map<number, Set<string>>();

// Function to get or create provider for a chain
const getChainProvider = (chainId: number): ethers.Provider => {
    if (!providers.has(chainId)) {
        providers.set(chainId, getProvider(chainId) as ethers.Provider);
    }
    return providers.get(chainId)!;
};

// Function to add new addresses to watch for a specific chain
export const addAddressesToWatch = async (addresses: string | string[], chainId: number) => {
    const addressArray = Array.isArray(addresses) ? addresses : [addresses];

    if (!watchedAddressesByChain.has(chainId)) {
        watchedAddressesByChain.set(chainId, new Set());
    }

    const chainAddresses = watchedAddressesByChain.get(chainId)!;
    addressArray.forEach((address) => chainAddresses.add(address.toLowerCase()));

    // Only update filter if we don't have an active listener for this chain
    if (!activeListeners.get(chainId)) {
        await setupChainListener(chainId);
    }
};

// Function to setup a single chain listener
const setupChainListener = async (chainId: number) => {
    const provider = getChainProvider(chainId);
    const addresses = Array.from(watchedAddressesByChain.get(chainId) || []);

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
        const numericChainId = parseInt(chainId);
        // Add addresses to watch list
        if (!watchedAddressesByChain.has(numericChainId)) {
            watchedAddressesByChain.set(numericChainId, new Set());
        }
        addresses.forEach((addr) => watchedAddressesByChain.get(numericChainId)!.add(addr.toLowerCase()));

        // Setup single listener for this chain
        await setupChainListener(numericChainId);
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
            await handleStockClass(stockClassIdBytes16);
            break;

        case TOPICS.StakeholderCreated:
            const stakeholderIdBytes = get(log, "topics.1", null);
            if (!stakeholderIdBytes) {
                console.error("No stakeholder id found");
                return;
            }
            const [stakeholderIdBytes16] = abiCoder.decode(["bytes16"], stakeholderIdBytes);
            await handleStakeholder(stakeholderIdBytes16);
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
            const decodedData = abiCoder.decode([structType], txData);

            const _tx = {
                type: txType,
                timestamp: block.timestamp,
                data: decodedData[0],
            };

            if (handleFunc) {
                console.log("Handling transaction:", txType);
                await handleFunc(_tx.data, issuerId, _tx.timestamp);
                console.log(" | Transaction handled:", txType);
            } else {
                console.error("Invalid transaction type: ", txType);
                throw new Error(`Invalid transaction type: "${txType}"`);
            }
            break;
        case TOPICS.StockPlanCreated:
            const stockPlanIdBytes = get(log, "topics.1", null);
            const sharesReservedBytes = get(log, "topics.2", null);
            if (!stockPlanIdBytes || !sharesReservedBytes) {
                console.error("No stock plan id found");
                return;
            }
            const [stockPlanIdBytes16] = abiCoder.decode(["bytes16"], stockPlanIdBytes);
            const [sharesReserved] = abiCoder.decode(["uint256"], sharesReservedBytes);
            await handleStockPlan(stockPlanIdBytes16, sharesReserved);
            break;

        default:
            console.warn(`Unhandled topic ${topic} for address: ${deployed_to}`);
    }
};
