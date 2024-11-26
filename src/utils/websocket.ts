/* eslint-disable no-case-declarations */

import { Log, AbiCoder, Block, ethers } from "ethers";
import { Provider } from "ethers/src.ts/providers";
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
// Create a Set to store unique addresses
const watchedAddresses = new Set<string>();

// Function to add new addresses to the filter (can handle single or multiple addresses)
export const addAddressesToWatch = (addresses: string | string[]) => {
    const addressArray = Array.isArray(addresses) ? addresses : [addresses];
    addressArray.forEach((address) => watchedAddresses.add(address));
    updateProviderFilter();
};

// Function to remove addresses from the filter (can handle single or multiple addresses)
export const removeAddressesToWatch = (addresses: string | string[]) => {
    const addressArray = Array.isArray(addresses) ? addresses : [addresses];
    addressArray.forEach((address) => watchedAddresses.delete(address));
    updateProviderFilter();
};

// let provider: Provider;
const provider = getProvider() as Provider;
let isSetup = false;

// Function to update the provider filter
const updateProviderFilter = () => {
    if (!provider) {
        console.log("🔗 | No provider found");
        return;
    }
    console.log("🔗 | Updating provider filter");
    isSetup = false;
    provider.removeAllListeners();
    setupProviderListener();
};

// Function to set up the provider listener
const setupProviderListener = () => {
    if (isSetup) {
        console.log("🔗 | listener already set up");
        return;
    }
    console.log("🔗 | Setting up provider listener");
    provider.on(
        {
            address: Array.from(watchedAddresses),
            topics: [Object.values(TOPICS)],
        },
        async (log: Log) => {
            const block = await log.getBlock();
            if (!block) {
                console.error("No block found");
                return;
            }
            const deployed_to = log.address;
            await handleEventType(log, block, deployed_to);
        }
    );

    provider.on("error", (err) => {
        console.error(err);
    });
    isSetup = true;
};

export const startListener = async (contracts: string[]) => {
    if (isSetup) {
        console.log("🔗 | Listener already setup");
        return;
    }
    console.log("🔗 | Starting listener");
    addAddressesToWatch(contracts);
    setupProviderListener();
};

const handleEventType = async (log: Log, block: Block, deployed_to: string) => {
    const topic = get(log, "topics.0", null);
    console.log("🔗 | Handling event type", topic);
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
            console.log("🔗 | TxCreated event");
            const issuer = await Issuer.findOne({ deployed_to });
            if (!issuer) {
                console.error("No issuer found");
                return;
            }
            const issuerId = issuer._id;
            const decoded = abiCoder.decode(["uint8", "bytes"], log.data);
            console.log("🔗 | Decoded data", decoded);
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
                console.log("✅ | Transaction handled:", txType);
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
