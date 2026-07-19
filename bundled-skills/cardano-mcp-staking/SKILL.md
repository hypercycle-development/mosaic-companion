---
name: cardano-mcp-staking
description: "Query staking delegation status and available rewards via cardano MCP. Read-only, no delegation changes."
allowed-tools:
  - Read
user-invocable: true
metadata: {"openclaw":{"emoji":"🥩","requires":{"mcp":["cardano"]}}}
---

# cardano-mcp-staking

Query staking delegation status and available ADA rewards through a configured `cardano` MCP server. Read-only — this skill cannot register, delegate, or withdraw. For staking operations, use `cardano-cli-staking` or `koios-agent-wallet`.

## When to use

- User asks which pool they are delegated to.
- User asks about pending staking rewards.
- User wants a quick staking status check.
- A configured `cardano` MCP server is available.

## When NOT to use

- No `cardano` MCP server is configured — use `koios-agent-wallet` (`fetchAccountInfo`) or `cardano-cli query stake-address-info`.
- User wants to delegate, register, or withdraw — use `cardano-cli-staking` / `cardano-cli-staking-operator` or `koios-agent-wallet` (MODE=stake).
- User needs testnet staking info — current integration assumes mainnet unless testnet support is explicitly validated.

## Operating rules

1. **Detect MCP first.** If `get_stake_delegation` is not available, fall back to Koios or CLI.
2. **Never ask for seed phrases or keys.**
3. **Rewards are in ADA.** The MCP tool returns `availableAdaRewards` already divided by 10^6 — do not divide again.
4. **Pool ID is bech32.** The returned `poolId` is bech32-encoded (`pool1...`). Link to a pool explorer (e.g., Cardanoscan) for details.
5. **Network assumption.** Current integration assumes mainnet unless testnet support is explicitly validated.

## MCP tool

### `get_stake_delegation`

Staking pool and available rewards for the connected wallet.

- **Input:** none
- **Output:** `{ poolId: string, availableAdaRewards: number }`
- `poolId`: bech32 pool ID (`pool1...`) or empty if not delegated
- `availableAdaRewards`: available rewards in ADA (already divided by 10^6)

## Example output

```
=== Staking Status ===
Delegated to: pool1pu5jlj4q9w9jlxeu370a3c9myx47md5j5m2str0naunn2q3lkdy (IOHK)
Rewards:      12.45 ₳
```

## References

- `shared/mcp-provider.md`
- `cardano-cli-staking` (CLI guidance for delegation)
- `koios-agent-wallet` (Koios-based staking)
- cardano-mcp: https://github.com/IndigoProtocol/cardano-mcp
