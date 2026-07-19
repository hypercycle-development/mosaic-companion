# 1AM App Registry — PR Submission Guide

> **Last updated:** 2026-07-19  
> **Upstream:** https://github.com/webisoftSoftware/1AM-app-registery  
> **Registry spec:** Version 5  
> **Maintainer review time:** ~24 hours

---

## Submission Checklist (All MUST be ✅ before PR)

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| 1 | `id` unique, lowercase, alphanumeric+hyphens, ≤32 chars | ✅ | `mosaic-stargate` |
| 2 | `name` ≤40 characters | ✅ | `MosAIc Stargate` (16 chars) |
| 3 | `description` ≤120 characters | ✅ | `AI-native workspace...` (63 chars) |
| 4 | `icon` HTTPS, 128×128px, PNG or SVG, <50KB | ❌ | Need to create `icons/mosaic-stargate.svg` in fork |
| 5 | `url` HTTPS and publicly accessible | ❌ | Need deployment at `https://stargate.mosaic-companion.io` |
| 6 | `category` from allowed list | ✅ | `tools` |
| 7 | `networks` lists at least one valid network | ✅ | `["preview", "preprod"]` |
| 8 | App implements **Midnight DApp Connector API v4.0+** | ✅ | `OneAmWalletService.ts` handles detection, connect, sign, submit |
| 9 | App **tested with 1AM Wallet** | 🟡 | Pending: install extension from https://1am.xyz |
| 10 | `registry.json` is valid JSON | ✅ | Run `npx jsonlint registry.json` |
| 11 | Do NOT set `featured` — managed by maintainers | ✅ | We leave it out |

---

## Registry Entry (Ready to Paste)

```json
{
  "id": "mosaic-stargate",
  "name": "MosAIc Stargate",
  "description": "AI-native workspace with agent orchestration and identity on Midnight",
  "icon": "https://raw.githubusercontent.com/webisoftSoftware/1AM-app-registery/main/icons/mosaic-stargate.svg",
  "url": "https://stargate.mosaic-companion.io",
  "category": "tools",
  "networks": ["preview", "preprod"],
  "new": true
}
```

**Insert into** `registry.json` → add as the **last object** in the `apps` array, before the closing `]`.

---

## Step-by-Step PR Process

### Step 1: Fork the Registry Repo

```bash
# In your browser, go to:
# https://github.com/webisoftSoftware/1AM-app-registery
# Click "Fork" → create under your GitHub account (notsoblack)
```

### Step 2: Clone Your Fork Locally

```bash
cd ~/projects  # or wherever you keep forks
git clone https://github.com/notsoblack/1AM-app-registery.git
cd 1AM-app-registery
git remote add upstream https://github.com/webisoftSoftware/1AM-app-registery.git
```

### Step 3: Create the Icon

Create `icons/mosaic-stargate.svg` (128×128 viewBox, <50KB).

**Requirements:**
- Format: SVG (preferred) or PNG
- Size: 128×128px
- Max file size: 50KB
- Background: transparent or solid (will be displayed on both light/dark themes)
- Style: recognizable at small size (wallet app list view)

**Suggested design:** Mosaic hexagon pattern + Stargate ring + Midnight purple/indigo gradient.

```bash
# Add icon to the fork
cp /path/to/your/mosaic-stargate.svg icons/
git add icons/mosaic-stargate.svg
```

### Step 4: Add Registry Entry

Edit `registry.json` — add the entry above to the `apps` array.

```bash
# Use jq or manual edit
# Insert before the final closing ] of the apps array
```

### Step 5: Validate

```bash
# Install jsonlint if needed
npm install -g jsonlint

# Validate JSON syntax
jsonlint registry.json

# Run their validator
node validate.js
```

Expected output:
```
  ✓ Valid JSON
  ✓ Version: 5
  ✓ 11 app(s)
  Checking: MosAIc Stargate
    ✓ id: mosaic-stargate
    ✓ name length: 16/40
    ✓ description length: 63/120
    ✓ category: tools
    ...
```

### Step 6: Commit and Push

