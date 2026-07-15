# Stargate Vault — Skill Registry & Access Control System

## Overview

The **Stargate Vault** is the central skill repository for the Mosaic Companion ecosystem. It contains **283 skills** with complete documentation, trigger phrases, and access patterns for AI Agents.

| Metric | Value |
|--------|-------|
| **Total Skills** | 283 |
| **Categories** | 24 |
| **Trigger Phrases** | 316+ |
| **Access Patterns** | 5 |
| **AI Agency Skills** | 5 |

---

## Vault Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    STARGATE VAULT                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              VAULT INDEX (vault-index.json)                 ││
│  │                                                              ││
│  │  • 283 skill entries                                        ││
│  │  • 24 categories                                            ││
│  │  • 316+ trigger phrases                                     ││
│  │  • Access control metadata                                  ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                             │                                   │
│  ┌──────────────────────────┴──────────────────────────────────┐│
│  │                  SKILL STORAGE                                ││
│  ├──────────────────────────────────────────────────────────────┤│
│  │                                                              ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ ││
│  │  │ BUNDLED SKILLS │  │ BOT-AUTHORED   │  │ HERMES SOURCE │ ││
│  │  │     (278)      │  │    (5)         │  │   (323)       │ ││
│  │  │                │  │                │  │               │ ││
│  │  │ ~/mosaic-comp  │  │ ~/.config/...  │  │ ~/.hermes/    │ ││
│  │  │ /bundled-skills│  │ /mosaicbot/    │  │ /skills/      │ ││
│  │  └────────────────┘  └─────────────────┘  └───────────────┘ ││
│  │                                                              ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              ACCESS CONTROL LAYER                          ││
│  │                                                              ││
│  │  • Public Access (all agents)                               ││
│  │  • Restricted (specific agents)                             ││
│  │  • Admin (orchestrator only)                                ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Skill Categories

| Category | Count | Description | Key Skills |
|----------|-------|-------------|------------|
| **ai-agency** | 5 | AI Agency architecture & operations | `hypercycle-node-factory-architect`, `stargate-bundle-creator` |
| midnight | 107 | Midnight blockchain & smart contracts | `midnight-orchestrator`, `midnight-core-concepts` |
| blockchain | 21 | Cardano, Aiken, node operations | `cardano-integration`, `aiken-smart-contracts` |
| software-development | 36 | Coding, debugging, testing | `senior-ai-developer`, `code-review-and-quality` |
| devops | 14 | Infrastructure, deployment, k8s | `hyperaibox-fleet-manager`, `axi-forge` |
| mosaic-stargate | 13 | Stargate operations | `stargate-master-index`, `stargate-debug-playbook` |
| hypercycle | 2 | HyperCycle node management | `hypercycle-aimifier`, `hypercycle-node-manager-ops` |
| mcp | 8 | Model Context Protocol | `codebase-memory-mcp`, `native-mcp` |
| github | 6 | GitHub workflows | `github-code-review`, `github-pr-workflow` |
| creative | 21 | ASCII art, diagrams, design | `architecture-diagram`, `excalidraw` |
| mlops | 11 | ML operations | `axolotl`, `serving-llms-vllm` |
| debugging | 8 | Debugging methodologies | `systematic-debugging`, `eight-phase-debugging` |
| data-science | 5 | Data analysis | `jupyter-live-kernel`, `timesfm-forecasting` |
| autonomous-ai-agents | 9 | Agent orchestration | `mosaic-bot-orchestrator`, `agentic-system-evolution` |
| + 10 more | — | Research, media, productivity | — |

---

## Access Patterns

### Pattern 1: Direct Skill Loading

```javascript
// Load skill by exact name
TOOL:load_skill {
  "name": "hypercycle-aim-master"
}

// Response: Returns full skill content (SKILL.md)
```

### Pattern 2: Category Browse

```javascript
// List all skills in a category
TOOL:vault_browse {
  "category": "ai-agency"
}

// Response: Array of skill summaries
[
  {
    "name": "hypercycle-node-factory-architect",
    "description": "Master orchestrator for AI Agency design",
    "triggers": ["design node factory", "architect ai agency"]
  },
  {
    "name": "stargate-bundle-creator",
    "description": "Package skills into deployable bundles",
    "triggers": ["create a bundle", "package skills"]
  }
]
```

### Pattern 3: Trigger Matching

```javascript
// Find skills matching user intent
TOOL:vault_match {
  "query": "aimify this model"
}

// Response: Array of matching skills sorted by relevance
[
  {
    "name": "hypercycle-aim-master",
    "match_score": 0.95,
    "trigger_matched": "aimify this model",
    "description": "Complete aim-py-gen mastery for HyperCycle AIM modules"
  }
]
```

