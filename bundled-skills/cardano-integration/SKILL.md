---
name: cardano-integration
description: Cardano integration fundamentals for Mosaic-Companion — eUTxO, wallet pairing, NFT verification, Koios/Blockfrost APIs, CIP standards, DePIN node operations, and revenue opportunities with IAGON.
trigger: When working with Cardano blockchain features in Mosaic-Companion, NFT verification, wallet connectors, policy ID checks, IAGON storage/compute nodes, DePIN revenue, or Fireblocks SDK integration.
---

# Cardano Integration Skill

## Overview

This skill covers all Cardano integration patterns used in the Mosaic-Companion Electron app. It is designed to be developed and tested in `~/Cardano/` and selectively ported into the main app.

## Architecture Patterns

### 0. Wallet Bridge Options (CRITICAL — read before implementing)

Desktop-to-mobile wallet bridges have fundamental topology constraints. Read `references/tokeo-wallet-architecture.md` for the full decision matrix before choosing an approach.

**Summary:** The HTTP callback server (Option A) is pragmatic for same-network setups but is **brittle across WiFi networks, NAT, firewalls, and mobile data**. It should not be treated as the only or permanent solution. Document the limitation clearly for users.

### 1. Wallet Pairing Flow (QR-based, LAN-only)

Used for desktop-to-mobile wallet connections when no browser extension is available.

```
Desktop (Electron)                    Mobile (Tokeo)
    |                                       |
    |  1. Create session + QR code          |
    |     (sessionId, callbackUrl)            |
    |  2. Display QR                          |
    | ------------------->                    |
    |                                       |  3. Scan QR
    |                                       |  4. Connect wallet
    |                                       |  5. Sign proof
    |  6. POST /callback                      |
    | <-------------------                    |
    |     {sessionId, address, signature}   |
    |  7. Complete session                    |
    |  8. Verify NFTs via Koios             |
```

**Key files:**
- `electron/integrations/cardano/TokeoQRBridge.ts` — Session manager + HTTP callback server
- `electron/integrations/cardano/ipcHandlers.ts` — IPC bridge renderer <-> main
- `src/components/AdaPortalPanel.tsx` — UI for QR modal, polling, verification display

### 1b. Lace Browser Wallet Button (CIP-30 Real-Browser Bridge + Firefox Fallback)

Desktop app UI offers a single "LACE" button. The backend spawns a **real Chrome/Brave/Edge browser process** pointing to a temporary local HTTP server so that MV3 extensions inject correctly. Firefox uses an external-process bridge because Firefox extensions cannot run inside Chromium.

**CRITICAL PITFALL — `data:` URLs are incompatible with MV3 extensions:**
The old WebView bridge loaded a `data:text/html` URL into a hidden `BrowserWindow`. Lace (and other Manifest-V3 extensions) declare `content_scripts.matches` as `["http://*/*", "https://*/*", "file://*/*"]`. `data:` is **explicitly excluded**, so `window.cardano` is undefined and the bridge can never enable the wallet. The fix is to serve the bridge page over `http://127.0.0.1:PORT`.

**CRITICAL PITFALL — Bridge page inline `onclick` breaks under quote-escaping:**
TypeScript template literals generating HTML with `onclick="connectWallet(\''+key+'\')"` produce JavaScript syntax errors when parsed by Chrome because the backslash-escaped single quotes become literal backslashes in the rendered HTML. Use `document.createElement('button')` + `addEventListener('click', () => connectWallet(key))` instead. See `references/bridge-template-pitfalls.md`.

**CRITICAL PITFALL — `<\/script>` in template literals breaks HTML parsing:**
Inside a TypeScript template literal generating an HTML page, `<\/script>` (backslash-escaped closing tag) is NOT recognized by the browser's HTML parser as a `</script>` close tag. The script block never terminates, and everything after it becomes JavaScript, yielding `SyntaxError: Unexpected token '<'`. Use raw `</script>` — the template literal boundary is a backtick, not HTML, so no escaping is needed. See `references/bridge-template-pitfalls.md`.

**Flow:**
```
UI "LACE" button click
  → detectWallets() (filesystem scan of Chrome extension dirs + Firefox install check)
  → if Lace found in Chrome: connectWallet('lace') (spawn real Chrome on http://127.0.0.1:PORT)
  → else if Chrome fails but Firefox installed: connectWallet('lace') (Firefox bridge)
  → else: legacy WebView bridge as last resort
  → setConnected(true), setAddress(result.address)
  → tokeoVerifyCollection(policyIds) (Koios on-chain NFT check)
  → showNotification(success | error)
```

