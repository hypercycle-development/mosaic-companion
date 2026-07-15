---
title: Cardano eUTxO Fundamentals
name: cardano-eutxo-fundamentals
category: blockchain
description: |
  Comprehensive knowledge base for Cardano eUTxO fundamentals, smart contract
  languages (Aiken, Helios, OpShin, Plutus Tx), off-chain tooling (MeshJS,
  Lucid), governance (Conway/CIP-1694), and security best practices.
  Derived from elRaulito's "eUTxO Fundamentals: Building Cardano Smart
  Contracts" with 40+ Cardano tools integration patterns.
author: Hermes Agent
version: 1.0.0
---

# Cardano eUTxO Fundamentals

## 1. eUTxO Model vs Account Model

### eUTxO (Cardano)
- Each transaction spends **outputs from prior transactions** and generates new outputs.
- Wallet balance = sum of unspent transaction outputs (UTxOs).
- **Analogy**: Paper bills — spend a bill, receive change as new bills.
- **Benefits**: Parallel tx processing, higher privacy, deterministic fees.

### Account Model (Ethereum)
- Global state maintains each account balance.
- **Analogy**: Bank ATM — balance checked before approval.
- **Benefits**: Simpler for complex stateful contracts.
- **Drawback**: Susceptible to double-spending, requires incrementing nonce.

## 2. Transaction Anatomy

A Cardano transaction has:
- **Inputs**: UTxOs being spent (reference previous tx hashes)
- **Outputs**: New UTxOs created
- **Fee**: Predictable, based on tx size
- **Minted Value**: Any tokens minted/burned
- **Certificates**: Stake operations
- **Withdrawals**: Rewards from stake keys
- **Valid Range**: Time boundaries
- **Signatories**: List of signatures
- **Redeemers**: Input data for scripts
- **ID**: Transaction hash

### Determinism & Transaction Chaining
- Once all tx fields are set, the hash is **final** — won't change.
- Enables **transaction chaining**: build dependent txs before confirmation.
- Alice sends 50 ADA → Raul can immediately build a tx sending 120 ADA to Bob using the predicted hash.
- **Risk**: If Alice's tx fails (deadline expires), all chained txs fail.

### Fee Predictability
- No fee market on Cardano — fees are static and deterministic.
- Once fee covers processing cost, tx will be in next blocks.
- Unlike Bitcoin RBF which changes tx hash.

## 3. Smart Contract Fundamentals

### Components
1. **Parties**: Who can interact (everyone, specific users, asset owners)
2. **Actions**: Deposit, mint, store data, withdraw, read
3. **Rules**: Conditions under which actions are allowed
4. **Data Fields (Datum)**: State stored with locked UTxO

### Action vs Interaction
- **Smart Contract Action**: Tx where contract is in the **inputs** (invoked/executed).
- **Smart Contract Interaction**: Tx where contract is only in **outputs** (funds sent to it).

### Common Risks
- **Double satisfaction**: User spends two inputs requiring similar conditions
- **Dust attack**: Spam tokens added to contract making funds unretrievable
- **Spam contract**: Second contract runs alongside attacked one to unlock funds
- **Datum attack**: Corrupted datum makes funds unspendable
- **Backdoor**: All funds retrievable by malicious actor

## 4. Native Scripts

### Multisignature Scripts
Four constructors:
- `RequireSignature vkeyhash` — validate signature
- `RequireAllOf <script>*` — all must be satisfied
- `RequireAnyOf <script>*` — at least one satisfied
- `RequireMOf <num> <script>*` — at least M satisfied

### Time Locking
- `RequireTimeBefore` — current slot before specified slot
- `RequireTimeAfter` — current slot after specified slot

### Example: 3-of-3 Multisig
```json
{
  "type": "all",
  "scripts": [
    { "type": "sig", "keyHash": "..." },
    { "type": "sig", "keyHash": "..." },
    { "type": "sig", "keyHash": "..." }
  ]
}
```

## 5. Smart Contract Languages

