# MosAic Companion - Complete Integration Guide

> **Last Updated:** March 27, 2026
> **Branch:** `upstream-hybrid`
> **Repository:** https://github.com/notsoblack/mosaic-companion

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Plugin Architecture](#plugin-architecture)
4. [Components](#components)
5. [Services](#services)
6. [Integration Points](#integration-points)
7. [UI Structure](#ui-structure)
8. [API Reference](#api-reference)
9. [Development](#development)
10. [Troubleshooting](#troubleshooting)

---

## 🌟 Overview

MosAic Companion is an Electron-based AI agent orchestration platform with multi-agent support, wallet integrations, and local LLM capabilities.

### Key Features

| Feature | Description | Plugin/Component |
|---------|-------------|------------------|
| **Multi-Agent Orchestration** | Run multiple AI agents in parallel, sequential, collaborative, or orchestrator modes | `plugins/multi-agent` |
| **Agent Soul & Memory** | Persistent personality and memory for agents | `plugins/agent-soul` |
| **Ollama Integration** | Local LLM model management | `plugins/ollama-models` + `ModelSelector.tsx` |
| **Cardano Wallet** | CIP-30 wallet support with HyperSharePass NFT gating | `plugins/cardano-wallet` + `CardanoWalletConnect.tsx` |
| **ETH/BASE Wallet** | Ethereum and Base network wallet with ANFE support | `plugins/eth-wallet` + `EthWalletConnect.tsx` |
| **HyperInsight Dashboard** | AIM leaderboards and network stats | `plugins/hyperinsight` |
| **AIM Nodes** | Node Manager client with MCP server | `plugins/aim-nodes` |
| **JIT Payments** | Just-in-time crypto payments | `plugins/payments-jit` |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm 9+
- Electron 28+

### Installation

```bash
# Clone the repository
git clone https://github.com/notsoblack/mosaic-companion.git
cd mosaic-companion
git checkout upstream-hybrid

# Install dependencies
npm install --legacy-peer-deps

# Build
npm run build

# Run Electron
npm start
```

### Development

```bash
# Run Vite dev server
npm run dev

# Open in browser
# http://localhost:5173
```

---

## 🔌 Plugin Architecture

### Directory Structure

```
plugins/
├── cardano-wallet/
│   ├── manifest.json         # Plugin metadata
│   ├── main/
│   │   └── index.ts         # IPC handlers (Electron main)
│   └── renderer/
│       └── index.tsx        # React component (UI)
├── eth-wallet/
│   ├── manifest.json
│   ├── main/index.ts
│   └── renderer/index.tsx
├── ollama-models/
│   ├── manifest.json
│   ├── main/index.ts
│   └── renderer/index.tsx
├── multi-agent/
│   ├── manifest.json
│   ├── main/index.ts
│   └── renderer/index.tsx
├── agent-soul/
│   ├── manifest.json
│   ├── main/index.ts
│   └── renderer/index.tsx
├── hyperinsight/            # Upstream plugin
├── aim-nodes/               # Upstream plugin
└── payments-jit/            # Upstream plugin
```

### Creating a New Plugin

1. **Create directory:**
   ```bash
   mkdir -p plugins/my-plugin/main plugins/my-plugin/renderer
   ```

2. **Create manifest.json:**
   ```json
   {
     "id": "my-plugin",
     "version": "1.0.0",
     "name": "My Plugin",
     "description": "Plugin description",
     "ipcNamespace": "myplugin",
     "route": "mosaic://myplugin",
     "icon": "star"
   }
   ```

3. **Create IPC handlers (main/index.ts):**
   ```typescript
   import { ipcMain } from 'electron';
   import Store from 'electron-store';

   const store = new Store({ name: 'my-plugin' });

   export function registerMyPluginIpc(ipcMain: typeof import('electron').ipcMain) {
     ipcMain.handle('myplugin:get-data', async () => {
       return store.get('data', {});
     });
     console.log('[MyPlugin] IPC handlers registered');
   }
   ```

4. **Create UI component (renderer/index.tsx):**
   ```typescript
   import React, { useState, useEffect } from 'react';

   export function MyPluginView() {
     const [data, setData] = useState(null);

     useEffect(() => {
       if (window.electronAPI?.myplugin) {
         window.electronAPI.myplugin['get-data']().then(setData);
       }
     }, []);

     return <div>{/* Your UI */}</div>;
   }
   ```

5. **Register in electron/main.ts:**
   ```typescript
   import { registerMyPluginIpc } from './plugins/my-plugin/main/index';
   // In app.whenReady():
   registerMyPluginIpc(ipcMain);
   ```

6. **Add preload API (electron/preload.ts):**
   ```typescript
   myplugin: {
     'get-data': () => ipcRenderer.invoke('myplugin:get-data'),
   }
   ```

---

## 🧩 Components

### ModelSelector (`src/components/ModelSelector.tsx`)

**Purpose:** Select local Ollama models for agents

**Location:** SettingsPage → Agent Card → Model Selection (for Ollama provider)

**Props:**
```typescript
interface ModelSelectorProps {
  onSelect: (model: string) => void;
  defaultModel?: string;
  onApiKeyChange?: (hasKey: boolean) => void;
}
```

**Features:**
- Lists installed Ollama models
- Pull new models from Ollama
- Cloud model support (with API key)
- Model size display

**Usage:**
```tsx
<ModelSelector
  onSelect={(model) => updateAgent(agent.id, { model })}
  defaultModel={agent.model}
/>
```

---

### AgentSoulSettings (`src/components/AgentSoulSettings.tsx`)

**Purpose:** Configure agent personality and memory

**Location:** SettingsPage → Agent Card → Agent Soul (collapsible)

**Props:**
```typescript
interface AgentSoulViewProps {
  agentId: string;
  agentName: string;
  onSave?: () => void;
}
```

**Features:**
- Personality templates (default, assistant, coder, analyst, creative)
- Vibe, tone, core truths, boundaries
- Memory categories: keyFacts, preferences, relationships, decisions
- Response style toggles

**Usage:**
```tsx
<AgentSoulSettings
  agentId={agent.id}
  agentName={agent.name}
  onSave={() => toast.success("Agent soul updated")}
/>
```

---

### MultiAgentPanel (`src/components/MultiAgentPanel.tsx`)

**Purpose:** Select agents and orchestration mode

**Location:** Chatview → Below input (when >1 agent available)

**Props:**
```typescript
interface MultiAgentPanelProps {
  agents?: AIAgentConfig[];
  selectedAgentIds?: string[];
  orchestrationMode?: OrchestrationMode;
  isActive?: boolean;
  isRunning?: boolean;
  currentAgentName?: string;
  onRun?: (agentIds: string[], prompt: string, mode: OrchestrationMode) => void;
}
```

**Features:**
- Agent selection (multi-select)
- Orchestration modes: parallel, sequential, collaborative, orchestrator
- Run button
- Status indicators

**Usage:**
```tsx
<MultiAgentPanel
  agents={agents}
  selectedAgentIds={selectedIds}
  orchestrationMode="parallel"
  onRun={(ids, prompt, mode) => console.log({ ids, prompt, mode })}
/>
```

---

### CardanoWalletConnect (`src/components/CardanoWalletConnect.tsx`)

**Purpose:** Connect Cardano wallets (Eternl, Lace, Nami, Yoroi, Flint)

**Location:** MidnightPage → Cardano Access section

**Features:**
- CIP-30 wallet connection
- HyperSharePass NFT detection
- Access levels based on NFT count (1+ = chat+agent, 10+ = compute)
- Manual address input for Electron mode

---

### EthWalletConnect (`src/components/EthWalletConnect.tsx`)

**Purpose:** Connect Ethereum/Base wallets (MetaMask, Rabby, Coinbase)

**Location:** Web3Page → ETH/BASE Wallet section

**Features:**
- MetaMask, Rabby, Coinbase Wallet support
- Network switching (Ethereum, Base, Base Sepolia)
- ANFE contract detection
- Balance display

---

## 🔧 Services

### MultiAgentService (`src/services/MultiAgentService.ts`)

**Purpose:** Multi-agent orchestration logic

**Key Methods:**
```typescript
class MultiAgentService {
  getAgents(): Agent[];
  runOrchestration(agentIds, prompt, mode, executeFn): Promise<OrchestrationResult>;
  addListener(callback): void;
  removeListener(callback): void;
}
```

**Orchestration Modes:**
- `parallel` - All agents run simultaneously
- `sequential` - Agents run one after another
- `collaborative` - Agents share context
- `orchestrator` - Lead agent coordinates others

---

### AgentSoulService (`src/services/AgentSoulService.ts`)

**Purpose:** Agent personality and memory management

**Key Methods:**
```typescript
class AgentSoulService {
  getOrCreateSoul(agentId, agentName, template?): Promise<AgentSoulConfig>;
  updatePersonality(agentId, updates): Promise<AgentSoulConfig>;
  addMemory(agentId, category, entry): Promise<AgentSoulConfig>;
  generateSystemPrompt(soul): string;
}
```

---

### OllamaService (`src/services/OllamaService.ts`)

**Purpose:** Local LLM model management

**Key Methods:**
```typescript
class OllamaService {
  listModels(): Promise<OllamaModel[]>;
  pullModel(name, onProgress?): Promise<void>;
  deleteModel(name): Promise<void>;
  generate(options): Promise<OllamaResponse>;
}
```

---

### CardanoWalletService (`src/services/CardanoWalletService.ts`)

**Purpose:** Cardano wallet operations

**Key Methods:**
```typescript
class CardanoWalletService {
  connect(walletName): Promise<CardanoWalletState>;
  disconnect(): Promise<void>;
  getNFTCount(policyId): Promise<number>;
  signData(message): Promise<string>;
  signTx(tx, partialSign?): Promise<string>;
}
```

---

### EthWalletService (`src/services/EthWalletService.ts`)

**Purpose:** Ethereum/Base wallet operations

**Key Methods:**
```typescript
class EthWalletService {
  connect(network?): Promise<EthWalletState>;
  disconnect(): Promise<void>;
  getBalance(): Promise<string>;
  switchNetwork(network): Promise<void>;
}
```

---

## 🔗 Integration Points

### SettingsPage Integration

```tsx
// src/components/SettingsPage.tsx

// Imports
import { ModelSelector } from "./ModelSelector";
import { AgentSoulSettings } from "./AgentSoulSettings";
import { Brain } from "lucide-react";

// In agent card, after test connection section:
{/* Agent Soul Settings */}
<div className="mt-4 pt-4 border-t border-gray-800">
  <details className="group">
    <summary className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
      <Brain size={14} />
      Agent Soul & Personality
    </summary>
    <div className="mt-3">
      <AgentSoulSettings
        agentId={agent.id}
        agentName={agent.name}
        onSave={() => toast.success("Agent soul updated")}
      />
    </div>
  </details>
</div>

{/* Ollama Model Selector (for Ollama provider) */}
{agent.provider === "ollama" && (
  <div className="mt-4 pt-4 border-t border-gray-800">
    <ModelSelector
      onSelect={(model) => updateAgent(agent.id, { model })}
      defaultModel={agent.model}
    />
  </div>
)}
```

---

### Chatview Integration

```tsx
// src/components/Chatview.tsx

// Import
import { MultiAgentPanel } from "./MultiAgentPanel";

// Below input area, inside status bar:
{/* Multi-Agent Panel */}
{agents && agents.length > 1 && (
  <div className="mt-3">
    <MultiAgentPanel
      agents={agents}
      selectedAgentIds={[]}
      orchestrationMode="parallel"
      isActive={false}
      isRunning={false}
      currentAgentName=""
      onRun={(agentIds, prompt, mode) => {
        console.log("Multi-agent run:", { agentIds, prompt, mode });
      }}
    />
  </div>
)}
```

---

### MidnightPage Integration

```tsx
// src/components/MidnightPage.tsx

// Already integrated
import { CardanoWalletConnect } from "./CardanoWalletConnect";

// In Cardano Access section:
<CardanoWalletConnect />
```

---

### Web3Page Integration

```tsx
// src/components/Web3Page.tsx

// Import
import { EthWalletConnect } from "./EthWalletConnect";

// New section after Wallet Overview:
<section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800">
  <h2 className="text-xl font-semibold mb-4 text-indigo-400">
    <Wallet size={20} className="inline mr-2" />
    ETH/BASE Wallet
  </h2>
  <EthWalletConnect
    onConnect={(address, network) => console.log({ address, network })}
    onDisconnect={() => console.log("Disconnected")}
  />
</section>
```

---

## 🎨 UI Structure

### Page URLs

| URL | Page | Components |
|-----|------|-------------|
| `browser://home` | LandingPage | Welcome dashboard |
| `browser://settings` | SettingsPage | Agent config, nodes, model selector, agent soul |
| `browser://web3` | Web3Page | ETH/BASE wallet, network settings |
| `browser://midnight` | MidnightPage | Cardano wallet, HyperSharePass |
| `browser://mcp` | MCPPage | MCP configuration |
| `browser://vault` | VaultPage | Secure storage |
| `browser://sandbox` | SandboxPage | Code sandbox |
| `browser://internal_chat` | ChatPage | Chat interface |
| `browser://hyperinsight` | HyperInsightView | AIM dashboard |

### Component Hierarchy

```
App
├── Sidebar
│   ├── Navigation items
│   └── Agent status
├── ContentArea
│   ├── SettingsPage
│   │   ├── AI Agents Section
│   │   │   ├── Agent Card
│   │   │   │   ├── Provider/Model selection
│   │   │   │   ├── AgentSoulSettings ← Our component
│   │   │   │   └── ModelSelector ← Our component (for Ollama)
│   │   │   └── Add Agent button
│   │   ├── Hypercycle Nodes Section
│   │   └── Gmail Integration
│   ├── Web3Page
│   │   ├── Wallet Overview
│   │   ├── EthWalletConnect ← Our component
│   │   ├── Network Settings
│   │   └── ...
│   ├── MidnightPage
│   │   └── CardanoWalletConnect ← Our component
│   └── ChatPage
│       └── Chatview
│           ├── Message list
│           ├── Input area
│           └── MultiAgentPanel ← Our component
└── Footer
```

---

## 📡 API Reference

### Electron API (window.electronAPI)

```typescript
// Cardano Wallet
window.electronAPI.cardano['get-state'](): Promise<CardanoWalletState>
window.electronAPI.cardano['set-state'](state): Promise<{ success: boolean }>
window.electronAPI.cardano['disconnect'](): Promise<{ success: boolean }>
window.electronAPI.cardano['get-policy-id'](): Promise<{ policyId: string }>

// ETH Wallet
window.electronAPI.ethwallet['get-state'](): Promise<EthWalletState>
window.electronAPI.ethwallet['set-state'](state): Promise<{ success: boolean }>
window.electronAPI.ethwallet['disconnect'](): Promise<{ success: boolean }>
window.electronAPI.ethwallet['get-networks'](): Promise<{ networks: object }>
window.electronAPI.ethwallet['get-anfe-contract'](): Promise<{ address: string }>

// Ollama
window.electronAPI.ollama['list-models'](): Promise<{ models: OllamaModel[] }>
window.electronAPI.ollama['pull-model'](name): Promise<{ success: boolean }>
window.electronAPI.ollama['delete-model'](name): Promise<{ success: boolean }>
window.electronAPI.ollama['get-preferences'](): Promise<Preferences>
window.electronAPI.ollama['set-preferences'](prefs): Promise<{ success: boolean }>
window.electronAPI.ollama['status'](): Promise<{ running: boolean, version?: string }>

// Multi-Agent
window.electronAPI.multiagent['get-agents'](): Promise<Agent[]>
window.electronAPI.multiagent['set-agents'](agents): Promise<{ success: boolean }>
window.electronAPI.multiagent['get-state'](): Promise<MultiAgentState>
window.electronAPI.multiagent['set-state'](state): Promise<{ success: boolean }>
window.electronAPI.multiagent['run-parallel'](agentIds, prompt): Promise<OrchestrationResult>
window.electronAPI.multiagent['run-sequential'](agentIds, prompt): Promise<OrchestrationResult>
window.electronAPI.multiagent['get-history'](): Promise<HistoryEntry[]>
window.electronAPI.multiagent['get-modes'](): Promise<OrchestrationMode[]>

// Agent Soul
window.electronAPI.agentsoul['get-all'](): Promise<AgentSoulConfig[]>
window.electronAPI.agentsoul['get'](agentId): Promise<AgentSoulConfig>
window.electronAPI.agentsoul['create'](agentId, name, template?): Promise<AgentSoulConfig>
window.electronAPI.agentsoul['update-personality'](agentId, updates): Promise<AgentSoulConfig>
window.electronAPI.agentsoul['add-memory'](agentId, category, entry): Promise<AgentSoulConfig>
window.electronAPI.agentsoul['get-templates'](): Promise<Template[]>
window.electronAPI.agentsoul['delete'](agentId): Promise<{ success: boolean }>
```

---

## 🛠️ Development

### Build Commands

```bash
# TypeScript check
npm run build

# Vite build
npm run build

# Electron build
npm run electron:build

# Run Electron
npm start

# Run Vite dev server
npm run dev
```

### Project Structure

```
mosaic-companion/
├── electron/
│   ├── main.ts              # Electron main process
│   ├── preload.ts           # Preload scripts
│   └── settings.ts          # Settings management
├── plugins/
│   ├── cardano-wallet/      # Our plugin
│   ├── eth-wallet/          # Our plugin
│   ├── ollama-models/       # Our plugin
│   ├── multi-agent/         # Our plugin
│   ├── agent-soul/          # Our plugin
│   ├── hyperinsight/        # Upstream
│   ├── aim-nodes/           # Upstream
│   └── payments-jit/        # Upstream
├── src/
│   ├── components/
│   │   ├── SettingsPage.tsx     # Agent config
│   │   ├── Chatview.tsx         # Chat interface
│   │   ├── MidnightPage.tsx     # Cardano wallet
│   │   ├── Web3Page.tsx         # ETH wallet
│   │   ├── ModelSelector.tsx    # Ollama models
│   │   ├── AgentSoulSettings.tsx  # Personality/memory
│   │   ├── MultiAgentPanel.tsx   # Multi-agent orchestration
│   │   ├── CardanoWalletConnect.tsx
│   │   └── EthWalletConnect.tsx
│   ├── services/
│   │   ├── MultiAgentService.ts
│   │   ├── AgentSoulService.ts
│   │   ├── OllamaService.ts
│   │   ├── CardanoWalletService.ts
│   │   └── EthWalletService.ts
│   └── types/
│       ├── ai.ts
│       ├── electron.d.ts
│       └── types.ts
├── docs/
│   ├── PLUGIN_ARCHITECTURE.md
│   ├── UPSTREAM_ANALYSIS.md
│   ├── UI_ARCHITECTURE.md
│   └── README.md (this file)
└── .backup/
    ├── components/          # Original files
    ├── services/             # Original files
    └── types/                # Original files
```

---

## ❓ Troubleshooting

### Build Errors

**TypeScript: Cannot find name 'aiAgents'**
- Fix: Use `agents` instead of `aiAgents` in Chatview

**Module not found: electron-store**
- Fix: `npm install electron-store --legacy-peer-deps`

**Plugins not loading**
- Fix: Check `electron/main.ts` imports and `ipcMain` registrations

### Runtime Issues

**Wallet not connecting in Electron**
- This is expected - browser extensions aren't available in Electron
- Use manual address input (view-only mode)

**Ollama not responding**
- Ensure Ollama is running: `ollama serve`
- Check port 11434 is available

**Multi-agent panel not showing**
- Requires >1 agent configured
- Check Settings → AI Agents

---

## 📝 Changelog

### v1.1.0 (March 27, 2026)
- Integrated ModelSelector into SettingsPage
- Integrated AgentSoulSettings into SettingsPage
- Integrated MultiAgentPanel into Chatview
- Added EthWalletConnect to Web3Page
- Added Brain icon for Agent Soul section
- Created comprehensive documentation

### v1.0.0 (March 26, 2026)
- Hybrid merge with upstream v0.1.6
- Plugin architecture implementation
- Cardano wallet plugin
- ETH/BASE wallet plugin
- Ollama models plugin
- Multi-agent orchestration plugin
- Agent soul plugin

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run `npm run build` to verify
5. Submit a pull request

---

## 📄 License

MIT License - See LICENSE file for details

---

*Built with ❤️ for the MosAic Companion ecosystem*