**Chrome/Brave/Edge bridge (`CIP30ChromeBridge.ts`):**
1. Find free port (30000–40000).
2. Start temp `http.Server` serving inline bridge HTML.
3. Spawn Chrome with `--app=http://127.0.0.1:PORT` (or `--new-window`).
4. Bridge page enumerates `window.cardano`, calls `.enable()`, POSTs `{address, rewardAddress, networkId}` to `/callback`.
5. Electron resolves promise, kills process/tab, shuts down server.
6. 120-second timeout with auto-cleanup on failure.

**Firefox bridge:** Spawns actual Firefox process with a bridge page, bridge page calls `wallet.enable()`, POSTs address back to a temporary local HTTP server (see `references/cip30-firefox-bridge.md`).

**Fallback chain in `ipcHandlers.ts`:**
1. Real Chrome spawn (`connectChromeWallet`)
2. Legacy WebView bridge (`bridgeConnectWallet`)
3. Firefox external process (`connectFirefoxWallet`) — only if `walletKey === 'lace'`

**Key files:**
- `src/components/AdaPortalPanel.tsx` — "LACE" button handler (~line 938)
- `electron/integrations/cardano/CIP30WebViewBridge.ts` — Chrome/Chromium/Brave/Edge bridge window + extension loader
- `electron/integrations/cardano/CIP30FirefoxBridge.ts` — Firefox process spawner + callback server
- `electron/integrations/cardano/ipcHandlers.ts` — `cardano:detectWallets` (aggregates both), `cardano:connectWallet` (Chrome → Firefox fallback)

See `references/lace-ui-integration.md` for the exact component code and `templates/lace-button-handler.ts` for a reusable handler snippet.
See `references/cip30-firefox-bridge.md` for Firefox-specific internals.

### 2. Callback Host Discovery

The desktop HTTP server must be reachable from the mobile device. Never hardcode `localhost`.

```typescript
function getCallbackHost(): string {
  const interfaces = os.networkInterfaces();
  let tailscaleIp: string | null = null;
  let lanIp: string | null = null;

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        if (addr.address.startsWith('100.')) {
          tailscaleIp = addr.address; // Tailscale mesh (100.64.0.0/10)
        } else if (
          addr.address.startsWith('192.168.') ||
          addr.address.startsWith('10.') ||
          addr.address.startsWith('172.16.')
        ) {
          lanIp = addr.address; // Private LAN
        }
      }
    }
  }

  // Priority: LAN > Tailscale > localhost
  // Rationale: Mobile devices on the same WiFi can always reach LAN IPs.
  // Tailscale IPs (100.x) only work if the mobile device is also on the Tailscale mesh.
  return lanIp || tailscaleIp || 'localhost';
}
```

**Critical:** Bind server to `'0.0.0.0'` to accept external connections:
```typescript
server.listen(preferredPort, '0.0.0.0', () => { ... });
```

### 3. NFT Verification (Koios)

```typescript
// Policy IDs for verified collections
const DEFAULT_ACCESS_POLICIES = [
  'a222abf06e562a5acc7d5bb3bec3d0b29414082e6fe5650026f92d46', // HPEC DAO PASS
  '454fb57214730cb34f83d7b377308a76ab6e7140ea634a7fc63affa5', // CMHPEC DAO PASS
  'bc963a07e32da4d22b77c8cba7ab9f3df6241f37d7bfc9b0deb48f65', // HyperDegens
];

interface NFTVerificationResult {
  hasAccess: boolean;
  matchedPolicies: string[];
  assets: any[];
  error?: string;
}
```

**Address validation:** Accept both `addr` (base/enterprise) and `stake` (reward) prefixes.
**Quantity filter:** Use `parseInt(quantity, 10) > 0` (not `<= 1`) to include all valid NFTs.

### 4. CIP Standards Reference

| Standard | Purpose |
|----------|---------|
| CIP-30 | dApp connector API (Eternl, Lace, Yoroi) |
| CIP-08 | Message signing (for QR callback proofs) |
| CIP-25 | NFT metadata standard |
| CIP-27 | Royalties metadata |

## Verified Collections (Seeded)

| Collection | Policy ID | Status |
|-----------|-----------|--------|
| HPEC DAO PASS | `a222ab...6f92d46` | ✅ Verified |
| CMHPEC DAO PASS | `454fb5...63affa5` | ✅ Verified |
| HyperDegens | `bc963a...b48f65` | ✅ Verified |

