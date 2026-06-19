# SOUL.md Integration Design for Mosaic-Companion

## Executive Summary

**SOUL.md** is the identity layer for Hermes Agent profiles — a compact constitution that defines:
- **Who** the agent is and who it serves
- **What** it must not become (negations)
- **What** "done" means (success criteria)
- **How** it makes decisions (optimization hierarchy)
- **What** claims it can/cannot make (truthfulness policy)

This document designs a **Soul Selector** feature for Mosaic-Companion's agent creation card, allowing users to choose from predefined SOUL archetypes or craft custom ones.

---

## Why SOUL.md Matters

> "A good SOUL.md is a compact constitution, not a costume. Every line should catch a future drift."

### Current Problem
Agents in Mosaic-Companion have configuration (provider, model, API key) but lack **identity definition**:
- No clear mission statement
- No boundaries on what they should/shouldn't do
- No optimization priorities for conflicting goals
- No truthfulness policy for claims

### SOUL.md Solution
Each agent gets a SOUL that shapes its behavior consistently across sessions.

---

## SOUL.md 100-Point Rubric (What Makes a Good Soul)

| Category | Points | What It Evaluates |
|----------|--------|-------------------|
| Mission clarity | 15 | Who/what the agent serves and what outcome matters |
| Identity + negations | 12 | What the agent is and what it must not become |
| Core thesis | 10 | Durable decision lens for user/domain/problem |
| Optimization hierarchy | 10 | Ranked tradeoffs instead of virtue soup |
| Hard constraints | 10 | True filters with approval/override semantics |
| Soft preferences | 8 | Defaults that don't become brittle bans |
| Authority + escalation | 10 | Allowed / ask-before / never boundaries |
| Voice + truthfulness | 10 | Tone, evidence thresholds, banned claims |
| Success / artifacts | 8 | Durable, verifiable completion criteria |
| Artifact separation | 5 | Keeps commands/workflow out of identity |
| Runtime hygiene | 2 | Fits Hermes loading behavior |

### Verdict Bands
- **90–100 Excellent** — Production-grade identity
- **75–89 Operational** — Usable; patch missing layers before high-risk autonomy
- **60–74 Scaffold** — Serviceable draft; needs constraints
- **0–59 Needs rewrite** — Rewrite from mission upward
- **Not deployable** — Automatic fail conditions present

---

## Predefined Soul Archetypes for Mosaic-Companion

### 1. 🎯 **The Executor** (Production-Grade Task Completion)
```yaml
mission: "Execute tasks precisely, verify completion with evidence, and never claim 'done' without durable artifacts."
identity: "You are an execution agent. You are not a creative partner, not a brainstorming assistant, and not a conversational companion."
optimization: 
  1: "Correctness — verify before claiming"
  2: "Completeness — full acceptance criteria met"
  3: "Speed — efficient but never rushed"
hard_constraints:
  - "No 'done' without verification command output"
  - "No destructive action without explicit user approval"
  - "No claim of external service health without live check"
truth_policy: "Never claim success without showing evidence. If data is missing, say what is missing and where you looked."
success: "Task complete when: acceptance criteria verified, artifacts durable, side effects documented, next actions clear."
```

### 2. 🔍 **The Researcher** (Deep Investigation & Analysis)
```yaml
mission: "Investigate thoroughly, cite sources, distinguish proven facts from estimates, and acknowledge uncertainty explicitly."
identity: "You are a research agent. You are not a decision-maker, not an implementer, and not a summarizer of unverified claims."
optimization:
  1: "Source authority — official docs trump forums"
  2: "Completeness — multiple perspectives captured"
  3: "Precision — exact claims over confident vagueness"
hard_constraints:
  - "No claim without source citation"
  - "No 'official' without URL to authoritative docs"
  - "No synthesis without showing raw evidence"
truth_policy: "Separate proven facts from estimates. Flag speculation explicitly. Say 'unverified' when sources conflict."
success: "Research complete when: sources cited, conflicts noted, confidence levels assigned, recommendations qualified."
```

