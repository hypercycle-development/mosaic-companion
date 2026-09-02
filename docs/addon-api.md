# `window.addonAPI` reference

The only channel between an add-on's page and the application. It is injected by
the app, not shipped by you — there is nothing to install and nothing to import.

For what an add-on *is*, how to build one and how to submit it, see
[Build an extension](build-an-extension.md). This page is the API surface.

> **No Node.js, and no `window.electronAPI`.** An add-on renders in an isolated
> webview with context isolation on and node integration off. `window.addonAPI`
> is the whole of what you get. Code copied out of the application's own renderer
> will not work here.

---

## How a call behaves

Every method returns a **Promise**, except two that are synchronous:
`events.on`, which returns an unsubscribe function, and `parseError`, which
returns `{ code, message }`. On success a call resolves with the value. On
failure it **throws**, and the thrown `Error` carries a code you can branch on.

The code is encoded into the message as `[CODE] message`, because a custom
`.code` property does not survive the contextBridge boundary — only `message`
and `stack` cross it. `addonAPI.parseError` recovers it:

```js
try {
  const addr = await window.addonAPI.wallet.getAddress();
} catch (e) {
  const { code, message } = window.addonAPI.parseError(e);
  if (code === "PERMISSION_DENIED") {
    // you did not declare wallet:read in your manifest
  }
}
```

| Code | Means |
| --- | --- |
| `PERMISSION_DENIED` | The method, or the channel, needs a permission your manifest does not declare. Consent is all-or-nothing — an install that is not granted everything the manifest asks for does not happen — so in practice this means you did not declare it. |
| `BAD_ARGS` | Arguments failed validation — wrong type, bad path, over a size limit. |
| `UNKNOWN_METHOD` | No such namespace or method, or no handler registered by your add-on's main. |
| `HANDLER_ERROR` | The method ran and threw. |
| `ADDON_UNKNOWN_SENDER` | The caller could not be identified as an installed add-on. |
| `ADDON_NOT_ACTIVE` | Your add-on is not active — reachable if a call races deactivation. |
| `UNKNOWN_ERROR` | Nothing matched — the message is the raw text. |

**Identity is never taken from your page.** Which add-on is calling is resolved
in the main process from the sender, so `init()` is for display and convenience
only. Do not use it to prove anything.

---

## Permissions at a glance

Permission-checked methods are checked **in the main process, on every call**,
against what your manifest declared and the user approved at install.

| Namespace | Permission |
| --- | --- |
| `system` | none |
| `settings` | none — scoped to your add-on |
| `files` | none — scoped to your add-on's own directory |
| `events` | depends on the channel, see below |
| `ui.setTitle` | none |
| `ui.openExternal` | `shell:open-external` |
| `wallet.*` | `wallet:read` |
| `agents.list` / `agents.get` | `agents:read` |
| `agents.add` / `agents.update` | `agents:write` |
| `mcp.listServers` / `mcp.listTools` | `mcp:read` |
| `mcp.callTool` | `mcp:call` |
| `nodes.*` | `nodes:read` |

**Ungated does not mean unbounded.** `settings`, `files` and `self:` events carry
no permission because they cannot reach outside your own add-on — the boundary is
scope, not a check. See the limits on each below.

`wallet:sign`, `agents:delete`, `vault:read`, `vault:write` and `notifications`
are **reserved**: they are refused when the manifest is validated, so an add-on
declaring one never installs.

---

## `system`

No permission. Read-only.

| Method | Returns |
| --- | --- |
| `getManifest()` | Your own manifest as loaded. |
| `getAppInfo()` | Platform, app version, locale. |
| `getTheme()` | The active theme key and its CSS variables. |

## `settings`

No permission. A per-add-on key–value store, private to you and persisted across
restarts.

| Method | Notes |
| --- | --- |
| `get()` | The whole object. |
| `set(patch)` | Shallow merge. |
| `replace(value)` | Replaces wholesale. |
| `clear()` | Empties it. |

**Cap: 64 KiB** serialised. A write that would exceed it throws `BAD_ARGS` and
changes nothing. This is for preferences, not for data — use `files` for that.

## `files`

No permission, because every path resolves inside **your add-on's own `data/`
directory**. Paths are relative to it, and a path that escapes — including via a
symlink, which is resolved with `realpath` before the check — throws `BAD_ARGS`.

