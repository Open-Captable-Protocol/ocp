import { ethers } from "ethers";
import CAP_TABLE from "../../chain/out/DiamondCapTable.sol/DiamondCapTable.json";
import { setupEnv } from "../utils/env.js";
import getTXLibContracts from "../utils/getLibrariesContracts.js";
import getProvider from "./getProvider.js";
import STAKEHOLDER_FACET from "../../chain/out/StakeholderFacet.sol/StakeholderFacet.json";
import ISSUER_FACET from "../../chain/out/IssuerFacet.sol/IssuerFacet.json";
import STOCK_CLASS_FACET from "../../chain/out/StockClassFacet.sol/StockClassFacet.json";
import STOCK_FACET from "../../chain/out/StockFacet.sol/StockFacet.json";
import CONVERTIBLE_FACET from "../../chain/out/ConvertiblesFacet.sol/ConvertiblesFacet.json";
import WARRANT_FACET from "../../chain/out/WarrantFacet.sol/WarrantFacet.json";
import EQUITY_COMPENSATION_FACET from "../../chain/out/EquityCompensationFacet.sol/EquityCompensationFacet.json";
import STOCK_PLAN_FACET from "../../chain/out/StockPlanFacet.sol/StockPlanFacet.json";

setupEnv();

const provider = getProvider();
export const getContractInstance = (address) => {
    const WALLET_PRIVATE_KEY = process.env.PRIVATE_KEY;
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

    const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);
    const contract = new ethers.Contract(address, combinedABI, wallet);
    const libraries = getTXLibContracts(contract.target, wallet);

    return { contract, provider, libraries };
};
