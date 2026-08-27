# Vault System — Technical Documentation

## Overview

The Vault is MosAIc's structured data storage system. It lets users organize information into **boxes** and control which AI agents can access each box. Agents can only read boxes they've been explicitly granted access to — this is enforced at runtime in the main process.

```
User → creates Boxes → adds Entries → assigns Agent Access
Agent → requests data → access checked → allowed or denied
```

---

## Architecture

### Data Flow

```
┌─────────────┐     IPC      ┌──────────────┐     fs      ┌───────────────────┐
│  Renderer    │ ──────────→  │  Main Process │ ─────────→  │  Disk (~/.config)  │
│  (VaultPage) │              │  (IPC + Vault)│             │  vault.json        │
│  (ChatView)  │ ←────────── │  (ToolModule) │ ←───────── │  vault-content/    │
└─────────────┘              └──────────────┘             └───────────────────┘
```

### File Structure

```
~/.config/mosaic-companion/
├── vault.json                     # Box metadata (names, descriptions, timestamps)
├── vault-content/
│   ├── box-1740528000000.json     # Entries for box 1
│   ├── box-1740529000000.json     # Entries for box 2
│   └── ...
└── ai-agents.json                 # Agent configs (includes boxAccess[])
```

**Design decision:** Box metadata and content are stored separately. `vault.json` stays lean (just box names/IDs), while content files can grow large independently. Deleting a box also deletes its content file.

---

## Core Concepts

### Box

A named container for related data entries.

| Field         | Type                                      | Description                                   |
| ------------- | ----------------------------------------- | --------------------------------------------- |
| `id`          | string                                    | Unique identifier (e.g., `box-1740528000000`) |
| `name`        | string                                    | Human-readable name (must be unique)          |
| `description` | string?                                   | Optional description                          |
| `sourceType`  | `"manual"` \| `"import"` \| `"connector"` | How data enters this box                      |
| `createdAt`   | number                                    | Unix timestamp                                |
| `updatedAt`   | number                                    | Unix timestamp                                |

### Entry

A single piece of text content inside a box.

| Field       | Type    | Description                                     |
| ----------- | ------- | ----------------------------------------------- |
| `id`        | string  | Unique identifier (e.g., `entry-1740528000000`) |
| `label`     | string? | Optional short label/title                      |
| `content`   | string  | The actual text content                         |
| `createdAt` | number  | Unix timestamp                                  |
| `updatedAt` | number  | Unix timestamp                                  |

### Agent Access

Each AI agent has an optional `boxAccess: string[]` field in its config (`ai-agents.json`). This is an array of box IDs that the agent is permitted to read. If the array is empty or missing, the agent has no vault access.

---

## API Reference

### User-Facing API (Preload Bridge)

These are called from the renderer process via `window.electronAPI.vault.*`. No access control — the user owns all data.

#### Box Management

| Method                   | Args                                           | Returns                     | Description                   |
| ------------------------ | ---------------------------------------------- | --------------------------- | ----------------------------- |
| `getBoxes()`             | —                                              | `VaultBox[]`                | List all boxes                |
| `getBox(id)`             | box ID                                         | `VaultBox \| null`          | Get a single box              |
| `addBox(input)`          | `{ name, description?, sourceType? }`          | `{ success, box?, error? }` | Create a box                  |
| `updateBox(id, updates)` | box ID, `{ name?, description?, sourceType? }` | `{ success, box?, error? }` | Update a box                  |
| `deleteBox(id)`          | box ID                                         | `{ success, error? }`       | Delete box + content file     |
| `getAgentBoxes(agentId)` | agent ID                                       | `VaultBox[]`                | Get boxes an agent can access |

#### Content Management

| Method                                 | Args                                     | Returns                       | Description              |
| -------------------------------------- | ---------------------------------------- | ----------------------------- | ------------------------ |
| `getBoxContent(boxId)`                 | box ID                                   | `VaultEntry[]`                | Get all entries in a box |
| `addEntry(boxId, input)`               | box ID, `{ content, label? }`            | `{ success, entry?, error? }` | Add an entry             |
| `updateEntry(boxId, entryId, updates)` | box ID, entry ID, `{ content?, label? }` | `{ success, entry?, error? }` | Update an entry          |
| `deleteEntry(boxId, entryId)`          | box ID, entry ID                         | `{ success, error? }`         | Delete an entry          |

### Agent-Facing API (ToolModule)

These are exposed through the Tool Registry as `vault:list_boxes` and `vault:read_box`. Access control is enforced via `ExecutionContext.agentId`.

#### `vault:list_boxes`

Lists boxes the calling agent has access to.

- **Input:** `{}` (no args)
- **Context required:** `{ agentId: string }`
- **Returns:** Array of `{ id, name, description, sourceType }` — only boxes in the agent's `boxAccess[]`
- **Without context:** Returns `{ success: false, error: "No agent context" }`

#### `vault:read_box`

Reads all entries from a box.

- **Input:** `{ boxId: string }`
- **Context required:** `{ agentId: string }`
- **Returns:** Array of `{ id, label, content, createdAt }` — only if agent has access
- **Without access:** Returns `{ success: false, error: "Access denied" }`

