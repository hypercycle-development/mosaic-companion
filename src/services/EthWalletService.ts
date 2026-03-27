/**
 * ETH Wallet Service - Ethereum & BASE Wallet Integration
 * Supports: MetaMask, Rabby, Coinbase Wallet
 * Networks: Ethereum, Base, Base Sepolia
 */

import { ethers } from 'ethers';

// Extend Window interface for Ethereum wallet providers
declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: any[] }) => Promise<any>;
      on?: (event: string, callback: (...args: any[]) => void) => void;
      removeListener?: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

export type EthNetwork = 'ethereum' | 'base' | 'base-sepolia';

export interface EthWalletState {
  connected: boolean;
  address: string | null;
  chainId: number | null;
  balance: string | null;
  network: EthNetwork | null;
}

export interface EthNodeInfo {
  name: string;
  url: string;
  type: 'public' | 'factory' | 'anfe';
}

export const ETH_NETWORKS: Record<EthNetwork, { chainId: number; rpc: string; name: string }> = {
  ethereum: {
    chainId: 1,
    rpc: 'https://eth.llamarpc.com',
    name: 'Ethereum Mainnet'
  },
  base: {
    chainId: 8453,
    rpc: 'https://base.llamarpc.com',
    name: 'Base'
  },
  'base-sepolia': {
    chainId: 84532,
    rpc: 'https://base-sepolia.llamarpc.com',
    name: 'Base Sepolia'
  }
};

// ETH Node Factories & ANFEs
export const ETH_NODE_FACTORIES: EthNodeInfo[] = [
  { name: 'Alchemy', url: 'https://eth-mainnet.g.alchemy.com/v2/', type: 'factory' },
  { name: 'Infura', url: 'https://mainnet.infura.io/v3/', type: 'factory' },
  { name: 'QuickNode', url: 'https://docs.quiknode.io/', type: 'factory' },
  { name: 'Tenderly', url: 'https://rpc.tenderly.co', type: 'factory' }
];

export const BASE_ANFES: EthNodeInfo[] = [
  { name: 'Base RPC (Public)', url: 'https://base.llamarpc.com', type: 'public' },
  { name: 'Base RPC (Infura)', url: 'https://base-mainnet.infura.io/v3/', type: 'factory' },
  { name: 'Base ANFE-Alchemy', url: 'https://base.g.alchemy.com/v2/', type: 'anfe' },
  { name: 'Base ANFE-Tenderly', url: 'https://base.tenderly.co', type: 'anfe' }
];

class EthWalletService {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.Signer | null = null;
  private state: EthWalletState = {
    connected: false,
    address: null,
    chainId: null,
    balance: null,
    network: null
  };

  async connect(): Promise<EthWalletState> {
    if (!window.ethereum) {
      throw new Error('No ETH wallet found. Please install MetaMask.');
    }

    try {
      this.provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await this.provider.send('eth_requestAccounts', []);
      
      if (accounts.length > 0) {
        this.signer = await this.provider.getSigner();
        const address = accounts[0];
        const networkInfo = await this.provider.getNetwork();
        const balance = await this.provider.getBalance(address);
        
        const networkKey = networkInfo.chainId === 1n ? 'ethereum' 
          : networkInfo.chainId === 8453n ? 'base' 
          : networkInfo.chainId === 84532n ? 'base-sepolia' : null;

        this.state = {
          connected: true,
          address,
          chainId: Number(networkInfo.chainId),
          balance: ethers.formatEther(balance),
          network: networkKey as EthNetwork
        };
      }
      
      return this.state;
    } catch (error) {
      console.error('ETH wallet connection failed:', error);
      throw error;
    }
  }

  async switchNetwork(network: EthNetwork): Promise<void> {
    if (!window.ethereum) return;

    const targetChainId = '0x' + ETH_NETWORKS[network].chainId.toString(16);
    
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: targetChainId }]
      });
    } catch (error: any) {
      // Chain not added, add it
      if (error.code === 4902) {
        await this.addNetwork(network);
      }
    }
  }

  private async addNetwork(network: EthNetwork): Promise<void> {
    const config = ETH_NETWORKS[network];
    
    await window.ethereum?.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: '0x' + config.chainId.toString(16),
        chainName: config.name,
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: [config.rpc],
        blockExplorerUrls: network === 'base' ? ['https://basescan.org'] : ['https://etherscan.io']
      }]
    });
  }

  async getBalance(): Promise<string> {
    if (!this.provider || !this.state.address) return '0';
    const balance = await this.provider.getBalance(this.state.address);
    return ethers.formatEther(balance);
  }

  async sendTransaction(to: string, amount: string): Promise<string> {
    if (!this.signer) throw new Error('Wallet not connected');
    
    const tx = await this.signer.sendTransaction({
      to,
      value: ethers.parseEther(amount)
    });
    
    return tx.hash;
  }

  getState(): EthWalletState {
    return this.state;
  }

  async disconnect(): Promise<void> {
    this.provider = null;
    this.signer = null;
    this.state = {
      connected: false,
      address: null,
      chainId: null,
      balance: null,
      network: null
    };
  }
}

export const ethWalletService = new EthWalletService();
export default ethWalletService;