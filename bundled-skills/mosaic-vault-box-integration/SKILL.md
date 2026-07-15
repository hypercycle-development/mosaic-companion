---
name: mosaic-vault-box-integration
description: "Add skill/content boxes to Mosaic Companion's Vault system. Covers the box metaphor (vault.json metadata + vault-content/ entries), NOT separate sidebar pages."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [mosaic, vault, boxes, integration, hermes-vault]
    related_skills: []
---

# Mosaic Vault Box Integration

## Overview

**CRITICAL DISTINCTION:** The Mosaic Vault uses a **box metaphor**, NOT separate sidebar pages.

**WRONG approach (what I did initially):**
- Create new sidebar item "Skill Vault" 
- Create separate routing in ContentArea.tsx
- Build custom protocol handlers

**CORRECT approach:**
- Add box entry to `vault.json` 
- Create content file in `vault-content/`
- Existing VaultPage renders it automatically

## The Box Architecture

```
~/.config/mosaic-companion/
├── vault.json                    # Box metadata (id, name, description, sourceType)
└── vault-content/
    ├── box-skills-main.json      # Content for "Skills" box
    ├── box-hermes-vault-*.json   # Content for "Hermes Vault" box
    └── box-{id}.json            # Content for other boxes
```

**User sees:** 6 boxes in Vault page (Skills, Taste-Skills, Training-Logs, Midnight Network Quest, Stargate Doctor, Hermes Vault)

## When to Use This Skill

- User asks to add skills to the Vault
- Need to create a new content box alongside existing boxes
- Integrating external skill libraries into Mosaic
- Creating agent-accessible knowledge boxes

## Common Pitfalls

### ⚠️ CRITICAL: Do NOT Create Separate Sidebar Entry

**WRONG:** Creating a new sidebar item
```typescript
// ❌ DON'T DO THIS
{ id: "skill-vault", label: "Skill Vault", icon: "BookOpen", url: INTERNAL_SKILL_VAULT_URL }
```

This creates a duplicate navigation item that confuses users. The Vault already exists — add boxes TO it.

**CORRECT:** Add a new **box** to the existing Vault system
```json
// ✅ DO THIS: Add entry to ~/.config/mosaic-companion/vault.json
{
  "boxes": [
    // ... existing boxes ...
    {
      "id": "box-hermes-vault-{timestamp}",
      "name": "Hermes Vault", 
      "description": "Complete Hermes skill library with {N} skills",
      "sourceType": "connector",
      "createdAt": 1234567890000,
      "updatedAt": 1234567890000
    }
  ]
}
```

Then create `vault-content/box-hermes-vault-{timestamp}.json` with the entries.

### Understanding Box Access vs Entry-Level Access

**Box-level access** (via `agent.boxAccess`):
- Controls which agents can SEE the box
- Managed in the "Agent Access" tab of each box

**Entry-level access** (via `agent.vaultSkills`):
- Controls which skills within Hermes Vault each agent has
- Managed in the "Content" tab with per-entry toggles
- Requires `vaultSkills?: Record<string, string[]>` on AIAgentConfig

## Implementation Steps

### Step 1: Create Box Metadata

Edit `~/.config/mosaic-companion/vault.json`:

```json
{
  "boxes": [
    // ... existing boxes ...
    {
      "id": "box-hermes-vault-123456789",
      "name": "Hermes Vault",
      "description": "Complete Hermes skill library with 283 skills across 24 categories",
      "sourceType": "connector",
      "createdAt": 1234567890000,
      "updatedAt": 1234567890000
    }
  ]
}
```

### Step 2: Create Content File

Create `~/.config/mosaic-companion/vault-content/box-hermes-vault-123456789.json`:

```json
{
  "boxId": "box-hermes-vault-123456789",
  "entries": [
    {
      "id": "entry-skill-name",
      "label": "skill-name",
      "content": "# skill-name\n\n**Category:** category\n**Source:** hermes\n\n## Description\nSkill description here...\n\n## Trigger Phrases\n- trigger one\n- trigger two",
      "createdAt": 1234567890000,
      "updatedAt": 1234567890000
    }
  ]
}
```