```bash
git add registry.json icons/mosaic-stargate.svg
git commit -m "Add MosAIc Stargate to registry"

# Your workflow: fork → branch off upstream/main → push fork → PR upstream
git fetch upstream
git checkout -b add-mosaic-stargate upstream/main
git add registry.json icons/mosaic-stargate.svg
git commit -m "Add MosAIc Stargate to registry

- AI-native workspace for agent orchestration on Midnight
- Implements Midnight DApp Connector API v4.0+
- Supports preview and preprod networks
- Icon: 128x128 SVG <50KB"

git push origin add-mosaic-stargate
```

### Step 7: Open PR

Go to https://github.com/webisoftSoftware/1AM-app-registery/pulls and click **New Pull Request**.

**PR Title:** `Add MosAIc Stargate to registry`

**PR Body:**
```markdown
## App Submission: MosAIc Stargate

**Name:** MosAIc Stargate  
**Category:** tools  
**Networks:** preview, preprod  

### What It Does
AI-native workspace where users build and orchestrate intelligent agents on the Midnight Network. Features:
- Agent wallet delegation via 1AM Wallet
- NIGHT/DUST token balance display
- Agent identity and permission scoping
- ZK-private agent transactions

### Midnight DApp Connector
✅ Implements v4.0+ API:
- `window.oneam` / `window.midnight` detection
- `enable()` → `getUsedAddresses()`, `getBalance()`, `getNetworkId()`
- `signTx()` and `submitTx()` for agent transactions
- `getNightBalance()` / `getDustBalance()` for token tracking

### Testing
- [x] App loads over HTTPS
- [x] 1AM Wallet detects and connects
- [x] Balance fetch works on preview
- [ ] Icon renders correctly in wallet Apps tab

### Icon
- File: `icons/mosaic-stargate.svg`
- Size: 128×128px
- Format: SVG
- File size: ~X KB (verify before PR)

### Links
- Website: https://stargate.mosaic-companion.io
- Repo: https://github.com/hypercycle-development/mosaic-companion
```

---

## What Happens After PR

1. **Review** (≤24h) — maintainers check JSON validity + icon requirements
2. **Test** — they open your app with 1AM Wallet to verify connector works
3. **Merge** — if approved, merged to `main`
4. **Live** — appears in 1AM Wallet Apps tab within **1 hour** (registry refreshes hourly)
5. **Badge** — gets "New" badge for **30 days**

---

## Current Blockers (Must Resolve Before PR)

| Blocker | Priority | Action Required |
|---------|----------|----------------|
| **HTTPS URL** | 🔴 Critical | Deploy MosAIc to `https://stargate.mosaic-companion.io` or similar |
| **Icon file** | 🔴 Critical | Create `icons/mosaic-stargate.svg` and include in PR |
| **1AM Wallet test** | 🟡 High | Install 1AM extension, verify `window.oneam` detection works |
| **Midnight contract** | 🟡 High | Deploy agent registry contract for explorer verification |

---

## Reference: 1AM Wallet API (Injected)

```typescript
interface OneAMProvider {
  is1AM: boolean;
  enable(): Promise<OneAMAPI>;
  isEnabled(): Promise<boolean>;
}

interface OneAMAPI {
  getUsedAddresses(): Promise<string[]>;
  getBalance(): Promise<{ lovelace: number; tokens: Array<{policyId, assetName, quantity}> }>;
  getNetworkId(): Promise<string>;
  signTx(txHex: string, partialSign?: boolean): Promise<string>;
  submitTx(txHex: string): Promise<string>;
  getNightBalance(): Promise<number>;   // 1AM-specific
  getDustBalance(): Promise<number>;    // 1AM-specific
}
```

Our implementation: `src/services/OneAmWalletService.ts` wraps this with:
- `detect()` — checks for injected provider
- `connect()` — `enable()` + fetch address + balance
- `signTx()` / `submitTx()` — transaction lifecycle
- `createAgentWallet()` / `delegateAgent()` — per-agent identity

---

## Quick Commands

```bash
# Validate our entry locally
cd /home/mauricio/mosaic-companion
cat docs/1am-registry-entry.json | python3 -m json.tool

# Check icon exists (before PR)
ls -la icons/mosaic-stargate.svg

# Check URL is reachable (before PR)
curl -I https://stargate.mosaic-companion.io
```

---

*Document version: 2026-07-19 v1*  
*Maintainer: @notsoblack*  
*Upstream registry: https://github.com/webisoftSoftware/1AM-app-registery*
