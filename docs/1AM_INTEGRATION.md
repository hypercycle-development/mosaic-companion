# 1AM Wallet Integration — MosAIc Stargate

> **Status:** ✅ Built · 🟡 Registry PR deferred — MosAIc is Electron desktop app, not web DApp

## What Was Built

This integration adds **1AM Wallet** support to the **Stargate Addon** inside MosAIc Companion. It enables **plugin developers** to build Midnight-powered tools and agents that can:
- Connect to 1AM Wallet from within any Stargate plugin
- Read NIGHT/DUST balances
- Sign and submit Midnight transactions
- Delegate agent-specific wallet permissions

> **Important:** MosAIc Companion is an **Electron desktop application**, not a browser-based DApp. The 1AM Wallet extension injects `window.oneam` into the renderer process. This works for plugin use inside MosAIc, but means we **cannot currently submit to the 1AM App Registry** (which requires a public HTTPS URL for its in-wallet Apps tab).

## Architecture

```
┌─────────────────────────────────────────┐
│  MosAIc Companion (Electron Desktop)    │
│  ├─ Main Process                        │
│  │   └─ IPC handlers (session cache)   │
│  ├─ Renderer (React)                    │
│  │   ├─ Stargate Addon                 │
│  │   │   ├─ OneAmWalletService.ts      │
│  │   │   │   ├─ detect()               │
│  │   │   │   ├─ connect()              │
│  │   │   │   ├─ fetchWalletData()      │
│  │   │   │   ├─ signTx() / submitTx()  │
│  │   │   │   └─ createAgentWallet()     │
│  │   │   └─ Plugin SDK                 │
│  │   │       └─ exposes 1AM APIs to    │
│  │   │           third-party plugins    │
│  │   └─ AdaPortalPanel.tsx              │
│  │       └─ "1AM Wallet Dashboard"     │
│  └─ 1AM Wallet Browser Extension        │
│      └─ injects window.oneam into       │
│         Electron renderer               │
└─────────────────────────────────────────┘
```

## Files Added / Modified

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/services/OneAmWalletService.ts` | **NEW** | Wallet detection, connect, balance (NIGHT/DUST), tx signing, agent wallet delegation |
| 2 | `electron/preload.ts` | **MOD** | `oneam` IPC namespace (12 methods) |
| 3 | `electron/main.ts` | **MOD** | IPC handlers for 1AM session cache + agent wallet CRUD |
| 4 | `global.d.ts` | **MOD** | Type declarations for `window.electronAPI.oneam` |
| 5 | `src/components/AdaPortalPanel.tsx` | **MOD** | 1AM Wallet Dashboard on Stargate Start tab |
| 6 | `docs/1AM_INTEGRATION.md` | **NEW** | This document |
| 7 | `docs/1AM_REGISTRY_PR.md` | **NEW** | Future registry PR guide (when HTTPS URL available) |
| 8 | `docs/1am-registry-entry.json` | **NEW** | Pre-built registry entry (for future use) |

## User Flow (Stargate Start Tab)

### Before
```
┌────────────────────────────┐
│ NFT Access                 │
│ Connect wallet to verify   │
│ NFT holdings for premium   │
│ access                 [LACE]│
└────────────────────────────┘
```

### After
```
┌────────────────────────────┐
│ 1AM Wallet                 │
│ Midnight Network — NIGHT · │
│ DUST · Agent Identity      │
│                    [Connect] │
├────────────────────────────┤
│ Lovelace  1.45   NIGHT 500 │
│ DUST  1200                 │
│ Assets: 3 tokens           │
│ Agent Wallets: 2           │
│  • Researcher  Delegated   │
│  • Executor    Read-only   │
│ [Disconnect]               │
└────────────────────────────┘

┌────────────────────────────┐
│ Cardano (LACE)  [Legacy]   │
│ Legacy NFT access    [LACE]│
└────────────────────────────┘
```

## For Plugin Developers

If you're building a Stargate plugin that needs Midnight powers:

```typescript
import { oneAmWallet } from '@mosaic/stargate/services';

// Inside your plugin:
const result = await oneAmWallet.connect();
if (result.success) {
  const night = await oneAmWallet.getNightBalance();
  const dust  = await oneAmWallet.getDustBalance();
  const tx    = await oneAmWallet.signTx(rawTxHex);
}
```

The 1AM Wallet session is shared across all Stargate plugins — users connect once, every plugin benefits.

## Agent Wallet Concept

Each AI agent can have a **delegated sub-wallet**:

```typescript
oneAmWallet.createAgentWallet(agent.id, agent.name);
oneAmWallet.delegateAgent('agent-123', ['read', 'sign', 'spend_night']);
```

| Benefit | How It Works |
|---|---|
| **Per-agent budgets** | Each agent has its own NIGHT/DUST allocation |
| **Permission scoping** | Agents can't spend beyond delegated rights |
| **Audit trail** | All agent actions traceable to master 1AM identity |
| **ZK privacy** | Agent transactions are private by default on Midnight |

## Build Verification

```bash
npm run typecheck   # ✅ Pass
npm run build       # ✅ Pass
```

## About the 1AM App Registry

### Why We're NOT Submitting Yet

| Requirement | Our Status |
|---|---|
| Midnight DApp Connector v4+ | ✅ Implemented |
| Working HTTPS URL | ❌ **Blocker** — MosAIc is a desktop app |
| 128×128 icon (HTTPS, <50KB) | ❌ **Blocker** — no web host |
| Tested with 1AM Wallet | 🟡 Works in Electron renderer; needs extension install |

### When We WILL Submit

Once any of these happen:
1. **MosAIc gets a web deployment** (landing page, web demo, or hosted instance)
2. **A companion developer portal** goes live at a real HTTPS URL
3. **1AM Wallet adds Electron app support** to its registry model

At that point, use `docs/1AM_REGISTRY_PR.md` + `docs/1am-registry-entry.json`.

## Quick Start for Devs

```bash
git checkout feat/stargate-integration
npm install
npm run dev
# In the app: Navigate to Stargate → Start tab → Connect 1AM Wallet
```

*Built for feat/stargate-integration branch.*
*Registry submission deferred until HTTPS deployment is available.*