### Step 3: Enable Per-Entry Agent Delegation (Optional)

For boxes like Hermes Vault where each entry is a skill:

1. Add `vaultSkills` field to `AIAgentConfig` interface:
```typescript
vaultSkills?: Record<string, string[]>;
// Key: box ID, Value: array of entry IDs this agent can use
```

2. In `VaultPage.tsx`, detect Hermes Vault and render agent toggles per entry

## Verification Checklist

- [ ] `vault.json` contains new box metadata
- [ ] `vault-content/box-{id}.json` exists with valid JSON
- [ ] Box appears in Vault page (6 boxes total)
- [ ] Can expand box and see Content/Agent Access tabs
- [ ] No duplicate sidebar entries created
- [ ] No separate routing added to ContentArea.tsx

## Additional Patterns Learned

### Auto-Initializing Vault on App Startup

When creating vault content that should exist from day one, initialize it in `electron/main.ts`:

```typescript
// In app.whenReady().then(async () => { ... })

// Initialize SAFE Rev Pool vault for agent learning
try {
  const { initializeSafePoolVault } = await import("./integrations/vault");
  const result = initializeSafePoolVault();
  if (result.success) {
    console.log("[Vault]", result.message);
  }
} catch (e) {
  console.warn("[Vault] Failed to initialize vault:", e);
}
```

**Critical:** Use `async () =>` in `app.whenReady().then()` to support dynamic imports.

### Creating Knowledge Base Modals

For rich vault content display, create a modal component instead of navigating to the Vault page:

```typescript
// SafePoolKnowledgeModal.tsx
interface SafePoolKnowledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Usage in AdaPortalPanel:
const [showSafeKnowledgeModal, setShowSafeKnowledgeModal] = useState(false);

// In JSX:
<SafePoolKnowledgeModal 
  isOpen={showSafeKnowledgeModal} 
  onClose={() => setShowSafeKnowledgeModal(false)} 
/>
```

### Correct Tab Placement

**WRONG:** Adding pool cards to "Start" tab
**CORRECT:** Adding pool cards to "Stargate Pool" tab (renderStargatePool function)

```typescript
// In AdaPortalPanel.tsx, inside renderStargatePool()
{activeStargateTab === 'pool' && (
  <>
    {/* SAFE Rev Pool Card should be HERE */}
    <div className="p-4 rounded-xl bg-gradient-to-r from-green-900/30 to-emerald-900/30".../>
    
    {/* Wallet Header */}
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700".../>
  </>
)}
```

## Node Revenue Sharing Model

When building decentralized marketplace vaults, consider the node revenue sharing pattern:

```
Revenue Split per Transaction:
├─ Driver: 96.5% (0% fees)
├─ Platform: 1.5%
├─ Node Operator: 1.5% (passive income)
└─ Tiller Rewards: 0.5%

Node Intelligence Inheritance:
C-3PO Node (London) learns → Factory spawns:
    ├── C-3PO-B (Birmingham) inherits config
    └── C-3PO-M (Manchester) inherits config
```

### Pitfall: Modal Buttons Without Handlers

**Symptom:** Buttons in modal appear clickable but do nothing
**User report:** "buttons of ( Simulated Mode ) and ( Soft Launch ) is not working"

**Cause:** Buttons have `hover:` styles but no `onClick` handler

**Fix:** Always add onClick handlers, even if just showing an alert:
```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onActionOne?: () => void;  // Optional handler
  onActionTwo?: () => void;
}

// In component:
<button 
  onClick={() => {
    if (onActionOne) {
      onActionOne();
      onClose();
    } else {
      alert('Description of what this does');
    }
  }}
>
  Action One
</button>
```

**Verification:** Click every button in new UI before claiming it's done.