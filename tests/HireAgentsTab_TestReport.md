# Hire Agents Tab Test Report

**Task:** Mosaic Companion Hire Agents Tab Testing + Kanban Integration

**Component:** AdaPortalPanel → Marketplace Tab (Hire Agents)

**Tab ID:** `marketplace`

**Date:** 2026-06-10

**Tester:** Kanban Worker (ops)

---

## Executive Summary

The Hire Agents tab allows users to browse AI agent marketplace listings and hire agents. The current implementation has basic hiring functionality via callbacks, but **PaymentService integration is missing** and kanban task creation relies on the HermesAgentOrchestrator.

### Key Findings
- ✅ Agent listings populate from AgentMarketplaceService
- ✅ Hire button triggers handleHireAgent callback
- ✅ Wallet adapter integration exists (Base chain support)
- ❌ PaymentService.checkBalance NOT implemented
- ❌ PaymentService.payForAgent NOT implemented  
- ⚠️ Kanban task creation exists in HermesAgentOrchestrator but not wired to onHireAgent

---

## Test Results

### 1. Agent Listings Population ✅ PASSED

**Test:** Verify agent listings populate from stargateRegistry.getAgents() and HyperInsight

**Code Location:** `/home/mauricio/mosaic-companion/src/components/AdaPortalPanel.tsx:355`

**Implementation:**
```typescript
const loadData = useCallback(async () => {
  setIsLoading(true);
  console.log('[AdaPortal] loadData: Fetching real data from HyperInsight + user agents...');
  try {
    // 1. Load agents (async — from real user config + HyperInsight AIMs)
    const marketplaceListings = await agentMarketplace.getListings();
    console.log('[AdaPortal] listings loaded:', marketplaceListings.length);
    setListings(marketplaceListings);
```

**Data Sources:**
- `agentMarketplace.getListings()` → loads from user AI agent configs
- HyperInsight AIMs → for backing compute nodes
- StargateRegistry → fallback for built-in agents

**Status:** ✅ PASS - Uses real data from marketplace service

---

### 2. Hire Button Triggers Wallet Detection ⚠️ PARTIAL

**Test:** Verify "Hire" button triggers wallet detection flow

**Code Location:** `/home/mauricio/mosaic-companion/src/components/AdaPortalPanel.tsx:1005-1013`

**Current Implementation:**
```typescript
const handleHireAgent = useCallback((listing: MarketplaceListing) => {
  console.log('[AdaPortal] handleHireAgent called:', listing.agentName);
  if (onHireAgent) {
    onHireAgent(listing.agentId, listing.agentName);
  } else if (onNavigateToChat) {
    onNavigateToChat(`Hire agent ${listing.agentName} for my project`);
  }
  showNotification('success', `Hiring ${listing.agentName}...`);
}, [onHireAgent, onNavigateToChat]);
```

**Issues Found:**
- ❌ No wallet detection (PaymentService.detectWallet not called)
- ❌ No balance validation (PaymentService.checkBalance not called)
- ❌ No actual payment execution (PaymentService.payForAgent not called)
- ⚠️ onHireAgent callback is passed from parent but not integrated with orchestrator

**Button UI:** `/home/mauricio/mosaic-companion/src/components/AdaPortalPanel.tsx:2264-2270`
```tsx
<button 
  onClick={() => handleHireAgent(listing)}
  className="mt-3 w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
>
  <ArrowRight size={16} />
  Hire Agent
</button>
```

**Status:** ⚠️ PARTIAL - Button exists but payment flow not implemented

---

### 3. PaymentService.checkBalance ❌ NOT IMPLEMENTED

**Test:** Verify PaymentService validates USDC + ETH balances

**Expected from task:**
```
PaymentService.checkBalance(address, price) — USDC + ETH
```

**Actual Status:**
- ❌ PaymentService does not exist in codebase
- ❌ No USDC balance checking
- ❌ No ETH/gas balance checking
- ⚠️ Wallet adapter exists but only handles connection, not token balances

**Wallet Adapter:** `/home/mauricio/mosaic-companion/src/components/AdaPortalPanel.tsx:43`
```typescript
import {
  anfeService, 
  hboxPoolService,
  walletAdapter,
  ...
} from '../services/StargatePool';
```

**Status:** ❌ FAIL - PaymentService needs to be implemented

---

### 4. USDC Transfer Execution ❌ NOT IMPLEMENTED

**Test:** Verify USDC transfer executes on Base

