# Payments JIT Orchestrator (`payments-jit`)

This plugin acts as a Phase 2 & Phase 3 payment coordinator. It relies on the lower-level `aim-nodes` NodeManagerClient to execute tool requests but automatically detects when the node manager responds with `402 Payment Required`.

When a 402 is intercepted, this orchestrator springs into action, analyzing the payment rejection details, deciding on a top-up size according to configurable local policies (protecting user balances with per-tx and per-day caps), automatically transferring ERC20s like USDC/HyPC to the Node Manager, and re-triggering the call in a single fluid operation.

## Architecture 
The structure ensures we do not tightly couple Node HTTP clients with viem contracts. `aim-nodes` doesn't know about tokens, while `payments-jit` intercepts and handles ERC-20 transfers before deferring back to `aim-nodes`.

### 1. Policies (`policy.ts`)
Defaults protect against runaway agent spend.
- **Max top-up limits**: 50 USDC max per top up, 200 USDC max daily across all nodes.
- **Min top-up**: Always sends at least 10 USDC to minimize gas overhead (if configured for L1).
- **Safety multipliers**: Automatically sends 2x the `missing` requested amount to afford multiple calls before topping up again.

### 2. Supported Wallets 
Currently configured to aggressively utilize the `InternalWalletPaymentSigner` using Electron's `viem` wrapper to automatically sign background TXs natively via `safeStorage` exported keys in a backend headless format without requiring explicit web popup prompts. 

### 3. Claim Fallbacks (`balanceClaimer.ts`)
A critical part of the NM integration is mapping the `txHash` into an NM `/balance` POST payload. Since NM versions have drifted on expected schema fields (`tx-id` versus `tx_id`), the orchestrator tries the `dash` notation first. If 400 is returned indicating a validation exception, it transparently retries with the `underscore` format before aborting. 

## Exposing to MCP (Phase 3 Wrapper)
```ts
import { call_paid_aim } from 'mosaic-browser/plugins/payments-jit/main';

const response = await call_paid_aim({
  nodeUrl: 'http://ip:8000',
  slot: 0,
  actionPath: 'request',
  privateKey: '0x...',
  chainId: 8453
});
// Internally executes POST request -> intercepts 402 -> transfers USDC on Base -> Claims /balance -> Retries -> Returns data.
```
