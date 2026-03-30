# Multi-Agent Orchestration

> Integrate multi-agent AI workflows into your Mosaic Companion app

---

## ⚡ Latest Upgrade: Real-Time Sequential Streaming

**Version:** March 2026

This upgrade transforms the sequential execution model from batched rendering to **true real-time streaming**.

### What Changed

**Before:**
- Agents executed sequentially but rendered at the end
- UI showed a single batched response after all agents completed
- All responses appeared together

**After:**
- Each agent renders immediately after its execution completes
- Users see a live multi-agent conversation unfold
- "Thinking → Response" replacement per agent

### Execution Flow

```
1. Insert "thinking" placeholder message
   └─ "🧠 Agent 1 (1/3) thinking..."
   
2. Run agent and get response

3. Replace thinking message with actual response
   └─ Agent 1's response now visible

4. Pass context to next agent
   └─ Agent 2 sees Agent 1's output

5. Repeat until all agents complete
```

### Key Rule

**All rendering MUST happen inside the execution loop.**

```typescript
for (let i = 0; i < agents.length; i++) {
  // 1. Insert thinking message
  setSessions(prev => [...prev, thinkingMessage]);
  await new Promise(r => setTimeout(r, 0)); // Force render

  // 2. Run agent
  const response = await runAgent(agent, context);

  // 3. Replace thinking with response (IMMEDIATELY)
  setSessions(prev => prev.map(msg => 
    msg.id === thinkingId 
      ? { ...msg, content: response, status: "done" }
      : msg
  ));
  await new Promise(r => setTimeout(r, 0)); // Force render

  // 4. Pass context to next agent
  previousOutputs.push({ agentName: agent.name, output: response });
}
```

### ⚠️ Anti-Patterns (DO NOT USE)

- ❌ `setMessages(fullArray)` - Batching all responses before rendering
- ❌ `useEffect(() => { setMessages(results) })` - Overwriting chat after execution
- ❌ Waiting for full loop completion before updating UI
- ❌ Merging all agent responses into one message

### Test Case

**Run 3 agents in sequential mode:**

Expected:
```
Agent 1 appears → Agent 2 appears → Agent 3 appears
```

NOT:
```
All responses appear at once
```

### Integration with Agent Soul + Memory

Each agent receives:
- Its own Soul system prompt (personality, reasoning style)
- Memory context from previous sessions
- Previous agent outputs for critique/refinement

---

## Quick Start

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