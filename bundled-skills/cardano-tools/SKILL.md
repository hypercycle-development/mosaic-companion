---
name: cardano-tools
description: "40+ Cardano blockchain tools for querying tokens, NFTs, DEX swaps, governance, handles, pools, and staking. Originally extracted from dancesWithClaws v2026.2.5-from-shell-with-love. Covers TapTools, Cexplorer, CSWAP, Metera, Ada Handle, GovCircle, ADA Anvil, NABU VPN, and core data/governance/DeFi/PoI/Scrolls tools."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [cardano, blockchain, ada, tap-tools, cexplorer, cswap, metera, ada-handle, govcircle, ada-anvil, nabu, dex, defi, governance, nft, token, staking, koios, blockfrost]
    related_skills: [blockchain-node-ops]
---

# Cardano Tools (40+ tools across 13 categories)

Complete Cardano ecosystem integration extracted from `CharlesHoskinson/dancesWithClaws@v2026.2.5-from-shell-with-love`. Provides Hermes with full Cardano blockchain querying, DeFi interaction, governance tracking, identity resolution, and immutable storage capabilities.

## Architecture

```
cardano/
  client.ts          — Koios API client with automatic failover (mainnet/preprod/preview)
  types.ts           — Shared Cardano types (AddressInfo, TxInfo, PoolInfo, EpochInfo, AssetInfo, UtxoSet, Asset)
  data-tools.ts      — Core blockchain queries (address, tx, pool, tip) via Koios
  defi-tools.ts      — Liqwid Finance (lending APYs, positions, estimates) + Surge DEX (pools, quotes, prices)
  governance-tools.ts — Clarity Protocol (proposals, DReps) + GovCircle (circles, proposals, votes)
  taptools.ts        — Token/NFT analytics (price, holders, collections, DEX volume, trending)
  cexplorer.ts       — Blockchain explorer (address, tx, pool, epoch, search)
  ada-handle.ts      — Identity resolution ($handle -> address, reverse lookup, metadata, availability)
  cswap.ts           — DEX aggregator (pools, prices, swap estimates, liquidity)
  metera.ts          — Index tokens (indices, composition, performance)
  ada-anvil.ts       — Token minting (mint, burn, collections, mint history)
  govcircle.ts       — Governance circles (circles, proposals, votes)
  nabu-vpn.ts        — Decentralized VPN (nodes, stats, status)
  poi-tools.ts       — Proof-of-Inference anchoring (anchor inference, verify)
  scrolls-tools.ts   — Immutable storage (read scrolls, prepare write)
  index.ts           — Aggregator exporting all tools + createCardanoTools(cfg)
```

## Tool Catalog (40+ tools)

### Analytics & Data
| Tool | API | What it does |
|------|-----|-------------|
| taptools_get_token_price | TapTools | Price, 24h change, volume, market cap |
| taptools_get_token_holders | TapTools | Holder count + top holders |
| taptools_get_nft_collection | TapTools | Floor price, volume, supply |
| taptools_get_dex_volume | TapTools | Trading volume by DEX |
| taptools_get_trending | TapTools | Trending tokens/NFTs |
| cexplorer_get_address | Cexplorer | Balance, tx count, stake address |
| cexplorer_get_transaction | Cexplorer | Inputs, outputs, fees, metadata |
| cexplorer_get_pool | Cexplorer | Pool ticker, margin, stake, delegators |
| cexplorer_get_epoch | Cexplorer | Epoch stats |
| cexplorer_search | Cexplorer | Search addresses, txs, pools, tokens |
| cardano_address_info | Koios | Address balance, UTxO count, stake |
| cardano_tx_info | Koios | Transaction details |
| cardano_pool_info | Koios | Stake pool info |
| cardano_tip | Koios | Current blockchain tip |

### DeFi (Lending + DEX)
| Tool | API | What it does |
|------|-----|-------------|
| liqwid_get_markets | Liqwid | Lending markets with supply/borrow APYs |
| liqwid_get_position | Liqwid | User position (supplied, borrowed, health factor) |
| liqwid_estimate | Liqwid | Supply/borrow return estimates |
| surge_get_pools | Surge | Liquidity pools with TVL + APY |
| surge_get_quote | Surge | Swap quotes with price impact |
| surge_get_price | Surge | Token price on Surge |
| cswap_get_pools | CSWAP | Liquidity pools |
| cswap_get_price | CSWAP | Token price from pools |
| cswap_estimate_swap | CSWAP | Swap output, price impact, fees |
| cswap_get_liquidity | CSWAP | TVL and pool depth |
| metera_get_indices | Metera | Index token list |
| metera_get_composition | Metera | Component tokens + weights |
| metera_get_performance | Metera | NAV, returns over time |

### Identity
| Tool | API | What it does |
|------|-----|-------------|
| handle_resolve | Ada Handle | $handle -> Cardano address |
| handle_reverse_lookup | Ada Handle | Find handles for address |
| handle_get_metadata | Ada Handle | Rarity, image, custom data |
| handle_check_availability | Ada Handle | Check availability + price |

### Governance
| Tool | API | What it does |
|------|-----|-------------|
| clarity_get_proposals | Clarity | Active/recent governance proposals |
| cardano_drep_info | Clarity | DRep info (voting power, delegators) |
| govcircle_get_circles | GovCircle | Governance circles |
| govcircle_get_proposals | GovCircle | Proposals in circle |
| govcircle_get_votes | GovCircle | Vote breakdown |

