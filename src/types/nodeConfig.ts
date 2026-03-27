// Node Configuration Types
// Maps on-chain nodes/ANFEs to AI models
// Also supports HyperAIBOX physical nodes as agent toolkits

import { AIAgentConfig } from "./ai";
import { ChainId } from "./wallet";

// Node ownership info from blockchain
export interface OwnedNode {
  tokenId: string;
  chainId: ChainId;
  contractAddress: string;
  owner: string;
  tokenUri?: string;
  metadata?: NodeMetadata;
}

// Node metadata (from tokenURI)
export interface NodeMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Record<string, string | number>;
}

// Configuration linking on-chain node to AI model
export interface NodeModelConfig {
  id: string;
  tokenId: string;
  chainId: ChainId;
  contractAddress: string;
  agentId: string; // Reference to AIAgentConfig.id
  createdAt: number;
  updatedAt: number;
}

// Full node with config
export interface ConfiguredNode extends OwnedNode {
  config?: NodeModelConfig;
  agent?: AIAgentConfig;
}

// HyperAIBOX Physical Node
export interface HyperAIBOXNode {
  id: string;
  name: string;
  ip: string;
  user: string;
  role: 'field-operator' | 'strategic-intelligence' | 'coordinator';
  status: 'online' | 'offline' | 'unknown';
  capabilities: string[]; // e.g., 'scraping', 'ollama', 'storage'
  storage: {
    available: number; // GB
    used: number; // GB
    path: string; // /home/user/storage
  };
  ollamaModels?: string[]; // Models installed on this box
  linkedAgents: string[]; // Agent IDs that can use this box
  lastSeen: number;
}

// Agent Toolkit - Skills/tools from linked HyperAIBOX nodes
export interface AgentToolkit {
  agentId: string;
  nodes: HyperAIBOXNode[];
  skills: string[]; // Available skills from node storage
  lastSynced: number;
}

// Storage key for node configurations
export const NODE_CONFIGS_KEY = "mosaic_node_configs";

// Storage key for node ownership cache
export const OWNED_NODES_KEY = "mosaic_owned_nodes";

// Storage key for HyperAIBOX nodes
export const HYPERAIBOX_NODES_KEY = "mosaic_hyperaibox_nodes";

// Storage key for agent toolkits
export const AGENT_TOOLKITS_KEY = "mosaic_agent_toolkits";

// Default HyperAIBOX nodes from TOOLS.md
export const DEFAULT_HYPERAIBOX_NODES: HyperAIBOXNode[] = [
  {
    id: 'r2d2',
    name: 'R2D2',
    ip: '192.168.0.10',
    user: 'molt',
    role: 'field-operator',
    status: 'unknown',
    capabilities: ['scraping', 'ollama', 'storage', 'python'],
    storage: { available: 100, used: 0, path: '/home/molt/storage' },
    ollamaModels: [],
    linkedAgents: [],
    lastSeen: 0
  },
  {
    id: 'c3po',
    name: 'C-3PO',
    ip: '192.168.0.14',
    user: 'hpecagent',
    role: 'strategic-intelligence',
    status: 'unknown',
    capabilities: ['ollama', 'storage', 'analysis', 'leads'],
    storage: { available: 100, used: 0, path: '/home/hpecagent/storage' },
    ollamaModels: [],
    linkedAgents: [],
    lastSeen: 0
  }
];