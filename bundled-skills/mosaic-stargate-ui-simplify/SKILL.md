---
name: mosaic-stargate-ui-simplify
description: Simplify Mosaic Companion Stargate UI for new users by removing complex features and adding clear action cards
title: Mosaic Stargate UI Simplification
version: 1.0
trigger: When simplifying Mosaic Companion Stargate UI for new users
---

# Stargate UI Simplification Workflow

## Goal
Make Stargate less intimidating for new users by:
1. Removing advanced/complex UI elements (autonomous mode toggles, execution plan previews)
2. Renaming abstract intent cards to direct action labels
3. Adding clear one-line explanations on every card
4. Ensuring each card navigates to the correct tab

## Files to Edit
- `src/components/AdaPortalPanel.tsx` — Main Stargate panel
- `src/services/AdaPortal/types.ts` — `UserIntent` type (if adding intents)

## Step 1: Remove Complexity from Start Tab

In the `INTENT_OPTIONS` array:
- Remove `Autonomous Mode` toggle block entirely
- Remove `Execution Plan Preview` block entirely
- Remove `executionPlan` and `autonomousMode` state variables

## Step 2: Map Intent Cards to Tabs

**Rule:** Every major tab in Stargate must have a matching card on the Start tab. No card should be abstract — each one must have a concrete label, description, and a `tab: TabId` so clicking it navigates directly to that tab.

Current 10-card grid:

| Intent Card | Tab Target | Description |
|---|---|---|
| Hire Agents | marketplace | Browse and hire AI agents from the marketplace to work on your projects |
| AI Models | aims | Explore AI models (AIMs) — deploy, manage, and scale intelligent compute |
| Rankings | leaderboard | See top-performing agents, skills, and AI models across the network |
| Train Agents | training | Train your agents with custom skills, data, and reinforcement learning |
| Bundles | packages | Pre-packaged agent teams with skills — ready to deploy |
| Skills | skills | Discover and install skills for your agents — reusable capabilities and tools |
| Compute & Nodes | compute | Allocate compute power and manage HyperCycle nodes for your AI stack |
| Dashboard | dashboard | Overview of your AI workforce, compute usage, and network activity |
| Stargate Pool | stargate | Manage your ANFE licenses and deploy agents to HyperCycle compute nodes |
| Deploy System | asp | Create and manage Application Service Providers (ASPs) for your organization |

**Grid layout:** Start tab uses `grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3` so 10 cards fit cleanly in 4 rows.

**Type system:** If you add cards beyond the original 5 (`launch_project`, `grow_dao`, `build_dapp`, `automate_workflows`, `custom`), also expand `UserIntent` in `src/services/AdaPortal/types.ts` or TypeScript will reject the new `id` values.

Update:
- `label` — action name
- `description` — one-line explanation of what user can do
- `icon` — match the destination tab's icon
- `tab` — destination `TabId` for click navigation

## Step 3: Add `tab` Field to INTENT_OPTIONS Type

```typescript
const INTENT_OPTIONS: {
  id: UserIntent;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  tab: TabId;  // ← add this
}[] = [...]
```

## Step 4: Simplify Click Handler

Remove execution plan building + switch statement. Direct tab navigation:

```typescript
onClick={() => {
  setSelectedIntent(intent.id);
  setActiveTab(intent.tab as TabId);
  if (onNavigateToChat) {
    onNavigateToChat(`I want to ${intent.label.toLowerCase()}. Help me get started.`);
  }
}}
```

## Step 5: Clean Up Dead Code

Remove from state declarations:
```typescript
const [executionPlan, setExecutionPlan] = useState<any>(null);
const [autonomousMode, setAutonomousMode] = useState(false);
```

## Step 6: Add Explanatory Subtitles to Every Section Header

Every major tab renderer in `AdaPortalPanel.tsx` should have a `<p className="text-sm text-gray-400 mt-0.5">` directly under the section `<h2>` so new users know what the area does.

Sections patched in this session (add as needed for new tabs):

| Section | Subtitle Text |
|---------|---------------|
| Hire AI Agents (marketplace) | Browse the marketplace and hire specialized AI agents for your projects. |
| AI Models (aims) | Explore AI models you can deploy on HyperCycle compute nodes. |
| Train Your Agents (training) | Find trainers and improve your agents with custom skills and data. |
| Skills Marketplace (skills) | Discover and install reusable capabilities for your agents. |
| Agent Bundles (packages) | Pre-packaged agent teams with skills — ready to deploy. |
| Compute Access (compute) | Allocate compute power for running your agents and AI models. |
| Compute Nodes (nodes) | View and manage HyperCycle compute nodes available to run your AI stack. |
| Rankings (leaderboard) | See top-performing agents, skills, and AI models across the network. |
| Intelligence Dashboard (dashboard) | Overview of your AI workforce, compute, and network activity. |
| Stargate Pool (stargatePool) | Manage your ANFE licenses and deploy agents to HyperCycle compute nodes. |
| Deploy System (aspGateway) | Create and manage Application Service Providers (ASPs) for your organization. |

