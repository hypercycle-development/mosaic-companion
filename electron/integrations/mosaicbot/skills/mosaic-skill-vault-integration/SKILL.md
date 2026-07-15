---
name: mosaic-skill-vault-integration
description: "Integrate Stargate Vault (283+ Hermes skills) into Mosaic Companion. Provides the Skill Vault UI, protocol handler, and agent skill delegation."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [mosaic, skill-vault, stargate, electron, protocol]
    related_skills: [hermes-agent-skill-authoring, hermes-mcp-integration]
---

# Mosaic Skill Vault Integration

## Overview

This skill enables the **Skill Vault** feature in Mosaic Companion — a browsable, searchable library of 283+ Hermes skills that can be delegated to AI agents (Byron, Ada, Son of Anton, etc.).

**Key Components:**
- **SkillVaultPage.tsx** — UI for browsing, searching, and delegating skills
- **stargate-vault:** protocol — Electron custom protocol for serving JSON data
- **vault-index.json** — Master index of all 283 skills with metadata
- **Agent skill delegation** — Per-agent skill assignment persistence

**Architecture:**
```
Renderer (SkillVaultPage.tsx)
  ↓ fetch("stargate-vault://vault-index.json")
Electron Main (protocol handler)
  ↓ net.fetch(file://.../dist/renderer/stargate-vault/)
File System (stargate-vault/vault-index.json)
```

## When to Use

- User asks "where are my skills?" or "why don't I see the skill vault?"
- Skill Vault page shows empty or fails to load
- Need to add the Skill Vault sidebar entry
- Need to register the stargate-vault protocol
- Agent skill delegation is not persisting

## Files and Locations

| File | Purpose |
|------|---------|
| `src/components/SkillVaultPage.tsx` | Main UI component (495 lines) |
| `stargate-vault/vault-index.json` | Master skill index (283 skills, 178KB) |
| `stargate-vault/CATEGORIES.md` | Category documentation (24 categories) |
| `stargate-vault/TRIGGER-PHRASES.md` | 316+ activation phrases |
| `electron/main.ts` | Protocol registration and handler |
| `src/components/Sidebar.tsx` | Navigation entry |
| `src/components/ContentArea.tsx` | Route handling |
| `src/types/types.ts` | `INTERNAL_SKILL_VAULT_URL` constant |

## Implementation Steps

### 1. Create Vault Data Directory

```bash
mkdir -p ~/mosaic-companion/stargate-vault
```

Populate with:
- `vault-index.json` — skills object keyed by name
- `CATEGORIES.md` — category reference
- `TRIGGER-PHRASES.md` — trigger phrase reference

### 2. Register Electron Protocol

In `electron/main.ts` BEFORE `app.whenReady()`:

```typescript
protocol.registerSchemesAsPrivileged([
  { scheme: 'mosaic-media', privileges: { bypassCSP: true, supportFetchAPI: true, corsEnabled: true } },
  { scheme: 'stargate-vault', privileges: { bypassCSP: true, supportFetchAPI: true, corsEnabled: true } }
]);
```

Inside `app.whenReady()`:

```typescript
protocol.handle('stargate-vault', (request) => {
  const urlStr = request.url.replace(/^stargate-vault:\/\//, '');
  const vaultDir = path.join(__dirname, '..', 'renderer', 'stargate-vault');
  const filePath = path.join(vaultDir, path.normalize(urlStr));
  
  // Security: path traversal protection
  if (!filePath.startsWith(vaultDir)) {
    return new Response('Access Denied', { status: 403 });
  }
  
  return net.fetch(`file://${filePath}`);
});
```

### 3. Copy Vault Data to Dist

After `npm run build`:

```bash
cp -r ~/mosaic-companion/stargate-vault ~/mosaic-companion/dist/renderer/
```

### 4. Create SkillVaultPage Component

Key features:
- Grid/List view toggle
- Search by name, trigger phrase, description
- Category filter dropdown
- Per-skill agent delegation (checkboxes)
- Bulk category delegation
- Visual indicator of assigned agents

**Data fetching:**
```typescript
const response = await fetch("stargate-vault://vault-index.json");
const vaultData = await response.json();
```

### 5. Add Sidebar Entry

In `src/components/Sidebar.tsx`:

```typescript
import { INTERNAL_SKILL_VAULT_URL } from "../types/types";

