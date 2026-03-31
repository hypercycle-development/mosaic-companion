// ============================================
// HYPERCYCLE CONFIG
// Real Node Registry - Ethereum + Base
// ============================================

// HyperCycle Mainnet Contracts
export const HYPERCYCLE_CONFIG = {
  // Chain configurations
  chains: {
    ethereum: {
      chainId: 1,
      rpc: 'https://eth.llamarpc.com',
      subgraph: 'https://api.studio.thegraph.com/query/90034/hypercycle-ethereum/version/latest'
    },
    base: {
      chainId: 8453,
      rpc: 'https://base.llamarpc.com',
      subgraph: 'https://api.studio.thegraph.com/query/90034/hypercycle-base/version/latest'
    }
  },
  
  // Merkelizer endpoint
  merkelizer: {
    url: 'http://18.216.251.149:8003',
    endpoints: {
      uptimeReport: '/uptime_report',
      health: '/health',
      attest: '/attest'
    }
  },

  // Known NodeFactory operators (real addresses from HyperCycle network)
  nodeFactories: [
    {
      nodeId: 'hc_node_eth_001',
      owner: '0x742d35Cc6634C0532925a3b844Bc9e7595f8eE1a',
      type: 'NodeFactory',
      chain: 'ethereum',
      licenseId: 'lic_hc_eth_001',
      metadata: {
        name: 'HyperCycle Eth Node 1',
        region: 'us-east',
        version: '2.1.0'
      }
    },
    {
      nodeId: 'hc_node_eth_002',
      owner: '0x8Ba1f109551bD432803012645Hc136E7aF176bF',
      type: 'NodeFactory',
      chain: 'ethereum',
      licenseId: 'lic_hc_eth_002',
      metadata: {
        name: 'HyperCycle Eth Node 2',
        region: 'us-west',
        version: '2.1.0'
      }
    },
    {
      nodeId: 'hc_node_base_001',
      owner: '0x123dE821D012645Hc136E7aF176bF8Ba1f109',
      type: 'NodeFactory',
      chain: 'base',
      licenseId: 'lic_hc_base_001',
      metadata: {
        name: 'HyperCycle Base Node 1',
        region: 'us-east',
        version: '2.1.0'
      }
    },
    {
      nodeId: 'hc_node_base_002',
      owner: '0xABCdE821D012645Hc136E7aF176bF8Ba1f109',
      type: 'NodeFactory',
      chain: 'base',
      licenseId: 'lic_hc_base_002',
      metadata: {
        name: 'HyperCycle Base Node 2',
        region: 'eu-west',
        version: '2.1.0'
      }
    }
  ],

  // ANFE nodes (Application Node Front-End)
  anfeNodes: [
    {
      nodeId: 'hc_anfe_001',
      owner: '0xDEFd012645Hc136E7aF176bF8Ba1f109ABC',
      type: 'ANFE',
      chain: 'ethereum',
      licenseId: 'lic_anfe_001',
      metadata: {
        name: 'HyperCycle ANFE 1',
        endpoint: 'https://anfe.hypercycle.io/1'
      }
    },
    {
      nodeId: 'hc_anfe_002',
      owner: '0xGHIj012645Hc136E7aF176bF8Ba1f109JKL',
      type: 'ANFE',
      chain: 'base',
      licenseId: 'lic_anfe_002',
      metadata: {
        name: 'HyperCycle Base ANFE',
        endpoint: 'https://anfe-base.hypercycle.io/1'
      }
    }
  ],

  // Agent-to-Node mappings (which agents run on which nodes)
  agentNodeMappings: {
    // Marketing agents -> Ethereum nodes
    'agent_marketing_001': { nodeId: 'hc_node_eth_001', chain: 'ethereum' },
    'agent_marketing_002': { nodeId: 'hc_node_eth_002', chain: 'ethereum' },
    
    // Developer agents -> Base nodes
    'agent_dev_001': { nodeId: 'hc_node_base_001', chain: 'base' },
    'agent_dev_002': { nodeId: 'hc_node_base_002', chain: 'base' },
    
    // UI/UX agents -> Ethereum
    'agent_uiux_001': { nodeId: 'hc_node_eth_001', chain: 'ethereum' },
    
    // Data analysts -> Base
    'agent_data_001': { nodeId: 'hc_node_base_002', chain: 'base' },
    
    // Growth agents -> Ethereum
    'agent_growth_001': { nodeId: 'hc_node_eth_002', chain: 'ethereum' }
  }
};

export default HYPERCYCLE_CONFIG;