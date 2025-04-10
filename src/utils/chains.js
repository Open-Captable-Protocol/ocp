// Chain configuration for supported networks
export const SUPPORTED_CHAINS = {
    8453: {
        // Base Mainnet
        name: "Base Mainnet",
        rpcUrl: process.env.RPC_URL,
        wsUrl: (process.env.RPC_URL || "").replace("https://", "wss://"),
    },
    84532: {
        // Base Sepolia
        name: "Base Sepolia",
        rpcUrl: process.env.RPC_URL,
        wsUrl: (process.env.RPC_URL || "").replace("https://", "wss://"),
    },
    31337: {
        // Anvil
        name: "Anvil",
        rpcUrl: "http://localhost:8545",
        wsUrl: "ws://localhost:8545",
    },
};

// Get chain configuration
export function getChainConfig(chainId) {
    return SUPPORTED_CHAINS[chainId];
}
