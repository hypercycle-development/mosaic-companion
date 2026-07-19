---
name: mosaic-skill-bridge
description: Bridge Hermes skill ecosystem into Mosaic Bot and prevent skill hallucination through filesystem verification
version: 1.0.0
---

# Mosaic Skill Bridge

## Problem
Mosaic Bot was reporting 8 skills when 1,400+ Hermes skills were available. Bot also hallucinated skill creation.

## Solution Pattern

### 1. Multi-Path Skill Loading
Update loader to check multiple directories:
- PRIMARY: `~/mosaic-companion/bundled-skills/` (198 imported)
- LEGACY: `.../mosaicbot/bundled-skills/` (8 runtime)
- USER: `~/.config/.../mosaicbot-authored/` (bot-created)

### 2. Verification Layer
```typescript
export function verifySkillExists(skillName: string): {
  exists: boolean;
  path: string | null;
  lineCount: number;
  hallucination: boolean;
}
```
Use before claiming "created".

### 3. Skill Bridge for External Ecosystem
```typescript
export async function searchHermesSkills(query: string, limit: number) {
  // Real-time search ~/.hermes/skills/**
  // Parse frontmatter
  // Return matches with paths
}
```

### 4. Hallucination Prevention Rules
- NEVER claim "created" without tool execution
- ALWAYS verify skill exists after creation
- Report ACTUAL line counts from disk
- Include error message: "SKILL CREATION VERIFICATION FAILED"

### 5. Evolution vs Tracking
User explicitly wants: "focus on evolving, not to see whats happening on kanban"
- Prioritize skill creation over kanban monitoring
- Detect repeated patterns → propose skill creation
- Silent monitoring: alert only on crashes/errors

## Verification Checklist
After "I created X" claim:
```bash
ls ~/.config/mosaic-companion/mosaicbot/skills/mosaicbot-authored/
```
Should show actual files.

## Key Files
| File | Purpose |
|------|---------|
| `verification-layer.ts` | Hallucination detection |
| `skill-bridge.ts` | Hermes skill search |
| `skill-forge.ts` | Actual skill templates |
| `orchestrator.ts` | Evolution rules in system prompt |

## Pitfalls Discovered (2026-07-03 Session)

### CLAIMED vs ACTUAL Skills
Bot may claim "created 6 skills" but actually create 0. Root cause: LLM generated plausible output without tool execution. **Always verify filesystem before claiming success.**

```typescript
// BAD: Bot reports success without checking
return "Created 6 skills";

// GOOD: Verify then report
const count = fs.readdirSync(AUTHORED_SKILLS_DIR).length;
return `Created ${count} skills at ${AUTHORED_SKILLS_DIR}`;
```

### Knowledge Graph "0 Skills" Bug
**The "Knowledge Graph Context: 0 skills" display is a UI bug.** The knowledge graph indexes code memory, not skill registry. Actual skill count comes from:
```bash
ls ~/mosaic-companion/bundled-skills/ | wc -l
```

### Restart Required
After adding skills to `bundled-skills/`, **must restart Mosaic Companion** for them to load into the skill registry.

### System Prompt Updates Need Rebuild
Changes to `orchestrator.ts` require:
```bash
cd ~/mosaic-companion && npm run build
# Then restart
```

### Skill Count Reality Check
- **Claimed**: 1,400 Hermes skills
- **Actual**: 259 unique skills in `~/.hermes/skills/`
- **Converted**: 277 Mosaic native skills (199 existing + 78 new)
- **Missing**: 10 Stargate skills with permission errors

### File Permissions on Stargate Skills
Some skills in `~/.hermes/skills/mosaic-stargate/` have restricted permissions. Convert with:
```bash
sudo cp -r ~/.hermes/skills/mosaic-stargate/stargate-master-index \
  ~/mosaic-companion/bundled-skills/
```