**Expected from task:**
```
PaymentService.payForAgent() — USDC transfer
  → On success: agentEconomy.createContract()
               + onHireAgent() callback
               + Kanban task trigger for deployment
```

**Actual Status:**
- ❌ No PaymentService.payForAgent method
- ❌ No agentEconomy.createContract
- ⚠️ onHireAgent callback exists but not wired to kanban
- ⚠️ Base chain switching exists (line 76-87)

**Base Chain Support:** `/home/mauricio/mosaic-companion/src/components/AdaPortalPanel.tsx:76-87`
```typescript
async function ensureOnBaseChain(): Promise<void> {
  const state = walletAdapter.getState();
  if (!state.isConnected || state.chainId === 8453) return;
  try {
    await walletAdapter.switchChain(8453); // Base mainnet
    console.log('[AdaPortal] Auto-switched to Base chain');
  } catch (e) {
    console.warn('[AdaPortal] Failed to auto-switch to Base:', e);
  }
}
```

**Status:** ❌ FAIL - Payment execution not implemented

---

### 5. Kanban Task Auto-Creation ⚠️ EXISTS BUT NOT WIRED

**Test:** Verify kanban task creation trigger on successful hire

**Current Flow:**
1. User clicks "Hire" → handleHireAgent called
2. handleHireAgent calls onHireAgent callback (if provided)
3. ❌ No connection to HermesAgentOrchestrator

**HermesAgentOrchestrator Implementation:** `/home/mauricio/mosaic-companion/src/services/stargate/HermesAgentOrchestrator.ts:222-340`

```typescript
async hireAgent(params: HireAgentParams): Promise<OrchestratorTask> {
  const task: OrchestratorTask = {
    taskId: `hire-${Date.now()}`,
    status: 'backlog',
    type: 'hire',
    params,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    logs: [`Created hire task for ${params.agentName} (${params.role})`],
  };

  // ... skill sync phases ...

  // Creates kanban task via SSH dispatch
  const sshOut = await this._dispatchViaSSH(
    targetNodeId,
    `~/.local/bin/hermes kanban create "Deploy ${params.agentName} (${params.role})" --body "..." --assignee ${profileName}`
  );

  // Fallback: Electron spawn
  const electronTaskId = await this._spawnKanbanTask(
    `Deploy ${params.agentName} (${params.role})`,
    `Skills: ${params.skills.join(', ')} | Tier: ${params.computeTier}`,
    targetNodeId
  );
}
```

**HireAgentParams Interface:** `/home/mauricio/mosaic-companion/src/services/stargate/HermesAgentOrchestrator.ts:13-21`
```typescript
export interface HireAgentParams {
  agentName: string;
  role: string;
  skills: string[];
  computeTier: 'standard' | 'high_performance' | 'dedicated';
  targetNodeId?: string;
  description?: string;
  missionPrompt?: string;
}
```

**Usage in StargateFleetPanel:** `/home/mauricio/mosaic-companion/src/components/stargate/StargateFleetPanel.tsx:59-71`
```typescript
const handleHire = async () => {
  if (!hireForm.agentName || !hireForm.role) return;
  const task = await hermesAgentOrchestrator.hireAgent({
    agentName: hireForm.agentName,
    role: hireForm.role,
    skills: hireForm.skills || [],
    computeTier: hireForm.computeTier || 'standard',
    targetNodeId: selectedNode?.nodeId,
  });
  console.log('[Fleet] Hired:', task.taskId);
  setHireOpen(false);
};
```

**Status:** ⚠️ PARTIAL - Orchestrator exists but not integrated with marketplace tab

---

### 6. Agent Appears in User's Fleet ❌ NOT IMPLEMENTED

**Test:** Verify hired agent appears in user's fleet after successful hire

**Expected:** After payment + kanban task creation, agent should be added to user's agents

**Actual:** No fleet persistence logic found in handleHireAgent

**Status:** ❌ FAIL - Fleet integration not implemented

---

### 7. Transaction Receipt Logging ❌ NOT IMPLEMENTED

**Test:** Verify transaction receipt is logged

**Expected:** Payment transaction hash logged to vault or chronicle

**Actual:** No transaction logging found

**Status:** ❌ FAIL - Not implemented

---

### 8. No UI Hangs During Payment ⚠️ NOT TESTABLE

**Test:** Verify UI doesn't hang during payment flow

**Expected:** Loading states, error handling, timeout recovery

**Actual:** No payment flow exists to test

**Status:** ⚠️ N/A - Cannot test without PaymentService

---

## Files Examined

