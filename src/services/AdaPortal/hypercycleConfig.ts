// ============================================
// ADA PORTAL - HyperCycle Configuration
// External API endpoints and settings
// ============================================

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
  }
};

export default HYPERCYCLE_CONFIG;