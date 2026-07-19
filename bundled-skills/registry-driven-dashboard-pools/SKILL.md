---
name: registry-driven-dashboard-pools
description: "Use when a React/Electron dashboard tab has grown into a god-file with multiple unrelated sections. Break it into self-registering, independently routable pool components with a hub orchestrator."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [react, architecture, dashboard, ui-patterns, component-registry, god-file-refactor]
    related_skills: [spike, simplify-code, writing-plans]
---

# Registry-Driven Dashboard Pools

## Overview

A pattern for breaking monolithic dashboard tabs into self-registering, independently routable **pool** components. Each pool is a self-contained vertical (e.g., validator fleet, compute pool, freight marketplace) with its own data layer, UI, and lifecycle. A hub orchestrator handles selection, routing, and presentation.

Use this when:
- A single React component has grown past ~500 lines with unrelated sections
- Adding a new "partner" or "system" view requires editing the same file
- Multiple sections compete for the same screen real estate without clear hierarchy

## When to Use

- Dashboard tabs that display multiple independent systems
- Partner integration UI where each partner is a distinct feature vertical
- Any React component where `// ── Section A ──` comments have proliferated

**Don't use for:**
- Simple forms or single-purpose pages (overkill)
- Tightly coupled wizard flows where steps must share state
- Pages where everything is truly the same data model

## Architecture

```
DashboardTab (thin shell in parent)
  └── PoolHub (orchestrator)
        ├── PoolSelector (grid of registered pools)
        └── PoolDetail (dynamic component from registry)
              ├── PoolA → own data hooks + UI
              ├── PoolB → own data hooks + UI
              └── PoolC → own data hooks + UI
```

**Key principle:** Parent knows nothing about pool internals. It only renders `<PoolHub />`.

## File Layout

```
components/stargate/
  pools/
    types.ts          # PoolDefinition, PoolProps, PoolStatus, PoolCategory
    registry.ts       # STARGATE_POOLS array + lookup helpers
    index.ts          # barrel export
    PoolA.tsx         # self-contained pool component
    PoolB.tsx         # self-contained pool component
  PoolHub.tsx         # orchestrator: selector → detail
```

## Types

```typescript
// pools/types.ts
export type PoolStatus = 'active' | 'inactive' | 'error' | 'loading';
export type PoolCategory = 'validator' | 'compute' | 'freight' | 'liquidity' | 'storage' | 'ai';

export interface PoolDefinition {
  id: string;              // unique slug
  name: string;            // display name
  shortName: string;       // compact tab label
  description: string;     // one-liner for cards
  category: PoolCategory;
  icon: string;            // lucide icon name or emoji
  color: string;           // tailwind color token
  status: PoolStatus;
  isConfigurable: boolean; // shows gear icon?
  /** Optional live badge component rendered on the selector card */
  liveBadge?: React.ComponentType<{ definition: PoolDefinition }>;
  component: React.ComponentType<PoolProps>;
}

export interface PoolProps {
  definition: PoolDefinition;
  onBack?: () => void;
}
```

## Registry

```typescript
// pools/registry.ts
import type { PoolDefinition } from './types';
import PoolA from './PoolA';
import PoolB from './PoolB';

export const POOLS: PoolDefinition[] = [
  {
    id: 'pool-a',
    name: 'Pool A',
    shortName: 'A',
    description: '...',
    category: 'compute',
    icon: 'Server',
    color: 'indigo',
    status: 'active',
    isConfigurable: true,
    component: PoolA,
  },
  // ...
];
```

## Hub Orchestrator

```typescript
// PoolHub.tsx
const PoolHub: React.FC = () => {
  const [selected, setSelected] = useState<PoolDefinition | null>(null);

  if (selected) {
    const C = selected.component;
    return <C definition={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {POOLS.map(p => (
        <button key={p.id} onClick={() => setSelected(p)}>
          {/* card UI */}
        </button>
      ))}
    </div>
  );
};
```

## Parent Integration

Replace the god-file content with a single line:

```typescript
// Before (in parent):
<div>
  <SectionA />
  <SectionB />
  <SectionC />
  {/* 500+ lines */}
</div>

// After (in parent):
<PoolHub />
```

## Adding a New Pool

1. Create `components/stargate/pools/PartnerPool.tsx`
2. (Optional) Create `components/stargate/pools/PartnerLiveBadge.tsx` if you want a live stat on the hub card
3. Import and add entry to `registry.ts`
4. Done. No parent file touched.

## Live Badges on Hub Cards

