# Home Assistant plugin

Connects Mosaic to a **local** Home Assistant server, captures home events, and
(in later phases) helps build automation routines with AI.

See the full design at [`docs/home-assistant-plugin.md`](../../docs/home-assistant-plugin.md).

## Status — Phases 1–3 done

Implemented:
- **Connection** to HA over its WebSocket API using a Long-Lived Access Token.
- **Settings** persisted at `userData/home-assistant.json` with the token
  encrypted via Electron `safeStorage`. Includes **auto-connect on startup** and
  **agent-control** flags.
- **Live event stream**: subscribes to `state_changed` and pushes events to the
  renderer in real time.
- **SQLite capture** (`EventStore.js`): every state change is written to
  `userData/home-assistant-events.db`; 30-day retention, pruned every 6h.
- **AI tool module** (`electron/integrations/tools/modules/home-assistant.ts`):
  agents can `getStatus`, `listEntities`, `getHistory`, `proposeAutomation`
  (preview), and — only when the user enables control — `callService` and
  `createAutomation`.
- **UI**: Connect (URL + token + auto-connect switch + agent-control toggle +
  status), Live (event table), History (capture stats).

Not yet implemented: the pattern/insight engine and the Suggested Routines UI
(Phase 4), and the automation-build approval modal (Phase 5).

## Hybrid: registering Home Assistant's MCP server

The native tool module above already lets agents query/control HA. To also use
Home Assistant's **official MCP Server** (its Assist/intents surface) through
Mosaic's MCP pipeline:

1. In Home Assistant, add the **Model Context Protocol Server** integration
   (Settings → Devices & Services → Add Integration → "Model Context Protocol
   Server"). It exposes an SSE endpoint at `/mcp_server/sse`.
2. In Mosaic, open the **MCP Servers** page and add a server pointing at
   `http://<ha-host>:8123/mcp_server/sse` with an `Authorization: Bearer <token>`
   header (a Long-Lived Access Token).

This is a per-user configuration step (it needs your HA URL + token), so it is
not hard-coded.

### Agent-control gate

`callService` and `createAutomation` only run when the user has enabled
**"Allow the AI agent to control my home"** on the Connect page (off by default).
While disabled, those tools return a refusal explaining the agent should present
a preview for the user to approve — the suggest-and-preview policy.

## Architecture

```
main/
  HaClient.js   WebSocket + REST client (auth, subscribe_events, reconnect, ping)
  index.js      IPC handlers ("home-assistant:*"), encrypted settings, event push
renderer/
  index.tsx           mount/unmount entry
  HomeAssistantView.tsx  tabbed UI (Connect / Live)
  types.ts            shared renderer types
manifest.json   plugin metadata
```

## Setup (for users)

1. In Home Assistant: profile → **Security** → **Long-Lived Access Tokens** →
   create a token and copy it.
2. In Mosaic: open **Home Assistant** from the sidebar.
3. Enter your server URL (e.g. `http://homeassistant.local:8123`) and paste the
   token, then **Connect**.
4. Open the **Live** tab and toggle something in your home to see events.

## IPC surface (`window.electronAPI.homeAssistant`)

| Method | Description |
|---|---|
| `getSettings()` | `{ baseUrl, hasToken }` (never returns the token) |
| `saveSettings({ baseUrl, token })` | persists URL; keeps saved token if blank |
| `connect()` | validates token via REST, then opens the WebSocket |
| `disconnect()` | tears down the connection |
| `status()` | `{ status }` |
| `getStates()` | `{ success, data }` — current entity states |
| `onStatus(cb)` / `onEvent(cb)` / `onError(cb)` | event subscriptions (return unsubscribe) |