### Aiken (Recommended)
- Modern, purely functional, static typing with inference
- Compiles to Untyped Plutus Core (UPLC)
- **Installation**: `npm install -g @aiken-lang/aiken` or `brew install aiken`
- **Project scaffold**: `aiken new <project>` → creates `lib/`, `validators/`, `aiken.toml`
- **Build**: `aiken build` → generates CIP-0057 `plutus.json` blueprint
- **Test**: `aiken check` — unit tests and property-based tests
- **Debug**: `trace cbor.diagnostic(value)` for CBOR diagnostic output
- **Language Server**: `aiken lsp`

### Helios
- Functional, C-like syntax, inspired by Go/Rust
- JavaScript/TypeScript SDK for Cardano dApps
- **CDN**: `https://helios.hyperion-bt.org/<version>/helios.js`
- **npm**: `npm i @hyperionbt/helios`
- **Playground**: https://playground.helios.hyperion-bt.org

### OpShin
- Strict subset of valid Python
- Philosophy: if it compiles, it's valid Python and on-chain behavior matches Python behavior
- **Install**: `python3 -m pip install opshin`
- **Book**: https://book.opshin.dev/

### Plutus Tx
- Native Cardano smart contract language, written in Haskell
- Plutus Tx compiler: GHC Core → Plutus IR → Typed Plutus Core → Untyped Plutus Core
- **Setup**: Requires Haskell, ghcup, nix-shell
- **Playground**: https://playground.plutus.iohkdev.io/

### Plu-ts
- TypeScript eDSL for on-chain + off-chain
- **npm**: `npm install @harmoniclabs/plu-ts`
- **Book**: https://book.plu-ts.dev/

## 6. Validator Execution Model

### Three Arguments
1. **Datum**: Attached to locked output, carries state
2. **Redeemer**: Attached to spending input, provides action data
3. **Context**: Transaction-level info (signers, inputs, outputs, etc.)

### Execution Rules
- **SPEND contracts**: Executed **once per input** from the contract
- **MINT/WITHDRAW contracts**: Executed **once per transaction**

### Example: Multi-input Exercise
Tx spending 3 UTxOs from same contract + withdrawing staking rewards + minting 2 tokens:
- **4 unique contracts executed** (3 spend + 1 withdraw + 1 mint = wait, withdraw and mint each once, but the 3 spends are same contract executed 3 times = 3 executions of same contract + 1 withdraw + 1 mint = 3 unique contract hashes? Actually: spend contract A executed 3 times, withdraw contract B once, mint contract C once, mint contract D once = 4 unique contracts)
- **3 datums** (one per spent UTxO)
- **6 redeemers** (3 for spends + 1 for withdraw + 2 for mints)

## 7. Two-Phase Validation & Collateral

### Phase 1: Structural Validation
- Checks tx construction correctness
- Ensures tx can pay processing fee
- **If fails**: discarded immediately, no scripts run

### Phase 2: Script Execution
- Executes all scripts in tx
- **If fails**: collateral is taken to compensate nodes

### Collateral
- Required for all Phase 2 (non-native) smart contract txs
- Deterministic costs: users calculate execution costs in advance
- Honest users never lose collateral on valid txs
- Vasil upgrade: change address for collateral, only required amount taken

## 8. Debugging Tools

### Aiken Tests
```aiken
test foo() {
  1 + 1 == 2
}
```
- Tests execute on same VM as on-chain contracts
- `aiken check` generates report with memory/CPU units

### Gastronomy (UPLC Debugger)
- By Sundae Labs
- Steps through UPLC execution forward/backward
- CLI: `gastronomy-cli run <script.uplc> <redeemer>`
- GUI: `gastronomy`

## 9. Optimization Techniques

### Withdraw 0 Trick
- Spend validators run once per input; withdraw scripts run once per tx
- Split logic: spend validator checks "withdraw 0" executed; complex logic in withdraw contract
- Reduces complexity when handling multiple inputs

### Parametric Scripts
- Predefine parameters in script to save computation
- Example: minting script that restricts destinations to parameterized spend script instances
- Requires: constant-length parameters (via hashing), redeemers supply resolved values

## 10. Off-Chain Tooling

### MeshJS
- Modern TypeScript library for Cardano dApps
- **Setup**: `npm install @meshsdk/core @meshsdk/core-csl`
- **Providers**: BlockfrostProvider, Maestro, etc.
- **Key classes**: MeshWallet, MeshTxBuilder

