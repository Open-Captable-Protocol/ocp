// TODO https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-7.md
// Once changed from chainId: number to CAIP-7: string, use `canton:mainnet` and `canton:devnet`

export const CANTON_MAINNET_CHAIN_ID = 6765788401;
export const CANTON_DEVNET_CHAIN_ID = 6765788402;

export function isCantonChainId(chainId) {
    return chainId == CANTON_MAINNET_CHAIN_ID || chainId == CANTON_DEVNET_CHAIN_ID;
}
