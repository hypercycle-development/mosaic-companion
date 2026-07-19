---
name: agentic-system-evolution
description: Diagnose and fix autonomous agents that alert but do not evolve. Wire up pattern detection, skill proposals, user approval, and auto-implementation pipelines.
triggers:
  - agent not evolving despite having tools
  - bot alerts but never creates skills
  - false alerts from wrong health endpoints
  - bot is slow or only has X skills
  - need to add self-improvement to existing agent
  - want bot to grow its own capabilities
related_skills:
  - mosaic-bot-orchestrator
  - kanban-orchestrator
  - autonomous-ai-agents
---

# Agentic System Evolution

Diagnose why autonomous agents alert but don't evolve, then wire up a complete self-creation pipeline.

## When to Use This Skill

- Agent has tools/skills available but never creates new ones
- Agent gives false alerts (reports down when services are up)
- Agent alerts on issues but never proposes solutions
- User says "bot is slow" or "bot only has X skills after Y time"
- Agent has create_skill permission but never uses it
- Need to add continuous improvement to existing agent architecture

## Architecture Pattern

```
Heartbeat/Trigger → Pattern Detection (3+ occurrences)
                           ↓
                    Create Skill Proposal
                           ↓
                    Queue in Pending State
                           ↓
                    User Approves (UI or CLI)
                           ↓
                    Auto-Implement (Write SKILL.md)
                           ↓
                    Import and Available Immediately
                           ↓
                    Verify Outcome → Learn
```

## Phase 1: Diagnose Why Agent Won't Evolve

### Check 1: Are Alerts Accurate?

**Symptom:** Agent reports "[CRITICAL] Service Down" but service is actually UP.

**Root Causes:**
1. Wrong health check endpoints (code checks /health, actual endpoint is / or returns 404)
2. Hardcoded IPs that changed (DHCP lease renewal)
3. Wrong ports (internal vs external Docker proxy ports)

**Debug Commands:**
```bash
# Test actual endpoints
curl -s --max-time 5 http://IP:PORT/health || echo "Failed"
curl -s --max-time 5 http://IP:PORT/ || echo "Root failed"
timeout 2 bash -c "echo >/dev/tcp/IP/PORT" && echo "TCP OK"

# SSH-tunnel for internal health
ssh user@IP "curl -s http://localhost:INTERNAL_PORT/health"
```

**Fix Pattern:**
```typescript
// BEFORE (BROKEN):
{ name: "Service", url: "http://ip:8100/health", expectedStatus: 200 }
// Result: Connection refused → FALSE DOWN

// AFTER (FIXED):
{ name: "Service", url: "http://ip:9000/", expectedStatus: 404 }
// ANY response = healthy (Docker proxy returns 404)
const isHealthy = result.latencyMs !== undefined;
```

### Check 2: Are Tools Actually Callable?

**Symptom:** Agent has create_skill in allowlist but never calls it.

**Debug:** Check if write tools are actually exposed to the agent:
```typescript
// In heartbeat loop - are write tools reachable?
console.log("Available tools:", Object.keys(TOOLS));
console.log("Write allowlist:", readAllowlist());

// Does the agent KNOW about these tools?
// Check prompt injection - are tools listed in system prompt?
```

**Common Issue:** Write tools exist but agent does not know to use them.

### Check 3: Is There a Proposal Mechanism?

**Symptom:** Agent detects patterns but never proposes skills.

**Root Cause:** Missing pattern detection → proposal → approval → implementation chain.

## Phase 2: Build Evolution Engine

### Step 1: Create Pattern Detection

**File:** `evolution-engine.ts` (or equivalent in your stack)

```typescript
export interface DetectedPattern {
  id: string;
  pattern: string;
  category: "infra" | "code" | "workflow";
  occurrences: number;
  firstSeen: number;
  lastSeen: number;
  status: "detected" | "proposed" | "implemented";
}

const PATTERN_TEMPLATES = {
  "fleet_down": { category: "infra", skill: "fleet-health-monitor" },
  "service_unreachable": { category: "infra", skill: "dynamic-endpoint-handler" },
  "test_failing": { category: "code", skill: "test-debugger" },
  "skill_not_found": { category: "workflow", skill: "capability-gap-filler" },
};

export function detectPattern(alertText: string): DetectedPattern | null {
  const normalized = alertText.toLowerCase();
  for (const [key, config] of Object.entries(PATTERN_TEMPLATES)) {
    if (matchesPattern(normalized, key)) {
      return loadOrCreatePattern(key, config);
    }
  }
  return null;
}
```

### Step 2: Create Proposal System

```typescript
export interface SkillProposal {
  id: string;
  name: string;
  patternId: string;
  description: string;
  trigger: string;      // When to use this skill
  solution: string;     // What the skill does
  commands: string[];   // Available commands
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "implemented";
}

export async function proposeSkill(pattern: DetectedPattern): Promise<SkillProposal> {
  const template = generateSkillTemplate(pattern);
  const proposal: SkillProposal = {
    id: `skill-${pattern.id}-${Date.now()}`,
    ...template,
    priority: pattern.occurrences >= 3 ? "high" : "medium",
    status: "pending",
  };
  
  // Store in queue
  await saveProposal(proposal);
  
  // Notify user (via vault, notification, or UI)
  await notifyUser(`Proposed skill "${proposal.name}" for pattern "${pattern.id}"`);
  
  return proposal;
}
```

### Step 3: Wire to Heartbeat/Trigger