### Lock Funds Example
```typescript
const unsignedTx = await txBuilder
  .txOut(validatorAddr, [{ unit: "lovelace", quantity: lockAmount.toString() }])
  .txOutInlineDatumValue(mConStr0([ownerPubKeyHash]))
  .changeAddress(ownerAddress)
  .selectUtxosFrom(walletUtxos)
  .complete();
```

### Spend from Contract Example
```typescript
const unsignedTx = await txBuilder
  .spendingPlutusScriptV3()
  .txIn(txHash, outputIndex, amount, address)
  .txInScript(scriptCbor)
  .txInRedeemerValue(mConStr0([stringToHex("Hello, World!")]))
  .txInInlineDatumPresent()
  .txInCollateral(collateralTxHash, collateralIndex, collateralAmount, collateralAddr)
  .requiredSignerHash(ownerPubKeyHash)
  .changeAddress(ownerAddress)
  .selectUtxosFrom(await wallet.getUtxos())
  .complete();
```

### Lucid (Legacy but Useful)
```typescript
const tx = await lucid.newTx()
  .payToAddress("ADDRESS", { lovelace: 2000000n })
  .complete();
const signedTx = await tx.sign().complete();
const txHash = await signedTx.submit();
```

## 11. Governance (Conway Era / CIP-1694)

### Governance Bodies
1. **Ada Holders**: Core voting power, can delegate to DReps, register as DReps, submit governance actions
2. **DReps (Delegated Representatives)**: Vote on proposals, power proportional to delegated stake
3. **SPOs (Stake Pool Operators)**: Maintain infrastructure, vote on technical aspects
4. **Constitutional Committee (CC)**: Oversees constitutionality, each member has one vote

### Governance Actions (7 types)
1. **NoConfidence**: Motion against constitutional committee
2. **UpdateCommittee**: Change CC members/thresholds/terms
3. **NewConstitution**: Modify off-chain constitution
4. **TriggerHF**: Initiate hard fork (requires prior software upgrade)
5. **ChangePParams**: Update protocol parameters
6. **TreasuryWdrl**: Treasury movements
7. **Info**: On-chain record only

### Ratification Thresholds
| Action | CC | DReps | SPOs |
|--------|-----|-------|------|
| No confidence | - | 0.67 | 0.51 |
| New Constitution | 2/3 | 0.75 | - |
| Hard fork | 2/3 | 0.60 | 0.51 |
| Treasury withdrawal | 2/3 | 0.67 | - |
| Info | 2/3 | 1 | 1 |

### Governance Action Lifecycle
- Lifespan: 6 epochs (`govActionLifetime`)
- Snapshots at every epoch boundary
- Ratification checked at epoch boundary
- Enacted at next epoch boundary
- Expires if not ratified

### DRep Smart Contract Example (Aiken)
```aiken
validator drep {
  publish(_redeemer, _certificate, tx) { is_nft_owner(tx) }
  vote(_redeemer, _voter, tx) { is_nft_owner(tx) }
  propose(_redeemer, _proposal, tx) { is_nft_owner(tx) }
  else(_) { fail }
}

pub fn is_nft_owner(tx: Transaction) {
  expect Some(referenceInput) = list.at(tx.reference_inputs, 0)
  expect Some(cred) = referenceInput.output.address.stake_credential
  expect Inline(stake_key_hash) = cred
  expect VerificationKey(hash) = stake_key_hash
  and {
    quantity_of(referenceInput.output.value, POLICY_ID, ASSET_NAME) == 1,
    list.has(tx.extra_signatories, hash),
  }
}
```
- Uses **reference inputs** to read NFT without consuming
- Checks **stake credential** (not spending key) for delegation pattern

### MeshJS Governance Transactions
```typescript
// Delegate to DRep
txBuilder.voteDelegationCertificate({ dRepId }, rewardAddress)

// Register as DRep
txBuilder.drepRegistrationCertificate(dRepId, { anchorUrl, anchorDataHash })

// Cast vote
txBuilder.vote(
  { type: "DRep", drepId },
  { txHash: govActionTxHash, txIndex: govActionIndex },
  { voteKind: "Yes" }
)

// Vote with Plutus script
txBuilder.votePlutusScriptV3()
  .vote({ type: "DRep", drepId: scriptDRepId }, govAction, { voteKind: "Yes" })
  .voteScript(votingScriptCbor)
  .voteRedeemerValue("")
```

