import { ethers } from "ethers";
import CAP_TABLE from "../../chain/out/DiamondCapTable.sol/DiamondCapTable.json";
import CAP_TABLE_FACTORY from "../../chain/out/DiamondCapTableFactory.sol/DiamondCapTableFactory.json";
import STAKEHOLDER_FACET from "../../chain/out/StakeholderFacet.sol/StakeholderFacet.json";
import ISSUER_FACET from "../../chain/out/IssuerFacet.sol/IssuerFacet.json";
import STOCK_CLASS_FACET from "../../chain/out/StockClassFacet.sol/StockClassFacet.json";
import STOCK_FACET from "../../chain/out/StockFacet.sol/StockFacet.json";
import CONVERTIBLE_FACET from "../../chain/out/ConvertiblesFacet.sol/ConvertiblesFacet.json";
import WARRANT_FACET from "../../chain/out/WarrantFacet.sol/WarrantFacet.json";
import EQUITY_COMPENSATION_FACET from "../../chain/out/EquityCompensationFacet.sol/EquityCompensationFacet.json";
import STOCK_PLAN_FACET from "../../chain/out/StockPlanFacet.sol/StockPlanFacet.json";
import { toScaledBigNumber } from "../utils/convertToFixedPointDecimals.js";
import { setupEnv } from "../utils/env.js";
import getProvider from "./getProvider.js";

setupEnv();

async function deployCapTable(issuerId, initial_shares_authorized) {
    const WALLET_PRIVATE_KEY = process.env.PRIVATE_KEY;
    const provider = getProvider();
    const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
    console.log("🗽 | Wallet address: ", wallet.address);

    // const factories = await readfactories();
    const factoryAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // factories[0]?.factory_address;
    // console.log({ factories, factoryAddress });

    if (!factoryAddress) {
        throw new Error(`❌ | Factory address not found`);
    }

    const capTableFactory = new ethers.Contract(factoryAddress, CAP_TABLE_FACTORY.abi, wallet);

    console.log("Creating a new cap table...");
    const tx = await capTableFactory.createCapTable(issuerId, toScaledBigNumber(initial_shares_authorized));
    await tx.wait();
    console.log("Cap table created");

    const capTableCount = await capTableFactory.getCapTableCount();
    console.log("📄 | Cap table count: ", capTableCount);

    const diamondAddress = await capTableFactory.capTables(capTableCount - BigInt(1));
    console.log("✅ | Diamond address: ", diamondAddress);

    // Create a combined ABI from all facets
    const combinedABI = [
        ...CAP_TABLE.abi,
        ...STAKEHOLDER_FACET.abi,
        ...ISSUER_FACET.abi,
        ...STOCK_CLASS_FACET.abi,
        ...STOCK_FACET.abi,
        ...STOCK_PLAN_FACET.abi,
        ...CONVERTIBLE_FACET.abi,
        ...WARRANT_FACET.abi,
        ...EQUITY_COMPENSATION_FACET.abi,
    ];

    // Create the diamond contract with combined ABI
    const diamond = new ethers.Contract(diamondAddress, combinedABI, wallet);

    // Return both the diamond contract and individual facet contracts
    return {
        contract: diamond, // Main diamond contract with all facets
        // facets: {
        //     stakeholder: new ethers.Contract(diamondAddress, STAKEHOLDER_FACET.abi, wallet),
        //     issuer: new ethers.Contract(diamondAddress, ISSUER_FACET.abi, wallet),
        //     stockClass: new ethers.Contract(diamondAddress, STOCK_CLASS_FACET.abi, wallet),
        //     stock: new ethers.Contract(diamondAddress, STOCK_FACET.abi, wallet),
        // },
        address: diamondAddress,
        deployHash: tx.hash,
    };
}

export default deployCapTable;
