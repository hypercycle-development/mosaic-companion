// =============================================================================
// HYPERCYCLE CONTRACTS — Single Source of Truth
// All on-chain addresses for Ethereum and Base networks.
// Imported by: AdaPortal, StargatePool, ANFEService, Web3 tools, MosaicBot.
// =============================================================================

export const CHAIN_IDS = {
  ethereum: 1,
  base: 8453,
} as const;

export type HyperCycleChain = 'ethereum' | 'base';

// ---------------------------------------------------------------------------
// Ethereum Mainnet
// ---------------------------------------------------------------------------
export const ETH_CONTRACTS = {
  /** HyPC — fungible ERC-20 economic backing token */
  HyPC:              '0xea7b7dc089c9a4a916b5a7a37617f59fd54e37e4',
  /** HyPCL — Node Factory Licence (ERC-721) */
  HyPCL:             '0xd32CB5f76989A27782e44c5297AAba728Ad61669',
  /** c_HyPC — CHyPC compressed identity collateral (ERC-721) */
  c_HyPC:            '0x21468e63abF3783020750F7b2e57d4B34aFAfba6',
  /** ERC-1155 Node Factory */
  NodeFactory:       '0x4BFbA79CF232361a53eDdd17C67C6c77A6F00379',
} as const;

// ---------------------------------------------------------------------------
// Base Mainnet
// ---------------------------------------------------------------------------
export const BASE_CONTRACTS = {
  /** c_HyPCe — CHyPCe compressed identity collateral (ERC-721) */
  c_HyPC:            '0x674DdC6e324142713431a21D3E1BD0140cC700f7',
  /** HyPCL — ANFE Licence (ERC-721) */
  HyPCL:             '0x282b61FcBA0d77a8eE3e0De225AF6BFC11f44659',
  /** ANFE — Advanced Node Factory Enclosure (ERC-721) */
  ANFE:              '0x8c0075D087de9588DdF5c1441dF39828d695bc2f',
  /** c_AIMF — Aimifier */
  c_AIMF:            '0x998d350C59Fd7a4a524fcc987Adc811f25b886F4',
  /** c_IAIb — IoAI Box */
  c_IAIb:            '0x1dcbEEc07614aB8b3AEe828f19a9299ad0772eC1',
  /** c_IAIf — IoAI Federated */
  c_IAIf:            '0xf319fea203EB534BE138F86682B42d359424e905',
  /** c_IAIr — IoAI Registry */
  c_IAIr:            '0xaaA03DBEa02373Ce123b02B590265De428B17172',
  /** c_IAIs — IoAI Search */
  c_IAIs:            '0xe283deFF3736C12E313C19dF6FBbC896fcf246d3',
  /** c_OpnAI — Open IoAI */
  c_OpnAI:           '0x4795f8af5c8d2D9bceA287d7448435879A6d46dF',
  /** c_QntV — Quantum Verify */
  c_QntV:            '0x1512D4A43596a34593D6913462068F089879E8Cc',
  /** c_SpcN — Space Nodes */
  c_SpcN:            '0x2Be0d36d961E15879C865B0fA828710C65f60940',
} as const;

// ---------------------------------------------------------------------------
// Unified registry by chain
// ---------------------------------------------------------------------------
export const HYPERCYCLE_CONTRACTS: Record<HyperCycleChain, Record<string, string>> = {
  ethereum: { ...ETH_CONTRACTS },
  base:     { ...BASE_CONTRACTS },
};

// ---------------------------------------------------------------------------
// Subgraph endpoints
// ---------------------------------------------------------------------------
export const HYPERCYCLE_SUBGRAPHS = {
  ethereum: 'https://api.studio.thegraph.com/query/90034/hypercycle-ethereum/version/latest',
  base:     'https://api.studio.thegraph.com/query/90034/hypercycle-base/version/latest',
} as const;

