# Integration Guide - HyperCycle Developers

> How to integrate the Multi-Agent Orchestration System into your HyperCycle projects

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Integration Options](#integration-options)
3. [Connecting HyperCycle Nodes](#connecting-hypercycle-nodes)
4. [Registering New Agents](#registering-new-agents)
5. [Exposing Compute to Marketplace](#exposing-compute-to-marketplace)
6. [Monitoring Workloads](#monitoring-workloads)
7. [Complete Example](#complete-example)

---

## Quick Start

### Install the Package

```bash
# Clone the repository
git clone https://github.com/hypercycle-development/mosaic-companion.git
cd mosaic-companion

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Use in Your App

```tsx
import { MultiAgentPanel, toPanelAgent } from 'mosaic-companion';
import { AgentOrchestrationService } from 'mosaic-companion';

function MyApp() {
  const handleRun = async (agentIds, prompt, mode) => {
    const result = await AgentOrchestrationService[
      `run${mode.charAt(0).toUpperCase() + mode.slice(1)}`
    ](agents, prompt);
    
    console.log(result.finalOutput);
  };

  return (
    <MultiAgentPanel
      agents={myAgents.map(toPanelAgent)}
      onRun={handleRun}
      onCollapse={() => {}}
    />
  );
}
```

---

## Integration Options

### Option 1: Full Integration (Recommended)

Use the entire Mosaic Companion application with Multi-Agent Panel pre-integrated.

**Pros:**
- Complete solution out of the box
- All UI components ready
- Settings, persistence, and security included

**Cons:**
- Requires adopting entire app

```bash
# Run the full app
npm run dev
```

### Option 2: Component Integration

Import only the MultiAgentPanel component into your existing app.

**Pros:**
- Drop into any React app
- Customize UI as needed

**Cons:**
- Need to implement backend integration

```tsx
// Your existing app
import { MultiAgentPanel } from 'mosaic-companion/components';

<MultiAgentPanel
  agents={myAgents}
  onRun={handleRun}
  onCollapse={closePanel}
/>
```

### Option 3: Service Integration

Use only the orchestration service, build your own UI.

**Pros:**
- Complete control over UI
- Minimal dependencies

**Cons:**
- More implementation work

```typescript
import { AgentOrchestrationService } from 'mosaic-companion/services';

// Your custom UI calls the service directly
const result = await AgentOrchestrationService.runParallel(
  selectedAgents,
  prompt
);
```

---

## Connecting HyperCycle Nodes

### HyperAIBox Integration

```typescript
// electron/integrations/hypercycle/config.ts

export interface HyperAIBoxNode {
  id: string;
  name: string;
  endpoint: string;        // e.g., 'http://192.168.1.100:8080'
  capabilities: string[];  // ['llm', 'embedding', 'tts']
  status: 'available' | 'busy' | 'offline';
}

export const hypercycleConfig = {
  // Local HyperAIBox nodes
  nodes: [
    {
      id: 'hyperbox-1',
      name: 'Local HyperAIBox',
      endpoint: process.env.HYPERBOX_ENDPOINT || 'http://localhost:8080',
      capabilities: ['llm', 'embedding'],
      status: 'available' as const,
    },
  ],
  
  // Marketplace configuration
  marketplace: {
    enabled: true,
    endpoint: 'https://compute.hypercycle.ai',
    apiKey: process.env.HYPERBOX_API_KEY,
  },
};
```

### Connecting to a Node

```typescript
// electron/integrations/hypercycle/client.ts
export class HyperAIBoxClient {
  private baseUrl: string;
  
  constructor(endpoint: string) {
    this.baseUrl = endpoint;
  }
  
  // Generate text using the node
  async generate(
    model: string,
    messages: Message[],
    options?: GenerateOptions
  ): Promise<GenerateResponse> {
    const response = await fetch(`${this.baseUrl}/v1/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.HYPERBOX_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 2048,
        stream: options?.stream ?? false,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`HyperAIBox error: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  // Check node health
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

### Adding ANFE Nodes

ANFE (Accelerated Neural Forge Engine) provides embedding generation:

```typescript
// electron/integrations/hypercycle/anfe.ts
export class ANFEClient {
  private endpoint: string;
  
  constructor(endpoint: string) {
    this.endpoint = endpoint;
  }
  
  async generateEmbedding(
    text: string,
    model: string = 'nomic-embed-text'
  ): Promise<number[]> {
    const response = await fetch(`${this.endpoint}/v1/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: text,
      }),
    });
    
    const result = await response.json();
    return result.data[0].embedding;
  }
  
  async generateEmbeddings(
    texts: string[],
    model: string = 'nomoc-embed-text'
  ): Promise<number[][]> {
    const response = await fetch(`${this.endpoint}/v1/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: texts,
      }),
    });
    
    const result = await response.json();
    return result.data.map(d => d.embedding);
  }
}
```

---

## Registering New Agents

### Agent Configuration

```typescript
// src/types/ai.ts
export interface AIAgentConfig {
  /** Unique identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Description for agent selection */
  description: string;
  
  /** AI model to use */
  model: string;
  
  /** System prompt defining agent behavior */
  systemPrompt?: string;
  
  /** Temperature setting (0-1) */
  temperature?: number;
  
  /** Max tokens per response */
  maxTokens?: number;
  
  /** Whether agent is active for selection */
  isActive?: boolean;
  
  /** Custom capabilities */
  capabilities?: string[];
  
  /** Node preference */
  preferredNode?: 'local' | 'marketplace' | 'any';
}
```

### Registering an Agent

```typescript
// In settings or database
const registerAgent = async (config: AIAgentConfig) => {
  // Validate configuration
  if (!config.id || !config.name || !config.model) {
    throw new Error('Missing required agent fields');
  }
  
  // Store agent configuration
  await saveAgentConfig(config);
  
  // Register with system
  console.log(`Registered agent: ${config.name}`);
};

// Example: Create a code review agent
const codeReviewerAgent: AIAgentConfig = {
  id: 'code-reviewer',
  name: 'Code Reviewer',
  description: 'Reviews code for bugs, security issues, and best practices',
  model: 'gemini-2.0-flash-exp',
  systemPrompt: `You are an expert code reviewer. Analyze the provided code for:
- Bugs and edge cases
- Security vulnerabilities
- Performance issues
- Code style violations
- Best practices violations

Provide a detailed report with line numbers and severity levels.`,
  temperature: 0.3,
  maxTokens: 4096,
  isActive: true,
  capabilities: ['code-review', 'llm'],
};

await registerAgent(codeReviewerAgent);
```

### Using Custom Agents

```tsx
// Pass agents to MultiAgentPanel
<MultiAgentPanel
  agents={[
    {
      id: 'coder',
      name: 'Senior Coder',
      role: 'Write clean, efficient code',
      status: 'ready',
    },
    {
      id: 'reviewer',
      name: 'Code Reviewer',
      role: 'Review code for issues',
      status: 'ready',
    },
    {
      id: 'tester',
      name: 'QA Tester',
      role: 'Write tests and verify functionality',
      status: 'ready',
    },
  ]}
  onRun={handleMultiAgentRun}
  onCollapse={closePanel}
/>
```

---

## Exposing Compute to Marketplace

### Registering as a Provider

```typescript
// electron/integrations/hypercycle/marketplace.ts
export interface ComputePricing {
  pricePerToken: number;
  pricePerRequest: number;
  currency: 'HYPER' | 'USD';
}

export interface ComputeCapabilities {
  llm: {
    models: string[];
    maxContextLength: number;
    streaming: boolean;
  };
  embedding: {
    models: string[];
    dimensions: number[];
  };
}

export class ComputeMarketplace {
  private apiKey: string;
  private endpoint: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.endpoint = process.env.MARKETPLACE_ENDPOINT || 'https://compute.hypercycle.ai';
  }
  
  async registerProvider(config: {
    name: string;
    capabilities: ComputeCapabilities;
    pricing: ComputePricing;
    endpoint: string;
  }): Promise<{ providerId: string }> {
    const response = await fetch(`${this.endpoint}/v1/providers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(config),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to register: ${response.statusText}`);
    }
    
    return response.json();
  }
  
  async updateStatus(
    providerId: string,
    status: 'available' | 'busy' | 'offline'
  ): Promise<void> {
    await fetch(`${this.endpoint}/v1/providers/${providerId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ status }),
    });
  }
  
  async getWorkloads(): Promise<Workload[]> {
    const response = await fetch(`${this.endpoint}/v1/workloads`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
    });
    
    return response.json();
  }
}
```

### Starting the Provider Service

```typescript
// electron/main.ts
import { ComputeMarketplace } from './integrations/hypercycle/marketplace';
import { HyperAIBoxClient } from './integrations/hypercycle/client';