## API Endpoints (Koios Mainnet)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/address_info` | POST | Get address UTxOs |
| `/api/v1/address_assets` | POST | Get address asset list |
| `/api/v1/asset_info` | POST | Get asset details |

## File Locations

**Reference implementation:** `~/Cardano/integration-examples/`
**Mosaic integration:** `~/mosaic-companion/electron/integrations/cardano/`
**UI components:** `~/mosaic-companion/src/components/AdaPortalPanel.tsx`
**Services:** `~/mosaic-companion/src/services/AdaPortal/`

## External Cardano AI Skill Packs

Third-party skill packs specialize in Cardano CLI operations, smart contracts, and
local dev environments. When Hermes does not have built-in coverage for a Cardano
task, install a focused external skill rather than generating ad-hoc commands.

### Known high-quality pack: `cardano-agent-skills` (Flux Point Studios)

**25 skills, MIT license.** Covers the full Cardano development lifecycle with
self-calibrating CLI detection, Docker fallbacks, and safety-by-design patterns.

Install via:
```bash
hermes skills install https://github.com/Flux-Point-Studios/cardano-agent-skills
```

**Patterns worth adopting into our own integration (see
`references/flux-point-cardano-skills.md` for full catalog and provider diagrams):**

| Pattern | What it is | How it applies to Mosaic |
|---------|-----------|-------------------------|
| Playbook + Operator Split | Risky ops split into guidance skill (safe) and manual-only execution skill (operator). `disable-model-invocation: true` on the operator. | Apply to wallet tx signing, stake delegation, and NFT mint flows to prevent accidental autonomous execution. |
| Self-Calibrating Context | Skills declare `!command` in frontmatter context to detect actual CLI version before advising. | Use `!cardano-cli version` in skill context to auto-detect era-prefixed (Conway) vs legacy syntax. |
| Provider Selection Layer | Fail-closed hierarchy: MCP (opt) → Koios → CLI + node → Docker (fallback). Hard rules, not suggestions. | Formalize our Koios → CLI fallback into explicit rules instead of ad-hoc branching. |
| Docker Fallback Wrapper | Shell wrapper that tries native binary, then auto-falls back to official Docker image. | Add to any local scripts in `~/Cardano/` that call `cardano-cli` or `aiken`. See `templates/docker-fallback-wrapper.sh`. |
| Token-Efficient Loading | SKILL.md body stays under 500 lines; reference files load on demand. | Audit our SKILL.md and split long sections into `references/` files. |

**Key external skills relevant to Mosaic:**

| Skill | When to use |
|-------|-------------|
| `koios-agent-wallet` | Key-based agent wallets with MeshJS + KoiosProvider: generate, send, stake, sign+submit dApp txs. No mnemonic in agent runtime. Uses CSL dual-key signing for staking. |
| `cardano-devnet-in-a-box` | One-command local rehearsal stack: cardano-node + hydra + ogmios + kupo. Deterministic green/red testing before mainnet. |
| `aiken-smart-contracts` | Aiken workflows: validators, building, blueprints, .plutus generation. |
| `meshjs-cardano` | MeshJS patterns: tx building, CIP-30 connectors, wallet state management. |
| `cardano-cli-doctor` | Diagnose installed CLI version, produce compatibility report before generating commands. |
| `plutus-v3-conway` | Plutus V3 migration guide: unified context, governance scripts, V2→V3 migration. |
| `hydra-head` | Hydra L2 best practices: setup, keys, peers, lifecycle. For L2 scaling if Mosaic adopts Hydra. |
| `aiken-dex-security-audit` | Security audit playbook for Aiken DEX contracts with severity guide, invariants checklist, and report template. |

See `references/flux-point-cardano-skills.md` for the complete 25-skill catalog,
provider selection rules, trust boundary diagram, and version compatibility.

## Templates (in skill)

