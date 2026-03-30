# Multi-Agent Orchestration

> Integrate multi-agent AI workflows into your Mosaic Companion app

## Quick Start

```tsx
import { MultiAgentPanel, toPanelAgent } from './components/MultiAgentPanel';

<MultiAgentPanel
  agents={activeAgents.map(toPanelAgent)}
  onCollapse={() => setShowPanel(false)}
  onRun={(agentIds, prompt, mode) => handleExecution(agentIds, prompt, mode)}
/>
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      Chatview.tsx                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  MultiAgentPanel (UI)                                │   │
│  │  - Agent selection chips                             │   │
│  │  - Mode selector (parallel/sequential/etc)          │   │
│  │  - Prompt input                                      │   │
│  │  - Run button                                        │   │
│  └──────────────────────┬───────────────────────────────┘   │
│                          │ onRun callback                    │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  handleMultiAgentRun()                               │   │
│  │  - Creates session                                   │   │
│  │  - Calls AgentOrchestrationService                  │   │
│  └──────────────────────┬───────────────────────────────┘   │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              AgentOrchestrationService.ts                   │
│                                                             │
│  runSequential()    ──► Agent 1 → Agent 2 → Agent 3        │
│  runParallel()      ──► Agent 1                            │
│                       Agent 2                              │
│                       Agent 3                              │
│  runCollaborative() ──► Agents iterate together             │
│  runOrchestrator()  ──► Lead agent coordinates others      │
└─────────────────────────────────────────────────────────────┘
```

## Integration Guide

### 1. Add the Toggle Button

In your chat component (e.g., `Chatview.tsx`):

```tsx
import { Users } from 'lucide-react';
import { MultiAgentPanel, toPanelAgent } from './components/MultiAgentPanel';

function ChatView() {
  const [showMultiAgentPanel, setShowMultiAgentPanel] = useState(false);
  const [agents, setAgents] = useState<AIAgentConfig[]>([]);

  // ... existing code

  return (
    <div>
      {/* Toggle Button - place in your toolbar */}
      <button
        onClick={() => setShowMultiAgentPanel(!showMultiAgentPanel)}
        className={`p-2 rounded-lg ${showMultiAgentPanel ? 'bg-purple-600' : 'text-gray-500'}`}
      >
        <Users size={18} />
      </button>

      {/* Panel - place above input area */}
      {showMultiAgentPanel && (
        <div className="shrink-0 border-b border-gray-800">
          <MultiAgentPanel
            agents={agents.map(toPanelAgent)}
            onCollapse={() => setShowMultiAgentPanel(false)}
            onRun={handleMultiAgentRun}
          />
        </div>
      )}
    </div>
  );
}
```

### 2. Handle the Run Callback

```tsx
const handleMultiAgentRun = async (
  agentIds: string[],
  prompt: string,
  mode: "sequential" | "parallel" | "collaborative" | "orchestrator"
) => {
  const selectedAgents = agents.filter((a) => agentIds.includes(a.id));

  let result: { finalOutput: string };
  switch (mode) {
    case "sequential":
      result = await AgentOrchestrationService.runSequential(selectedAgents, prompt);
      break;
    case "parallel":
      result = await AgentOrchestrationService.runParallel(selectedAgents, prompt);
      break;
    case "collaborative":
      result = await AgentOrchestrationService.runCollaborative(selectedAgents, prompt);
      break;
    case "orchestrator":
      result = await AgentOrchestrationService.runOrchestrator(selectedAgents, prompt);
      break;
  }

  // Add result to chat
  const assistantMessage: ChatMessage = {
    id: `msg-${Date.now()}`,
    role: "assistant",
    content: result.finalOutput,
    timestamp: Date.now(),
  };
  setMessages((prev) => [...prev, assistantMessage]);
};
```

## API Reference

### MultiAgentPanel Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `agents` | `Agent[]` | No | Pre-loaded agents (if omitted, loads from API) |
| `initialSelected` | `string[]` | No | Pre-selected agent IDs |
| `onRun` | `(agentIds, prompt, mode) => void` | Yes | Called when user clicks Run |
| `onCollapse` | `() => void` | Yes | Called to collapse panel after run |

### Agent Type

```typescript
interface Agent {
  id: string;
  name: string;
  role?: string;
  status?: 'idle' | 'ready' | 'running' | 'done' | 'error';
  model?: string;
}
```

### Orchestration Modes

| Mode | Behavior |
|------|----------|
| `parallel` | All agents run simultaneously, responses aggregated |
| `sequential` | Agent 1 → output → Agent 2 → output → Agent 3 |
| `collaborative` | Agents iterate together, sharing context |
| `orchestrator` | Lead agent coordinates others, synthesizes output |

## Service API

### AgentOrchestrationService

```typescript
// Run agents in sequence (pipeline)
runSequential(agents: AIAgentConfig[], prompt: string): Promise<OrchestrationResult>

// Run all agents simultaneously
runParallel(agents: AIAgentConfig[], prompt: string): Promise<OrchestrationResult>

// Agents collaborate and iterate
runCollaborative(agents: AIAgentConfig[], prompt: string): Promise<OrchestrationResult>

// Lead agent orchestrates others
runOrchestrator(agents: AIAgentConfig[], prompt: string): Promise<OrchestrationResult>
```

### OrchestrationResult

```typescript
interface OrchestrationResult {
  taskId: string;
  responses: AgentResponse[];  // Each agent's response
  finalOutput: string;          // Aggregated final output
  totalDuration: number;        // Total time in ms
  mode: OrchestrationMode;
  success: boolean;
}
```

## Customization

### Styling

The panel uses Tailwind CSS with these color tokens:
- Primary: `indigo-600`
- Background: `gray-900`
- Border: `gray-700/800`

Override in your theme or wrap with custom className.

### Adding Custom Modes

1. Extend `OrchestrationMode` type in `types/agentOrchestration.ts`
2. Add mode info in `MultiAgentPanel.tsx`:
```typescript
const MODE_INFO = {
  // ... existing modes
  custom: { label: 'Custom', description: 'Your description' },
};
```
3. Implement in `AgentOrchestrationService.ts`

## File Structure

```
src/
├── components/
│   ├── MultiAgentPanel.tsx       # Main UI component
│   ├── MultiAgentSelector.tsx   # Agent picker
│   └── Chatview.tsx             # Integration example
├── services/
│   └── AgentOrchestrationService.ts  # Orchestration logic
└── types/
    └── agentOrchestration.ts    # TypeScript definitions
```