## 12. Security Best Practices

### Pre-Launch Checklist
- [ ] **Dust attack prevention**: Handle unexpected tokens in contract UTxOs
- [ ] **Double spending prevention**: Ensure contract logic enforced per-input
- [ ] **Stake key verification**: Verify funds sent to correct contract with right stake key
- [ ] **Mint-burn validation**: Confirm correct policy validation, not random asset names
- [ ] **Audit**: Mandatory before mainnet launch
- [ ] **Bug bounty**: Open source with community review if audit budget limited

### Contract Design Principles
- Keep validators minimal and focused
- Use datum for state, redeemer for action input
- Consider collateral requirements for all Phase 2 scripts
- Test thoroughly with `aiken check` before deployment
- Use reference scripts (CIP-33) to reduce tx size and fees

## 13. API Providers & Indexers

### Maestro
- API provider for Cardano queries
- Endpoints: address history, assets by policy, ada handle resolution, NFT holder history
- Dashboard: https://dashboard.gomaestro.org

### Blockfrost
- First API provider for Cardano
- Dashboard: https://blockfrost.io

### Kupo
- Self-hosted indexer (requires Cardano node)
- GitHub: https://github.com/CardanoSolutions/kupo

### Db-sync
- Original indexer requiring full node
- GitHub: https://github.com/IntersectMBO/cardano-db-sync

## 14. Network Environments

- **Mainnet**: Live network with real ADA
- **Preprod**: Staging for major upgrades, mirrors mainnet structure
- **Preview**: Showcases upcoming features, forks mainnet by ~4 weeks

## 15. Wallets (CIP-30 Compatible)

| Wallet | Desktop | Mobile |
|--------|---------|--------|
| Nami | ✓ | |
| Eternl | ✓ | ✓ |
| Begin | | ✓ |
| Vespr | | ✓ |
| Lace | ✓ | |
| NuFi | ✓ | |
| Yoroi | ✓ | ✓ |
| Flint | ✓ | ✓ |
| Gero | ✓ | |
| Typhon | ✓ | |

### CIP-30 Basic Flow
```javascript
const api = await cardano.nami.enable();
const balance = await api.getBalance();
const signedTx = await api.signTx(tx);
```

## 16. Cardano Node Operations

### Quick Setup (VPS)
```bash
wget https://github.com/input-output-hk/cardano-node/releases/download/8.1.2/cardano-node-8.1.2-linux.tar.gz
mkdir node && tar xvzf cardano-node-8.1.2-linux.tar.gz -C node
```

### Systemd Service
```ini
[Unit]
Description=Cardano Node
After=multi-user.target
[Service]
Type=simple
ExecStart=/home/ubuntu/node/cardano-node run \
  --config /home/ubuntu/node/config/mainnet-config.json \
  --topology /home/ubuntu/node/config/mainnet-topology.json \
  --database-path /home/ubuntu/node/mainnet/db/ \
  --socket-path /home/ubuntu/node/sockets/node.socket \
  --host-addr 0.0.0.0 --port 3001
Restart=on-failure
RestartSec=15s
[Install]
WantedBy=multi-user.target
```

### Snapshot Sync
```bash
curl -o - https://downloads.csnapshots.io/snapshots/mainnet/$(curl -s https://downloads.csnapshots.io/snapshots/mainnet/mainnet-db-snapshot.json | jq -r .[].file_name) | lz4 -c -d - | tar -x -C /root/node/mainnet/
```

### Submit API
```bash
./cardano-submit-api --config tx-submit-mainnet-config.yaml \
  --socket-path /root/node/sockets/node.socket \
  --port 8090 --mainnet --host-addr 0.0.0.0
```
Endpoint: `http://VPSIP:8090/api/submit/tx`

## 17. Ledger Eras

