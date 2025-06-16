import { ethers } from "ethers";
import { getChainConfig } from "../utils/chains.js";

function getProvider(chainId) {
    const chainConfig = getChainConfig(chainId);
    if (!chainConfig) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    console.log(`Using RPC URL for chain ${chainId}: ${chainConfig.rpcUrl}`);
    if (!chainConfig.rpcUrl) {
        throw new Error(`RPC URL not configured for chain ${chainId}. Please set the appropriate environment variable.`);
    }

    return new ethers.JsonRpcProvider(chainConfig.rpcUrl);
}

export default getProvider;