// ---------------------------------------------------------------------------
// Merkelizer API — now HyperInsight (legacy IP-based endpoint is dead)
// ---------------------------------------------------------------------------
export const MERKELIZER_API = {
  baseUrl: 'https://api.hyperinsight.app/v1',
  endpoints: {
    uptime:  '/uptime',
    nodes:   '/nodes',
    compute: '/compute',
  },
} as const;

// ---------------------------------------------------------------------------
// Minimal ABIs for direct RPC calls (eth_call)
// ---------------------------------------------------------------------------

/** ERC-20: balanceOf(address) → uint256 */
export const ERC20_BALANCE_ABI = '0x70a08231';

/** ERC-721: ownerOf(uint256 tokenId) → address */
export const ERC721_OWNEROF_ABI = '0x6352211e';

/** ERC-721: balanceOf(address) → uint256 */
export const ERC721_BALANCE_ABI = '0x70a08231'; // Same selector as ERC-20

/** ERC-1155: balanceOf(address account, uint256 id) → uint256 */
export const ERC1155_BALANCE_ABI = '0x00fdd58e';

/** ERC-721 / ERC-1155: uri(uint256) → string (metadata) */
export const URI_ABI = '0x0e89341c';

/** ERC-721 Transfer event topic — keccak256('Transfer(address,address,uint256)') */
export const ERC721_TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/**
 * Build an eth_call data payload for ERC-20/ERC-721 balanceOf.
 * @param owner — wallet address (0x...)
 */
export function encodeBalanceOf(owner: string): string {
  const padded = owner.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
  return `${ERC20_BALANCE_ABI}${padded}`;
}

/**
 * Build an eth_call data payload for ERC-721 ownerOf.
 * @param tokenId — token ID as decimal string or hex
 */
export function encodeOwnerOf(tokenId: string): string {
  const idHex = tokenId.startsWith('0x')
    ? tokenId.replace(/^0x/i, '').padStart(64, '0')
    : BigInt(tokenId).toString(16).padStart(64, '0');
  return `${ERC721_OWNEROF_ABI}${idHex}`;
}

/**
 * Build an eth_call data payload for ERC-1155 balanceOf(account, id).
 * @param account — wallet address
 * @param id — token ID
 */
export function encodeERC1155BalanceOf(account: string, id: string): string {
  const accPadded = account.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
  const idPadded = id.startsWith('0x')
    ? id.replace(/^0x/i, '').padStart(64, '0')
    : BigInt(id).toString(16).padStart(64, '0');
  return `${ERC1155_BALANCE_ABI}${accPadded}${idPadded}`;
}

/**
 * Build an eth_call data payload for ERC-721 tokenOfOwnerByIndex.
 * @param owner — wallet address
 * @param index — token index (0-based)
 */
export function encodeTokenOfOwnerByIndex(owner: string, index: number): string {
  const paddedOwner = owner.replace(/^0x/i, '').toLowerCase().padStart(64, '0');
  const paddedIndex = BigInt(index).toString(16).padStart(64, '0');
  return `0x2f745c59${paddedOwner}${paddedIndex}`;
}

/** Decode a uint256 result from eth_call */
export function decodeUint256(hexResult: string): bigint {
  return BigInt(hexResult || '0');
}

/** Decode an address result from eth_call */
export function decodeAddress(hexResult: string): string {
  const stripped = hexResult.replace(/^0x/i, '');
  if (stripped.length < 40) return '0x0000000000000000000000000000000000000000';
  return '0x' + stripped.slice(-40).toLowerCase();
}

// ---------------------------------------------------------------------------
// Token metadata for Web3 wallet display
// ---------------------------------------------------------------------------

export interface HyperCycleTokenMeta {
  symbol: string;
  name: string;
  contract: string;
  chain: HyperCycleChain;
  decimals: number;
  standard: 'ERC-20' | 'ERC-721' | 'ERC-1155';
  category: 'fungible' | 'identity' | 'license' | 'factory' | 'module';
}