### Minting & Infrastructure
| Tool | API | What it does |
|------|-----|-------------|
| anvil_mint_token | ADA Anvil | Mint native tokens |
| anvil_burn_token | ADA Anvil | Burn tokens |
| anvil_create_collection | ADA Anvil | Create NFT collection |
| anvil_get_mints | ADA Anvil | Minting history |
| nabu_get_nodes | NABU | VPN node list |
| nabu_get_node_stats | NABU | Node bandwidth, uptime, latency |
| nabu_check_status | NABU | Service health |

### Immutable Storage & AI
| Tool | What it does |
|------|-------------|
| scrolls_read | Read immutable document by tx hash |
| scrolls_prepare_write | Prepare metadata for immutable scroll entry |
| poi_anchor_inference | Anchor AI inference on Cardano blockchain |
| poi_verify_inference | Verify anchored inference by proof/tx |

## API Keys (required for production)

Without keys, tools hit rate limits quickly. Set as env vars or config:

```bash
export TAPTOOLS_API_KEY=tt_xxxx
export CEXPLORER_API_KEY=cx_xxxx
export ADA_HANDLE_API_KEY=ah_xxxx
export CSWAP_API_KEY=cs_xxxx
export METERA_API_KEY=mt_xxxx
export GOVCIRCLE_API_KEY=gc_xxxx
export ADA_ANVIL_API_KEY=av_xxxx
export NABU_VPN_API_KEY=nb_xxxx
export BLOCKFROST_API_KEY=bf_xxxx    # for core data tools
export KOIOS_API_KEY=ko_xxxx         # for core data tools
export FLUX_AGENT_TOKEN=flux_xxxx    # for Proof-of-Inference
```

## Core Client Configuration

The `createCardanoClient(config)` function uses Koios REST API as the primary provider:

| Network | Endpoint |
|---------|----------|
| mainnet | `https://api.koios.rest/api/v1` |
| preprod | `https://preprod.koios.rest/api/v1` |
| preview | `https://preview.koios.rest/api/v1` |

All requests use `AbortController` with 30s timeout. Results return `{ ok: true, data: T } | { ok: false, error: string }`.

## Key Types

```typescript
// AddressInfo
interface AddressInfo {
  address: string;
  balance: string;        // lovelace
  stake_address?: string;
  script_address: boolean;
  utxo_set: UtxoSet[];
}

// Transaction
interface TxInfo {
  tx_hash: string;
  block_height: number;
  epoch_no: number;
  fee: string;
  total_output: string;
  inputs: TxInput[];
  outputs: TxOutput[];
}

// Pool
interface PoolInfo {
  pool_id_bech32: string;
  margin: number;
  fixed_cost: string;
  pledge: string;
  meta_json?: { name?: string; ticker?: string; description?: string; homepage?: string };
  live_stake?: string;
  live_delegators?: number;
  live_saturation?: number;
}
```

## Integration Patterns

### Direct tool invocation (standalone)
```typescript
const tools = createCardanoTools(cfg);
const result = await tool.execute("call-id", { policy_id: "..." });
```

### Into Hermes / Mosaic Companion
The tools are structured as `AgentTool` objects with:
- `name`: snake_case identifier
- `description`: human-readable purpose
- `parameters`: TypeBox JSON schema
- `execute`: async function returning `{ content: [{ type: "text", text: JSON.stringify(result) }], details: result }`

For Mosaic Companion integration:
1. Map tool calls to IPC bridge
2. Use the same parameter reading helpers (`readStringParam`, `readNumberParam`, `jsonResult`)
3. Provide API keys via secure config storage (not plaintext in renderer)

## Pitfalls

- **Asset names are hex-encoded**: `534e454b` = "SNEK". Omit for blank asset names.
- **Balances in lovelace**: Divide by 1,000,000 for ADA. All tools return raw lovelace.
- **Koios keys optional but recommended**: Without a key, rate limits are aggressive.
- **Cexplorer vs Koios**: Cexplorer is for rich explorer data; Koios is for raw chain data. Both can coexist.
- **Handle case-insensitive**: `$charles`, `charles`, `CHARLES` all resolve the same.
- **Price impact warning**: CSWAP/Surge show price impact as percentage. >1% means you're moving the market.
- **Scrolls metadata label**: Fixed at `8888` for Ledger-Scrolls entries.
- **PoI needs FLUX_AGENT_TOKEN**: Without it, anchoring returns a configuration error.
- **Liqwid health factor**: <1.0 means position is at risk of liquidation.

## Testing

All tools have companion `.test.ts` files using Vitest with `vi.fn()` mock fetch. Test patterns:
1. Mock `global.fetch` with resolved JSON
2. Call `tool.execute("test-id", args)`
3. Parse `JSON.parse(result.content[0].text)`
4. Assert expected fields
5. Restore original fetch in `afterEach`

Total: 127 tests across 8 integration test files, all passing.

## References

- `references/tool-catalog.md` — Complete tool listing with parameters and API endpoints
- `references/api-reference.md` — Detailed API endpoint documentation for each provider
- `references/types-reference.md` — Full TypeScript interfaces
- `references/integration-patterns.md` — How to wire into Mosaic Companion
- `references/testing-guide.md` — Vitest patterns for mocking and asserting tool calls

## Source

Extracted from: https://github.com/CharlesHoskinson/dancesWithClaws/releases/tag/v2026.2.5-from-shell-with-love
Commit: 641a6b2 — "From Shell With Love: 32 Cardano ecosystem tools"
Local copy: ~/Cardano/extracted-tools/ (24 files: 13 implementation + 8 tests + types + client + index)