async function startProviderService() {
  const marketplace = new ComputeMarketplace(process.env.HYPERBOX_API_KEY!);
  
  // Register this node
  const { providerId } = await marketplace.registerProvider({
    name: 'My HyperAIBox',
    capabilities: {
      llm: {
        models: ['gemini-2.0-flash-exp', 'llama-3'],
        maxContextLength: 128000,
        streaming: true,
      },
      embedding: {
        models: ['nomic-embed-text'],
        dimensions: [768, 1536],
      },
    },
    pricing: {
      pricePerToken: 0.0001,
      pricePerRequest: 0.01,
      currency: 'HYPER',
    },
    endpoint: process.env.HYPERBOX_ENDPOINT!,
  });
  
  console.log(`Registered as provider: ${providerId}`);
  
  // Update status periodically
  setInterval(async () => {
    await marketplace.updateStatus(providerId, 'available');
  }, 60000);
}
```

---

## Monitoring Workloads

### Workload Tracking

```typescript
// Track active workloads
interface WorkloadTracker {
  workloads: Map<string, Workload>;
  
  startWorkload(config: WorkloadConfig): string {
    const id = `workload-${Date.now()}`;
    this.workloads.set(id, {
      id,
      status: 'running',
      startTime: Date.now(),
      agents: [],
    });
    return id;
  }
  
