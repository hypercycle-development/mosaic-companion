---
name: cardano-protocol-params
description: "Protocol parameters: fetch pparams, understand fees, min-UTxO, execution budgets. Read-only diagnostics."
allowed-tools:
  - Bash(cardano-cli:*)
  - Read
context:
  - "!cardano-cli version 2>&1 | head -5"
metadata: {"openclaw":{"emoji":"\ud83e\uddf0","requires":{"anyBins":["cardano-cli","docker"]},"install":[{"id":"brew","kind":"brew","formula":"colima docker docker-compose curl","bins":["colima","docker","docker-compose","curl"],"label":"Install Docker runtime (Colima) + Docker CLI + Compose + curl (brew)","os":["darwin","linux"]}]}}
---

# cardano-protocol-params

## When to use
- Fetching fresh protocol parameters
- Understanding fee calculation inputs
- Debugging min-UTxO or execution budget issues
- Comparing params across networks

## Operating rules (must follow)
- Always fetch fresh params for the target network
- Never assume mainnet params apply to testnets
- Keep pparams.json with tx artifacts for reproducibility

## Docker fallback mode
If `cardano-cli` is not installed locally, use the wrapper script in this skill folder to run **cardano-cli inside Docker** (the Cardano node container images include the CLI).

```bash
chmod +x {baseDir}/scripts/cardano-cli.sh
{baseDir}/scripts/cardano-cli.sh version
```

Notes:
- The wrapper mounts your current directory into the container as `/work` so files like `pparams.json`, `tx.body`, `datum.json` work normally.
- If you have a local node socket, set `CARDANO_NODE_SOCKET_PATH` before running so `query` commands work.
- Override the image with `CARDANO_DOCKER_IMAGE=ghcr.io/intersectmbo/cardano-node:<tag>`.

## Key parameters explained

### Fee calculation
```
minFeeA: 44           # lovelace per byte
minFeeB: 155381       # base fee in lovelace
```
Formula: `fee = minFeeA * txSize + minFeeB`

### Min UTxO
```
coinsPerUTxOByte: 4310   # lovelace per byte of UTxO
```
Minimum ADA required = size of UTxO (including datum) × coinsPerUTxOByte

### Execution units (Plutus)
```
maxTxExecutionUnits:
  steps: 10000000000     # CPU budget
  memory: 10000000       # Memory budget
executionUnitPrices:
  priceSteps: 0.0000721  # lovelace per step
  priceMemory: 0.0577    # lovelace per memory unit
```

### Reference scripts
```
minFeeRefScriptCostPerByte: 15  # Cost for using reference scripts
```

## Workflow

### Fetch parameters
```bash
# Preprod
cardano-cli conway query protocol-parameters \
  --testnet-magic 1 \
  --out-file pparams-preprod.json

# Mainnet
cardano-cli conway query protocol-parameters \
  --mainnet \
  --out-file pparams-mainnet.json
```

### Extract key values
```bash
# Using jq
cat pparams.json | jq '{
  minFeeA: .txFeePerByte,
  minFeeB: .txFeeFixed,
  coinsPerUTxOByte: .utxoCostPerByte,
  maxTxSize: .maxTxSize,
  maxValSize: .maxValueSize
}'
```

### Calculate min-UTxO for output
```bash
# Approximate: base ~160 bytes + datum size
# For simple ADA-only output: ~1 ADA minimum
# For output with tokens: varies by token count/names
```

## Examples

### Example: Debug "UTxO too small" error
**Problem:** Transaction fails with min-UTxO error

**Response:**
```bash
# 1. Fetch current params
cardano-cli conway query protocol-parameters \
  --testnet-magic 1 \
  --out-file pparams.json

# 2. Check coinsPerUTxOByte
cat pparams.json | jq .utxoCostPerByte
# Result: 4310

# 3. Estimate min-UTxO for your output
# Simple ADA output: ~160 bytes × 4310 = ~690,000 lovelace
# With inline datum: add datum size × 4310
# With tokens: add ~30 bytes per token

# 4. Solution: increase output amount above minimum
```

### Example: Estimate script execution cost
**Problem:** Need to budget for Plutus script

**Response:**
```bash
# 1. Get execution prices
cat pparams.json | jq '{
  priceSteps: .executionUnitPrices.priceSteps,
  priceMemory: .executionUnitPrices.priceMemory
}'

# 2. If script uses 1M steps and 100K memory:
# Cost = (1000000 × 0.0000721) + (100000 × 0.0577)
# Cost = 72.1 + 5770 = 5842.1 lovelace (~0.006 ADA)

# 3. Add to base tx fee for total
```

## Network magic reference
```
Mainnet:  (no flag, use --mainnet)
Preprod:  --testnet-magic 1
Preview:  --testnet-magic 2
```

## Safety / key handling
- Protocol params are public, no secrets involved
- Always verify you're querying the intended network
- Store pparams with tx artifacts for debugging

## References
- `shared/PRINCIPLES.md`
- [Cardano Protocol Parameters](https://docs.cardano.org)
