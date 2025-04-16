import { ethers } from "ethers";
import CAP_TABLE_FACTORY from "../../chain/out/CapTableFactory.sol/CapTableFactory.json";
import STAKEHOLDER_FACET from "../../chain/out/StakeholderFacet.sol/StakeholderFacet.json";
import ISSUER_FACET from "../../chain/out/IssuerFacet.sol/IssuerFacet.json";
import STOCK_CLASS_FACET from "../../chain/out/StockClassFacet.sol/StockClassFacet.json";
import STOCK_FACET from "../../chain/out/StockFacet.sol/StockFacet.json";
import CONVERTIBLE_FACET from "../../chain/out/ConvertiblesFacet.sol/ConvertiblesFacet.json";
import WARRANT_FACET from "../../chain/out/WarrantFacet.sol/WarrantFacet.json";
import EQUITY_COMPENSATION_FACET from "../../chain/out/EquityCompensationFacet.sol/EquityCompensationFacet.json";
import STOCK_PLAN_FACET from "../../chain/out/StockPlanFacet.sol/StockPlanFacet.json";
import STAKEHOLDER_NFT_FACET from "../../chain/out/StakeholderNFTFacet.sol/StakeholderNFTFacet.json";
import ACCESS_CONTROL_FACET from "../../chain/out/AccessControlFacet.sol/AccessControlFacet.json";
import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";
import { setupEnv } from "../utils/env.js";
import getProvider from "./getProvider.js";
import { findOne } from "../db/operations/atomic";
import Factory from "../db/objects/Factory.js";
import assert from "node:assert";

setupEnv();

export const facetsABI = [
    ...STAKEHOLDER_FACET.abi,
    ...ISSUER_FACET.abi,
    ...STOCK_CLASS_FACET.abi,
    ...STOCK_FACET.abi,
    ...STOCK_PLAN_FACET.abi,
    ...CONVERTIBLE_FACET.abi,
    ...WARRANT_FACET.abi,
    ...EQUITY_COMPENSATION_FACET.abi,
    ...STAKEHOLDER_NFT_FACET.abi,
    ...ACCESS_CONTROL_FACET.abi,
];

const WALLET_PRIVATE_KEY = process.env.PRIVATE_KEY;

export const getWallet = async (chainId) => {
    assert(WALLET_PRIVATE_KEY, "WALLET_PRIVATE_KEY is not set");
    assert(chainId, "chainId is not set");

    const provider = getProvider(chainId);
    console.log("🗽 | Wallet address: ", new ethers.Wallet(WALLET_PRIVATE_KEY, provider).address);
    console.log("Chain ID:", chainId);
    console.log("Factory address from env:", process.env.FACTORY_ADDRESS);
    console.log("Provider:", provider);

    return new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
};

async function deployCapTable(issuerId, initial_shares_authorized, chainId) {
    // Get provider for specified chain
    const wallet = await getWallet(chainId);
    console.log("🗽 | Wallet address: ", wallet.address);

    // Find factory for this chain
    console.log("Looking for factory with chain_id:", chainId, typeof chainId);
    const factory = await findOne(Factory, { chain_id: chainId });
    console.log("Found factory:", factory);
    const factoryAddress = factory?.factory_address;

    if (!factoryAddress) {
        throw new Error(`Factory not found for chain ${chainId}`);
    }
    console.log("🏭 | Factory address: ", factoryAddress);

    const capTableFactory = new ethers.Contract(factoryAddress, CAP_TABLE_FACTORY.abi, wallet);

    console.log("Creating a new cap table...");
    const tx = await capTableFactory.createCapTable(issuerId, toScaledBigNumber(initial_shares_authorized));
    const receipt = await tx.wait();
    console.log("Cap table created");

    const capTableCount = await capTableFactory.getCapTableCount();
    console.log("📄 | Cap table count: ", capTableCount);

    const captableAddress = await capTableFactory.capTables(capTableCount - BigInt(1));
    console.log("✅ | Cap table address: ", captableAddress);

    return {
        contract: new ethers.Contract(captableAddress, facetsABI, wallet),
        address: captableAddress,
        deployHash: receipt.hash,
        receipt,
    };
}

export default deployCapTable;