  updateProgress(workloadId: string, agentId: string, progress: number) {
    const workload = this.workloads.get(workloadId);
    if (workload) {
      const agent = workload.agents.find(a => a.id === agentId);
      if (agent) {
        agent.progress = progress;
      }
    }
  }
  
  completeWorkload(workloadId: string, result: OrchestrationResult) {
    const workload = this.workloads.get(workloadId);
    if (workload) {
      workload.status = 'completed';
      workload.endTime = Date.now();
      workload.result = result;
    }
  }
  
  getMetrics(workloadId: string): WorkloadMetrics {
    const workload = this.workloads.get(workloadId);
    if (!workload) return null;
    
    return {
      duration: workload.endTime! - workload.startTime,
      totalTokens: workload.agents.reduce((sum, a) => sum + (a.tokens || 0), 0),
      agentCount: workload.agents.length,
      success: workload.status === 'completed',
    };
  }
}
```

### Prometheus Metrics

```typescript
// Expose metrics for Prometheus
import { Registry, Counter, Histogram } from 'prom-client';

const registry = new Registry();
const orchestrationDuration = new Histogram({
  name: 'orchestration_duration_seconds',
  help: 'Duration of orchestration tasks',
  labelNames: ['mode'],
  buckets: [1, 5, 10, 30, 60, 300],
  registers: [registry],
});

const agentRequests = new Counter({
  name: 'agent_requests_total',
  help: 'Total number of agent requests',
  labelNames: ['agent_id', 'status'],
  registers: [registry],
});

