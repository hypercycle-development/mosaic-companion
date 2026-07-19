---
name: cardano-mcp-identity
description: "Retrieve ADAHandle identities ($handle) for the connected wallet via cardano MCP. Read-only."
allowed-tools:
  - Read
user-invocable: true
metadata: {"openclaw":{"emoji":"🏷️","requires":{"mcp":["cardano"]}}}
---

# cardano-mcp-identity

Look up ADAHandle ($handle) identities associated with the connected wallet through a configured `cardano` MCP server. Read-only.

## When to use

- User asks about their ADAHandle(s), $handle names, or human-readable wallet identifiers.
- User wants to know which handles they own.
- A configured `cardano` MCP server is available.

## When NOT to use

- No `cardano` MCP server is configured — ADAHandles can be queried manually via policy ID lookup with Koios or Blockfrost.
- User needs testnet data — current integration assumes mainnet unless testnet support is explicitly validated.
- User wants to register or transfer a handle — this skill is read-only.

## Operating rules

1. **Detect MCP first.** If `get_adahandles` is not available, explain that ADAHandles can be queried by checking for tokens under policy `f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a` using Koios or Blockfrost.
2. **Never ask for seed phrases or keys.**
3. **Display with `$` prefix.** The MCP tool returns handle names without the `$` prefix. Add it when displaying to the user (e.g., `$alice`).
4. **Network assumption.** Current integration assumes mainnet unless testnet support is explicitly validated.

## MCP tool

### `get_adahandles`

All ADAHandle identifiers for the connected wallet.

- **Input:** none
- **Output:** `{ adaHandles: string[] }` — decoded handle names without `$` prefix
- Policy ID used: `f0ff48bbb7bbe9d59a40f1ce90e9e9d0ff5002ec48f232b49ca0fb9a`
- Hex names are decoded; the `000de140` CIP-68 prefix is stripped automatically

## Example output

```
ADAHandles owned by this wallet:
  $alice
  $alice.dev
```

## References

- `shared/mcp-provider.md`
- ADAHandle: https://handle.me/
- cardano-mcp: https://github.com/IndigoProtocol/cardano-mcp