Pattern:
```tsx
<div className="mb-6">
  <h2 className="text-xl font-bold text-white">Section Name</h2>
  <p className="text-sm text-gray-400 mt-0.5">One-line explanation of what this section does.</p>
</div>
```

## Chat Username Fix

If the chat sidebar shows "User" instead of the user's name, the persisted settings file overrides the UI default.

**Root cause:** `~/.config/mosaic-companion/chat-settings.json` contains `"username": "user"`.

**Fix three locations:**
1. **Live config** — `~/.config/mosaic-companion/chat-settings.json`: change `username` to desired value (e.g., `"Mauricio P"`).
2. **Settings reader** — `electron/integrations/chat/index.ts` in `readSettings()`: validate that the parsed object actually contains a `username` field before returning it; update fallback default to the desired name.
| Custom Goal     | marketplace    |

# Stargate Pool — Community Compute Delegation

## Architecture (Non-Custodial)

- Users **retain their keys** — Stargate Pool provides compute delegation, not custody
- Licenses are delegated via `window.electronAPI.stargate.tilling.provision()` → SPO → HBA → Monitor container
- **Pool Status ≠ On-Chain Status**: The dashboard must show both independently:
  - **Compute status**: Is the monitor container running? (Node Manager `/info` check)
  - **On-chain status**: Is the Node Factory activated on Merkelizer?
- Use info banner: *"Pool Status ≠ On-chain Status: The cards below show compute allocation in the Stargate Pool. Your Node Factory may show 'active' here but still be 'dead' on Merkelizer."*

## Pricing Rules During Beta

- **Never display prices on buttons/cards during beta** — users get spooked
- Use `Beta` badge instead: `🌌 Delegate to Pool · Beta`
- Remove any hardcoded pricing (`$3.00/month`, `$0.50/hr`, etc.) from the UI
- When charging is ready, prices come from provider APIs or admin config, never hardcoded strings

## Earnings Display

- **Do NOT show fake earnings** (e.g., "0.00 HyPC") — this misleads users
- If real earnings tracking doesn't exist yet, remove the field entirely
- To add real earnings later, integrate with Merkelizer API or on-chain reward events

## HyperCycle Node Manager Health Check

The Node Manager returns **HTTP 405 on `/health`**. Use **`GET /info`** instead (returns 200).

```typescript
// Correct
const resp = await fetch('http://localhost:8000/info');

// Wrong — returns 405
const resp = await fetch('http://localhost:8000/health');
```

## SPO → Monitor Communication

**Critical**: `SPO_URL` inside monitor containers must be the **host LAN IP** (e.g., `192.168.0.112:9100`), never `localhost`. Monitor containers run on remote HyperAIBoxes and need to reach back to the SPO host.

## Files for Stargate Pool

| File | Purpose |
|------|---------|
| `electron/main.ts` | IPC handlers: `tilling:provision`, `tilling:stop`, `tilling:getSessions` |
| `electron/preload.ts` | `stargate.tilling` bridge exposed to renderer |
| `spo_server.js` | SPO backend: provision, heartbeat, session tracking |
| `hba_agent.py` | HBA agent: deploys monitor containers, health checks |
| `NodeFactoryTrackerPanel.tsx` | License cards with "Delegate to Pool" button |
| `StargatePoolDashboard.tsx` | Pool stats, session cards, capacity bar, dual-status |

---

# Compute Marketplace — Provider Catalog (Coming Soon Pattern)

## When External Provider APIs Are Not Ready

Use the **Coming Soon overlay pattern** instead of fake tier cards with hardcoded prices:

```typescript
const providerCatalog = [
  {
    id: 'compute-portal',
    name: 'ComputePortal',
    tagline: 'GPU & VPS instances on-demand',
    categories: ['GPU Compute', 'VPS', 'Storage'],
    status: 'coming_soon', // or 'active'
    // ... styling fields
  },
  // ...
];
```

**Card structure:**
1. Provider icon + name + "Active" or "Coming Soon" badge
2. Tagline description
3. Category tags (chips)
4. **Coming Soon overlay**: `absolute inset-0 bg-gray-900/70 backdrop-blur-[1px]` with centered "Coming Soon" badge + "Awaiting API integration" text
5. Disabled "Book" button (grayed out) for coming-soon providers
6. Active "Book" button for the provider that's actually working (e.g., Stargate Pool)

**Architecture note banner** below the catalog:
> Providers will be plugged in via adapter pattern (`ComputeProviderAdapter`). Each provider exposes `listCatalog()`, `getPricing()`, `provision()`. Affiliate commissions are tracked per booking via referral codes.

## What NOT To Do

❌ Static tier cards with fake prices (`$0.50/hr`, `$1.50/hr`, `$5.00/hr`)
❌ "Allocate Compute" button that just routes to AI Chat without actual compute allocation
❌ Provider names without attribution badges (users should know who they're renting from)
❌ Mixing "My Compute" nodes with "Rent Compute" tiers in the same list without clear separation

## Tab Destinations
| Intent Card     | Tab Target     |
|-----------------|----------------|
| Hire Agents     | marketplace    |
| AI Models       | aims           |
| Train Agents    | training       |
| Skills          | skills         |
| Custom Goal     | marketplace    |
