export const CANTON_MAINNET_CHAIN_ID = 6765788401;
export const CANTON_DEVNET_CHAIN_ID = 6765788402;

export function isCantonChainId(chainId) {
    return chainId == CANTON_MAINNET_CHAIN_ID || chainId == CANTON_DEVNET_CHAIN_ID;
}