const mainItems: SidebarItem[] = [
  // ... other items
  { id: "skill-vault", label: "Skill Vault", icon: "BookOpen", url: INTERNAL_SKILL_VAULT_URL },
];
```

### 6. Add Route Handling

In `src/components/ContentArea.tsx`:

```typescript
import { SkillVaultPage } from "./SkillVaultPage";

if (url === INTERNAL_SKILL_VAULT_URL) {
  useEffect(() => {
    onUpdateTab({ title: "Skill Vault", isLoading: false, favicon: undefined });
  }, [url]);

  return (
    <div className="h-full overflow-hidden bg-gray-950 text-gray-100">
      <SkillVaultPage />
    </div>
  );
}
```

### 7. Add Type Constant

In `src/types/types.ts`:

```typescript
export const INTERNAL_SKILL_VAULT_URL = "browser://skill-vault";
```

## vault-index.json Schema

```json
{
  "total_skills": 283,
  "generated_at": "2026-07-02T...",
  "categories": [
    { "id": "github", "name": "GitHub", "description": "...", "count": 5 }
  ],
  "skills": {
    "github-code-review": {
      "name": "github-code-review",
      "category": "github",
      "description": "Review PRs: diffs, inline comments via gh or REST.",
      "triggers": ["review this PR", "check the diff"],
      "source": "hermes",
      "path": "/home/mauricio/.hermes/skills/github/github-code-review"
    }
  }
}
```

## Agent Skill Delegation

**Per-skill delegation:**
```typescript
const toggleSkillForAgent = async (agentId: string, skillName: string) => {
  const currentSkills = agentSkills[agentId] || [];
  const hasSkill = currentSkills.includes(skillName);
  const newSkills = hasSkill
    ? currentSkills.filter(s => s !== skillName)
    : [...currentSkills, skillName];
  
  // Persist via IPC
  await window.electronAPI?.aiAgents?.update(agentId, { skills: newSkills });
};
```

**Bulk category delegation:**
```typescript
const delegateCategory = async (agentId: string, categoryId: string) => {
  const categorySkills = skills
    .filter(s => s.category === categoryId)
    .map(s => s.name);
  
  const newSkills = [...new Set([...currentSkills, ...categorySkills])];
  await window.electronAPI?.aiAgents?.update(agentId, { skills: newSkills });
};
```

## Common Pitfalls

1. **Protocol not registered** — Must call `protocol.registerSchemesAsPrivileged()` BEFORE `app.whenReady()`
2. **Path traversal vulnerability** — Always validate `filePath.startsWith(vaultDir)`
3. **Data not copied to dist** — `cp -r stargate-vault dist/renderer/` after build
4. **Fetch uses wrong URL** — Must be `stargate-vault://`, not `/stargate-vault/`
5. **Sidebar entry missing** — Check `Sidebar.tsx` has the entry with correct icon
6. **Route not handling** — Check `ContentArea.tsx` has the URL check BEFORE other routes

## Verification Checklist

- [ ] `protocol.registerSchemesAsPrivileged()` includes `'stargate-vault'`
- [ ] `protocol.handle('stargate-vault', ...)` is inside `app.whenReady()`
- [ ] Path traversal check `filePath.startsWith(vaultDir)` is present
- [ ] `stargate-vault/` copied to `dist/renderer/` after build
- [ ] `SkillVaultPage.tsx` uses `fetch("stargate-vault://vault-index.json")`
- [ ] Sidebar shows "Skill Vault" with BookOpen icon
- [ ] ContentArea routes `INTERNAL_SKILL_VAULT_URL` to SkillVaultPage
- [ ] Types.ts exports `INTERNAL_SKILL_VAULT_URL`
- [ ] Build passes with no TypeScript errors
- [ ] Skill Vault loads and shows 283 skills after app restart

## Related Resources

- `stargate-vault/README.md` — Vault system documentation
- `stargate-vault/component-registry.json` — Stargate component registration
- `references/mcp-integration.md` — MCP server integration patterns
- `src/types/ai.ts` — `AIAgentConfig` interface with `skills` field
