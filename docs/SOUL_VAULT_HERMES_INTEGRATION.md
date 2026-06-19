# Soul + Vault + Hermes Integration Guide

## Overview

This document describes the complete integration of SOUL.md identity layer, Hermes capabilities, and Vault knowledge access into Mosaic-Companion's agent system.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Mosaic-Companion                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Soul UI    │  │   Grader     │  │   Vault UI   │  │  Capability  │    │
│  │  Selector    │  │   Service    │  │   Manager    │  │   Selector   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                │                │                │               │
│         └────────────────┴────────────────┴────────────────┘               │
│                                      │                                       │
│                         ┌────────────▼────────────┐                         │
│                         │   VaultCapabilityService │                        │
│                         └────────────┬────────────┘                         │
│                                      │                                       │
│  ┌───────────────────────────────────┼───────────────────────────────────┐   │
│  │                         ┌─────────▼─────────┐                      │   │
│  │                         │     AIService      │                      │   │
│  │                         │  (System Prompt    │                      │   │
│  │                         │   Builder)         │                      │   │
│  │                         └─────────┬─────────┘                      │   │
│  │                                   │                                │   │
│  │  ┌────────────────────────────────┼─────────────────────────────┐  │   │
│  │  │                    ┌───────────▼───────────┐                │  │   │
│  │  │                    │  LLM System Prompt    │                │  │   │
│  │  │                    │  - SOUL.md Identity    │                │  │   │
│  │  │                    │  - Capabilities        │                │  │   │
│  │  │                    │  - Vault Knowledge     │                │  │   │
│  │  │                    │  - Skills              │                │  │   │
│  │  │                    └───────────┬───────────┘                │  │   │
│  │  │                                │                           │  │   │
│  │  │                    ┌───────────▼───────────┐                │  │   │
│  │  │                    │   AI Agent (LLM)      │                │  │   │
│  │  │                    └───────────────────────┘                │  │   │
│  │  └─────────────────────────────────────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. SoulSelector (`src/components/SoulSelector.tsx`)

UI component for selecting and customizing agent souls.

**Features:**
- Soul gallery with 6 predefined archetypes
- Custom SOUL.md editor with live preview
- SOUL grading badge (0-100 score)
- Grade details with drift risks and fixes

**Usage:**
```tsx
<SoulSelector
  selectedSoulId={agent.soulId}
  customSoulMarkdown={agent.soulOverride}
  soulGrade={agent.soulGrade}
  onSelectSoul={(soulId) => updateAgent({ soulId })}
  onCustomizeSoul={(markdown) => updateAgent({ soulOverride: markdown })}
  onGradeChange={(grade) => updateAgent({ soulGrade: grade })}
/>
```

### 2. SoulGraderService (`src/services/SoulGraderService.ts`)

Implements SOUL.md grading according to the soul-grader-skill standard.

**Grading Rubric (100 points):**
- Mission clarity: 15 points
- Identity + negations: 12 points
- Core thesis: 10 points
- Optimization hierarchy: 10 points
- Hard constraints: 10 points
- Soft preferences: 8 points
- Authority + escalation: 10 points
- Voice + truthfulness: 10 points
- Success / artifacts: 8 points
- Artifact separation: 5 points
- Runtime hygiene: 2 points

**API:**
```typescript
const grade = await gradeSoul(soulMarkdown);
// Returns: { score, verdict, deployability, blockers, fixes, ... }
```

### 3. HermesCapabilityRegistry (`src/services/HermesCapabilityRegistry.ts`)

Maps Hermes Agent tools to Mosaic-Companion capabilities.

**Capability Categories:**
- `core`: vision, text_to_speech
- `web`: web_search, browser_navigation
- `file`: file_read, file_write, file_search, file_patch
- `terminal`: terminal, process_management, code_execution
- `agent`: skill_management, memory_management, session_search, task_delegation, kanban, cronjob

**Predefined Sets:**
- `developer`: Full dev toolkit
- `researcher`: Investigation tools
- `ops`: Operations and automation
- `creative`: Design and ideation
- `minimal`: Essential only

**API:**
```typescript
const prompt = buildCapabilitySystemPrompt(["web_search", "file_read"]);
const set = getCapabilitySet("developer");
```

### 4. VaultCapabilityService (`src/services/VaultCapabilityService.ts`)

Builds complete system prompts from SOUL, capabilities, and vault knowledge.

