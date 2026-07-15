---
name: midnight-orchestrator
description: Master orchestrator for Midnight Network operations. Auto-detects Midnight context and routes to specialist skills for Compact development, devnet operations, wallet management, verification, and DApp scaffolding. Use when the user mentions 'Midnight', 'Compact', 'ZK', 'privacy', 'devnet', 'proof server', 'Lace wallet', 'token', 'shielded', or 'disclosure'.
version: 0.1.0
category: midnight
metadata:
  hermes:
    tags: [midnight, orchestrator, compact, privacy, blockchain, zk-proofs, devnet, agent-routing]
    related_skills:
      - midnight-compact-core-basic-start
      - midnight-compact-core-compact-structure
      - midnight-compact-core-compact-tokens
      - midnight-compact-core-compact-patterns
      - midnight-compact-core-compact-witness-ts
      - midnight-tooling-devnet
      - midnight-tooling-devnet-health
      - midnight-tooling-compact-cli
      - midnight-verify-verify-compact
      - midnight-verify-verify-by-devnet
      - midnight-verify-verify-by-source
      - midnight-wallet-managing-test-wallets
      - midnight-dapp-dev-core
      - midnight-dapp-dev-dapp-connector
      - midnight-core-concepts-architecture
      - midnight-core-concepts-privacy-patterns
      - midnight-proof-server-proof-server-api
      - midnight-node-node-operations
      - midnight-indexer-indexer-graphql-api
      - midnight-status-codes-status-codes-lookup
      - midnight-cq-compact-testing
      - midnight-cq-dapp-testing
---

# Midnight Orchestrator — Unified Entry Point for Hermes Agents

> **Quick Start:** When a user mentions anything Midnight-related, load this skill first. It will route to the correct specialist skill based on context.

## Context Detection Matrix

| User Signal | Specialist Skill | Action |
|------------|-------------------|--------|
| "write my first Compact contract" / "hello world" | `midnight-compact-core-basic-start` | Step-by-step devnet + contract + deploy |
| "contract structure" / "pragma" / "ledger" / "circuit" | `midnight-compact-core-compact-structure` | Contract anatomy, types, declarations |
| "token" / "ERC20" / "NFT" / "shielded token" | `midnight-compact-core-compact-tokens` | Token patterns and implementations |
| "pattern" / "access control" / "commitment" / "governance" | `midnight-compact-core-compact-patterns` | 18+ reusable design patterns |
| "witness" / "TypeScript witness" | `midnight-compact-core-compact-witness-ts` | Witness implementation patterns |
| "debug" / "error" / "why is my contract failing" | `midnight-compact-core-compact-debugging` | Debugging walkthrough |
| "review" / "audit" / "security check" | `midnight-compact-core-compact-review` | Multi-axis code review |
| "privacy leak" / "disclosure" / "sealed ledger" | `midnight-compact-core-compact-privacy-disclosure` | Privacy analysis and fixes |
| "ZKIR" / "proof" / "verify" / "compile check" | `midnight-verify-*` family | Multi-method verification |
| "devnet" / "local node" / "start the network" | `midnight-tooling-devnet` | Devnet lifecycle |
| "wallet" / "fund" / "NIGHT" / "DUST" / "Lace" | `midnight-wallet-managing-test-wallets` | Wallet operations |
| "DApp" / "React" / "Vite" / "frontend" / "shadcn" | `midnight-dapp-dev-core` | Frontend scaffolding |
| "indexer" / "GraphQL" / "query blockchain" | `midnight-indexer-indexer-graphql-api` | Indexer queries |
| "node" / "validator" / "committee" / "consensus" | `midnight-node-node-*` | Node operations |
| "proof server" / "proving" / "WASM checker" | `midnight-proof-server-proof-server-*` | Proof server ops |
| "error code" / "status 0x4b" / "code lookup" | `midnight-status-codes-status-codes-lookup` | Error catalog |
| "test" / "Vitest" / "Playwright" / "lint" | `midnight-cq-*` | Quality and testing |
| "architecture" / "Kachina" / "Zswap" / "protocol" | `midnight-core-concepts-*` | Conceptual foundations |

## Agent Routing Table

When working in a multi-agent context (kanban, delegation), route tasks to these agents:

| Task | Agent Skill | Reasoning |
|------|-------------|-----------|
| Write Compact contract | `midnight-agent-contract-writer` | Specialist in contract authoring |
| Review code | `midnight-agent-reviewer` | Security + quality review |
| Debug failing contract | `midnight-agent-compact-dev` | Debug + fix patterns |
| Set up devnet | `midnight-agent-cli-tester` | Toolchain + devnet ops |
| Verify claims | `midnight-agent-zkir-checker` + `midnight-agent-witness-verifier` | Multi-method verification pipeline |
| Write DApp frontend | `midnight-agent-dev` (dapp-dev) | React + wallet integration |
| Explain concepts | `midnight-agent-concept-explainer` | Educational content |

## Unified Workflow: New Project

When a user says "I want to build a Midnight DApp from scratch":

1. **Load** `midnight-compact-core-basic-start` → verify environment, create devnet
2. **Load** `midnight-compact-core-compact-structure` → scaffold contract
3. **Load** `midnight-compact-core-compact-tokens` (if token involved) or `midnight-compact-core-compact-patterns` (for access control)
4. **Load** `midnight-compact-core-compact-witness-ts` → write TypeScript witnesses
5. **LOAD** `midnight-verify-verify-compact` → compile, type-check, inspect
6. **LOAD** `midnight-tooling-devnet` → deploy to devnet
7. **LOAD** `midnight-wallet-managing-test-wallets` → fund wallets, register DUST
8. **LOAD** `midnight-dapp-dev-core` → scaffold Vite + React frontend
9. **LOAD** `midnight-dapp-dev-dapp-connector` → wire Lace wallet
10. **LOAD** `midnight-cq-compact-testing` + `midnight-cq-dapp-testing` → write tests

## End-to-End Verification Checklist

Before declaring any Midnight task complete:

- [ ] Compact contract compiles (`compact compile` or skill-guided)
- [ ] Witnesses type-check against generated bindings
- [ ] Contract deploys to local devnet
- [ ] Transactions execute without errors
- [ ] Privacy rules are respected (no implicit disclosure)
- [ ] DApp frontend connects to Lace wallet
- [ ] Tests pass (Vitest + Playwright)
- [ ] Error codes cataloged if any new ones encountered

## Environment Variables

Common env vars for Midnight development:
```bash
MIDNIGHT_NETWORK=devnet
COMPACT_CLI_VERSION=$(compact --version)
MIDNIGHT_PROOF_SERVER_URL=http://localhost:3000
MIDNIGHT_INDEXER_URL=http://localhost:4000/graphql
MIDNIGHT_NODE_URL=ws://localhost:9944
```

## Dependencies

Ensure these tools are available (checked by `midnight-expert-meta-doctor`):
- Docker (for devnet)
- Node.js 22+
- Compact CLI (`compact --version`)
- Lace wallet (browser extension)
