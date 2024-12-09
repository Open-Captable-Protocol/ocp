// Chain configuration for supported networks
export const SUPPORTED_CHAINS = {
    8453: {
        // Base Mainnet
        name: "Base Mainnet",
        rpcUrl: process.env.BASE_RPC_URL,
        wsUrl: process.env.BASE_WS_URL,
    },
    84532: {
        // Base Sepolia
        name: "Base Sepolia",
        rpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
        wsUrl: process.env.BASE_SEPOLIA_WS_URL,
    },
    31337: {
        // Anvil
        name: "Anvil",
        rpcUrl: "http://localhost:8545",
        wsUrl: "ws://localhost:8545",
    },
    31338: {
        // Anvil
        name: "Anvil2",
        rpcUrl: "http://localhost:8546",
        wsUrl: "ws://localhost:8546",
    },
};

// Get chain configuration
export function getChainConfig(chainId) {
    return SUPPORTED_CHAINS[chainId];
}
