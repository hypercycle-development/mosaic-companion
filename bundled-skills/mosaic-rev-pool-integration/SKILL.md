---
name: mosaic-rev-pool-integration
description: Integrate Rev Pools (like SAFE) into Mosaic Companion's Stargate Pool tab with proper vault support for agent learning
triggers:
  - Add new Rev Pool to Mosaic Companion
  - Create pool card in Stargate Pool tab
  - Set up vault for pool agent learning
  - Integrate Rev Pool UI into Stargate
  - SAFE Rev Pool Mosaic integration
  - Add pool knowledge base to Mosaic
---

# Mosaic Companion Rev Pool Integration

Integrate a new Revenue Pool (e.g., SAFE Freight Exchange) into Mosaic Companion's Stargate Pool tab with proper agent-learning vault support.

## Critical Location Rule

**ALWAYS place Rev Pool cards in the Stargate Pool tab, NOT the Start tab.**

The user explicitly corrected this - the Start tab is for intent-based entry points, while Stargate Pool is for compute/resource pools.

## Integration Steps

### 1. Add Pool Card to Stargate Pool Dashboard

File: `src/components/AdaPortalPanel.tsx` in `renderStargatePool()`

Insert the pool card BEFORE the Wallet Header:

```tsx
{/* ── [POOL NAME] Rev Pool Card ─────────────────────────────────────────── */}
<div className="p-4 rounded-xl bg-gradient-to-r from-[COLOR]-900/30 to-[COLOR]-900/30 border border-[COLOR]-500/30 mb-6">
  {/* Header with icon + status */}
  <div className="flex items-start justify-between">
    <div className="flex items-center gap-3">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[COLOR]-500 to-[COLOR]-600 flex items-center justify-center">
        <span className="text-white text-lg">[EMOJI]</span>
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold text-white">[POOL NAME] Rev Pool</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[COLOR]-500/20 text-[COLOR]-300 border border-[COLOR]-500/30">Active</span>
        </div>
        <p className="text-sm text-gray-400">[POOL TAGLINE]</p>
      </div>
    </div>
    <div className="text-right">
      <div className="text-2xl font-bold text-[COLOR]-400">[KEY METRIC]</div>
      <div className="text-xs text-gray-500">[METRIC LABEL]</div>
    </div>
  </div>

  {/* Stats Grid */}
  <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-[COLOR]-500/10">
    {/* 4 key stats */}
  </div>

  {/* Description */}
  <div className="mt-4 text-sm text-gray-400 leading-relaxed">
    [POOL DESCRIPTION]
  </div>

  {/* AIM Tags */}
  <div className="flex items-center gap-2 mt-4">
    <span className="text-xs text-gray-500">AIMs:</span>
    {/* AIM badges */}
  </div>

  {/* Action Buttons */}
  <div className="flex items-center gap-3 mt-4">
    <button className="flex-1 ...">
      <BookOpen size={14} /> Knowledge Base
    </button>
    <button className="...">
      <Info size={14} /> Details
    </button>
  </div>
</div>
```

### 2. Create Agent Learning Vault

File: `electron/integrations/vault/index.ts`

Add initialization function:

```typescript
export function initialize[PoolName]Vault(): { success: boolean; message: string } {
  const POOL_BOX_ID = "[pool-name]-rev-pool-operations";
  
  // Check if exists
  const existing = getBox(POOL_BOX_ID);
  if (existing) {
    return { success: true, message: "Vault already initialized" };
  }

  // Create box
  const now = Date.now();
  const vault = loadVault();
  const box: VaultBox = {
    id: POOL_BOX_ID,
    name: "[POOL NAME] Rev Pool Operations",
    description: "...",
    sourceType: "manual",
    createdAt: now,
    updatedAt: now,
  };
  vault.boxes.push(box);
  saveVault(vault);

  // Create entries with learning content
  const entries: VaultEntry[] = [
    {
      id: "entry-[pool]-overview",
      label: "[POOL] Overview",
      content: `# Markdown content...`,
      createdAt: now,
      updatedAt: now,
    },
    // More entries...
  ];

  saveBoxContent({ boxId: POOL_BOX_ID, entries });
  return { success: true, message: `Vault initialized with ${entries.length} entries` };
}
```

### 3. Auto-Initialize on App Startup

File: `electron/main.ts`

Add after vault skill watcher initialization:

```typescript
// Initialize [POOL NAME] Rev Pool vault for agent learning
try {
  const { initialize[PoolName]Vault } = await import("./integrations/vault");
  const result = initialize[PoolName]Vault();
  if (result.success) {
    console.log("[Vault]", result.message);
  }
} catch (e) {
  console.warn("[Vault] Failed to initialize vault:", e);
}
```

### 4. Create Vault Panel Component (Optional)

File: `src/components/stargate/[PoolName]VaultPanel.tsx`

For rich knowledge base UI. Include search, categorized entries, formatted markdown rendering.

## Vault Content Structure

Each pool vault should include these knowledge entries:

1. **Overview** - What the pool is, key differentiators, infrastructure
2. **Agent Workflows** - Step-by-step for each agent type
3. **Constraint Matching** - Rules and scoring formulas
4. **A2A Protocol** - Message formats, state machines, timeouts
5. **Settlement & Escrow** - Payment flows, failure scenarios, reputation
6. **Best Practices** - Optimization strategies, common mistakes
7. **API Reference** - Endpoints, auth, events (if applicable)

## Color Coding Convention

- SAFE (Freight): Green/Emerald (`from-green-900/30 to-emerald-900/30`)
- General Compute: Indigo/Purple
- Trading/Finance: Amber/Orange
- Media/Creative: Pink/Rose

## Verification

```bash
cd ~/mosaic-companion
npm run build
npm run start
```

Navigate: **Stargate → Stargate Pool** tab

Confirm:
- Pool card appears at top of Stargate Pool content
- "Knowledge Base" button opens vault content
- Console shows vault initialization message

## Pitfalls

1. **WRONG TAB**: Never put pool cards in Start tab - user explicitly wants them in Stargate Pool
2. **Import Paths**: In Electron, vault types must be inlined or use correct relative paths - the `../../electron` import often fails
3. **Box ID Collisions**: Use kebab-case pool names in box IDs: `"safe-rev-pool-operations"`
4. **Async Initialization**: Always wrap vault init in try/catch - vault may be locked or corrupted
5. **Async Callback in app.whenReady()**: When using `await` inside `app.whenReady().then()`, the callback MUST be marked `async`:
   ```typescript
   // WRONG - causes TS1308 error:
   app.whenReady().then(() => {
     const { initVault } = await import("./vault");  // ❌ Error!
   });
   
   // CORRECT:
   app.whenReady().then(async () => {  // ✅ Note the async
     const { initVault } = await import("./vault");
   });
   ```