### Pattern 4: Full-Text Search

```javascript
// Search skill content
TOOL:vault_search {
  "query": "docker manifest",
  "limit": 10
}

// Response: Skills containing the search term
[
  {
    "name": "hypercycle-aim-master",
    "relevance": 0.92,
    "excerpt": "The manifest.json is what the Node Manager reads..."
  }
]
```

### Pattern 5: Grant Agent Access

```javascript
// Grant agent access to vault
TOOL:vault_grant {
  "agent": "mosaic-bot",
  "scope": "ai-agency",  // or "all", "category:name", "skill:name"
  "permissions": ["read", "execute"]
}

// Response: Access token with expiry
{
  "granted": true,
  "token": "vault_token_abc123",
  "expires": "2026-07-04T00:00:00Z",
  "scope": "ai-agency"
}
```

---

## AI Agency Skills (5)

| Skill | Purpose | Trigger Phrases |
|-------|---------|-----------------|
| `hypercycle-node-factory-architect` | Master orchestrator | "design node factory", "architect ai agency" |
| `stargate-bundle-creator` | Package skills | "create a bundle", "package skills" |
| `stargate-marketplace-analyzer` | Analyze marketplace | "analyze marketplace", "skills leaderboard" |
| `ide-agent-forge-integrator` | IDE integration | "integrate ide", "agent forge" |
| `hypercycle-aim-master` | Aim-py-gen mastery | "aimify this model", "create aim module" |

---

## Trigger Phrase Examples

### How to Trigger Skills

| User Says | Skill Triggered |
|-----------|----------------|
| "Design a node factory for c3po" | `hypercycle-node-factory-architect` |
| "Create a bundle for health monitoring" | `stargate-bundle-creator` |
| "Analyze marketplace gaps" | `stargate-marketplace-analyzer` |
| "Set up IDE for development" | `ide-agent-forge-integrator` |
| "Aimify this model" | `hypercycle-aim-master` |
| "Debug my agent" | `stargate-debug-playbook` |
| "Review this PR" | `github-code-review` |
| "Deploy to Stargate" | `stargate-contract-ops` |
| "Check C-3PO health" | `stargate-health-monitor` |
| "Create Midnight contract" | `midnight-compact-core-compact-init-project` |

---

## Granting Access to AI Agents

### Access Levels

```yaml
public:
  description: "Available to all agents"
  skills: 283  # All skills are public by default
  
restricted:
  description: "Requires explicit grant"
  skills:
    - godmode  # Blocked by blacklist
    - admin-shell  # Blocked by blacklist
    
admin:
  description: "Orchestrator only"
  operations:
    - vault_grant
    - vault_revoke
    - vault_audit
```

### Grant Access to Agent

```bash
# Grant Mosaic Bot access to all skills
vault grant --agent mosaic-bot --scope all --permissions read,execute

# Grant access to specific category
vault grant --agent researcher-a --scope category:midnight --permissions read

# Grant access to single skill
vault grant --agent writer --scope skill:humanizer --permissions execute
```

### Access Token Format

```json
{
  "token": "vault_stargate_abc123xyz789",
  "agent": "mosaic-bot",
  "scope": "all",
  "permissions": ["read", "execute"],
  "granted_at": "2026-07-03T10:00:00Z",
  "expires_at": "2026-07-04T10:00:00Z",
  "granted_by": "stargate-orchestrator"
}
```

---

## Integration with Stargate

### Component Registry

```javascript
// Register vault as Stargate component
stargate.registerComponent({
  name: "stargate-vault",
  type: "skill-registry",
  version: "1.0.0",
  capabilities: ["skill-discovery", "access-control", "trigger-matching"],
  endpoints: {
    browse: "/vault/browse",
    search: "/vault/search",
    match: "/vault/match",
    grant: "/vault/grant"
  }
});
```

### Leaderboard Integration

```javascript
// Vault skills appear on Stargate leaderboard
{
  "category": "AI Agency",
  "skills": [
    "hypercycle-node-factory-architect",
    "stargate-bundle-creator",
    "stargate-marketplace-analyzer",
    "ide-agent-forge-integrator",
    "hypercycle-aim-master"
  ],
  "leader": "mosaic-bot",
  "usage_score": 847
}
```

---

## Vault API Reference

### GET /vault/browse

List skills by category.

**Parameters:**
- `category` (string): Category name or "all"
- `limit` (number): Max results to return
- `offset` (number): Pagination offset

