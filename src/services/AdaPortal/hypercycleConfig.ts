// ============================================
// ADA PORTAL - HyperCycle Configuration
// External API endpoints and settings
// ============================================

// HyperCycle Contract Addresses
export const HYPERCYCLE_CONTRACTS = {
  ethereum: {
    HyPC: '0xea7b7dc089c9a4a916b5a7a37617f59fd54e37e4',
    HyPCL: '0xd32CB5f76989A27782e44c5297AAba728Ad61669', // Node Factory Licence
    c_HyPC: '0x21468e63abF3783020750F7b2e57d4B34aFAfba6',
    NodeFactory: '0x4BFbA79CF232361a53eDdd17C67C6c77A6F00379' // ERC-1155
  },
  base: {
    c_HyPC: '0x674DdC6e324142713431a21D3E1BD0140cC700f7', // c_HyPCe
    HyPCL: '0x282b61FcBA0d77a8eE3e0De225AF6BFC11f44659', // ANFE Licence
    ANFE: '0x8c0075D087de9588DdF5c1441dF39828d695bc2f', // Advanced Node Factory Enclosure
    c_AIMF: '0x998d350C59Fd7a4a524fcc987Adc811f25b886F4', // Aimifier
    c_IAIb: '0x1dcbEEc07614aB8b3AEe828f19a9299ad0772eC1', // IoAI Box
    c_IAIf: '0xf319fea203EB534BE138F86682B42d359424e905', // IoAI Federated
    c_IAIr: '0xaaA03DBEa02373Ce123b02B590265De428B17172', // IoAI Registry
    c_IAIs: '0xe283deFF3736C12E313C19dF6FBbC896fcf246d3', // IoAI Search
    c_OpnAI: '0x4795f8af5c8d2D9bceA287d7448435879A6d46dF', // Open IoAI
    c_QntV: '0x1512D4A43596a34593D6913462068F089879E8Cc', // Quantum Verify
    c_SpcN: '0x2Be0d36d961E15879C865B0fA828710C65f60940' // Space Nodes
  }
};

export const HYPERCYCLE_CONFIG = {
  // HyperCycle Subgraph
  subgraph: {
    ethereum: 'https://api.studio.thegraph.com/query/90034/hypercycle-ethereum/version/latest',
    base: 'https://api.studio.thegraph.com/query/90034/hypercycle-base/version/latest'
  },
  
  // Merkelizer API
  merkelizer: {
    baseUrl: 'http://YOUR_HYPERCYCLE_NODE_IP:8003',
    endpoints: {
      uptime: '/uptime',
      nodes: '/nodes',
      compute: '/compute'
    }
  },
  
  // Payment configuration
  payment: {
    token: 'USDC',
    chain: 'ethereum',
    decimals: 6
  },
  
  // MCP Configuration
  mcp: {
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  },

  // Contract addresses (imported from HYPERCYCLE_CONTRACTS)
  contracts: HYPERCYCLE_CONTRACTS
};

export default HYPERCYCLE_CONFIG;