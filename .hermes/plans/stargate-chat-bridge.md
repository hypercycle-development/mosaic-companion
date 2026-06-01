# Stargate-to-Chat Training Room Bridge

## Overview
Bridge the Stargate "Train Agents" flow into Mosaic-Companion Chat Rooms. When a user clicks Train on an agent, the agent gets deployed to a live chat room where it can train interactively. Training sessions are logged to Vault.

## Files

### 1. Deployer Service `src/services/stargate/TrainingRoomDeployer.ts`
- `deployAgentToTrainingRoom(agentId, agentName, skill)`
  1. Ensures chat connection via `window.chatAPI`
  2. Creates/joins room named `{agentName}-training-{skill}`
  3. Assigns agent with training context (injects system prompt)
  4. Writes nav signal to `sessionStorage["stargate_training_deployment"]`
  5. Logs session to Vault box "Training-Logs"
- Uses `(window as any).chatAPI` / `electronAPI` to avoid global.d.ts dependency

### 2. Agent Runner `electron/integrations/chat/agent-runner.ts`
- Added optional `trainingContext?: { skillName: string; systemPrompt?: string }` param
- Injected context becomes the system prompt for the LLM call, replacing the generic assistant prompt

### 3. Main Process `electron/integrations/chat/index.ts`
- `chat:assign-agent` IPC handler accepts `trainingContext` object and passes it to `startAgentInRoom`

### 4. CHATAPI `electron/integrations/chat/CHATAPI.ts`
- `assignAgent` signature extended with optional `trainingContext`

### 5. Preload Types `global.d.ts`
- `chatAPI.assignAgent` type signature updated

### 6. AdaPortalPanel `src/components/AdaPortalPanel.tsx`
- In `handleAgentConfirmed`, `'train'` case now:
  - Derives skill name from `selectedSkill?.name` or `selectedTrainer.listingId`
  - Dynamically imports `TrainingRoomDeployer`
  - Calls `deployAgentToTrainingRoom`
  - Shows notification on success/error
  - Triggers `onNavigateToChat` for navigation

### 7. ChatPage `src/components/ChatPage.tsx`
- Added `trainingInfo` and `trainingNotice` state
- `useEffect` reads `sessionStorage["stargate_training_deployment"]` on mount
- Auto-joins/selects the training room when it appears in room list
- Shows "Training" purple badge in room header
- Shows notice: "{Agent} is training here for '{skill}'. Interact to guide its learning."

## Build Verdict
- `npx tsc --noEmit` passes cleanly (no new errors introduced)

## Next Iteration Ideas
- Sparring mode: deploy two agents to same room
- Guided training: pre-load conversation threads into room history
- Multi-agent curriculum: sequential room hops driven by a script
