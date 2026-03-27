/**
 * Midnight Types - Type definitions for Midnight Network integration
 */

// =============================================================================
// Midnight Tool Args (for autocomplete in renderer)
// =============================================================================

export interface MidnightToolArgs {
  "midnight:init": Record<string, never>;
  "midnight:create-node": {
    type: "validator" | "full" | "light";
    stake: number;
    privacy: "public" | "shielded" | "private";
    delegation: "user" | "agent" | "hybrid";
    agentId?: string;
  };
  "midnight:delegate": { nodeId: string; agentId: string };
  "midnight:get-status": { nodeId: string };
  "midnight:stop-node": { nodeId: string };
  "midnight:restart-node": { nodeId: string };
  "midnight:get-network-info": Record<string, never>;
  "midnight:list-nodes": Record<string, never>;
}

// =============================================================================
// Node Types
// =============================================================================

export type NodeType = "validator" | "full" | "light";
export type PrivacyLevel = "public" | "shielded" | "private";
export type DelegationType = "user" | "agent" | "hybrid";
export type NodeStatus = "deploying" | "active" | "stopped" | "error";

export interface MidnightNode {
  nodeId: string;
  endpoint: string;
  privacyKey: string;
  status: NodeStatus;
  createdAt: number;
}

export interface MidnightDelegation {
  delegationId: string;
  nodeId: string;
  agentId: string;
  permissions: string[];
  createdAt: number;
}

// =============================================================================
// Network Types
// =============================================================================

export interface MidnightNetworkInfo {
  blockHeight: number;
  blockTime: number;
  sessionLength: number;
  validators: number;
  totalNodes: number;
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface MidnightConfig {
  network: "testnet" | "mainnet";
  provider: "cardano-partnerchain";
  rpcEndpoint?: string;
}