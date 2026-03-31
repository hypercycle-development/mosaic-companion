// Map chainId -> TokenSymbol -> TokenMetadata
const registry = {
    // ETH Mainnet
    1: {
        USDC: {
            address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            decimals: 6,
            symbol: 'USDC',
        },
        HyPC: {
            address: '0x103cCeFafE2E3f389366118D07218683e33fCDE0', // Official placeholder or resolved ETH mainnet HyPC contract
            decimals: 18,
            symbol: 'HyPC',
        },
    },
    // Base Mainnet
    8453: {
        USDC: {
            address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
            decimals: 6,
            symbol: 'USDC',
        },
    },
    // ETH Sepolia
    11155111: {
        USDC: {
            address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
            decimals: 6,
            symbol: 'USDC',
        },
    }
};
export function getToken(chainId, symbol) {
    const chainTokens = registry[chainId];
    if (!chainTokens) {
        throw new Error(`Token registry missing configuration for chainId: ${chainId}`);
    }
    const token = chainTokens[symbol.toUpperCase()];
    if (!token) {
        throw new Error(`Token ${symbol} is not registered for chainId: ${chainId}`);
    }
    return token;
}
