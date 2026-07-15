---
name: ai-agency-architect
description: Design and orchestrate AI Agencies by combining multiple skills, MCPs, and tools into cohesive autonomous systems
tags:
  - ai-agency
  - orchestration
  - architecture
  - multi-skill
  - autonomous
version: 1.0.0
author: Hermes Agent
---

# AI Agency Architect

Design and orchestrate **AI Agencies** — cohesive autonomous systems that combine multiple skills, MCP servers, tools, and workflows into unified operation units.

## When to Use

- Designing autonomous systems that require multiple capabilities
- Creating "master orchestrator" patterns that coordinate sub-components
- Building systems that span: skills + MCPs + tools + IDE + sandboxes
- Setting up self-improving or continuously-evolving architectures
- Creating node factories, automation clusters, or multi-agent swarms

## Core Pattern: Master Orchestrator

```
┌─────────────────────────────────────────────────────────────┐
│                    MASTER ORCHESTRATOR                       │
│              (Root skill - coordinates everything)         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐     │
│  │   SKILL      │ │   SKILL       │ │   SKILL       │     │
│  │   BUNDLE     │ │   MARKETPLACE │ │   DEVELOPMENT │     │
│  │   CREATOR    │ │   ANALYZER    │ │   INTEGRATOR  │     │
│  └───────┬───────┘ └───────┬───────┘ └───────┬───────┘     │
│          │                 │                 │               │
│          └─────────────────┼─────────────────┘               │
│                            │                                 │
│  ┌─────────────────────────┴───────────────────────────────┐  │
│  │                  MCP SERVERS                           │  │
│  │  codebase-memory │ stargate │ hypercycle │ cardano    │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                  TOOL SANDBOX                            ││
│  │  terminal │ file │ search │ patch │ process │ kanban   ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Agency Design Patterns

### Pattern 1: Fully Autonomous Agency
```yaml
name: "c3po-autonomous-factory"
type: autonomous
components:
  skills:
    - master-architect          # Root orchestrator
    - bundle-creator            # Packaging
    - marketplace-analyzer      # Analysis
    - node-manager-ops          # Operations
  mcp:
    - codebase-memory
    - stargate
    - hypercycle
  workflows:
    provisioning: automated
    monitoring: continuous
    scaling: threshold-based
governance:
  autonomyLevel: full
  escalationThreshold: 3
  humanCheckpoint: ["delete", "large-expenditure"]
```

### Pattern 2: Human-in-the-Loop Agency
```yaml
name: "r2d2-supervised-ops"
type: human-supervised
components: *same_as_autonomous
approvalGates:
  decommissioning: required
  configChanges: required
  expenditure: required
governance:
  autonomyLevel: supervised
  approvalTimeout: "24h"
```

### Pattern 3: Multi-Agent Swarm
```yaml
name: "bb8-swarm"
type: swarm
agents:
  - role: provisioner
    skills: ["node-ops", "pool-lifecycle"]
  - role: monitor
    skills: ["health-monitor", "aim"]
  - role: marketplace
    skills: ["marketplace-analyzer", "bundle-creator"]
  - role: developer
    skills: ["ide-integrator", "codebase-memory"]
coordination:
  protocol: stargate-swarm
  consensus: majority
  leaderElection: true
```

## Implementation Steps

### Step 1: Analyze Requirements
```bash
# Identify needed capabilities
1. List target operations (node factories, pool management, etc.)
2. Identify required skills from existing inventory
3. Detect gaps via marketplace analysis
4. Plan skill acquisition/creation
```

### Step 2: Design Architecture
```typescript
interface AIAgency {
  name: string;
  type: "autonomous" | "supervised" | "swarm";
  
  components: {
    // Core skills
    skills: string[];
    
    // MCP integrations
    mcp: string[];
    
    // Automation workflows
    workflows: Record<string, Workflow>;
  };
  
  governance: {
    autonomyLevel: "full" | "supervised" | "minimal";
    escalationThreshold: number;
    auditLog: boolean;
    humanCheckpoint: string[];
  };
}
```

### Step 3: Assemble Components
```bash
# Create skill bundles
bundle create --name "node-ops" --skills "hypercycle-node-manager-ops,stargate-health-monitor"

# Configure MCP servers
mcp configure --name stargate --url "http://localhost:9100"
mcp configure --name hypercycle --url "http://c3po:8000"

# Setup IDE integration
ide-forge init --workspace ~/ai-agency
```

### Step 4: Deploy Agency
```bash
# Deploy to target environment
architect deploy --agency "my-agency" --cluster [c3po,r2d2,bb8]

# Verify health
architect status --agency "my-agency" --verbose
```

### Step 5: Evolve Continuously
```bash
# Run evolution loop
architect evolve --agency "my-agency" --learning-rate 0.1