**Key Functions:**
```typescript
// Build complete system prompt
const prompt = buildAgentSystemPrompt({
  agentId: "...",
  agentName: "...",
  soulId: "executor",
  capabilities: { enabledCapabilities: [...], vaultBoxAccess: [...] },
  vaultAccess: [...],
});

// Assemble into final string
const systemPrompt = assembleSystemPrompt(promptParts);

// Get recommended capabilities for soul
const caps = getRecommendedCapabilities("executor");

// Grade SOUL if needed
const grade = await ensureSoulGrade(soulId, soulOverride, existingGrade);
```

### 5. SoulVaultConnector (`src/services/SoulVaultConnector.ts`)

Connects SOUL identities to vault box access patterns.

**Features:**
- Recommended vault boxes per soul archetype
- Vault box categories with sensitivity levels
- Auto-configuration of vault access
- Capability-based vault suggestions

**Soul-Vault Mapping:**
- **Executor**: credentials, deployment, secrets
- **Researcher**: references, documentation, archives
- **Creative**: assets, templates, inspiration
- **Guardian**: security (required), audit, compliance
- **Navigator**: guides, documentation, templates
- **Fast**: quickrefs, cheatsheets

### 6. StargateSoulIntegration (`src/services/stargate/StargateSoulIntegration.ts`)

Integrates SOUL with Stargate module for AIM deployment.

**Features:**
- Soul-AIM configuration mapping
- Skill compatibility checking
- Fleet role definitions
- Deployment readiness gates

**API:**
```typescript
// Get optimal AIM config for soul
const config = getSoulAimConfig("executor");
// Returns: { preferredProvider, recommendedModel, minMemory, timeoutMs }

// Check deployment readiness
const readiness = checkSoulDeploymentReadiness(agentConfig);
// Returns: { ready: boolean, issues: [], warnings: [] }

// Match skills to soul
const matches = matchSkillsToAgent(availableSkills, agentConfig);
// Returns: { perfect: [], compatible: [], incompatible: [] }
```

## Data Flow

### Agent Creation Flow

1. User clicks "Add Agent"
2. Default agent created with:
   - `soulId: "executor"`
   - `capabilities: ["file_read", "memory_management", "session_search"]`
   - `vaultBoxAccess: []`
3. User can customize in AIAgentsSettings:
   - Change soul archetype
   - Edit custom SOUL.md
   - Grade SOUL
   - Configure capabilities
   - Grant vault access

### Chat Flow

1. User sends message to agent
2. AIService.buildSystemPrompt():
   - Load SOUL (from soulId or soulOverride)
   - Inject capability instructions
   - Load vault knowledge (via IPC)
   - Load skills (via IPC)
3. Combined system prompt sent to LLM
4. Agent responds with consistent identity

### SOUL Grading Flow

1. User edits SOUL.md or selects predefined soul
2. User clicks "Grade SOUL"
3. SoulGraderService.gradeSoul() evaluates:
   - Automatic fail conditions
   - Category scores
   - Drift risks
   - Suggested fixes
4. Grade displayed in badge and detailed view
5. User can fix issues and re-grade

## Type Extensions

### AIAgentConfig Extensions (`src/types/ai.ts`)

```typescript
export interface AIAgentConfig {
  // ... existing fields ...
  
  // SOUL.md identity layer
  soulId?: string;
  soulOverride?: string;
  soulGrade?: SoulGrade;
  
  // Capability configuration
  capabilities?: AgentCapabilityConfig;
}
```

### AgentCapabilityConfig (`src/types/soul.ts`)

```typescript
export interface AgentCapabilityConfig {
  enabledCapabilities: string[];
  vaultBoxAccess: string[];
  customSystemPrompt?: string;
}
```

## Integration Points

### 1. AIAgentsSettings (`src/components/AIAgentsSettings.tsx`)

Added SoulSelector after skills section:

```tsx
{/* ─── Agent Soul / Identity ───────────────────── */}
<div className="pt-4 border-t border-gray-800">
  <SoulSelector
    selectedSoulId={agent.soulId || null}
    customSoulMarkdown={agent.soulOverride || null}
    soulGrade={agent.soulGrade}
    onSelectSoul={(soulId) => updateAgent(agent.id, { soulId })}
    onCustomizeSoul={(markdown) => updateAgent(agent.id, { soulOverride: markdown })}
    onGradeChange={(grade) => updateAgent(agent.id, { soulGrade: grade })}
  />
</div>
```

### 2. AIService (`src/services/AIService.ts`)

Modified sendMessage() to inject SOUL and capabilities:

