---
name: soul-md-integration
description: Implement SOUL.md identity layer for Mosaic-Companion agents. Adds soul selector UI, grading integration, and system prompt injection.
---

# SOUL.md Integration for Mosaic-Companion

## Overview

Integrate SOUL.md identity layer into Mosaic-Companion's agent system. SOUL.md is a compact constitution that defines agent identity, mission, constraints, and behavior.

## When to Use

- Adding agent identity/behavior definition to Mosaic-Companion
- Creating agent soul selector UI
- Implementing SOUL grading using soul-grader skill
- Injecting SOUL into LLM system prompts

## Prerequisites

- Understanding of Mosaic-Companion agent system (`AIAgentConfig`, `AIService`)
- Familiarity with React component architecture
- Knowledge of SOUL.md grading standard

## Implementation Steps

### Step 1: Define Types

Create `src/types/soul.ts`:

```typescript
export interface AgentSoul {
  id: string;
  name: string;
  archetype: string;
  description: string;
  icon: string;
  color: string;
  soulMarkdown: string;
  customizable: boolean;
  recommendedFor: string[];
}

export interface SoulGrade {
  score: number;
  verdict: 'Excellent' | 'Operational' | 'Scaffold' | 'Needs rewrite' | 'Not deployable';
  deployability: string;
  blockers: string[];
  fixes: string[];
}
```

### Step 2: Create Predefined Souls

Create `src/data/predefined-souls.ts` with 6 archetypes:
- Executor (production-grade task completion)
- Researcher (deep investigation)
- Creative (ideation partner)
- Guardian (security reviewer)
- Navigator (learning guide)
- Fast Responder (quick answers)

Each soul must include:
- Mission statement (who it serves, what outcome)
- Core thesis (durable decision lens)
- Optimization hierarchy (ranked priorities)
- Hard constraints (binary filters)
- Voice guidelines
- Truthfulness policy
- Success criteria

### Step 3: Extend Agent Config

Modify `src/types/ai.ts`:

```typescript
export interface AIAgentConfig {
  // ... existing fields
  soulId?: string;
  soulOverride?: string;
  soulGrade?: SoulGrade;
}
```

### Step 4: Create Soul Selector Component

Create `src/components/SoulSelector.tsx`:

```typescript
interface SoulSelectorProps {
  selectedSoulId: string | null;
  customSoulOverride: string | null;
  onSelect: (soulId: string) => void;
  onCustomize: (customSoulMarkdown: string) => void;
}
```

UI Requirements:
- Soul gallery grid (2 columns)
- Soul cards with icon, name, description
- "Custom" option with SOUL.md editor
- Grade badge showing SOUL quality
- Expand/collapse for details

### Step 5: Implement Soul Grader Service

Create `src/services/SoulGraderService.ts`:

```typescript
export async function gradeSoul(soulMarkdown: string): Promise<SoulGrade> {
  // Use soul-grader skill if available
  // Fall back to basic regex/keyword scoring
  // Return structured grade object
}
```

Grading must evaluate:
- Mission clarity (15 pts)
- Identity + negations (12 pts)
- Core thesis (10 pts)
- Optimization hierarchy (10 pts)
- Hard constraints (10 pts)
- Soft preferences (8 pts)
- Authority + escalation (10 pts)
- Voice + truthfulness (10 pts)
- Success criteria (8 pts)
- Artifact separation (5 pts)
- Runtime hygiene (2 pts)

### Step 6: Modify AIService

Update `src/services/AIService.ts`:

```typescript
function buildSystemPrompt(agent: AIAgentConfig): string {
  const soul = agent.soulOverride || 
               getSoulById(agent.soulId)?.soulMarkdown ||
               DEFAULT_SOUL.soulMarkdown;
  
  return `${soul}\n\n---\n\n${skills}\n\n---\n\n${tools}`;
}
```

### Step 7: Integrate into Settings

Modify `src/components/AIAgentsSettings.tsx`:

1. Add SoulSelector below provider/model selection
2. Store soulId and soulOverride in agent config
3. Show grade badge in agent list
4. Allow soul customization per agent

## Anti-Rationalizations

| Rationalization | Reality |
|-----------------|---------|
| "Users don't need this, just use the default" | Default agents drift. SOUL creates consistency. |
| "This adds too much complexity" | It's an optional layer that improves reliability. |
| "We can add this later" | Identity drift happens now. Fix it now. |
| "Just use system prompts" | System prompts get buried. SOUL is explicit identity. |

## Verification Checklist

- [ ] SoulSelector renders correctly
- [ ] Predefined souls load from bundled data
- [ ] Custom soul editor accepts markdown
- [ ] Grading returns score 0-100
- [ ] Grade badge displays correctly
- [ ] Soul injected into system prompt
- [ ] Agent behavior reflects SOUL identity
- [ ] Soul persistence works across sessions

## Output Format

Deliver:
1. Type definitions (soul.ts)
2. Predefined souls data file
3. SoulSelector component
4. SoulGraderService
5. Modified AIAgentConfig types
6. Updated AIService
7. Updated AIAgentsSettings

## References

- `references/soul-md-grading-rubric.md` — Complete 100-point grading rubric
- `references/provider-routing-ollama-cloud.md` — Ollama Cloud 401 fix pattern
- `templates/soul-md-template.md` — Starter templates (minimal and full production)
- `templates/agent-config-ollama-cloud.json` — Valid Ollama Cloud agent configuration
- SOUL.md grading standard: github.com/cobibean/soul-grader-skill
- Mosaic-Companion agent docs: docs/agents.md
- AGENTS.md spec: hermes-agent.nousresearch.com/docs