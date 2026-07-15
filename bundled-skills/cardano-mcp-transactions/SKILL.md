---
name: cardano-mcp-transactions
description: "Sign and submit pre-built Cardano transactions via cardano MCP. High-risk: requires structured preview and explicit user confirmation."
allowed-tools:
  - Read
user-invocable: true
metadata: {"openclaw":{"emoji":"📤","requires":{"mcp":["cardano"]}}}
---

# cardano-mcp-transactions

Sign and submit pre-built unsigned transactions through a configured `cardano` MCP server. This is a **high-risk operation** — the MCP server has no server-side approval gate and will sign+submit any CBOR passed to it. Safety depends entirely on the preview-confirm flow defined below.

## When to use

- User has a pre-built unsigned transaction (CBOR hex) from a dApp API, MeshTxBuilder, or `cardano-cli transaction build`.
- User wants to sign and submit that transaction via their MCP-configured wallet.
- A configured `cardano` MCP server is available.

## When NOT to use

- User needs to *build* a transaction — use `cardano-cli-transactions`, `meshjs-cardano`, or `koios-agent-wallet`. The MCP server cannot construct transactions.
- No `cardano` MCP server is configured — use `koios-agent-wallet` (sign-submit mode) or `cardano-cli transaction sign` + `submit`.
- User needs testnet submission — current integration assumes mainnet unless testnet support is explicitly validated.
- The transaction CBOR cannot be summarized — **refuse to submit** (see operating rules).

## Operating rules (MUST follow — no exceptions)

### Rule 1: Never submit without a structured preview

Before calling `submit_transaction`, you MUST present a structured preview to the user containing ALL of the following fields:

```
=== Transaction Preview ===
Network:        mainnet (assumed)
Source wallet:  addr1qx... (from get_addresses)
Outputs:
  1. addr1qy... — 50.000000 ₳
  2. addr1qz... — 10.000000 ₳ + 100 HOSKY
Fee:            ~0.18 ₳
CBOR fingerprint: <first 16 hex chars>...<last 16 hex chars> (<total bytes> bytes)

Submit this transaction? (yes/no)
```

If you cannot produce this preview (e.g., you cannot decode the CBOR, or the transaction structure is opaque), you MUST refuse to submit and explain why.

### Rule 2: Require unambiguous confirmation

The user must respond with a clear affirmative tied to the preview. Accept: "yes", "confirm", "submit it", "go ahead". Reject: vague responses like "sure", "whatever", "I guess", or any response that doesn't clearly reference the transaction. If ambiguous, ask again.

### Rule 3: One transaction per confirmation

Each `submit_transaction` call requires its own preview-confirm cycle. Never batch or auto-submit.

### Rule 4: Fail closed on uncertainty

- Cannot determine the network? Refuse.
- Cannot decode the CBOR? Refuse.
- Cannot identify the source wallet? Refuse.
- Unsure if MCP is configured for the right network? Refuse.

State what you cannot verify and suggest the user use CLI or Koios skills with explicit network flags instead.

### Rule 5: Never ask for seed phrases or keys

The MCP server handles signing internally. Never prompt for mnemonics, private keys, or signing keys.

### Rule 6: Network assumption

Current integration assumes mainnet unless testnet support is explicitly validated against the configured MCP server. If the user states they are on testnet, do NOT use this skill — route to `koios-agent-wallet` or `cardano-cli-transactions-operator` with explicit network flags.

## MCP tool

### `submit_transaction`

Sign and submit an unsigned transaction from the connected wallet.

- **Input:** `{ cbor: string }` — unsigned transaction CBOR hex
- **Output:** `{ transactionHash: string, timestamp: number }`
- **Error:** `{ content: [{ type: "text", text: "Unable to submit transaction : <error>" }] }`
- The MCP server signs locally using the configured wallet's seed phrase (Lucid `fromTx().sign.withWallet()`)
- There is **no server-side approval gate** — any valid CBOR will be signed and broadcast

## Transaction sources

The MCP server cannot build transactions. The unsigned CBOR must come from elsewhere:

| Source | How to get unsigned CBOR |
|--------|--------------------------|
| MeshTxBuilder | `await txBuilder.complete()` → extract hex |
| cardano-cli | `cardano-cli transaction build ... --out-file tx.raw` → read file |
| dApp API | Capture from mint/swap API response (`txCbor`, `unsignedTx`, etc.) |
| koios-agent-wallet | `agent-wallet.js` can build unsigned tx in some modes |

## Provider precedence for signing+submit

```
Transaction submission:
  1. cardano MCP (if configured + preview confirmed) ← this skill
  2. koios-agent-wallet MODE=sign-submit (key-based, any network)
  3. cardano-cli transaction sign + submit (CLI, any network)

Unsupported or uncertain network → fail closed, do not silently switch providers.
```

## Trust model

| Layer | Responsibility |
|-------|---------------|
| MCP server process | Holds seed phrase in env, signs CBOR, submits to chain. No approval gate. |
| This skill | Enforces preview-confirm flow. Refuses opaque/unverifiable transactions. |
| MCP client UI | User approves/denies individual tool calls. |
| User | Reviews preview, gives explicit confirmation. |

The seed phrase never leaves the MCP server process. The agent never sees key material. Safety depends on the preview-confirm flow in this skill and the user's own review.

## References

- `shared/mcp-provider.md`
- `shared/PRINCIPLES.md`
- `cardano-cli-transactions` (CLI tx building guidance)
- `cardano-cli-transactions-operator` (CLI tx execution)
- `koios-agent-wallet` (Koios sign+submit)
- `meshjs-cardano` (MeshJS tx building)
- cardano-mcp: https://github.com/IndigoProtocol/cardano-mcp
