# Home Assistant Companion — Design

A Mosaic extension that connects to a **local** Home Assistant server, passively
**learns** from what happens in the home, and helps the user **build automation
routines** with AI assistance.

> **Decisions locked in** (2026-05-30):
> - **Approach: Hybrid.** A native plugin owns the connection, passive event
>   capture, learning, and UI. In addition, Home Assistant's official **MCP
>   Server** integration is registered in Mosaic's MCP config so agents can also
>   make live tool calls through the existing MCP pipeline.
> - **Autonomy: Suggest & preview only.** The agent can read everything and draft
>   automations, but anything that changes the home (`createAutomation`,
>   `callService`) requires explicit human approval. Direct write/control is an
>   opt-in setting, **off by default**.

---

## 1. Why two Mosaic primitives

Mosaic has two distinct extension types, and this feature uses both:

| Need | Primitive | Lives in |
|---|---|---|
| Connect to HA, capture events 24/7, store history, dashboard UI | **Plugin** | `plugins/home-assistant/` |
| Let an AI agent query the home, find patterns, draft routines | **Tool module** | `electron/integrations/tools/modules/home-assistant.ts` |
| Live control/queries through the existing MCP pipeline | **MCP server entry** | Mosaic MCP config (Hybrid) |

The plugin and the tool module share one connection/storage layer in the main
process.

```
            ┌─────────────────────── Electron main process ───────────────────────┐
            │                                                                       │
  HA server │   HaClient (WS + REST)                EventStore (better-sqlite3)     │
  :8123  ───┼─►  • auth (long-lived token)   ──────► home_events table             │
   (local)  │    • subscribe state_changed          entities snapshot              │
            │    • call_service / get_states  ◄────  PatternEngine (insights)       │
            │            │                                   │                       │
            │            ├── plugin IPC: "home-assistant:*"  │                       │
            │            └── ToolModule: "homeassistant:*" ◄─┘  (registry.ts)        │
            └───────────────────┬───────────────────────────────────┬──────────────┘
                                │ preload bridge                     │ tools:execute
                                ▼                                    ▼
                  HomeAssistantView (plugin UI)          Chat agent <use_tool>…

  Hybrid: HA's MCP Server ──► Mosaic MCP client ──► agent live tool calls
```

---

## 2. Connection layer — `HaClient` (main process)

Home Assistant exposes a **WebSocket API** (live events + service calls) and a
**REST API** (snapshots, automation config). Local-first design:

- **Auth:** a **Long-Lived Access Token** (HA → Profile → Security → Long-Lived
  Access Tokens). Simplest for a local server, no OAuth redirect (avoids the
  port-conflict class of problems). Stored **encrypted via `safeStorage`**, the
  same pattern as the HyperInsight API key (`plugins/hyperinsight/main/index.js`).
- **WebSocket** to `ws://<host>:8123/api/websocket`:
  1. server sends `{type:"auth_required"}`
  2. client sends `{type:"auth", access_token}`
  3. server replies `{type:"auth_ok"}`
  4. client subscribes: `{id, type:"subscribe_events", event_type:"state_changed"}`
  - Reconnect/backoff/ping mirrors `electron/integrations/chat/client.ts`.
- **REST** for one-shot reads/writes (header `Authorization: Bearer <token>`):
  - `GET /api/states`, `GET /api/services`, `GET /api/config`
  - `GET /api/config/area_registry`, `/device_registry`, `/entity_registry`
  - `POST /api/services/<domain>/<service>` (control)
  - `POST /api/config/automation/config/<id>` (create automation)

Config persisted at `userData/home-assistant.json`:
`{ baseUrl, tokenEncB64, lastConnectedAt }`.

---

## 3. Passive learning — `EventStore` (SQLite)

`better-sqlite3` is already a dependency (used by agent memory). New DB at
`userData/home-assistant-events.db`:

```sql
CREATE TABLE home_events (
  id INTEGER PRIMARY KEY,
  ts INTEGER NOT NULL,            -- epoch ms
  entity_id TEXT NOT NULL,        -- light.hallway, binary_sensor.motion_x
  domain TEXT NOT NULL,           -- light, switch, binary_sensor, climate...
  old_state TEXT, new_state TEXT, -- "on"/"off"/"22.5"
  attrs JSON,                     -- brightness, temperature, etc.
  context_user TEXT               -- who/what triggered it (manual vs automation)
);
CREATE INDEX idx_events_entity_ts ON home_events(entity_id, ts);
CREATE INDEX idx_events_ts ON home_events(ts);
```

The WS `state_changed` handler writes one row per transition. A periodic task
(the HyperInsight poller pattern) handles retention (e.g. raw 30 days, hourly
roll-ups beyond). `context_user` distinguishes **manual** actions (candidate
routines) from already-automated ones.

---

## 4. Insight engine — `PatternEngine`

Runs periodically / on demand over the event store, emitting **candidate
routines** with confidence + evidence:

- **Temporal correlation:** "X within N s of Y, ≥P% of the time" (motion → light).
- **Time-of-day habits:** "thermostat → 20° around 22:30 on weeknights."
- **Co-occurrence:** entities that change together → a scene.
- **Sun/context:** join with `sun.sun` so suggestions read "after sunset".

Output `RoutineSuggestion`: confidence, human description, evidence counts, and a
**draft HA automation** (trigger/condition/action JSON). Deliberately classical/
statistical so it is cheap and works offline — **the LLM refines and explains,
it does not mine raw logs.**

---

## 5. AI tool module — `homeassistant`

Implements `ToolModule` (`electron/integrations/tools/types.ts`), registered in
`electron/integrations/tools/index.ts` next to `GmailModule`. Agents call these
via `<use_tool server="homeassistant" tool="...">`.

| Tool | Purpose | `displayHint` | Mutates home? |
|---|---|---|---|
| `getStatus` | connected? entity count? | analyze | no |
| `listEntities` | entities by domain/area | analyze | no |
| `getHistory` | query `home_events` for entity/range | analyze | no |
| `getSuggestions` | PatternEngine candidates | analyze | no |
| `proposeAutomation` | validate draft, return YAML preview | display | **no (preview only)** |
| `createAutomation` | write automation to HA | display | **yes — gated** |
| `callService` | turn on/off, set climate | display | **yes — gated** |
| `getAreasAndDevices` | registry for grounding | analyze | no |

`getSystemPrompt()` instructs: ground proposals in real data via
`getHistory`/`getSuggestions`, and always `proposeAutomation` for human review
before `createAutomation`. The recursive `analyze` loop (Chatview, depth ≤ 10)
lets the agent chain query → reason → propose in a single turn.

---

## 6. Routine-building flow (human-in-the-loop)

```
PatternEngine → suggestion ──► UI "Suggested routines" card
                                  │
        user clicks "Ask AI" ─────┤──► agent: getHistory + getSuggestions → proposeAutomation
                                  │              │
                                  ▼              ▼
                          YAML/diff preview in chat + UI
                                  │
                    user clicks "Create" ──► createAutomation → POST /api/config/automation/config
                                                                 → automation runs natively in HA
```

**Principle:** the agent **proposes**, the human **approves**, HA **executes**.
Generated automations run inside Home Assistant, so the home keeps working when
Mosaic is closed. `createAutomation`/`callService` are gated behind an explicit
confirmation and an "allow agent to control / create" setting (**off by
default**).

---

## 7. Plugin UI — `HomeAssistantView`

Tabbed, mirroring `HyperInsightView`:

- **Connect** — base URL + token entry, connection status dot.
- **Live** — real-time event stream + entity states (pushed via
  `webContents.send` → preload `onEvent` listener).
- **Insights** — discovered patterns with confidence + evidence.
- **Suggested Routines** — candidates, each with "Ask AI to refine" + "Create in HA".
- **Automations** — list/toggle existing HA automations (read + enable/disable).

---

## 8. File map (matches existing conventions)

**New — plugin:**
```
plugins/home-assistant/
  manifest.json                 { id, ipcNamespace:"home-assistant", route }
  main/
    index.js                    registerHomeAssistantIpc(ipcMain), setMainWindow, stop
    HaClient.js                 WS + REST client (model: chat/client.ts)
    EventStore.js               better-sqlite3 schema + queries        (Phase 2)
    PatternEngine.js            suggestion mining                       (Phase 4)
  renderer/
    index.tsx, HomeAssistantView.tsx, types.ts, components/…
  README.md
```
**New — tool module (Phase 3):** `electron/integrations/tools/modules/home-assistant.ts`

**Edited — wiring (same spots HyperInsight/Gmail touch):**
- `electron/main.ts` — import + `registerHomeAssistantIpc(ipcMain)`;
  `setMainWindow(win)`; `stopHomeAssistant()` on `before-quit`.
- `electron/preload.ts` — expose `window.electronAPI.homeAssistant.*`.
- `global.d.ts` — type the `homeAssistant` surface.
- `electron/integrations/tools/index.ts` — `registry.register(new HomeAssistantModule())` (Phase 3).
- `src/types/types.ts` — `INTERNAL_HOME_ASSISTANT_URL`.
- `src/components/ContentArea.tsx` — route → `<HomeAssistantView/>`.
- `src/components/Sidebar.tsx` — nav entry + icon.

---

## 9. Phasing

1. **Connect + Live** — HaClient, token auth, WS subscribe, live event view. *(scaffolded first)*
2. **Capture** — EventStore writing `state_changed` to SQLite + retention.
3. **Tool module** — `getStatus/listEntities/getHistory/callService` so the agent can talk to the home; register HA's MCP server in Mosaic MCP config (Hybrid).
4. **Insights** — PatternEngine + Suggested Routines UI.
5. **Build** — `proposeAutomation` / `createAutomation` with the human-approval gate.

---

## 10. Security notes

- Token stored encrypted (`safeStorage`); never logged.
- All home-mutating tools gated by an explicit setting + per-action confirmation.
- Local-only by default; no event data leaves the machine except what the user
  chooses to send to their configured AI provider during a chat.
