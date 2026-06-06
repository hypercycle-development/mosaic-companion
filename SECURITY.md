# Security Notice — Stargate Module

## Exposed Personal Infrastructure in `stargate-module` branch

**Severity:** Medium  
**Scope:** Personal HyperAIbox / Merkelizer node information leaked into source code  
**Affected Branch:** `stargate-module` (all commits prior to fix)  
**Fixed in:** see commit hash after merge  

---

## Summary

Three hard-coded values referencing the author's personal infrastructure were present in source files on the `stargate-module` branch.  Anyone cloning or pulling this branch before the fix would see the author's private HyperAIbox node list, IP addresses, and ANFE license IDs in the **HyperCycle Nodes** column of the Kanban Dashboard and related Stargate panels.

### Leaked Data
| Value | Location | What It Exposed |
|---|---|---|
| `YOUR_FLEET_REGISTRY_URL | `src/services/stargate/FleetDiscoveryService.ts:56` | Public fleet registry containing author&apos;s HyperAIbox node list (names, API hosts, ports, ANFE licenses) |
| `http://YOUR_HYPERCYCLE_NODE_IP:8003` | `src/components/stargate/NodeFactoryTrackerPanel.tsx:77` | Author&apos;s Merkelizer / CBNO Node Manager API endpoint |
| `http://YOUR_HYPERCYCLE_NODE_IP:8003/` | `plugins/stargate-pool/renderer/StargatePoolView.tsx:448` | Same endpoint, shown as fallback in Stargate Pool panel |

---

## Impact

- **Fresh installs** of the app (from the affected branch) would automatically load and display the author's private HyperAIbox fleet in the Dashboard — without the end user configuring anything.
- **Node names, IP addresses, ANFE license IDs, and compute grades** were visible to anyone who ran the app.
- **No authentication required** — the fleet registry Gist was public, and the Merkelizer endpoint was reachable over plain HTTP.
- **Operational risk:** Node Manager queries were being sent to the author's server from every fresh install.

---

## Fix Applied

### 1. `src/services/stargate/FleetDiscoveryService.ts`
- Removed hard-coded Gist URL (`DEFAULT_REGISTRY_URL = ''`).
- `loadFleetRegistry()` now falls back to the user's **locally-configured Hypercycle Nodes** (Settings → Hypercycle Nodes) instead of fetching a public Gist.
- If neither a registry URL nor local nodes are configured, returns an empty array.

### 2. `src/components/stargate/NodeFactoryTrackerPanel.tsx`
- Removed hard-coded IP (`DEFAULT_API_BASE = ''`).
- Added an editable **"Merkelizer / Node Manager API Base"** field in the Settings panel, with a warning about using someone else's endpoint.
- Added a guard in `checkLicense()`: if no API base is configured, returns a clear error message instead of silently failing or calling an undefined host.

### 3. `plugins/stargate-pool/renderer/StargatePoolView.tsx`
- Removed hard-coded fallback IP. Now shows a configuration hint when `VITE_MERKELIZER_URL_MAINNET` is not set.

### 4. `src/components/KanbanDashboard.tsx`
- Added a security comment explaining the per-user source of fleet data.

---

## Immediate Actions for Author

> **If you are the person whose infrastructure was leaked:**

1. **Assume the IP `YOUR_HYPERCYCLE_NODE_IP` is known.**  Anyone who cloned the repo before the fix has it in their local git history.
2. **Rotate / restrict the Merkelizer endpoint:**
   - Change the listening port (e.g., from `8003` to a non-default port).
   - Restrict inbound access to your Tailscale/VPN IP range.
   - Or terminate the EC2 instance and spin up a new one (new IP).
3. **Rotate the fleet registry Gist:**
   - Delete or make private the old Gist at `gist.github.com/YOUR_GITHUB_USERNAME/49937...`.
   - If you still need a shared fleet registry, create a new one and distribute it privately to trusted peers.
4. **Review access logs** on `YOUR_HYPERCYCLE_NODE_IP:8003` for unexpected requests.

---

## Immediate Actions for All Users

> **If you cloned the `stargate-module` branch before this fix:**

1. **Pull the latest commit** containing the fix (see top of this file).
2. **Delete any cached fleet data** from the app's localStorage:
   - `fleet_registry_url`
   - `fleet_registry_nodes`
   - `node_factory_tracker_settings`
3. **Configure your own nodes:**
   - Go to **Settings → Hypercycle Nodes** and add your own HyperAIbox / Node Manager details.
   - Go to **Node Factory Ops → Settings** and enter your own Merkelizer API base URL.

---

## Prevention

To prevent this class of leak in future commits:

1. **Never commit personal infrastructure URLs, IPs, or API keys.**  Use environment variables (`.env` files) that are `.gitignore`d, or runtime configuration via the app's Settings UI.
2. **Always default to empty / no-op values** in shared source code.  If a service needs an endpoint to function, leave the default blank and show a setup prompt in the UI.
3. **Use `git-secrets` or `secret-scanner` in CI** to catch patterns like IP addresses, Gist URLs, and API endpoints before they reach the remote.
4. **Code review checklist:** Any PR touching Stargate / HyperCycle / Node Factory panels should be checked for hardcoded IPs, registry URLs, or license data.

---

## Verification

After applying the fix, confirm no leaked values remain in the working tree:

```bash
grep -r "18\.216\.251\.149" src/ plugins/ || echo "Clean — no leaked IP found"
grep -r "YOUR_FLEET_REGISTRY_GIST_ID" src/ plugins/ || echo "Clean — no leaked Gist found"
grep -r "YOUR_GITHUB_USERNAME.*gist" src/ plugins/ || echo "Clean — no leaked Gist author found"
```

Expected output:
```
Clean — no leaked IP found
Clean — no leaked Gist found
Clean — no leaked Gist author found
```

---

*This notice was generated as part of the security fix on the `stargate-module` branch.*
