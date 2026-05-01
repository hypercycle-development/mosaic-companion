import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet, base, sepolia } from 'viem/chains';
// ERC20 minimum ABI
const erc20Abi = [
    {
        type: 'function',
        name: 'transfer',
        inputs: [
            { name: 'recipient', type: 'address' },
            { name: 'amount', type: 'uint256' },
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable',
    },
];
/**
 * Concrete implementation of IPaymentSigner AND INodeSigner
 * wrapping viem for the Mosaic internal wallet context.
 */
export class InternalWalletPaymentSigner {
    walletClient;
    publicClient;
    account;
    storedRpcUrl;
    constructor(config) {
        const { privateKey, chainId, rpcUrl } = config;
        // Dynamically require privateKeyToAccount to avoid polluting renderer if imported there accidentally
        const { privateKeyToAccount } = require('viem/accounts');
        this.account = privateKeyToAccount(privateKey);
        this.storedRpcUrl = rpcUrl;
        this.switchClients(chainId, rpcUrl);
    }
    switchClients(chainId, rpcUrl) {
        const chain = [mainnet, base, sepolia].find((c) => c.id === chainId) || mainnet;
        const transport = rpcUrl ? http(rpcUrl) : http();
        this.publicClient = createPublicClient({
            chain,
            transport,
        });
        this.walletClient = createWalletClient({
            account: this.account,
            chain,
            transport,
        });
    }
    async switchNetwork(chainId, rpcUrl) {
        // Preserve the stored RPC URL if no explicit override is provided
        this.switchClients(chainId, rpcUrl || this.storedRpcUrl);
    }
    async getAddress() {
        return this.account.address;
    }
    async getChainId() {
        return this.publicClient.chain.id;
    }
    async signMessage(message) {
        return await this.walletClient.signMessage({ message });
    }
    async sendErc20Transfer(args) {
        const { tokenAddress, to, amount } = args;
        const { request } = await this.publicClient.simulateContract({
            account: this.account,
            address: tokenAddress,
            abi: erc20Abi,
            functionName: 'transfer',
            args: [to, amount],
        });
        const txHash = await this.walletClient.writeContract(request);
        return { txHash };
    }
    async waitForConfirmations(args) {
        // Instead of relying on viem's waitForTransactionReceipt (which has RPC polling issues
        // in Electron), we use a simple delay to give the chain time to confirm.
        // The node manager itself will verify the on-chain tx when we POST /balance with tx-id.
        const blockTimeMs = 15_000; // ~12-15s per ETH mainnet block
        console.error?.(`[web3Tools] Waiting ${blockTimeMs}ms for tx ${args.txHash.slice(0, 12)}... to be included in a block`);
        await new Promise(resolve => setTimeout(resolve, blockTimeMs));
        console.error?.(`[web3Tools] Wait complete. Proceeding to claim.`);
    }
}
