# MCP Integrations in Mosaic Companion

**Updated:** 2026-06-20

## Active MCP Servers

| MCP Server | Status | Tools | Purpose |
|------------|--------|-------|---------|
| hermes-tools | ✅ Running | 43 | Core Hermes tools (skills, terminal, browser, kanban) |
| midnight-mcp | ✅ Running | 30 | Midnight blockchain - Compact contracts, search, analysis |
| midnight-wallet | ✅ Running | ~20 | NIGHT wallet, transfers, contract deploy |
| web3 | ✅ Running | ~15 | Base Sepolia - ETH/USDC, balances |
| codebase-memory | ✅ Running | 5 | Code knowledge graph - search, trace, query |
| atomicmail | ✅ Running | 3 | Email via JMAP - register, jmap_request, help |
| gbrain | ❌ Down | - | Knowledge base (connection refused) |
| stargate-marketplace | ❌ Down | - | Skills marketplace (connection refused) |

---

## Codebase Memory MCP

**Binary:** `/home/mauricio/.local/bin/codebase-memory-mcp` (266MB)

**Already Indexed Projects:**
- `home-mauricio-mosaic-companion` (5204 nodes, 13582 edges)

**Available Tools:**
- `index_repository(repo_path, mode="fast")` - Index a new project
- `search_graph(project, query, limit)` - Semantic code search
- `query_graph(project, cypher_query)` - Cypher queries for complex patterns
- `trace_path(project, function_name, mode="calls")` - Call chains, data flow
- `get_code_snippet(project, qualified_name)` - Read source code

**Usage:**
```python
# Search for code
search_graph(project="home-mauricio-mosaic-companion", query="terminal execution", limit=10)

# Trace function calls
trace_path(project="home-mauricio-mosaic-companion", function_name="AIAgent.chat", mode="calls")

# Cypher query
query_graph(project="home-mauricio-mosaic-companion", query="MATCH (f:Function) WHERE f.complexity > 10 RETURN f")
```

---

## Atomic Mail MCP

**Package:** `@atomicmail/mcp-github` v0.3.20-rc1

**Process:** `node .../mcp-github/esm/mcp/main.js`

**Credentials Directory:** `~/.hermes/atomicmail-ada/`

### Registered Accounts

| Inbox | API Key | Credentials Dir |
|-------|---------|-----------------|
| ada-ai@atomicmail.ai | 44af61db-0f68-475e-9517-cc19c1164ad6 | ~/.hermes/atomicmail-ada |
| ruby-outreach@atomicmail.ai | (existing) | ~/.atomicmail |

### Available Tools
- `register` - Create new inbox (username 5-21 chars)
- `jmap_request` - JMAP batch operations
- `help` - Built-in documentation

### Available Presets
- `list_inbox.json` - Fetch inbox emails
- `send_mail.json` - Send email
- `reply.json` - Reply to email
- `send_mail_attachment.json` - Send with attachment

### How to Send Email

```bash
# Using preset with vars
ATOMIC_MAIL_CREDENTIALS_DIR=~/.hermes/atomicmail-ada \
npx -y @atomicmail/agent-skill@latest jmap_request \
  --ops-file node_modules/@atomicmail/mcp-github/presets/send_mail.json \
  --vars '{
    "TO": "mauricio.prieto@palmyra.partners",
    "SUBJECT": "Test from Ada - Atomic Mail",
    "BODY": "Hello! This is a test email."
  }'
```

### JMAP Capabilities Required
- `urn:ietf:params:jmap:core`
- `urn:ietf:params:jmap:mail`
- `urn:ietf:params:jmap:submission` (for sending)
- `urn:ietf:params:jmap:blob` (for attachments)

---

## Midnight MCP Categories

| Category | Tools | Use Cases |
|----------|-------|-----------|
| search | 4 | Semantic search Compact, TypeScript, docs |
| analyze | 4 | Static analysis, security audit, circuit explanation |
| repository | 3 | File access, examples, version tracking |
| versioning | 6 | Upgrade checks, breaking changes, migration |
| generation | 3 | AI contract generation/review (requires sampling) |
| health | 8 | Server status, rate limits |
| compound | 2 | Multi-step operations |

### Key Tools
- `midnight-search-compact` - Search Compact smart contract code
- `midnight-search-typescript` - Search TypeScript SDK
- `midnight-search-docs` - Search Midnight documentation
- `midnight-compile-contract` - Compile Compact contracts
- `midnight-analyze-contract` - Security analysis
- `midnight-get-latest-syntax` - Get Compact syntax reference

---

## Midnight Wallet

**Version:** 0.4.1

**Networks:** preprod, preview, undeployed

### Commands
- `midnight_wallet_generate` - Create wallet
- `midnight_wallet_list` - List wallets
- `midnight_wallet_use` - Set active wallet
- `midnight_balance` - Check NIGHT balance
- `midnight_transfer` - Send NIGHT tokens
- `midnight_contract_deploy` - Deploy Compact contract
- `midnight_contract_call` - Call contract circuit
- `midnight_localnet_up/down/status` - Docker local blockchain

### Current Wallet
- Name: `byron-test`
- Network: `undeployed`
- Address: `mn_addr_undeployed19f0f009kk0vaqq5aac8uz048n5vwauumml69nuvs2n094fm5fees05suln`

---

## Web3 MCP (Base Sepolia)

**Network:** Base Sepolia (Chain ID: 84532)
**RPC:** https://sepolia.base.org
**Explorer:** https://sepolia.basescan.org

### Capabilities
- ETH/USDC transfers
- Balance queries
- Token lookups
- Contract interactions