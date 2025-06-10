import { ethers } from "ethers";
import CAP_TABLE_FACTORY from "../../chain/out/CapTableFactory.sol/CapTableFactory.json";
import { facetsABI } from "../utils/errorDecoder.js";
import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";
import { setupEnv } from "../utils/env.js";
import getProvider from "./getProvider.js";
import Factory, { FACTORY_VERSION } from "../db/objects/Factory.js";
import assert from "node:assert";
import { decodeError } from "../utils/errorDecoder";
import { CANTON_CHAIN_ID } from "./canton/constants.js";
import { deployCapTableCanton } from "./canton/deployCapTableCanton.js";

setupEnv();

const WALLET_PRIVATE_KEY = process.env.PRIVATE_KEY;

export const getWallet = async (chainId) => {
    assert(WALLET_PRIVATE_KEY, "WALLET_PRIVATE_KEY is not set");
    assert(chainId, "chainId is not set");

    const provider = getProvider(chainId);
    return new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
};

async function deployCapTable(issuerId, initial_shares_authorized, chainId) {
    if (chainId === CANTON_CHAIN_ID) {
        return deployCapTableCanton(issuerId, initial_shares_authorized, chainId);
    }

    // Get provider for specified chain
    const wallet = await getWallet(chainId);
    console.log("🗽 | Wallet address: ", wallet.address);

    // Find most recent factory for this chain
    // Refactor: Query factory by id after linking issuer so instead of storing chainId in issuer we story `factory`
    // it's gonna be done after next migration
    const factory = await Factory.findOne(
        {
            version: FACTORY_VERSION.DIAMOND,
            chain_id: chainId,
        },
        null,
        { sort: { createdAt: -1 } }
    );

    if (!factory) {
        throw new Error(`No factory found for chain ${chainId} with version DIAMOND`);
    }

    const factoryAddress = factory.factory_address;
    if (!factoryAddress) {
        throw new Error(`Factory address not found for chain ${chainId}`);
    }
    console.log("🏭 | Factory address: ", factoryAddress);

    const capTableFactory = new ethers.Contract(factoryAddress, CAP_TABLE_FACTORY.abi, wallet);

    let receipt;
    let captableAddress;
    try {
        console.log("Creating a new cap table...");
        const tx = await capTableFactory.createCapTable(issuerId, toScaledBigNumber(initial_shares_authorized));
        receipt = await tx.wait();
        console.log("Cap table created");

        const capTableCount = await capTableFactory.getCapTableCount();
        console.log("📄 | Cap table count: ", capTableCount);

        captableAddress = await capTableFactory.capTables(capTableCount - BigInt(1));
        console.log("✅ | Cap table address: ", captableAddress);
    } catch (error) {
        const decodedError = decodeError(error);
        console.log("Error creating cap table:", decodedError);
        throw decodedError;
    }

    return {
        contract: new ethers.Contract(captableAddress, facetsABI, wallet),
        address: captableAddress,
        deployHash: receipt.hash,
        receipt,
        factory,
    };
}

export default deployCapTable;