```typescript
// ─── SOUL + Capability Injection (v3.0) ────────────────────────────────
let soulCapabilitySystemPrompt = "";
try {
  // Build SOUL + capabilities prompt
  const promptParts = buildAgentSystemPrompt(agentContext);
  soulCapabilitySystemPrompt = assembleSystemPrompt(promptParts);
} catch (e) {
  console.error("[AIService] SOUL/Capability system prompt build failed:", e);
}

// Pass to skill builder
const result = await window.electronAPI?.skills?.buildSystemPrompt?.({
  baseSystemPrompt: soulCapabilitySystemPrompt, // Include SOUL layer
  skillNames: config.skills,
});
```

### 3. New Agent Defaults

Modified addAgent() to include SOUL defaults:

```typescript
const newAgent: AIAgentConfig = {
  // ... base fields ...
  soulId: "executor",
  soulOverride: "",
  capabilities: {
    enabledCapabilities: ["file_read", "memory_management", "session_search"],
    vaultBoxAccess: [],
  },
};
```

## Usage Examples

### Creating a Research Agent

1. Create new agent
2. Set provider to "claude" or "ollama-cloud"
3. Select "The Researcher" soul
4. Grade SOUL (should be 75-100)
5. Add vault access: "references", "documentation"
6. Enable capabilities: web_search, browser_navigation
7. Test connection
8. Deploy

### Creating a Guardian Agent

1. Create new agent
2. Select "The Guardian" soul
3. Edit SOUL.md to add specific security policies
4. Grade SOUL (required: 80+ for safety agents)
5. Grant vault access to "security" (required), "audit"
6. Enable capabilities: file_read, file_search
7. Add skills: source-security-audit, code-review-and-quality

### Custom Soul Creation

1. Select "Custom Soul" archetype
2. SOUL.md editor opens with template
3. Fill in:
   - Mission: "You are a data analysis agent..."
   - Core thesis: "Data is messy..."
   - Hard rules: "No destructive queries without backup..."
4. Click Grade → Shows score and fixes
5. Fix issues until grade >= 75
6. Save agent

## File Structure

```
src/
  types/
    soul.ts                    # Soul and capability types
    ai.ts                      # Extended AIAgentConfig
  components/
    SoulSelector.tsx           # Soul selection UI
    AIAgentsSettings.tsx       # Updated with SoulSelector
  data/
    predefined-souls.ts        # 6 soul archetypes
  services/
    SoulGraderService.ts       # SOUL grading implementation
    HermesCapabilityRegistry.ts # Capability definitions
    VaultCapabilityService.ts  # Prompt building
    SoulVaultConnector.ts      # Vault-soul integration
    AIService.ts               # Updated with SOUL injection
    stargate/
      StargateSoulIntegration.ts # Stargate module integration
```

## Migration Guide

### For Existing Agents

Existing agents will have `soulId`, `soulOverride`, `soulGrade`, and `capabilities` as undefined. The system handles this gracefully:

1. Default soul (Executor) is used if no soul configured
2. Recommended capabilities auto-applied based on soul
3. No vault access granted by default
4. User can upgrade agent by selecting a soul in settings

### Data Migration

No migration needed. New fields are optional and backward-compatible.

## Security Considerations

### Vault Access
- Agents only access vault boxes explicitly granted
- Guardian agents require "security" box access
- Credentials/secrets never stored in SOUL.md (automatic fail)
- Vault box access logged and auditable

### SOUL Grading
- Automatic fails prevent deployment of unsafe SOULs
- Blockers include: secrets, false claims, missing gates
- Grade must be >= 60 for operational deployment
- Grade >= 90 recommended for production

### Capability Restrictions
- Terminal/code_execution require user confirmation
- Web browser access limited to allowed domains
- File operations scoped to workspace
- Memory storage subject to size limits

## Future Extensions

1. **Soul Marketplace**: Share custom SOULs via Stargate
2. **Soul Evolution**: Track SOUL changes over time
3. **Multi-Agent Souls**: Fleet coordination protocols
4. **Soul-Based Routing**: Route tasks by soul compatibility
5. **A/B Soul Testing**: Compare agent performance by soul

## References

- SOUL.md Grading Standard: https://github.com/cobibean/soul-grader-skill
- Hermes Agent Docs: https://hermes-agent.nousresearch.com/docs
- Stargate Module: See `docs/STARGATE_INTEGRATION.md`

## Support

For issues with SOUL integration:
1. Check SOUL grade >= 60
2. Verify capabilities are enabled
3. Confirm vault access granted
4. Review AIService logs for prompt injection errors