| Era | Key Features | Consensus | Hard Fork |
|-----|-------------|-----------|-----------|
| Byron | PoS | Ouroboros Classic/PBFT | Genesis |
| Shelley | Decentralized block production | TPraos | Shelley HF |
| Allegra | Token locking | TPraos | Allegra HF |
| Mary | Native tokens | TPraos | Mary HF |
| Alonzo | Plutus smart contracts | TPraos | Alonzo HF |
| Babbage | PlutusV2, Reference inputs, Inline datums | Praos | Vasil |
| Conway | Decentralized governance (CIP-1694) | Praos | Chang HF |

## 18. Key Concepts Glossary

- **eUTxO**: Extended Unspent Transaction Output — Cardano's accounting model
- **Datum**: Data attached to a script-locked UTxO (contract state)
- **Redeemer**: Data provided when spending from a script (action input)
- **ScriptContext**: Transaction-level information available to validators
- **CIP**: Cardano Improvement Proposal
- **CIP-30**: Wallet-webpage connection standard
- **CIP-33**: Reference scripts (reduce tx size)
- **CIP-57**: Plutus blueprint standard (generated by Aiken as `plutus.json`)
- **CIP-1694**: On-chain governance framework
- **DRep**: Delegated Representative in governance
- **SPO**: Stake Pool Operator
- **CC**: Constitutional Committee
- **Lovelace**: Smallest ADA unit (1 ADA = 1,000,000 lovelace)
- **ExUnits**: Execution units (memory + CPU) for Phase 2 scripts
- **Collateral**: UTxO reserved to compensate nodes if script validation fails
- **Reference Input**: Input read by script but not consumed (CIP-31)
- **Inline Datum**: Datum stored directly in UTxO (not just hash)

## 19. dApp-Wallet Integration (CIP-30)

### Standard
CIP-30 defines the **dApp-wallet web bridge**: wallets inject a `window.cardano.{walletName}` API that web pages call to connect, query balances, sign transactions, and submit to the blockchain.

**Spec**: https://cips.cardano.org/cip/CIP-0030
**CanIUse**: https://www.cardano-caniuse.io/

### Core API Methods
```typescript
const api = await window.cardano.nami.enable();
const balance   = await api.getBalance();          // lovelace string
const addresses = await api.getUsedAddresses();
const networkId = await api.getNetworkId();        // 0=testnet, 1=mainnet
const utxos     = await api.getUtxos();
const signedTx  = await api.signTx(txHex, true);   // partial sign
const txHash    = await api.submitTx(signedTx);
```

### Event Listeners
```typescript
api.onAccountChange((addresses: string[]) => { ... });
api.onNetworkChange((networkId: number) => { ... });
```

### Mobile-Only Wallets (Injected API Limitation)
Some wallets (e.g., **Tokeo**, **Vespr**, **Begin**) only inject their API when the DApp is opened **inside the wallet's built-in DApp browser**. For desktop Electron apps, a **QR-code bridge** or **deep-link callback** pattern is required:

**The QR Callback Flow**:
1. Desktop builds unsigned transaction or session payload
2. Displays QR code with `{ type: "cardano-sign", sessionId: "uuid", callback: "app://callback", network: "mainnet" }`
3. User scans with mobile wallet app → decodes payload
4. Wallet app reviews transaction → user signs
5. Wallet POSTs signed result to callback URL (HTTP localhost server or custom protocol handler)
6. Desktop receives signedTx/address and submits via Blockfrost/Koios

**Callback Mechanisms for Desktop**:

| Mechanism | Pros | Cons |
|-----------|------|------|
| Local HTTP server (localhost:3456) | Universal, any wallet can POST | Firewall prompts, port conflicts |
| Custom protocol (`mosaic-companion://`) | Native feel, no server process | Mobile OS may block unknown protocols |
| WebSocket | Real-time, bidirectional | More complex, needs connection management |
| Polling + cloud relay | Works across networks | Privacy concern, needs backend |

**Security Considerations**:
- Session IDs must use `crypto.randomUUID()` — never `Math.random()` or predictable sequences
- Always set a max polling timeout (e.g., 5 minutes) and clean up intervals/servers when user closes modal
- Validate callback origin to prevent spoofed scan responses
- Store Blockfrost/Koios API keys in Electron `safeStorage`, never in renderer plaintext

**Desktop Detection Rule**:
- If `window.cardano?.tokeo` is `undefined` (desktop Chrome/Electron), hide "Extension" button — only show QR
- If `window.cardano?.tokeo` exists (inside wallet DApp browser), show "Extension" button — QR optional

