---
name: hydra-head-operator
description: "Execute Hydra operations: init, commit, open, close, fanout. Manual invoke only due to L1 state changes."
argument-hint: "<shell command>"
allowed-tools:
  - Bash(hydra-node:*)
  - Bash(hydra-tui:*)
  - Bash(curl:*)
  - Bash(docker:*)
  - Bash(cat:*)
  - Read
  - Write
disable-model-invocation: true
user-invocable: true
command-dispatch: tool
command-tool: exec
command-arg-mode: raw
context:
  - "!hydra-node --version 2>&1 | head -3"
  - "!hydra-node run --help 2>&1 | head -30"
metadata: {"openclaw":{"emoji":"\ud83d\uddef","requires":{"anyBins":["hydra-node","docker"],"bins":["curl"]},"install":[{"id":"brew","kind":"brew","formula":"colima docker docker-compose curl","bins":["colima","docker","docker-compose","curl"],"label":"Install Docker runtime (Colima) + Docker CLI + Compose + curl (brew)","os":["darwin","linux"]}],"homepage":"https://docs.openclaw.ai/tools/exec"}}
---

# hydra-head-operator

> **OPERATOR SKILL**: Executes Hydra Head operations that affect L1 state. Requires explicit human invocation.

## When to use
- When ready to start hydra-node, init head, commit funds, or close/fanout
- After reviewing guidance from `hydra-head`

## Operating rules (must follow)
- **Confirm network and scripts tx id before starting**
- Verify all peer configurations match
- **REQUIRE explicit confirmation before Init, Close, Fanout**
- Keep logs for debugging
- Test on devnet/preview before mainnet

## OpenClaw exec dispatch mode
This skill also functions as a **deterministic exec gateway** for OpenClaw: when you run the slash command, OpenClaw **bypasses the model** and forwards your arguments straight to the **Exec Tool** (`command-dispatch: tool`).

### Safety first: force approvals + allowlist mode
Before using as an operator, set Exec defaults for the session:
- `/exec host=gateway security=allowlist ask=on-miss`

### Allowlist-safe shortcut (recommended)
If your Exec allowlist is strict, allowlist **one** entrypoint and route everything through it:
- Allowlist: `~/Projects/**/cardano-agent-skills/scripts/oc-safe.sh` (adjust glob)
- Run:
  - `/hydra_head_operator ./scripts/oc-safe.sh hydra --help`
  - `/hydra_head_operator ./scripts/oc-safe.sh hydra gen-hydra-key --output-file hydra`
  - `/hydra_head_operator ./scripts/oc-safe.sh hydra-api 4001 head`

## Docker fallback mode
If `hydra-node` is not installed locally, use the wrapper script in this skill folder to run **hydra-node inside Docker**:

```bash
chmod +x {baseDir}/scripts/hydra-node.sh
{baseDir}/scripts/hydra-node.sh --help
```

Quick API probes (curl wrapper):
```bash
chmod +x {baseDir}/scripts/hydra-api.sh
{baseDir}/scripts/hydra-api.sh 4001 head
{baseDir}/scripts/hydra-api.sh 4001 metrics
```

## Pre-flight checklist
```
[ ] Network: ___________
[ ] Hydra scripts tx id for network
[ ] Cardano node accessible (socket or Blockfrost)
[ ] Cardano signing key ready
[ ] Hydra signing key generated
[ ] Peer configs exchanged (vkeys + addresses)
[ ] Contestation period agreed
```

## Execution workflow

### Step 1: Generate Hydra key (if needed)
```bash
hydra-node gen-hydra-key --output-file hydra
# Creates hydra.sk and hydra.vk
chmod 600 hydra.sk
```

### Step 2: Start hydra-node
```bash
hydra-node run \
  --node-id "participant-1" \
  --persistence-dir ./hydra-state \
  --cardano-signing-key cardano.sk \
  --hydra-signing-key hydra.sk \
  --hydra-verification-key peer1-hydra.vk \
  --hydra-verification-key peer2-hydra.vk \
  --cardano-verification-key peer1-cardano.vk \
  --cardano-verification-key peer2-cardano.vk \
  --peer "peer1-host:5001" \
  --peer "peer2-host:5001" \
  --api-host 0.0.0.0 \
  --api-port 4001 \
  --host 0.0.0.0 \
  --port 5001 \
  --testnet-magic 1 \
  --node-socket /path/to/node.socket \
  --hydra-scripts-tx-id <scripts-tx-id> \
  --contestation-period 120s \
  2>&1 | tee hydra-node.log
```

### Step 3: Verify connectivity
```bash
# Check peers connected
curl -s localhost:4001/peers | jq .

# Check head status
curl -s localhost:4001/status | jq .
```

### Step 4: Init head (REQUIRES CONFIRMATION)
```
⚠️ CONFIRM HEAD INIT ⚠️
Network: preprod
Participants: 3
Contestation period: 120s

Type 'init' to proceed:
```
```bash
# Via API
curl -X POST localhost:4001/init

# Or via hydra-tui
hydra-tui --connect localhost:4001
```

### Step 5: Commit funds
```bash
# Prepare UTxO to commit
cardano-cli conway query utxo \
  --address <your-addr> \
  --testnet-magic 1

# Commit via API
curl -X POST localhost:4001/commit \
  -H "Content-Type: application/json" \
  -d '{"utxo": {"<txid>#<index>": {...}}}'
```

### Step 6: Operate in head
```bash
# Submit L2 transactions through API
curl -X POST localhost:4001/submit \
  -H "Content-Type: application/json" \
  -d '{"transaction": "..."}'
```

### Step 7: Close head (REQUIRES CONFIRMATION)
```
⚠️ CONFIRM HEAD CLOSE ⚠️
This will begin contestation period (120s).
All parties must remain online to contest if needed.

Type 'close' to proceed:
```
```bash
curl -X POST localhost:4001/close
```

### Step 8: Fanout (after contestation)
```bash
# Wait for contestation period
# Then fanout
curl -X POST localhost:4001/fanout

# Verify L1 UTxOs
cardano-cli conway query utxo \
  --address <your-addr> \
  --testnet-magic 1
```

## Safety / key handling
- Never share hydra.sk or cardano.sk
- Keep persistence-dir backed up
- Monitor logs during contestation
- Ensure all parties can contest if needed

## References
- `hydra-head` (guidance skill)
- `hydra-head-troubleshooter` (if issues arise)
- `shared/PRINCIPLES.md`
- [hydra.family docs](https://hydra.family)
