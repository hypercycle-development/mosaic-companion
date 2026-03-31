/**
 * Midnight MCP Provider
 * 
 * Integration layer connecting MosAIc's MCPClient to the Midnight MCP Server.
 * This enables ZK proof generation and contract interaction from within MosAIc.
 * 
 * Usage:
 *   import { midnightPlugin, MidnightTools } from './midnight';
 *   await api.addPlugin(midnightPlugin);
 *   await api.connectPlugin('midnight');
 */

import { MCPServerConfig, MCPPlugin } from '../MCPAPI';

// =============================================================================
// Provider Configuration
// =============================================================================

export interface MidnightProviderConfig {
  network: 'testnet' | 'mainnet';
  rpcUrl?: string;
  indexerUrl?: string;
  proofServerUrl?: string;
}

/**
 * Create Midnight provider configuration for MosAIc MCPClient
 * 
 * This runs the midnight-mcp-server as a child process via npx.
 * Ensure mosaic-midnight-mcp-server is installed or available.
 */
export function createMidnightProvider(
  config: MidnightProviderConfig
): MCPServerConfig {
  const { network, rpcUrl, indexerUrl, proofServerUrl } = config;
  
  return {
    name: 'midnight',
    transport: 'stdio',
    command: 'npx',
    args: ['mosaic-midnight-mcp-server'],
    env: {
      MIDNIGHT_NETWORK: network,
      MIDNIGHT_RPC_URL: rpcUrl || getDefaultRpcUrl(network),
      MIDNIGHT_INDEXER_URL: indexerUrl || getDefaultIndexerUrl(network),
      MIDNIGHT_PROOF_SERVER_URL: proofServerUrl || getDefaultProofServerUrl(network),
    },
  };
}

/**
 * Create HTTP-based Midnight provider (for distributed deployments)
 */
export function createMidnightHttpProvider(
  config: MidnightProviderConfig & { serverUrl: string }
): MCPServerConfig {
  return {
    name: 'midnight',
    transport: 'http',
    url: `${config.serverUrl}/mcp`,
  };
}

// =============================================================================
// Default Endpoints (Testnet)
// =============================================================================

function getDefaultRpcUrl(network: string): string {
  if (network === 'mainnet') {
    return 'https://rpc.midnight.network';
  }
  return 'https://rpc.testnet.midnight.network';
}

function getDefaultIndexerUrl(network: string): string {
  if (network === 'mainnet') {
    return 'https://indexer.midnight.network/graphql';
  }
  return 'https://indexer.testnet.midnight.network/graphql';
}

function getDefaultProofServerUrl(network: string): string {
  if (network === 'mainnet') {
    return 'https://proof.midnight.network';
  }
  return 'https://proof.testnet.midnight.network';
}

// =============================================================================
// Tool Helpers
// =============================================================================

/**
 * Type-safe tool arguments for Midnight operations
 */
export const MidnightTools = {
  /**
   * Deploy a ZK contract to Midnight
   */
  deployContract: (args: {
    compiledContract: string;
    initialState: Record<string, unknown>;
    network?: 'testnet' | 'local';
  }) => ({
    name: 'deploy_contract',
    arguments: args,
  }),

  /**
   * Call a function on a deployed contract
   */
  callContract: (args: {
    contractAddress: string;
    functionName: string;
    args: Record<string, unknown>;
    privateStateId: string;
  }) => ({
    name: 'call_contract',
    arguments: args,
  }),

  /**
   * Submit a ZK proof for verification
   */
  submitProof: (args: {
    proof: string;
    publicInput: string[];
  }) => ({
    name: 'submit_proof',
    arguments: args,
  }),

  /**
   * Register as a proof provider
   */
  registerProvider: (args: {
    endpoint: string;
    capabilities: string[];
    pricing: { perProof: number; currency: 'NIGHT' | 'USD' };
  }) => ({
    name: 'register_as_provider',
    arguments: args,
  }),

  /**
   * Get job status
   */
  getJobStatus: (args: { jobId: string }) => ({
    name: 'get_job_status',
    arguments: args,
  }),

  /**
   * Query public state
   */
  getPublicState: (args: { contractAddress: string }) => ({
    name: 'get_public_state',
    arguments: args,
  }),

  /**
   * Query private state (decrypted)
   */
  getPrivateState: (args: {
    contractAddress: string;
    privateStateId: string;
  }) => ({
    name: 'get_private_state',
    arguments: args,
  }),

  /**
   * List available proof providers
   */
  listProviders: (args?: { capability?: string; limit?: number }) => ({
    name: 'list_providers',
    arguments: args || {},
  }),
} as const;

// =============================================================================
// Resource Helpers
// =============================================================================

export const MidnightResources = {
  /**
   * Get block data
   */
  block: (height: number) => `midnight:/block/${height}`,
  
  /**
   * Get latest block
   */
  latestBlock: () => 'midnight:/block/latest',
  
  /**
   * Get contract state
   */
  contract: (address: string) => `midnight:/contract/${address}`,
  
  /**
   * Get ZK artifact (prover/verifier keys)
   */
  zkArtifact: (name: string) => `midnight:/zk-artifact/${name}`,
  
  /**
   * Get network status
   */
  networkStatus: () => 'midnight:/network/status',
  
  /**
   * Get provider info
   */
  provider: (id: string) => `midnight:/provider/${id}`,
} as const;

// =============================================================================
// Example Usage
// =============================================================================

/**
 * Example: Connecting to Midnight and deploying a contract
 * 
 * ```typescript
 * import { MCPClient, mcpResultToString } from './mcp/MCPClient';
 * import { createMidnightProvider, MidnightTools } from './midnight';
 * 
 * const mcpClient = new MCPClient();
 * 
 * // Connect to Midnight
 * await mcpClient.connect(createMidnightProvider({ 
 *   network: 'testnet' 
 * }));
 * 
 * // Deploy a contract
 * const deployResult = await mcpClient.callTool(
 *   'midnight',
 *   MidnightTools.deployContract({
 *     compiledContract: 'BASE64_ENCODED_CONTRACT',
 *     initialState: { owner: 'midnight_abc123', value: 100 }
 *   })
 * );
 * 
 * console.log(mcpResultToString(deployResult));
 * // { success: true, contractAddress: 'midnight_xyz789', ... }
 * ```
 */

/**
 * Midnight Plugin for MosAIc UI
 * 
 * This is the shape expected by MCPPage.tsx addPlugin form.
 * Use with:
 *   await api.addPlugin(midnightPlugin);
 *   await api.connectPlugin('midnight');
 */
export const midnightPlugin: Omit<MCPPlugin, 'id'> = {
  name: 'midnight',
  description: 'Midnight Network ZK proof generation & contract interaction',
  transport: 'stdio',
  command: 'npx',
  args: ['mosaic-midnight-mcp-server'],
  env: {
    MIDNIGHT_NETWORK: 'testnet',
  },
  autoConnect: false,
};

/**
 * HTTP variant for distributed deployments
 */
export const midnightHttpPlugin: Omit<MCPPlugin, 'id'> = {
  name: 'midnight',
  description: 'Midnight Network ZK proof generation (HTTP)',
  transport: 'http',
  url: 'http://localhost:3000/mcp',
  autoConnect: false,
};

export default {
  createMidnightProvider,
  createMidnightHttpProvider,
  MidnightTools,
  MidnightResources,
  midnightPlugin,
  midnightHttpPlugin,
};