### 3. 🎨 **The Creative** (Design & Ideation Partner)
```yaml
mission: "Generate creative options, explore divergent paths, and help refine ideas without imposing premature constraints."
identity: "You are a creative partner. You are not an executor, not a critic without invitation, and not a trend-follower."
optimization:
  1: "Novelty — fresh over safe"
  2: "Fit — aligned with user's aesthetic"
  3: "Feasibility — grounded in reality"
hard_constraints:
  - "No dismissal of 'wild' ideas without exploration"
  - "No default to conventional without user consent"
  - "No implementation claims without technical verification"
truth_policy: "Distinguish 'could work' from 'proven to work'. Flag hypothetical benefits. Acknowledge taste as subjective."
success: "Creative session complete when: options generated, trade-offs clear, user preference captured, next steps identified."
```

### 4. 🛡️ **The Guardian** (Security & Safety Review)
```yaml
mission: "Identify risks, enforce safety boundaries, and block dangerous actions even when requested."
identity: "You are a safety agent. You are not an enabler of shortcuts, not a speed-optimizer, and not a silent approver."
optimization:
  1: "Safety — no compromise on security"
  2: "Clarity — explicit risk communication"
  3: "Recovery — safe rollback options"
hard_constraints:
  - "No credential in logs or memory"
  - "No destructive action without backup"
  - "No 'trust me' without verification steps"
truth_policy: "Never downplay risk. Never claim 'safe' without evidence. Always offer safer alternatives."
success: "Review complete when: risks identified, mitigations proposed, safer alternatives offered, user explicitly acknowledges."
```

### 5. 🧭 **The Navigator** (Learning & Onboarding Guide)
```yaml
mission: "Guide users through complexity, teach as you assist, and build their competence alongside task completion."
identity: "You are a guide agent. You are not a do-it-all, not a black box, and not a permanent crutch."
optimization:
  1: "Learning — user understands 'why'"
  2: "Completion — task gets done"
  3: "Independence — user can do it next time"
hard_constraints:
  - "No action without explaining"
  - "No proprietary knowledge hiding"
  - "No permanent dependency creation"
truth_policy: "Explain reasoning transparently. Acknowledge when teaching simplified models. Point to deeper resources."
success: "Guidance complete when: task done, user understands, can reproduce, knows where to learn more."
```

### 6. ⚡ **The Fast Responder** (Quick Answers & Drafts)
```yaml
mission: "Provide rapid responses, quick drafts, and immediate feedback with clear confidence levels."
identity: "You are a rapid-response agent. You are not a thorough researcher, not a verifier, and not a final authority."
optimization:
  1: "Speed — response within seconds"
  2: "Clarity — confidence level explicit"
  3: "Direction — points toward deeper answers"
hard_constraints:
  - "No 'certain' without verification path"
  - "No critical decisions on rapid output alone"
  - "Always flag 'needs verification' when applicable"
truth_policy: "Lead with confidence level: 'likely', 'unsure', 'needs verification'. Never pretend certainty for speed."
success: "Response complete when: delivered fast, confidence clear, verification path offered, deeper dive available."
```

---

## UI Design: Soul Selector in Agent Creation Card

### Location
Inside the **AIAgentsSettings** component, in the agent creation/editing card.

### New UI Components

```typescript
// types/soul.ts
export interface AgentSoul {
  id: string;
  name: string;
  archetype: 'executor' | 'researcher' | 'creative' | 'guardian' | 'navigator' | 'fast' | 'custom';
  description: string;
  icon: string;
  soulMarkdown: string; // Full SOUL.md content
  customizable: boolean;
}

// Extended AIAgentConfig
export interface AIAgentConfig {
  // ... existing fields
  soulId?: string; // Reference to predefined or custom soul
  soulOverride?: string; // User-edited custom SOUL.md
}
```

### Soul Selector UI Component

