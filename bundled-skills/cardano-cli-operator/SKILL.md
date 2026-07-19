---
name: cardano-cli-operator
description: "Manual-only operator command for Cardano CLI: dispatches directly to OpenClaw Exec Tool (no model) so you can run deterministic, approval-gated cardano-cli commands (native or Docker fallback)."
argument-hint: "<shell command>"
disable-model-invocation: true
command-dispatch: tool
command-tool: exec
command-arg-mode: raw
metadata: {"openclaw":{"emoji":"\u2699\ufe0f","requires":{"anyBins":["cardano-cli","docker"],"bins":["curl"]},"install":[{"id":"brew","kind":"brew","formula":"colima docker docker-compose curl","bins":["colima","docker","docker-compose","curl"],"label":"Install Docker runtime (Colima) + Docker CLI + Compose + curl (brew)","os":["darwin","linux"]}],"homepage":"https://docs.openclaw.ai/tools/exec"}}
---

# cardano-cli-operator (manual-only)

This skill is a **deterministic exec gateway**: when you run the slash command, OpenClaw **bypasses the model** and forwards your arguments straight to the **Exec Tool** (`command-dispatch: tool`).

## Safety first: force approvals + allowlist mode
Before using this operator, set Exec defaults for the session:

- `/exec host=gateway security=allowlist ask=on-miss`

## Allowlist-safe shortcut (recommended)
If your Exec allowlist is strict, allowlist **one** entrypoint and route everything through it:

- Allowlist: `~/Projects/**/cardano-agent-skills/scripts/oc-safe.sh` (adjust glob)
- Run:
  - `/cardano_cli_operator ./scripts/oc-safe.sh cardano version`
  - `/cardano_cli_operator ./scripts/oc-safe.sh cardano query tip --mainnet`

## Use it (copy/paste)
Run `cardano-cli` via the included wrapper (native `cardano-cli` if installed, otherwise Docker fallback):

- Version
  - `/cardano_cli_operator ./skills/cardano-cli-operator/scripts/cardano-cli.sh version`

- Query tip (requires socket / correct network)
  - `/cardano_cli_operator ./skills/cardano-cli-operator/scripts/cardano-cli.sh query tip --mainnet`

- Dump protocol params (example)
  - `/cardano_cli_operator ./skills/cardano-cli-operator/scripts/cardano-cli.sh query protocol-parameters --mainnet --out-file pparams.json`

## Socket note (Docker fallback)
If you have a local node socket and you're using Docker fallback, set:
- `CARDANO_NODE_SOCKET_PATH=/path/to/node.socket`

## Notes
- This operator does **not** decide what to run; it runs what you type deterministically.
- Use the non-operator skills for guidance and safe templates.

## Consolidated Skills

This umbrella skill absorbed the following narrower siblings. See `scripts/` for their session-specific content:

| Absorbed Skill | Where its content lives | What it added |
|---|---|---|
| `cardano-cli-doctor` | `scripts/cardano-cli-doctor-*.sh` | CLI version detection, compatibility diagnostics |
| `cardano-cli-plutus-scripts` | `scripts/cardano-cli-plutus-scripts-*.sh` | Plutus script deployment templates and guidance |
| `cardano-cli-plutus-scripts-operator` | (archived without support files) | Plutus script transaction execution |
| `cardano-cli-staking` | `scripts/cardano-cli-staking-*.sh` | Stake registration, delegation templates |
| `cardano-cli-staking-operator` | (archived without support files) | Staking operation execution |
| `cardano-cli-transactions` | `scripts/cardano-cli-transactions-*.sh` | Transaction build/sign/submit templates |
| `cardano-cli-transactions-operator` | (archived without support files) | Transaction execution |
| `cardano-cli-wallets` | `scripts/cardano-cli-wallets-*.sh` | Wallet key generation and UTxO query templates |
| `cardano-cli-wallets-operator` | (archived without support files) | Wallet operation execution |
| `cardano-protocol-params` | `scripts/cardano-protocol-params-*.sh` | Protocol parameters, fees, min-UTxO, execution budgets |

**Usage:** When a user asks for CLI command templates, look up the appropriate `scripts/cardano-cli-*` file for copy-paste commands. For execution, use this operator skill directly.