| Template | Purpose |
|----------|---------|
| `templates/docker-fallback-wrapper.sh` | Docker fallback starter script for any Cardano CLI tool (auto-detects native binary, falls back to official image) |
| `templates/midday-sdk-client.ts` | Midday SDK client setup — seed wallet, local devnet, load/deploy/call/read lifecycle |
| `templates/address-utils.ts` | CBOR hex → bech32 conversion with `@emurgo/cardano-serialization-lib-asmjs` — NEW 2026-05-14 |
| `templates/verified-nft-filter.ts` | Verified-only NFT filtering — two-point filter (assets + groups) to display only allowed collections. |
| `templates/lace-button-handler.ts` | Reusable React button + async handler for Lace CIP-30 connect + NFT verify |
| `templates/qr-pairing.ts` | Complete `TokeoQRSessionManager` class |
| `templates/koios-client.ts` | Koios API client for NFT/asset queries |
| `templates/cip30-chrome-bridge-reference.ts` | Production `CIP30ChromeBridge.ts` reference (real-browser spawn, asset extraction, temp HTTP server) |
| `templates/ipc-handlers-reference.ts` | Production `ipcHandlers.ts` reference (fallback chain, Chrome→WebView→Firefox) |
| `templates/cip30-connector.ts` | CIP-30 browser wallet connector (Eternl, Lace, Yoroi) |
| `templates/cip30-real-browser-bridge.ts` | Real-browser bridge template (Chrome/Brave/Edge) for MV3 compatibility |
| `templates/cip30-webview-bridge.ts` | Legacy WebView bridge — backward compat only, NOT for MV3 wallets |
| `templates/nft-verifier.ts` | NFT ownership verifier with policy ID matching |
| `templates/electron-fetch.ts` | Protocol-aware fetch helper (handles `file://` vs `http://`) |
| `templates/wallet-integration.ts` | End-to-end wallet integration example |

## References (in skill)

| Reference | Purpose |
|-----------|---------|
| `references/midnight-network.md` | **Midnight Network quick reference** — zkSNARKs L1, Compact language, dual-token economics (NIGHT/DUST), Midday SDK patterns, devnet tooling, critical pitfalls |
| `references/midnight-mcp-server.md` | **Midnight MCP Server** — `midnight-mcp` v0.2.x deep analysis: 29 tools, hosted/local architecture, Hermes integration config, sampling requirements, tool catalog |
| `references/midnight-hypercycle-opportunities.md` | **Midnight + HyperCycle + Mosaic synergy** — 5 concrete win-win projects: Private AI Compute Marketplace, ZK Data Labeling, Model Inference API, Cross-Chain Verification Hub, Agent Orchestration |
| `references/mosaic-midnight-integration-test-protocol.md` | **Mosaic-Companion × midnight-mcp integration test protocol** — exact JSON-RPC stdio commands, expected `tools/list` size (28), ChromaDB fallback behavior, type-check gates, global install pattern |
| `references/policy-ids.md` | Verified NFT policy IDs for HPEC / CMHPEC / HyperDegens |
| `references/debugging.md` | 8-phase debugging methodology for Cardano features |
| `references/verified-nft-filtering.md` | **Verified-only NFT display** — filter assets to only verified collections before rendering, two-point filter pattern (assets + groups). |
| `references/tokeo-wallet-architecture.md` | Desktop<->Mobile bridge options and trade-offs |
| `references/cip30-firefox-bridge.md` | **Firefox extension bridge** — spawn Firefox process, temporary HTTP callback server |
| `references/cip30-webview-bridge.md` | Electron WebView bridge setup, extension loading, IPC wiring |
| `references/lace-ui-integration.md` | UI button wiring for Stargate Start tab (AdaPortalPanel.tsx) |
| `references/lace-asset-cards.md` | Blue NFT asset collection card rendering after wallet connect |
| `references/nft-collection-cards.md` | **Full NFT Collection Card system** — React components, IPFS images, infrastructure panel, metadata modal |
| `references/mv3-extension-url-matches.md` | **MV3 `content_scripts.matches` pitfall** — why `data:` URLs fail and how real-browser bridges fix it |
| `references/bridge-template-pitfalls.md` | **Bridge page template pitfalls** — `\x3c/script\x3e` syntax, `onclick` escaping, Chrome profile locks, HTML entities in TSX (`&gt;`) |
| `references/chrome-bridge-race-condition.md` | **CIP30ChromeBridge race condition** — `detect` payload resolves before `connect`, leaving address/assets undefined. Fix: guard resolution with `result.address` |
| `references/asset-data-chain.md` | Five-stage asset pipeline from bridge page → Koios → UI render |
| `references/cbor-address-koios-pitfall.md` | **CBOR hex address → bech32** — `api.getUsedAddresses()` returns hex bytes, but Koios requires bech32 (`addr1...`). Includes `@emurgo/cardano-serialization-lib-asmjs` integration pattern and esbuild external config. |
| `references/koios-v1-flat-array-pitfall.md` | **Koios v1 flat-array format** — `/address_assets` no longer wraps results in `{asset_list: [...]}`. Parser must handle flat array directly. |
| `references/esbuild-stale-build-pitfall.md` | **Stale esbuild artifacts** — when main.js contains old symbols (`api.getBalance()`) that no longer exist in source. Clean rebuild required: `rm -rf dist/ && npm run build:electron && npm run build`. |
| `references/node-factory-license-mapping.md` | **License ID prefix → Node Factory multiplier table** — first 3 digits of ETH/BASE license IDs map to configurable levels (e.g. prefix `225` = Level 11 = 2 NFs). Used to derive `nodeFactories` count from raw license list. |
| `references/nft-card-label-conventions.md` | **NFT Collection Card UI conventions** — subtitle must read `'NFT'` (not projectType); `cHYPC Pool` must use `infrastructure.activeNodes` (not `rewardPoolHYPC`). |
| `references/cardano-depin-revenue-synthesis.md` | **DePIN revenue research** — IAGON storage/compute node setup, Fireblocks Cardano Raw SDK architecture, tier system, staking requirements, ARM64 feasibility, "Sign-and-Store" edge-native custody+storage farm concept. |
## Debugging Checklist