// In your orchestration code
const start = Date.now();
try {
  const result = await AgentOrchestrationService.runParallel(agents, prompt);
  orchestrationDuration.observe({ mode: 'parallel' }, (Date.now() - start) / 1000);
} catch (error) {
  // Handle error
}
```

---

## Complete Example

### Full Integration Example

```tsx
// App.tsx - Complete integration example
import React, { useState, useEffect } from 'react';
import { MultiAgentPanel, toPanelAgent } from './components/MultiAgentPanel';
import { AgentOrchestrationService } from './services/AgentOrchestrationService';
import { AIAgentConfig } from './types/ai';

export function MultiAgentApp() {
  const [agents, setAgents] = useState<AIAgentConfig[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      const savedAgents = await window.electronAPI.aiAgents.get();
      setAgents(savedAgents.filter((a: AIAgentConfig) => a.isActive !== false));
    };
    loadAgents();
  }, []);

  // Handle multi-agent execution
  const handleMultiAgentRun = async (
    agentIds: string[],
    prompt: string,
    mode: OrchestrationMode
  ) => {
    setIsRunning(true);
    
    const selectedAgents = agents.filter(a => agentIds.includes(a.id));
    
    // Add user message
    setMessages(prev => [...prev, {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    }]);

    try {
      let result;
      switch (mode) {
        case 'sequential':
          result = await AgentOrchestrationService.runSequential(selectedAgents, prompt);
          break;
        case 'parallel':
          result = await AgentOrchestrationService.runParallel(selectedAgents, prompt);
          break;
        case 'collaborative':
          result = await AgentOrchestrationService.runCollaborative(selectedAgents, prompt);
          break;
        case 'orchestrator':
          const [orchestrator, ...workers] = selectedAgents;
          result = await AgentOrchestrationService.runOrchestrated(
            orchestrator,
            workers,
            prompt
          );
          break;
      }

      // Add assistant response
      setMessages(prev => [...prev, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: result.finalOutput,
        timestamp: Date.now(),
        metadata: {
          agentCount: agentIds.length,
          mode,
          duration: result.totalDuration,
        },
      }]);

    } catch (error) {
      console.error('Multi-agent execution failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="app">
      {/* Header with toggle */}
      <header className="flex justify-between items-center p-4">
        <h1>Mosaic Companion</h1>
        <button
          onClick={() => setShowPanel(!showPanel)}
          className={`p-2 rounded ${showPanel ? 'bg-purple-600' : 'bg-gray-800'}`}
        >
          <Users size={18} />
        </button>
      </header>

      {/* Chat messages */}
      <main className="flex-1 overflow-y-auto p-4">
        {messages.map(msg => (
          <div key={msg.id} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </main>

      {/* Multi-Agent Panel */}
      {showPanel && (
        <MultiAgentPanel
          agents={agents.map(toPanelAgent)}
          onRun={handleMultiAgentRun}
          onCollapse={() => setShowPanel(false)}
        />
      )}
    </div>
  );
}
```

### Environment Variables Summary

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key |
| `HYPERBOX_ENDPOINT` | No | Local HyperAIBox endpoint |
| `HYPERBOX_API_KEY` | No | HyperAIBox API key |
| `ETHEREUM_RPC` | No | Ethereum RPC endpoint |
| `LOG_LEVEL` | No | Logging level (debug, info, warn, error) |

---

## Next Steps

1. **Try the Demo** - Run `npm run dev` and explore the Multi-Agent Panel
2. **Configure Agents** - Add your own agents in Settings
3. **Connect Nodes** - Set up HyperAIBox for local compute
4. **Join Marketplace** - Register as a compute provider

---

## Support

- **Documentation:** [docs/](docs/)
- **Issues:** [GitHub Issues](https://github.com/hypercycle-development/mosaic-companion/issues)
- **Discord:** [HyperCycle Discord](https://discord.com/invite/hypercycle)