export const HYPERCYCLE_TOKENS: HyperCycleTokenMeta[] = [
  // Ethereum
  { symbol: 'HyPC',    name: 'HyperCycle Token',                  contract: ETH_CONTRACTS.HyPC,    chain: 'ethereum', decimals: 18, standard: 'ERC-20',  category: 'fungible' },
  { symbol: 'HyPCL',   name: 'Node Factory Licence',              contract: ETH_CONTRACTS.HyPCL,   chain: 'ethereum', decimals: 0,  standard: 'ERC-721', category: 'license' },
  { symbol: 'c_HyPC',  name: 'CHyPC Identity Collateral',         contract: ETH_CONTRACTS.c_HyPC,  chain: 'ethereum', decimals: 0,  standard: 'ERC-721', category: 'identity' },
  { symbol: 'NodeFac', name: 'Node Factory ERC-1155',             contract: ETH_CONTRACTS.NodeFactory, chain: 'ethereum', decimals: 0, standard: 'ERC-1155', category: 'factory' },
  // Base
  { symbol: 'c_HyPCe', name: 'CHyPCe Identity Collateral',        contract: BASE_CONTRACTS.c_HyPC, chain: 'base',     decimals: 0,  standard: 'ERC-721', category: 'identity' },
  { symbol: 'HyPCL-B', name: 'ANFE Licence',                    contract: BASE_CONTRACTS.HyPCL,  chain: 'base',     decimals: 0,  standard: 'ERC-721', category: 'license' },
  { symbol: 'ANFE',    name: 'Advanced Node Factory Enclosure',   contract: BASE_CONTRACTS.ANFE,   chain: 'base',     decimals: 0,  standard: 'ERC-721', category: 'factory' },
  { symbol: 'AIMF',    name: 'Aimifier',                          contract: BASE_CONTRACTS.c_AIMF, chain: 'base',     decimals: 0,  standard: 'ERC-721', category: 'module' },
  { symbol: 'IAIb',    name: 'IoAI Box',                          contract: BASE_CONTRACTS.c_IAIb, chain: 'base',     decimals: 0,  standard: 'ERC-721', category: 'module' },
  { symbol: 'IAIf',    name: 'IoAI Federated',                    contract: BASE_CONTRACTS.c_IAIf, chain: 'base',     decimals: 0,  standard: 'ERC-721', category: 'module' },
  { symbol: 'IAIr',    name: 'IoAI Registry',                     contract: BASE_CONTRACTS.c_IAIr, chain: 'base',     decimals: 0,  standard: 'ERC-721', category: 'module' },
  { symbol: 'IAIs',    name: 'IoAI Search',                       contract: BASE_CONTRACTS.c_IAIs, chain: 'base',     decimals: 0,  standard: 'ERC-721', category: 'module' },
  { symbol: 'OpnAI',   name: 'Open IoAI',                         contract: BASE_CONTRACTS.c_OpnAI,chain: 'base',     decimals: 0,  standard: 'ERC-721', category: 'module' },
  { symbol: 'QntV',    name: 'Quantum Verify',                    contract: BASE_CONTRACTS.c_QntV, chain: 'base',     decimals: 0,  standard: 'ERC-721', category: 'module' },
  { symbol: 'SpcN',    name: 'Space Nodes',                       contract: BASE_CONTRACTS.c_SpcN, chain: 'base',     decimals: 0,  standard: 'ERC-721', category: 'module' },
];

export default {
  ETH_CONTRACTS,
  BASE_CONTRACTS,
  HYPERCYCLE_CONTRACTS,
  HYPERCYCLE_SUBGRAPHS,
  MERKELIZER_API,
  HYPERCYCLE_TOKENS,
  encodeBalanceOf,
  encodeOwnerOf,
  encodeERC1155BalanceOf,
  encodeTokenOfOwnerByIndex,
  decodeUint256,
  decodeAddress,
};