1. Is the callback server bound to `0.0.0.0`? (not `localhost` or `127.0.0.1`)
2. Is `getCallbackHost()` returning an external IP (Tailscale/LAN)?
3. Is the mobile device on the same network / Tailscale mesh?
4. Is the firewall allowing inbound on the callback port (9876+)?
5. Does the QR payload include `policyIds` array?
6. Is address validation accepting `stake1...` addresses?
7. Is quantity filter `> 0` instead of `<= 1`?
8. Are policy IDs lowercased and trimmed before comparison?

## Critical Data Flow — Asset Chain from Bridge to UI

When connecting a browser wallet via the real-browser bridge, assets must travel through **five** stages. If any stage drops or ignores the `assets[]` field, the UI shows "Connected" with 0 assets and NFT Collection Cards never render.

  ① `CIP30ChromeBridge.ts` bridge page — extracts assets from `api.getUtxos()` (or Koios fallback)
  ② POSTs `{success: true, assets: [...]}` to `/callback` on the temp HTTP server
  ③ `ipcHandlers.ts` `connectWallet` receives result → stores into `tokeoState.assets`
  ④ Renderer `connectWallet()` stores `data.assets` into `session.assets`
  ⑤ `NFTCollectionCards.tsx` renders groups from `session.assets`

**Pitfall: Stage 3 drops assets.** `TokeoConnectionState` originally lacked an `assets` field, so after connect the main process had no memory of assets. `getWalletAssets` then always returned `[]`.