```typescript
// In heartbeat-tools.ts or main agent loop
async function processHeartbeatResult(alertText: string) {
  // Only propose on actual issues (not OK)
  if (alertText === "HEARTBEAT_OK") return;
  
  const pattern = detectPattern(alertText);
  if (!pattern) return;
  
  // Threshold: 3+ occurrences or critical infra
  if (pattern.occurrences >= 3 || pattern.category === "infra") {
    const proposal = await proposeSkill(pattern);
    
    // Append to alert so user sees it
    return alertText + `\n\n[Evolution] Proposed skill "${proposal.name}" — user approval required.`;
  }
}
```

### Step 4: Add Approval and Implementation

```typescript
export async function approveSkill(proposalId: string): Promise<void> {
  const proposal = await getProposal(proposalId);
  proposal.status = "approved";
  
  // Auto-implement immediately
  await implementSkill(proposal);
}

async function implementSkill(proposal: SkillProposal): Promise<void> {
  // Create skill directory
  const skillDir = path.join(SKILLS_DIR, proposal.name);
  fs.mkdirSync(skillDir, { recursive: true });
  
  // Generate SKILL.md
  const skillContent = generateSkillMarkdown(proposal);
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), skillContent);
  
  // Create manifest
  fs.writeFileSync(
    path.join(skillDir, "manifest.json"),
    JSON.stringify({
      name: proposal.name,
      version: "1.0.0",
      createdBy: "evolution-engine",
      pattern: proposal.patternId,
    })
  );
  
  // Trigger skill loader to import immediately
  await reloadSkills();
  
  // Record to history
  await recordOutcome(proposal, "implemented");
}
```

### Step 5: Add IPC or CLI Interface

```typescript
// IPC handlers for UI integration
ipcMain.handle("evolution:patterns", () => loadPatterns());
ipcMain.handle("evolution:pending", () => getPendingProposals());
ipcMain.handle("evolution:approve", (_e, id) => approveSkill(id));
ipcMain.handle("evolution:reject", (_e, id, reason) => rejectSkill(id, reason));
ipcMain.handle("evolution:stats", () => getEvolutionStats());
```

**CLI Tool:**
```python
#!/usr/bin/env python3
# management CLI for users
import argparse
# ... commands: status, patterns, pending, approve, reject
```

## Phase 3: Storage Schema

### File Structure

```
~/.config/<app>/mosaicbot/
├── evolution/
│   ├── detected-patterns.json    # Pattern history
│   ├── pending-skills.json       # Proposals queue
│   └── skill-history.json        # Outcomes
└── skills/                       # Auto-created skills
    └── {skill-name}/
        ├── SKILL.md
        └── manifest.json
```

### Pattern Storage

```json
{
  "id": "c3po_unreachable",
  "pattern": "dynamic-ip-handler",
  "category": "infra",
  "occurrences": 5,
  "firstSeen": 1700000000000,
  "lastSeen": 1700003600000,
  "proposedSkillId": "skill-c3po_unreachable-1700003600000",
  "status": "implemented"
}
```

### Proposal Storage

```json
{
  "id": "skill-c3po_unreachable-1700003600000",
  "name": "dynamic-ip-handler",
  "patternId": "c3po_unreachable",
  "description": "Handles IP changes for DHCP-assigned boxes",
  "trigger": "C-3PO unreachable or SSH connection failed",
  "solution": "Scan subnet to find new IP, update SSH config",
  "commands": ["c3po:find", "c3po:update-ip"],
  "priority": "high",
  "status": "implemented",
  "proposedAt": 1700003600000,
  "skillPath": ".../skills/dynamic-ip-handler/SKILL.md"
}
```

## Phase 4: Verification and Learning

### Did the Skill Work?

Add outcome verification:

```typescript
async function verifySkillOutcome(proposal: SkillProposal): Promise<boolean> {
  // Wait for next occurrence of the pattern
  const nextOccurrence = await waitForPattern(proposal.patternId, 24 * 60 * 60_000);
  
  if (!nextOccurrence) {
    return true; // Pattern never recurred = solved!
  }
  
  // Check if skill handled it automatically
  const handled = await checkSkillHandled(nextOccurrence);
  
  if (!handled) {
    // Skill didn't work - flag for improvement
    await flagSkillForImprovement(proposal);
  }
  
  return handled;
}
```

### Learning Loop

```
Heartbeat → Detect Pattern → Create Skill
                ↑                ↓
         Pattern Recurs? ← Verify Outcome
```

## Pitfalls

1. **Wrong endpoint assumptions** — Always verify actual working endpoints with curl before coding health checks
2. **Threshold too low** — 1-2 occurrences = noise. 3+ = real pattern
3. **Missing user approval** — Auto-implementing without approval creates noise skills
4. **No verification** — Skills that don't solve the problem accumulate as cruft
5. **Circular dependencies** — Evolution engine importing heartbeat-tools and vice versa
6. **Static IPs in registry** — DHCP leases change; scan subnet or use discovery

## Testing

```bash
# Check evolution system
python3 evolution-cli.py status

# List patterns
curl -X POST http://localhost:PORT/evolution/patterns

# Simulate alert to trigger evolution
curl -X POST http://localhost:PORT/evolution/force-trigger \
  -d '{"alert": "C-3PO unreachable after reboot"}'

# Approve pending skill
curl -X POST http://localhost:PORT/evolution/approve \
  -d '{"proposalId": "skill-c3po_unreachable-1234567890"}'
```

## Related Skills

- kanban-orchestrator — For creating tasks from skill proposals
- mosaic-bot-orchestrator — Specific to Mosaic Bot internals
- axi-integration — For tool-forging integration