# Schedule: every 6 hours
# - Analyze marketplace for new skills
# - Identify capability gaps
# - Develop or acquire missing skills
# - Update bundles
# - Rolling deployment
```

## Key Integration Points

### Stargate Component Registry
```javascript
// Register agency components
await stargate.registerAgency({
  name: "hypercycle-node-factory",
  type: "ai-agency",
  components: [
    { type: "skill", name: "master-architect" },
    { type: "mcp", name: "stargate" }
  ],
  capabilities: ["provisioning", "monitoring", "scaling"],
  leaderboard: { category: "ai-agency", rank: "pending" }
});
```

### Marketplace Integration
```javascript
// Publish to marketplace
await marketplace.publish({
  type: "ai-agency",
  name: "HyperCycle Node Factory",
  description: "Fully autonomous AI agency",
  capabilities: agency.components,
  pricing: { model: "usage-based", baseRate: 0.01 }
});
```

### IDE Integration
```javascript
// Register agency with IDE
ide.registerAgency({
  agency: "hypercycle-node-factory",
  views: ["architecture", "operations", "marketplace"],
  actions: ["deploy", "scale", "evolve"]
});
```

## Metrics & Monitoring

Track agency health:
```javascript
const metrics = {
  // Operational
  nodesManaged: 47,
  avgUptime: "99.97%",
  incidentsPerMonth: 2,
  
  // Evolution
  skillsDeveloped: 12,
  bundlesCreated: 5,
  
  // Efficiency
  automationRate: "94%",
  humanInterventions: "3/week",
  
  // Learning
  patternRecognition: "87% accuracy"
};
```

## Pitfalls

1. **Don't skip verification**: Always verify all components exist before deployment
2. **Start small**: Test with 1-2 nodes before scaling to hundreds
3. **Monitor everything**: Log all decisions; silent failures hide problems
4. **Human checkpoints**: Require approval for irreversible actions
5. **Version control**: Tag agency versions for rollback capability
6. **Test thoroughly**: Validate in staging before production

## Troubleshooting

### Agency Won't Deploy
```bash
# Verify all skills exist
ls ~/mosaic-companion/bundled-skills/<skill-name>/SKILL.md

# Check MCP connectivity
curl -s http://localhost:9100/health

# Validate workflow syntax
yamllint workflows/*.yml
```

### Skills Not Loading
```bash
# Rebuild skill cache
architect rebuild --cache

# Check for conflicts
architect conflicts --resolution

# Verify frontmatter
head -10 ~/bundled-skills/<skill>/SKILL.md
```

## Example: Complete Node Factory Setup

```typescript
// Design AI Agency for HyperCycle node factories
const factory = {
  name: "c3po-autonomous-factory",
  type: "autonomous",
  
  components: {
    skills: [
      "hypercycle-node-factory-architect",  // Master
      "stargate-bundle-creator",              // Packaging
      "stargate-marketplace-analyzer",        // Analysis
      "ide-agent-forge-integrator",          // Development
      "hypercycle-node-manager-ops",          // Operations
      "hypercycle-aimifier"                   // AIM
    ],
    
    mcp: [
      "codebase-memory",   // Code knowledge
      "stargate",          // Component registry
      "hypercycle"         // Node APIs
    ],
    
    workflows: {
      provisioning: {
        trigger: "new-node-request",
        steps: ["check", "allocate", "deploy", "configure", "register", "monitor"]
      },
      monitoring: {
        trigger: "heartbeat",
        interval: "5m",
        checks: ["health", "sync", "aim", "resources"]
      },
      scaling: {
        trigger: "load_threshold",
        threshold: "cpu > 80%",
        action: "provision_new_node"
      }
    }
  },
  
  governance: {
    autonomyLevel: "full",
    escalationThreshold: 3,
    auditLog: true,
    humanCheckpoint: ["shutdown", "delete", "large-expenditure"]
  }
};

// Deploy
architect.deploy(factory);
```

## Related Skills

- `stargate-bundle-creator` — Package skills into deployable bundles
- `stargate-marketplace-analyzer` — Analyze marketplace and identify gaps
- `mosaic-skill-bridge` — Bridge external skill ecosystems
- `flue` — Alternative agent framework (TypeScript)

## Summary

Use this skill to:
1. **Design** multi-component AI Agency architectures
2. **Orchestrate** skills, MCPs, tools, and sandboxes
3. **Deploy** autonomous, supervised, or swarm patterns
4. **Evolve** agencies through continuous improvement loops
5. **Scale** from prototypes to production systems

The AI Agency pattern transforms isolated skills into cohesive, autonomous operational units.