---

## Security Model

### Access Control Enforcement

```
Agent sends: <use_tool server="vault" tool="read_box">{"boxId":"box-123"}</use_tool>

Chatview.tsx
  → executeMCPAction(action, selectedAgent.id)        // agentId injected here
    → tools:execute("vault:read_box", args, { agentId })
      → ToolRegistry.executeTool(name, args, context)
        → VaultToolModule.readBox(args, context)
          → canAgentAccessBox(agentId, boxId)           // ENFORCEMENT GATE
            → reads ai-agents.json → checks boxAccess[]
              → ALLOW or DENY
```

### Key Security Properties

1. **Main process enforcement** — Access checks happen in the Electron main process (`canAgentAccessBox()`), not in the renderer. The renderer cannot bypass this.

2. **Agent identity is injected, not self-declared** — The `agentId` comes from `selectedAgent.id` in Chatview, not from the agent's own request. An agent cannot claim to be a different agent.

3. **Read-only for agents** — Agents can only `list_boxes` and `read_box`. They cannot create, modify, or delete boxes or entries. Only the user UI has write access.

4. **Declarative access** — `boxAccess` is stored on the agent config, not on the box. This means:
   - A box doesn't know which agents can see it (agents know which boxes they can see)
   - Removing a box from `boxAccess[]` instantly revokes that agent's access
   - The VaultPage UI provides toggles for managing this

5. **Content isolation** — Each box stores its content in a separate file. Reading one box's content doesn't load other boxes into memory.

### Known Limitations

- **Encryption at rest is not in a published release** — In the current published release (v0.1.12) content files are stored as plaintext JSON and the Vault page says so. On `main` — and therefore in a build from source — encryption with the OS secure-storage backend (`safeStorage`) is enabled, and protection then depends on the platform: where no backend is available, or a keychain prompt is declined, contents stay plaintext; on a Linux `basic_text` fallback they are obfuscated but not protected, because that backend stores its key in the clear. The Vault page reports which of the three applies, and a box already encrypted is never rewritten as plaintext.
- **No audit logging** — There's no log of which agent accessed which box and when. Future: add an access log.
- **No rate limiting** — An agent could call `read_box` in a tight loop. Not currently a concern since tool calls go through the LLM response cycle.
- **Timestamp-based IDs** — Box and entry IDs use `Date.now()`. Theoretically two entries created in the same millisecond could collide (extremely unlikely in practice).

---

## UI Components

### VaultPage (`src/components/VaultPage.tsx`)

The main management interface. Accessed via the Lock icon in the sidebar.

- **Box list** — Cards showing each box with metadata (source type, agent count, entry count)
- **Add box form** — Name, description, source type selector
- **Inline editing** — Click edit icon on a box to modify name/description
- **Expandable drawer** — Each box expands to show two tabs:
  - **Content tab** — Lists entries, add new entries form, delete on hover
  - **Agent Access tab** — Toggle switches for each configured agent

### Chat Integration (`src/components/Chatview.tsx`)

- **System prompt injection** — When an agent has box access, the system prompt includes a list of accessible boxes with names and IDs
- **Tool call rendering** — Tool calls (`<use_tool>`) render as collapsed chips with a wrench icon
- **Tool output rendering** — Tool outputs render as centered, neutral system rows (not user bubbles)

---

## Backend Modules

### `electron/integrations/vault/types.ts`

Type definitions: `BoxSourceType`, `VaultBox`, `VaultConfig`, `VaultEntry`, `BoxContent`.

### `electron/integrations/vault/index.ts`

Core CRUD operations and persistence:

- `loadVault()` / `saveVault()` — Read/write `vault.json`
- `getBoxes()`, `getBox()`, `addBox()`, `updateBox()`, `deleteBox()` — Box CRUD
- `getAgentBoxes()`, `canAgentAccessBox()` — Access control helpers
- `loadBoxContent()` / `saveBoxContent()` — Per-box content file I/O
- `getBoxContent()`, `addEntry()`, `updateEntry()`, `deleteEntry()` — Entry CRUD

### `electron/integrations/tools/modules/vault-tools.ts`

Read-only ToolModule for AI agents. Implements `list_boxes` and `read_box` with access enforcement via `ExecutionContext`.

### `electron/integrations/tools/types.ts`

Defines `ExecutionContext` (`{ agentId?: string }`) — threaded through the entire tool execution pipeline.

---

## Validation Rules

| Rule                                        | Enforcement Location                            |
| ------------------------------------------- | ----------------------------------------------- |
| Box name is required                        | `addBox()` in `vault/index.ts`                  |
| Box names must be unique (case-insensitive) | `addBox()` in `vault/index.ts`                  |
| Entry content cannot be empty               | `addEntry()` in `vault/index.ts`                |
| Agent must have access to read a box        | `readBox()` in `vault-tools.ts`                 |
| Agent context is required for tool calls    | `listBoxes()` / `readBox()` in `vault-tools.ts` |
| Deleting a box removes its content file     | `deleteBox()` in `vault/index.ts`               |
