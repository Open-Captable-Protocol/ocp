import { ethers } from "ethers";
import { getChainConfig } from "../utils/chains.js";

function getProvider(chainId) {
    const chainConfig = getChainConfig(chainId);
    if (!chainConfig) {
        throw new Error(`Unsupported chain ID: ${chainId}`);
    }

    return new ethers.JsonRpcProvider(chainConfig.rpcUrl);
}

export default getProvider;
