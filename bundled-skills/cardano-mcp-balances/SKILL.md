---
name: cardano-mcp-balances
description: "Read-only wallet state via cardano MCP: balances, addresses, and UTxOs. Requires a configured cardano MCP server."
allowed-tools:
  - Read
user-invocable: true
metadata: {"openclaw":{"emoji":"💰","requires":{"mcp":["cardano"]}}}
---

# cardano-mcp-balances

Query wallet balances, addresses, and UTxOs through a configured `cardano` MCP server. Read-only — no signing, no submission.

## When to use

- User asks about wallet balance, ADA holdings, or native token amounts.
- User asks for their wallet address(es).
- User asks about UTxOs or wants to inspect unspent outputs.
- A configured `cardano` MCP server is available.

## When NOT to use

- No `cardano` MCP server is configured — fall back to `koios-agent-wallet` or `cardano-cli-wallets`.
- User needs testnet data — current integration assumes mainnet unless testnet support is explicitly validated.
- User needs to build or submit transactions — see `cardano-mcp-transactions` or builder skills.

## Operating rules

1. **Detect MCP first.** If `get_balances`, `get_addresses`, or `get_utxos` tools are not available, fall back to Koios or CLI skills. Never error on missing MCP.
2. **Never ask for seed phrases or keys.** The MCP server manages key material internally.
3. **Lovelace conversion.** `get_balances` returns ADA amounts in lovelace. Always divide by 1,000,000 when displaying to the user.
4. **Network assumption.** Current integration assumes mainnet unless testnet support is explicitly validated against the configured MCP server.

## MCP tools

### `get_balances`

All token balances for the connected wallet.

- **Input:** none
- **Output:** `{ balances: [{ name, policyId, nameHex, amount }] }`
- `name`: `"ADA"` for lovelace, decoded hex for native assets
- `amount`: lovelace for ADA (divide by 1,000,000), raw quantity for native assets
- `policyId`: empty string for ADA, 56-char hex for native assets
- `nameHex`: empty string for ADA, hex-encoded asset name for native assets

### `get_addresses`

All addresses for the connected wallet.

- **Input:** none
- **Output:** `{ addresses: string[] }` — deduplicated bech32 addresses derived from UTxOs

### `get_utxos`

All unspent transaction outputs for the connected wallet.

- **Input:** none
- **Output:** `{ utxos: string[] }` — each UTxO serialized as CBOR hex

## Provider precedence

```
Wallet state query:
  1. cardano MCP (if configured) ← this skill
  2. koios-agent-wallet (MeshJS + Koios, any network)
  3. cardano-cli-wallets (CLI, any network)
```

Read-only wallet state goes MCP-first when available. If MCP is unavailable or the user needs testnet, fall back without prompting.

## Example output format

```
=== Wallet Summary ===
Address:  addr1qx...
ADA:      142.35 ₳
Native tokens:
  - HOSKY (f0ff48...): 1,000,000
  - SNEK (279c90...): 500
UTxOs:    7
```

## References

- `shared/mcp-provider.md`
- `koios-agent-wallet` (Koios fallback)
- `cardano-cli-wallets` (CLI fallback)
- cardano-mcp: https://github.com/IndigoProtocol/cardano-mcp

## Consolidated Skills

This umbrella skill absorbed the following narrower siblings:

| Absorbed Skill | Where its content lives | What it added |
|---|---|---|
| `cardano-mcp-identity` | (archived without support files) | ADAHandle identity lookup via MCP |
| `cardano-mcp-staking` | (archived without support files) | Staking delegation query via MCP |
| `cardano-mcp-transactions` | (archived without support files) | Sign and submit via MCP with preview-confirm flow |