Each pool can expose a `liveBadge` component that renders real-time stats directly on the selector card. This keeps the hub informative without opening every pool.

```typescript
// pools/types.ts
export interface PoolDefinition {
  // ... other fields
  liveBadge?: React.ComponentType<{ definition: PoolDefinition }>;
}

// pools/BatteryLiveBadge.tsx
export const BatteryLiveBadge: React.FC = () => {
  const [online, setOnline] = useState(0);
  useEffect(() => {
    // subscribe to bridge / polling data
    const unsub = bridge.onUpdate(t => setOnline(t?.validatorPool?.onlineValidators || 0));
    return unsub;
  }, []);
  return <span>{online}/{total} online</span>;
};
```

**Rules for live badges:**
- Must be self-contained — import its own data source, don't receive props from the hub
- Keep the render cheap (< 5ms) — it runs for every card on every poll tick
- Use `useEffect` + unsubscribe pattern — never leak intervals when cards unmount
- Fail silently — if data source is down, badge shows `0/0` or `—`, never throws

## Config Modal Pattern

Configurable pools should expose a settings modal triggered from the hub card's gear icon. The modal lives outside the pool component so it can be opened without entering the pool detail view.

```typescript
// PoolHub.tsx
const [configPool, setConfigPool] = useState<PoolDefinition | null>(null);

// on gear icon click:
<button onClick={(e) => { e.stopPropagation(); setConfigPool(pool); }}>
  <Settings size={14} />
</button>

// render modal at hub level:
<PoolConfigModal
  pool={configPool}
  isOpen={!!configPool}
  onClose={() => setConfigPool(null)}
  onSave={(id, values) => { /* persist */ setConfigPool(null); }}
/>
```

**Why at hub level:**
- Modal overlays the entire screen — it should not be clipped by the card's overflow boundary
- Keyboard shortcuts (Escape to close) need global capture
- State is hub-owned; the pool component may be unmounted when modal is open

## Common Pitfalls

1. **Sharing state across pools via parent props.** Don't lift pool-specific state to the parent. Each pool owns its own `useState` and data hooks. If two pools need shared data, use a context or store at the `PoolHub` level, not the parent page level.

2. **Importing pool components into the parent.** The parent should only import `PoolHub`. Never import individual pool components into the parent — that defeats the purpose.

3. **Forgetting `onBack` prop.** Every pool detail view should accept `onBack` and render a back arrow. The hub handles the state reset.

4. **Using string-based dynamic imports.** In an Electron + Vite app, dynamic imports with string expressions can break the bundle analyzer. Use the registry's direct component references instead.

5. **Putting data fetching in the hub.** The hub should be presentation-only. Data fetching lives inside each pool component or its custom hook.

6. **Assuming bridge-backed telemetry covers remote nodes.** The local Node Manager bridge (`EnhancedLocalNodeBridge.getTelemetry()`) only knows about services registered with the local Node Manager (port 8006). Remote validators, Docker containers on other hosts, or any service outside the Node Manager's purview require **direct HTTP polling** from the Electron renderer. See `references/stargate-pool-implementation.md` → "Telemetry Source: Local Bridge vs Direct Polling" for the full breakdown.

## Verification Checklist

- [ ] Parent file shrunk significantly (removed >50% of inline UI)
- [ ] `PoolHub` is the only stargate-related import in the parent
- [ ] Each pool component accepts `PoolProps` and uses `onBack` when in detail mode
- [ ] Registry is the single source of truth for pool list
- [ ] Build passes (`tsc --noEmit` clean)
- [ ] Adding a new pool requires only 1 new file + 1 registry line

## Extension: Docker-Local & Multi-Node Fleet Telemetry

The reference file `references/stargate-pool-implementation.md` now includes a worked extension showing how to add a 4th pool (Materios Attestor) that polls a **local Docker container** health endpoint (`127.0.0.1:8080`) and supports multi-node fleet endpoints. It documents the three telemetry patterns that can coexist in the same hub:

| Pattern | Data Source | When to use |
|---|---|---|
| **Bridge-backed** | `window.electronAPI.*` IPC | Privileged access (provisioning, file ops, process mgmt) |
| **Direct LAN poll** | `fetch()` to remote IP:port | Remote validators / nodes on same network |
| **Docker-local poll** | `fetch()` to `127.0.0.1:port` | Local container exposing HTTP — no bridge needed |

**Rule:** If the service exposes HTTP on a known port (localhost or LAN), use direct `fetch()` from the renderer. Only add an IPC bridge when the service requires privileged access that the renderer cannot reach.