**Pitfall: Stage 4 swallows assets.** The renderer service set `session.assets = []` ignoring `data.assets` from the IPC response. It also called `getBalance()` (IPC doesn't exist) instead of `getWalletAssets()`.

**Fix pattern:**
1. Extend `TokeoConnectionState` with `assets?: Asset[]`
2. In all three connect paths (Chrome/Legacy/Firefox), assign `tokeoState = { ..., assets }`
3. In renderer `connectWallet`, set `session.assets = data.assets || []`
4. In renderer `fetchWalletData`, call `window.electronAPI.cardano.getWalletAssets()`
5. Return `tokeoState.assets || []` from `cardano:getWalletAssets` handler

See `references/asset-data-chain.md` for the full diagram, file line references, and verification commands.

## Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| Cards never render after LACE connect | Asset data-chain broken at stage 3 or 4 | Follow the five-stage checklist above |
| `0 assets` shown even though wallet has NFTs | Renderer swallowed `data.assets` or `getBalance()` IPC missing | Patch `CardanoWalletService.connectWallet` and `fetchWalletData` per `references/asset-data-chain.md` |
| `npm run build` doesn't pick up main-process changes | Vite only builds renderer; esbuild builds main | Run `npm run build:electron` after ANY `electron/` change |
| `api.getBalance()` in compiled output but not in source | Stale `dist/main/main.js` from previous esbuild + cached JS artifact | `rm -rf dist/ && npm run build:electron && npm run build` |
| **Cards never render after LACE connect ("Fetching assets via Koios" appears but "Koios returned N" NEVER appears)** | Koios v1 returns a **flat array** directly; parser incorrectly expects `data[0].asset_list`. Returns `[]` silently. | Update `fetchAddressAssets()` to: `const data = await response.json(); if (!Array.isArray(data)) ...; return data;`. See `references/koios-v1-flat-array-pitfall.md`. |
| **Cards never render after LACE connect ("Fetching assets via Koios" appears but "Koios returned N" NEVER appears, address bech32 is correct but Koios curl returns non-empty)** | `api.getUsedAddresses()` returns CBOR hex bytes, but Koios `/address_assets` only accepts bech32 (`addr1...`). Hex addresses silently return `[]` | Install `@emurgo/cardano-serialization-lib-asmjs`, externalize it in esbuild, create `addressUtils.ts` with `toBech32Address()`, wrap Koios calls before `fetchAddressAssets()`. See `references/cbor-address-koios-pitfall.md`. |
| **Cards never render after LACE connect (no `assets` in callback)** | Chrome bridge `connectChromeWallet()` resolves on `detect` payload (which has no `address`/`assets`) before `connect` payload arrives | Guard resolution with `if (result && result.address)` in `CIP30ChromeBridge.ts` |
| `net::ERR_FILE_NOT_FOUND` on `/api/config` | Relative URL resolves to `file:///api/config` in Electron renderer | Use absolute `http://localhost:PORT/api/config` when `window.location.protocol === 'file:'` |
| `net::ERR_CONNECTION_REFUSED` on callback | Server bound to localhost instead of 0.0.0.0 | Bind server to `0.0.0.0` to accept external connections |
| `Maximum sessions reached` | Old sessions not cleaned up | Call `cleanupExpiredSessions()` before create |
| `Missing sessionId or address` | Mobile callback payload malformed | Verify JSON structure in mobile app |
| No NFTs found | Address prefix rejected or quantity filtered | Relax validation per checklist |
| Mobile cannot reach desktop | Firewall blocking inbound port | Open port 9876+ or use Tailscale mesh (100.x IPs) |
| Polling never detects connection | `tokeoCheckQR` returns wrong data shape | Ensure IPC handler returns `{success, data: {connected, address}}` |
| QR modal doesn't show | Missing `electronAPI.cardano` in preload | Register all cardano handlers in `preload.ts` |
| Build fails with TS error | Import path changed or type mismatch | Check `global.d.ts` matches preload exposed API |
| Chrome spawn exits code 21 | Stale `SingletonLock` in `~/.config/google-chrome/` pointing to dead PID | `rm -f ~/.config/google-chrome/SingletonLock SingletonCookie SingletonSocket`; safe to delete — recreated on next launch |
| **TS2345: type not assignable** | Firefox bridge returns `{name, key}` but Chrome array expects `{name, key, version}` | Add explicit type annotation: `const wallets: Array<{name: string; key: string; version: string}> = [...]` or cast in IPC handler |
| Firefox bridge never opens | Firefox not installed or not in PATH | Check `which firefox`; if missing, only Chrome bridge is available |
| Firefox bridge times out | Lace popup blocked or user didn't authorize | Ensure Firefox window is visible; user must click "Allow" in Lace popup |
| Firefox bridge: no address returned | `window.cardano` not injected in bridge page | Check Lace extension is enabled in Firefox; bridge page must load from `http://` (not `file://`) |
| **Bridge page: `Unexpected token '<'`** | `\x3c\/script\x3e` in TS template literal not recognized by HTML parser | Use raw `\x3c/script\x3e` (not `\x3c\/script\x3e`) inside template literals generating HTML pages |
| **Bridge page: `missing ) after argument list`** | Inline `onclick="connectWallet(...)"` quote escaping collapses across TS → HTML → JS layers | Use `document.createElement('button')` + `addEventListener('click', ...)` instead of inline `onclick` |
| **Old bridge code still running after edit** | Stale `dist/main/main.js` — only Vite build ran, not esbuild | `rm -rf dist/ && npm run build:electron && npm run build`; see `references/bridge-template-pitfalls.md` § "Stale Electron main-process build"

## Consolidated Skills

This umbrella skill absorbed the following narrower siblings. See `references/` and `scripts/` for their session-specific content:

| Absorbed Skill | Where its content lives | What it added |
|---|---|---|
| `meshjs-cardano` | (archived without support files — basic MeshJS patterns) | Transaction building, wallet connectors, script interactions |
| `koios-agent-wallet` | `scripts/koios-agent-wallet-*.js` | Key-based wallet generation, staking, and send-tx workflows with MeshJS + KoiosProvider |