**Response:**
```json
{
  "category": "ai-agency",
  "total": 5,
  "skills": [
    {
      "name": "hypercycle-node-factory-architect",
      "description": "Master orchestrator for AI Agency design",
      "version": "1.0.0",
      "triggers": ["design node factory", "architect ai agency"]
    }
  ]
}
```

### POST /vault/match

Find skills matching trigger phrase.

**Request:**
```json
{
  "query": "aimify this model",
  "context": "Creating HyperCycle AIM module"
}
```

**Response:**
```json
{
  "matches": [
    {
      "name": "hypercycle-aim-master",
      "match_score": 0.95,
      "trigger": "aimify this model",
      "description": "Complete aim-py-gen mastery..."
    }
  ],
  "suggested_action": "Load hypercycle-aim-master"
}
```

### POST /vault/grant

Grant agent access.

**Request:**
```json
{
  "agent": "mosaic-bot",
  "scope": "ai-agency",
  "permissions": ["read", "execute"],
  "duration": "24h"
}
```

**Response:**
```json
{
  "granted": true,
  "token": "vault_abc123",
  "expires": "2026-07-04T10:00:00Z"
}
```

### GET /vault/search

Full-text search across all skills.

**Parameters:**
- `q` (string): Search query
- `limit` (number): Max results
- `category` (string): Filter by category

**Response:**
```json
{
  "query": "docker manifest",
  "results": 12,
  "skills": [
    {
      "name": "hypercycle-aim-master",
      "relevance": 0.92,
      "excerpt": "The manifest.json is what the Node Manager reads..."
    }
  ]
}
```

---

## Usage Examples

### Example 1: Agent Discovers Skills

```javascript
// Agent joins Stargate ecosystem
const agent = await stargate.registerAgent({
  name: "researcher-a",
  type: "specialist"
});

// Grant vault access
const access = await vault.grant({
  agent: "researcher-a",
  scope: "category:research",
  permissions: ["read"]
});

// Agent browses available skills
const skills = await vault.browse({
  category: "research",
  token: access.token
});

// Agent uses skill
const result = await agent.execute({
  skill: "arxiv",
  params: { query: "transformer architecture" }
});
```

### Example 2: Trigger-Based Skill Activation

```javascript
// User message: "Aimify this Hermes agent"
const match = await vault.match({
  query: "aimify this Hermes agent"
});

// Returns: hypercycle-aim-master
const skill = await vault.load({
  name: match.skills[0].name
});

// Agent executes with full context
await agent.execute({
  skill: skill.name,
  context: skill.content
});
```

### Example 3: Multi-Agent Skill Sharing

```javascript
// Main agent delegates to specialists
const main = await stargate.getAgent("mosaic-bot");

// Get marketplace analysis
const marketplace = await main.delegate({
  to: "stargate-marketplace-analyzer",
  task: "Analyze current skill gaps"
});

// Get bundle creation
const bundle = await main.delegate({
  to: "stargate-bundle-creator",
  task: "Create bundle for identified gaps"
});

// Deploy via architect
const deployed = await main.delegate({
  to: "hypercycle-node-factory-architect",
  task: "Deploy bundle to node factory"
});
```

---

## Security & Governance

### Blacklist (Blocked Skills)

| Skill | Reason |
|-------|--------|
| `godmode` | Jailbreak techniques |
| `superuser` | Privilege escalation |
| `admin-shell` | System access |

### Audit Trail

```json
{
  "event": "skill_executed",
  "timestamp": "2026-07-03T10:00:00Z",
  "agent": "mosaic-bot",
  "skill": "hypercycle-aim-master",
  "trigger": "aimify this model",
  "duration": 4500,
  "result": "success"
}
```

---

## File Locations

```
~/mosaic-companion/stargate-vault/
├── README.md                    # This file
├── vault-index.json             # 283 skill index with metadata
├── access-control.json          # Agent permissions
├── audit-log.json               # Usage history
└── documentation/
    ├── ACCESS-GUIDE.md          # How to grant access
    ├── API-REFERENCE.md         # Full API docs
    ├── TRIGGER-PHRASES.md       # 316+ trigger phrases
    └── CATEGORIES.md            # 24 category breakdowns
```

---

## Summary

**The Stargate Vault contains all 283 skills with complete documentation and access patterns.**

| Feature | Status |
|---------|--------|
| Skill Registry | ✅ 283 skills indexed |
| Access Control | ✅ Token-based grants |
| Trigger Matching | ✅ 316+ phrases mapped |
| Category Browse | ✅ 24 categories |
| Full-Text Search | ✅ Content searchable |
| Agent Integration | ✅ Via Stargate API |
| Audit Trail | ✅ All access logged |

**Any AI Agent in Mosaic Companion can be granted access through the Vault.** 🏛️🔐
