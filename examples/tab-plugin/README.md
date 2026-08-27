# tab-plugin

The smallest possible MosAIc addon: one sidebar tab, one page, no build step.

Copy this directory, rename it, and you have a working addon skeleton.

## Files

| File | Purpose |
|------|---------|
| `manifest.json` | Everything the app needs to know: id, tab, entry point, permissions |
| `renderer/index.html` | The page itself — plain HTML and JS, no bundler required |

## Try it

Addons load from the app's addon host, which lives on the
`feat/addon-architecture` branch (it is not on `main` yet).

1. Run MosAIc from source (`npm start`), or a packaged build with
   `MOSAIC_ADDON_DEV=1` set.
2. **Configuration → Addons → Dev corner → Install unpacked**.
3. Point it at this directory (the one containing `manifest.json`).
4. "Example" appears in the sidebar.

A dev install grants every permission the manifest declares and skips the
consent dialog — that's a developer convenience, not what a real user sees.

## What it demonstrates

- **`window.addonAPI.init()`** — the handshake. Resolves with your addon id,
  your manifest, the current theme, and app info. Wait for it before calling
  anything else.
- **A granted permission** — `agents:read` is declared in the manifest, so
  `addonAPI.agents.list()` works. Note what comes back: no API keys. The host
  strips credentials on the way out; there is no flag to turn that off.
- **A denied permission** — `nodes:read` is a real permission this manifest
  doesn't ask for, so `addonAPI.nodes.list()` throws. Enforcement is in the
  main process against the installed manifest, so editing the page's
  JavaScript changes nothing.
- **Theming** — the CSS uses variables like `--background` that the addon
  preload injects and keeps updated when the user switches theme.

## The rules worth knowing before you build something bigger

**Your page is isolated.** Addon webviews run with `contextIsolation` on,
`sandbox` on and `nodeIntegration` off, forced by the host. There is no
`require`, no Node, and no `window.electronAPI`. `window.addonAPI` is the
entire surface — anything else is a dead end, and code ported from inside the
app will need rewriting to use it.

**Your identity is assigned, not claimed.** The host resolves which addon is
calling from the webview itself. Nothing you send can change who the app
thinks you are.

**Permissions are declared up front** in `manifest.json`, from a fixed
vocabulary: `wallet:read`, `agents:read`, `agents:write`, `mcp:read`,
`mcp:call`, `nodes:read`, `shell:open-external`. Ask for the least you need —
the user sees this list when they install.

Some names are deliberately reserved and rejected at install time:
`wallet:sign`, `agents:delete`, `vault:read`, `vault:write`, `notifications`.
An addon that needs one of these isn't ready to ship yet — talk to us rather
than routing around it.

**`id` must equal the directory name**, match `^[a-z][a-z0-9-]{1,40}$`, and
`version` must be valid semver.

## Going further

- A **main-process half** (`main/index.js`) is **not currently available to
  third-party addons.** Main-process code runs with the same access as MosAIc
  itself and isn't covered by the permission model, so an addon declaring it is
  rejected at install. Everything in this example, and most of what an addon
  needs, works from the renderer.
- **Larger worked examples** live in the
  [`mosaic-addons`](https://github.com/hypercycle-development/mosaic-addons)
  repository. HyperInsight is a full addon and worth reading, with one caveat:
  it declares a `main.entry`, which it can because it holds the single
  first-party slot in the allowlist. Copying that part will get a submission
  rejected — read it for the renderer side.
- **Publishing**: addons are distributed from `mosaic-addons`, one directory
  per addon, as a reviewed catalogue. Open a pull request adding
  `addons/<your-id>/`; submissions are assessed from the diff. See its
  [CONTRIBUTING guide](https://github.com/hypercycle-development/mosaic-addons/blob/main/CONTRIBUTING.md).
  Building and installing unpacked, as above, stays the right route while you
  develop and for anything you only want to run yourself — in a development
  build, or a packaged one started with `MOSAIC_ADDON_DEV=1`.