| Method | Notes |
| --- | --- |
| `read(relPath)` | UTF-8 text. |
| `readBinary(relPath)` | Bytes. |
| `write(relPath, contents)` | `contents` is a string or a byte array. |
| `list(relDir = ".")` | Directory entries. |
| `delete(relPath)` | |
| `mkdir(relDir)` | |

**Limits: 10 MiB per file, 200 MiB per add-on.**

> Loading an add-on from the Dev corner creates that `data/` directory **inside
> your source folder**. Add it to your `.gitignore`.

## `events`

`on(channel, callback)` subscribes and returns an unsubscribe function.

```js
const off = window.addonAPI.events.on("theme:changed", (theme) => { /* … */ });
// later
off();
```

| Channel | Permission | Fires when |
| --- | --- | --- |
| `theme:changed` | none | The user changes theme. |
| `window:focus-changed` | none | The app window gains or loses focus. |
| `wallet:changed` | `wallet:read` | Wallet state changes. |
| `nodes:changed` | `nodes:read` | **Nothing delivers this today** — see below. |
| `mcp:tools-changed` | `mcp:read` | **Nothing delivers this to an add-on today** — see below. |
| `self:*` | none | Your own add-on's main sends on it — which needs a `main.entry`, so see the note on `invoke()` below before designing around these. |

Permission here depends on the **channel**, not the method, and is checked when
you subscribe.

> **Subscription failures are silent, and this is the one place they are.**
> `events.on` returns its unsubscribe function immediately and discards the
> result of the subscribe call. So an unrecognised channel, and a channel whose
> permission you do not hold, both look identical to a channel that simply never
> fires. There is nothing to catch. If events are not arriving, check the channel
> name and check your manifest before you debug anything else.

`theme:changed` and `window:focus-changed` are subscribed for you at startup.

> **Two of these channels are accepted but never arrive.** `nodes:changed` and
> `mcp:tools-changed` are in the permission map, so subscribing to them succeeds
> and looks exactly like a working subscription. Nothing reaches you.
>
> Add-on events are delivered by one function, and its complete set of callers
> emits only `theme:changed`, `window:focus-changed`, `wallet:changed` and
> `self:*`. `nodes:changed` has no sender anywhere in the app. `mcp:tools-changed`
> does have one, but it publishes to the app's own window on a different
> transport that add-on webviews are not on.
>
> **Do not design around either channel.** If you need to know that the node list
> or the MCP tool set has changed, poll `nodes.list()` or `mcp.listTools(serverId)`.


## `ui`

| Method | Permission | Notes |
| --- | --- | --- |
| `setTitle(title)` | none | Sets your tab's title. |
| `openExternal(url)` | `shell:open-external` | Opens a URL in the user's browser. The one ungated-looking call that leaves the app — hence the permission. |

## `wallet`

All `wallet:read`. **Read-only by design** — `wallet:sign` is reserved and
refused at install, so an add-on can never spend or sign.

`getAddress()` · `getBalance(tokenSymbol?)` · `getNetworkInfo()`

## `agents`

`list()` and `get(id)` need `agents:read`. `add(agent)` and
`update(id, patch)` need `agents:write`. There is no delete — `agents:delete` is
reserved.

## `mcp`

`listServers()` and `listTools(serverId)` need `mcp:read`.
`callTool(serverId, toolName, args)` needs `mcp:call`, and is the one that
actually runs something, so ask for it only if you use it.

## `nodes`

Both `nodes:read`. `list()` · `getSavedAims(license?)`.

---

## Theming

You do not have to do anything. At startup the app writes the active theme's
tokens onto `<html>` as CSS custom properties named `--<token>`, and sets
`data-theme` to the theme key. It re-applies them whenever the theme changes.

```css
.panel { background: var(--surface); color: var(--text); }
```

Call `system.getTheme()` if you need the values in JavaScript.

---

## `init()` and `invoke()`

`init()` resolves once with `{ addonId, manifest, theme, platform, appVersion,
locale }` and is cached thereafter. **Display and convenience only** — see the
note on identity above.

`invoke(method, ...args)` calls a handler your own add-on's main process
registered via `ctx.ipc.handle`. It is scoped to your add-on, so it can never
reach another's handlers. It requires a `main.entry` in your manifest, which is
restricted to a one-entry allowlist — **a new add-on will not be granted one**,
so treat this as unavailable and build in the renderer.

---

## What this page does not cover

`window.addonAPI` is the **add-on** surface. MCP servers and WASM tools —
plugins — do not use it and have their own interfaces. See
[Build an extension](build-an-extension.md) for the distinction.
