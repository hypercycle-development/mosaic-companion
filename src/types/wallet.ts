// Wallet Types and Configuration

export type ChainId = 1 | 8453; // Ethereum Mainnet = 1, Base = 8453

export interface ChainConfig {
  id: ChainId;
  name: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
}

export interface WalletState {
  address: string | null;
  chainId: ChainId | null;
  balance: string;
  isConnected: boolean;
}

export interface ContractInfo {
  address: string;
  chainId: ChainId;
  name: string;
  type: "license" | "anfe";
}

// Supported chains
export const SUPPORTED_CHAINS: Record<ChainId, ChainConfig> = {
  1: {
    id: 1,
    name: "Ethereum",
    rpcUrl: "https://eth.llava.fi",
    blockExplorer: "https://etherscan.io",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  },
  8453: {
    id: 8453,
    name: "Base",
    rpcUrl: "https://mainnet.base.org",
    blockExplorer: "https://basescan.org",
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
  },
};

// Contract addresses
// HyperCycleLicense is the ERC721 contract that holds your license NFTs
export const HYPERCYCLE_CONTRACTS: ContractInfo[] = [
  {
    address: "0xd32cb5f76989a27782e44c5297aaba728ad61669",
    chainId: 1,
    name: "HyperCycle License",
    type: "license",
  },
  {
    address: "0x8c0075D087de9588DdF5c1441dF39828d695bc2f",
    chainId: 8453,
    name: "ANFE (Advanced Node Factory)",
    type: "anfe",
  },
];

// ERC-721 ABI for reading balances and tokens
export const ERC721_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

// HyperCycle License ABI
export const HYPERCYCLE_LICENSE_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenData(uint256 tokenId) view returns (uint8 status, uint8 height, string burnData)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

// ANFE ABI - ERC-1155 contract
// ERC-1155 uses balanceOf(address, id) not balanceOf(address)
export const ANFE_ABI = [
  "function balanceOf(address account, uint256 id) view returns (uint256)",
  "function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])",
  "function isApprovedForAll(address account, address operator) view returns (bool)",
  "function safeBatchTransferFrom(address from, address to, uint256[] ids, uint256[] amounts, bytes data) returns",
  "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data) returns",
  "function uri(uint256 id) view returns (string)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
];

// Window ethereum type declaration - merged with existing
declare global {
  // Ethereum wallet extension
  interface WindowEthereum {
    isMetaMask?: boolean;
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    on: (event: string, callback: (...args: unknown[]) => void) => void;
    removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
  }
}

export {};