// =============================================================================
// STARGATE POOL — Core Types & Registry
// Every strategic partner pool registers here. Self-contained, no god files.
// =============================================================================

import React from 'react';

export type PoolStatus = 'active' | 'inactive' | 'error' | 'loading';
export type PoolCategory = 'validator' | 'compute' | 'liquidity' | 'storage' | 'ai';

export interface PoolDefinition {
  id: string;                    // unique slug: 'battery', 'compute', 'materios'
  name: string;                  // display name
  shortName: string;             // compact name for tabs
  description: string;           // one-liner
  category: PoolCategory;
  icon: string;                  // emoji or lucide icon name
  color: string;                 // tailwind color token prefix
  status: PoolStatus;
  isConfigurable: boolean;       // shows gear icon?
  liveBadge?: React.ComponentType<{ definition: PoolDefinition }>;
  component: React.ComponentType<PoolProps>;
}

export interface PoolProps {
  definition: PoolDefinition;
  onBack?: () => void;
}

export interface PoolSummary {
  id: string;
  name: string;
  status: PoolStatus;
  statLabel: string;
  statValue: string;
  color: string;
}
