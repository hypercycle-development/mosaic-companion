import { createPublicClient, createWalletClient, http, custom, getContract } from 'viem';
import { mainnet, base, sepolia } from 'viem/chains';
import { IPaymentSigner, Address } from '../shared/types';
import { INodeSigner } from '../../aim-nodes/shared/nodeManagerClient/types';

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
] as const;

export interface InternalWalletConfig {
  privateKey: `0x${string}`;
  chainId: number;
  rpcUrl?: string; // Optional custom RPC
}

/**
 * Concrete implementation of IPaymentSigner AND INodeSigner 
 * wrapping viem for the Mosaic internal wallet context.
 */
export class InternalWalletPaymentSigner implements IPaymentSigner, INodeSigner {
  private walletClient: any;
  private publicClient: any;
  private account: any;
  private storedRpcUrl?: string;

  constructor(config: InternalWalletConfig) {
    const { privateKey, chainId, rpcUrl } = config;

    // Dynamically require privateKeyToAccount to avoid polluting renderer if imported there accidentally
    const { privateKeyToAccount } = require('viem/accounts');
    this.account = privateKeyToAccount(privateKey);
    this.storedRpcUrl = rpcUrl;

    this.switchClients(chainId, rpcUrl);
  }

  private switchClients(chainId: number, rpcUrl?: string) {
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

  async switchNetwork(chainId: number, rpcUrl?: string): Promise<void> {
    // Preserve the stored RPC URL if no explicit override is provided
    this.switchClients(chainId, rpcUrl || this.storedRpcUrl);
  }

  async getAddress(): Promise<Address> {
    return this.account.address;
  }

  async getChainId(): Promise<number> {
    return this.publicClient.chain.id;
  }

  async signMessage(message: string): Promise<Address> {
    return await this.walletClient.signMessage({ message });
  }

  async sendErc20Transfer(args: { tokenAddress: Address; to: Address; amount: bigint }): Promise<{ txHash: Address }> {
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

  async waitForConfirmations(args: { txHash: Address; confirmations: number }): Promise<void> {
    // Instead of relying on viem's waitForTransactionReceipt (which has RPC polling issues
    // in Electron), we use a simple delay to give the chain time to confirm.
    // The node manager itself will verify the on-chain tx when we POST /balance with tx-id.
    const blockTimeMs = 15_000; // ~12-15s per ETH mainnet block
    console.error?.(`[web3Tools] Waiting ${blockTimeMs}ms for tx ${args.txHash.slice(0, 12)}... to be included in a block`);
    await new Promise(resolve => setTimeout(resolve, blockTimeMs));
    console.error?.(`[web3Tools] Wait complete. Proceeding to claim.`);
  }
}