See `references/tokeo-wallet-integration.md` for a complete multi-chain wallet integration reference with TypeScript types, React hooks, Electron QR bridge examples, and NFT verification by policy ID.
Modern wallets support multiple chains with different namespaces:

| Chain | Namespace | Address | Message Sign | Tx Sign |
|-------|-----------|---------|--------------|---------|
| Cardano | `window.cardano.{wallet}` | Bech32/Base58 | CIP-30 / ECDSA | CBOR PSBT |
| Bitcoin | `window.{wallet}.bitcoin` | Taproot | BIP322 / ECDSA | Base64 PSBT |
| Sui | `window.{wallet}.sui` | 0x-prefixed hex | Ed25519 | BCS TX Block |

See `references/tokeo-wallet-integration.md` for a complete multi-chain wallet integration reference with TypeScript types, React hooks, and Electron QR bridge examples.

## 20. Integration with Mosaic Companion

When integrating Cardano capabilities into Mosaic Companion:

1. **Wallet Layer**: Use CIP-30 compatible wallets (Nami, Eternl, Lace, Tokeo) via browser extension or QR bridge
2. **Off-Chain Layer**: Use MeshJS for tx building, Blockfrost/Maestro for data queries
3. **Contract Layer**: Use Aiken for validator development, generate `plutus.json` blueprints
4. **Governance Layer**: Use MeshJS governance APIs for DRep voting and proposal submission
5. **Node Layer**: Optional self-hosted node for submit-api or Kupo indexer
6. **Security**: Follow pre-launch checklist, implement dust attack protection, validate stake keys

### Pattern: Read-Only Queries
```typescript
const provider = new BlockfrostProvider(API_KEY);
const utxos = await provider.fetchAddressUTxOs(address);
const assets = await provider.fetchAddressAssets(address);
```

### Pattern: Contract Interaction
```typescript
// 1. Load blueprint
const blueprint = JSON.parse(fs.readFileSync("plutus.json", "utf8"));
const scriptCbor = applyParamsToScript(blueprint.validators[0].compiledCode, []);

// 2. Build tx
const txBuilder = new MeshTxBuilder({ fetcher: provider, submitter: provider });
const unsignedTx = await txBuilder
  .txOut(validatorAddr, [{ unit: "lovelace", quantity: "10000000" }])
  .txOutInlineDatumValue(mConStr0([pubKeyHash]))
  .changeAddress(changeAddress)
  .selectUtxosFrom(utxos)
  .complete();

// 3. Sign and submit
const signedTx = await wallet.signTx(unsignedTx);
const txHash = await wallet.submitTx(signedTx);
```

## 21. Resources

- **eUTxO Fundamentals Book**: https://github.com/elRaulito/eUTxO-Fundamentals-Building-Cardano-Smart-Contracts
- **Aiken**: https://aiken-lang.org/
- **Helios**: https://www.hyperion-bt.org/helios-book/
- **OpShin**: https://book.opshin.dev/
- **Plu-ts**: https://book.plu-ts.dev/
- **MeshJS**: https://meshjs.dev/
- **Cardano Developer Portal**: https://developers.cardano.org/
- **CIP Repository**: https://github.com/cardano-foundation/CIPs

## Skill Support Files

- `references/aiken-hello-world.md` — Aiken starter project walkthrough
- `references/tokeo-wallet-integration.md` — Multi-chain wallet integration (CIP-30, Tokeo, QR bridge, Electron)
- `references/electron-cardano-qr-bridge-verified.md` — **VERIFIED IMPLEMENTATION**: Complete Electron IPC bridge with Koios NFT verification, local HTTP callback server, session manager, and all TypeScript fixes (session 2026-05-13, kanban `t_44717571`)

## Consolidated Skills

This umbrella skill absorbed the following narrower siblings. See `references/` for their session-specific content:

| Absorbed Skill | Where its content lives | What it added |
|---|---|---|
| `plutus-v3-conway` | `references/plutus-v3-conway-*.md` | V2→V3 migration guide, governance scripts, unified context |
| `cardano-devnet-in-a-box` | (archived without support files) | Local devnet rehearsal stack for testing |