1. **AdaPortalPanel.tsx** - Main marketplace UI component
   - handleHireAgent callback: line 1005-1013
   - Marketplace listings UI: line 2240-2275
   - Wallet integration: lines 43, 76-87

2. **HermesAgentOrchestrator.ts** - Kanban task creation
   - hireAgent method: line 222-340
   - _spawnKanbanTask: line 448-467
   - _dispatchViaSSH: line 401-443

3. **AgentMarketplaceService.ts** - Agent data source
   - getListings: line 201-204
   - Uses HyperInsight + user configs

4. **StargateFleetPanel.tsx** - Fleet hire dialog example
   - handleHire: line 59-71
   - Shows how orchestrator should be used

5. **UnifiedOrchestrator.ts** - Higher-level orchestration
   - batchHireToFleet: line 290-297
   - Combines multi-agent + fleet dispatch

---

## Critical Import Pattern Verified

```typescript
// ✅ CORRECT — real orchestrator singleton
import { hermesAgentOrchestrator, HireAgentParams } 
  from '../../services/stargate/HermesAgentOrchestrator';
```

This import is correct and matches the task requirement.

---

## Acceptance Criteria Summary

| Criteria | Status | Notes |
|----------|--------|-------|
| Agent listings populate | ✅ PASS | From AgentMarketplaceService |
| "Hire" triggers wallet detection | ❌ FAIL | PaymentService not implemented |
| PaymentService.checkBalance validates | ❌ FAIL | No PaymentService exists |
| USDC transfer executes on Base | ❌ FAIL | Payment execution not implemented |
| On success: agent in fleet | ❌ FAIL | Fleet persistence not implemented |
| Kanban task auto-created | ⚠️ PARTIAL | Orchestrator exists but not wired |
| Transaction receipt logged | ❌ FAIL | Not implemented |
| No UI hangs during payment | ⚠️ N/A | Cannot test without payment flow |

---

## Recommendations

### Immediate Actions Required

1. **Implement PaymentService** (`src/services/PaymentService.ts`)
   - detectWallet(): Check EVM wallet connection
   - checkBalance(address, price): Validate USDC + ETH balances
   - payForAgent(): Execute USDC transfer on Base

2. **Wire HermesAgentOrchestrator to AdaPortalPanel**
   - Update handleHireAgent to call orchestrator after payment
   - Pass required HireAgentParams (role, skills, computeTier)

3. **Add Fleet Persistence**
   - Store hired agents in user config via aiAgents API
   - Update agentMarketplace after successful hire

### Code Integration Example

```typescript
// In AdaPortalPanel.tsx - Enhanced handleHireAgent
const handleHireAgent = useCallback(async (listing: MarketplaceListing) => {
  console.log('[AdaPortal] handleHireAgent:', listing.agentName);
  
  try {
    // 1. Check wallet
    const wallet = await paymentService.detectWallet();
    if (!wallet) { /* show connect dialog */ return; }
    
    // 2. Check balances
    const hasFunds = await paymentService.checkBalance(wallet, listing.pricing.perTaskMin);
    if (!hasFunds) { /* show insufficient funds */ return; }
    
    // 3. Execute payment
    const receipt = await paymentService.payForAgent(listing.agentId, listing.pricing);
    if (!receipt.success) { /* show error */ return; }
    
    // 4. Create kanban task
    const task = await hermesAgentOrchestrator.hireAgent({
      agentName: listing.agentName,
      role: listing.roles[0],
      skills: listing.primarySkills,
      computeTier: 'standard',
      description: `Hired from marketplace: ${listing.listingId}`,
      missionPrompt: `Deploy ${listing.agentName} for user project`,
    });
    
    // 5. Add to fleet
    await agentMarketplace.addToFleet(listing.agentId, receipt.txHash);
    
    showNotification('success', `Hired ${listing.agentName}! Task: ${task.taskId}`);
  } catch (error) {
    showNotification('error', `Hire failed: ${error.message}`);
  }
}, [onHireAgent, onNavigateToChat]);
```

---

## Test Artifacts

- **Test Spec:** `/home/mauricio/mosaic-companion/tests/HireAgentsTab.spec.tsx`
- **Test Report:** `/home/mauricio/mosaic-companion/tests/HireAgentsTab_TestReport.md`
- **Parent Task:** t_0ae9e480 (Training Tab), t_f7399780 (Compute Tab)
- **Child Task:** t_e5510f2c

---

## Worker Session

**Session ID:** 20250610_154300_kanban_hire_agents
**Task ID:** t_c7966d6a
**Profile:** ops