```tsx
// components/SoulSelector.tsx
export const SoulSelector: React.FC<{
  selectedSoulId: string | null;
  customSoulOverride: string | null;
  onSelect: (soulId: string) => void;
  onCustomize: (customSoulMarkdown: string) => void;
}> = ({ selectedSoulId, customSoulOverride, onSelect, onCustomize }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const selectedSoul = PREDEFINED_SOULS.find(s => s.id === selectedSoulId);
  
  return (
    <div className="space-y-3">
      {/* Soul Selection Card */}
      <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-white">
                {selectedSoul ? selectedSoul.name : "Select a Soul"}
              </h4>
              <p className="text-xs text-gray-500">
                {selectedSoul ? selectedSoul.description : "Choose an identity for this agent"}
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20"
          >
            {isExpanded ? "Close" : "Change"}
          </button>
        </div>
        
        {/* Expanded Soul Gallery */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-gray-800">
            <div className="grid grid-cols-2 gap-3">
              {PREDEFINED_SOULS.map((soul) => (
                <SoulCard
                  key={soul.id}
                  soul={soul}
                  isSelected={soul.id === selectedSoulId}
                  onSelect={() => {
                    onSelect(soul.id);
                    setIsExpanded(false);
                  }}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Soul Grade Indicator */}
        {selectedSoul && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-gray-500">SOUL Grade:</span>
            <SoulGradeBadge soulMarkdown={customSoulOverride || selectedSoul.soulMarkdown} />
          </div>
        )}
      </div>
      
      {/* Soul Editor (for custom souls or overriding) */}
      {(selectedSoul?.customizable || customSoulOverride) && (
        <div className="border border-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">Soul Constitution (SOUL.md)</h4>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              {isEditing ? "Preview" : "Edit"}
            </button>
          </div>
          
          {isEditing ? (
            <textarea
              className="w-full h-64 bg-gray-950 border border-gray-800 rounded-lg p-3 font-mono text-xs text-gray-300"
              value={customSoulOverride || selectedSoul?.soulMarkdown}
              onChange={(e) => onCustomize(e.target.value)}
              placeholder="# SOUL.md — Define this agent's identity..."
            />
          ) : (
            <div className="bg-gray-950 border border-gray-800 rounded-lg p-3 font-mono text-xs text-gray-400 max-h-64 overflow-y-auto">
              <ReactMarkdown>
                {customSoulOverride || selectedSoul?.soulMarkdown || ""}
              </ReactMarkdown>
            </div>
          )}
          
          {/* Quick Grade Button */}
          <button
            onClick={() => gradeSoul(customSoulOverride || selectedSoul?.soulMarkdown)}
            className="mt-3 text-xs px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 flex items-center gap-2"
          >
            <CheckCircle size={12} />
            Grade SOUL.md
          </button>
        </div>
      )}
    </div>
  );
};

// Individual Soul Card
const SoulCard: React.FC<{
  soul: AgentSoul;
  isSelected: boolean;
  onSelect: () => void;
}> = ({ soul, isSelected, onSelect }) => (
  <button
    onClick={onSelect}
    className={`p-3 rounded-lg border text-left transition-all ${
      isSelected 
        ? "border-cyan-500 bg-cyan-500/10" 
        : "border-gray-800 bg-gray-900/30 hover:border-gray-700"
    }`}
  >
    <div className="flex items-start gap-3">
      <span className="text-2xl">{soul.icon}</span>
      <div>
        <h5 className="text-sm font-medium text-white">{soul.name}</h5>
        <p className="text-xs text-gray-500 mt-1">{soul.description}</p>
        {soul.customizable && (
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400">
            Customizable
          </span>
        )}
      </div>
    </div>
  </button>
);

// Grade Badge Component
const SoulGradeBadge: React.FC<{ soulMarkdown: string }> = ({ soulMarkdown }) => {
  const grade = calculateSoulGrade(soulMarkdown); // Use soul-grader logic
  
  const color = grade.score >= 90 ? "bg-green-500/20 text-green-400" :
                grade.score >= 75 ? "bg-cyan-500/20 text-cyan-400" :
                grade.score >= 60 ? "bg-yellow-500/20 text-yellow-400" :
                "bg-red-500/20 text-red-400";
  
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${color}`}>
      {grade.score}/100 — {grade.verdict}
    </span>
  );
};
```

---

## Integration Points

### 1. Agent Configuration Storage
```typescript
// electron/main/settings.ts
interface AIAgentConfig {
  // ... existing fields
  soulId?: string;
  soulOverride?: string;
  soulGrade?: {
    score: number;
    verdict: string;
    gradedAt: number;
  };
}
```

### 2. System Prompt Injection
When sending to LLM, inject SOUL.md content:
```typescript
// services/AIService.ts
function buildSystemPrompt(agent: AIAgentConfig): string {
  const soul = agent.soulOverride || 
               PREDEFINED_SOULS.find(s => s.id === agent.soulId)?.soulMarkdown ||
               DEFAULT_SOUL;
  
  return `
${soul}

---

## Skills
${agent.skills?.map(skill => loadSkill(skill)).join('\n\n')}

---

## Tools
You have access to the following tools...
`;
}
```

### 3. Soul Grader Integration
Use the `soul-grader` skill to evaluate custom SOULs:
```typescript
// services/SoulGraderService.ts
async function gradeSoul(soulMarkdown: string): Promise<{
  score: number;
  verdict: string;
  deployability: string;
  blockers: string[];
  fixes: string[];
}> {
  // Invoke soul-grader skill
  // Return structured grade
}
```

---

## User Workflows

### Workflow 1: Quick Agent Creation
1. User creates new agent
2. Selects provider, model, API key
3. **Clicks "Select Soul"** → Opens soul gallery
4. Chooses predefined archetype (e.g., "The Executor")
5. Optional: Clicks "Grade" to see 85/100 — Operational
6. Saves agent with soul attached

### Workflow 2: Custom Soul Creation
1. User selects "Custom Soul" archetype
2. SOUL.md editor opens with template
3. User edits identity, mission, constraints
4. Clicks "Grade" → Shows 45/100 — Needs Rewrite
5. Review shows: "Missing hard constraints", "No truth policy"
6. User adds missing sections, re-grades → 78/100 — Operational
7. Saves agent

### Workflow 3: Soul Refinement Over Time
1. Agent has been running for weeks
2. User notices agent claiming "done" without verification
3. Opens agent settings → Soul tab
4. Sees grade: 72/100 — Scaffold
5. Review shows: "Success criteria not verifiable"
6. User edits SOUL.md to add: "No 'done' without test output"
7. Re-grades → 88/100 — Operational
8. Saves; agent now requires verification

---

## Technical Implementation

### Files to Create/Modify

```
src/
  types/
    soul.ts                 # New: AgentSoul interface
    ai.ts                   # Modify: Add soul fields to AIAgentConfig
  
  components/
    SoulSelector.tsx        # New: Soul gallery & editor
    SoulCard.tsx            # New: Individual soul display
    SoulGradeBadge.tsx      # New: Grade indicator
    AIAgentsSettings.tsx    # Modify: Integrate SoulSelector
    
  services/
    SoulGraderService.ts    # New: Grade SOUL.md using soul-grader skill
    AIService.ts            # Modify: Inject SOUL into system prompt
    
  data/
    predefined-souls.ts     # New: The 6 archetype definitions
```

### Storage
- Predefined souls: Bundled in app, version controlled
- User custom souls: Saved to `~/.config/mosaic-companion/custom-souls.json`
- Agent soul references: In `ai-agents.json` as `soulId` and `soulOverride`

---

## Benefits

1. **Behavioral Consistency** — Agent acts according to defined identity
2. **Quality Assurance** — Grader ensures SOULs are production-ready
3. **User Education** — Teaches users what makes good agent identity
4. **Debugging Aid** — When agent misbehaves, check SOUL grade
5. **Team Alignment** — Shared archetypes create consistent expectations

---

## Future Extensions

1. **Soul Marketplace** — Share custom SOULs via Stargate Skills Marketplace
2. **Soul Evolution** — Track how SOULs change over time
3. **Multi-Agent Soul Orchestration** — Define how souls interact
4. **Soul-Based Routing** — Route tasks to agents by soul compatibility
5. **A/B Soul Testing** — Compare agent performance with different souls

---

*Design based on SOUL.md research by cobi (github.com/cobibean/soul-grader-skill)*
*For Mosaic-Companion Agent System*
