// =============================================================================
// TRAINING ROOM DEPLOYER — Bridge Stargate "Train" to Chat Rooms
// =============================================================================
// When user clicks "Train" in AdaPortal, deploys the agent to a live chat room
// where training happens via interaction. Logs all sessions to Vault.
//
// Flow:
//   1. Ensure chat connection
//   2. Create training room: "{agentName}-training-{skill}"
//   3. Assign agent via chatAPI.assignAgent → starts agent-runner
//   4. Navigate active tab to Chat Rooms
//   5. Log session to Vault "Training-Logs" box
// =============================================================================

const TRAINING_BOX_NAME = "Training-Logs";
const TARGET_SERVER_URL = "wss://agents-chat.hyperpg.site";

interface DeployResult {
  success: boolean;
  roomName?: string;
  roomId?: string;
  error?: string;
}

function getElectronAPI(): any {
  return (window as any).electronAPI;
}

function getChatAPI(): any {
  return (window as any).chatAPI;
}

/** Ensure Training-Logs box exists in Vault */
async function ensureTrainingBox(): Promise<string> {
  try {
    const boxes = await getElectronAPI().vault.getBoxes();
    let box = boxes.find((b: any) => b.name === TRAINING_BOX_NAME);
    if (!box) {
      const result = await getElectronAPI().vault.addBox({
        name: TRAINING_BOX_NAME,
        description: "Live training session logs from Stargate - Chat Rooms",
        sourceType: "manual",
      });
      if (result?.box) {
        box = result.box;
        console.log("[TrainingDeployer] Created vault box:", box.id);
      } else {
        console.warn("[TrainingDeployer] Could not create vault box:", result?.error);
        return "";
      }
    }
    return box?.id || "";
  } catch (e: any) {
    console.error("[TrainingDeployer] ensureTrainingBox failed:", e);
    return "";
  }
}

/** Append a training session entry to Vault */
async function logTrainingSession(
  boxId: string,
  agentName: string,
  skill: string,
  roomName: string,
  roomId: string,
  startedAt: number
): Promise<void> {
  if (!boxId) return;
  const timestamp = new Date(startedAt).toISOString();
  const content = [
    `## Training Session: ${skill}`,
    `Agent: ${agentName}`,
    `Room: ${roomName} (${roomId})`,
    `Started: ${timestamp}`,
    `Server: ${TARGET_SERVER_URL}`,
    `Status: active`,
    ``,
    `The agent has been deployed to a live chat room for interactive training.`,
    `Visit Chat Rooms to engage with the agent and guide its learning.`,
  ].join("\n");

  try {
    await getElectronAPI().vault.addEntry(boxId, {
      label: `${agentName} — ${skill} @ ${timestamp}`,
      content,
    });
    console.log("[TrainingDeployer] Logged session to vault box:", boxId);
  } catch (e: any) {
    console.error("[TrainingDeployer] Failed to log session:", e.message);
  }
}

/**
 * Deploy an agent to a training room.
 * Creates the room, assigns the agent (which triggers agent-runner),
 * logs the session, and signals navigation to Chat Rooms.
 */
export async function deployAgentToTrainingRoom(
  agentId: string,
  agentName: string,
  skill: string
): Promise<DeployResult> {
  const startedAt = Date.now();
  console.log("[TrainingDeployer] Deploying agent:", agentName, "skill:", skill);

  // ---------------------------------------------------------------------------
  // 1. Ensure chat connection
  // ---------------------------------------------------------------------------
  try {
    const status = await getChatAPI().status();
    if (status?.status !== "connected") {
      const settings = await getChatAPI().getSettings();
      if (!settings?.username) {
        await getChatAPI().saveSettings({
          serverUrl: TARGET_SERVER_URL,
          username: "user",
        });
      }
      await getChatAPI().connect();
    }
  } catch (e: any) {
    console.warn("[TrainingDeployer] Connection attempt:", e.message);
  }

  // ---------------------------------------------------------------------------
  // 2. Create or join training room
  // ---------------------------------------------------------------------------
  const roomName = `${agentName}-training-${skill}`;
  let roomId: string | undefined;

  try {
    const rooms = await waitForRooms(5000);
    const existing = rooms.find(
      (r: any) => r.name?.toLowerCase() === roomName.toLowerCase()
    );
    if (existing) {
      roomId = existing.id;
      console.log("[TrainingDeployer] Joining existing room:", roomName);
      await getChatAPI().joinRoom(roomId);
    } else {
      console.log("[TrainingDeployer] Creating room:", roomName);
      await getChatAPI().createRoom(roomName, "public");
      const roomsAfter = await waitForRooms(3000);
      const created = roomsAfter.find(
        (r: any) => r.name?.toLowerCase() === roomName.toLowerCase()
      );
      roomId = created?.id;
    }
  } catch (e: any) {
    console.error("[TrainingDeployer] Room creation failed:", e);
    return { success: false, error: `Room creation failed: ${e.message}` };
  }

  if (!roomId) {
    return { success: false, error: "Could not determine room ID after creation" };
  }

  // ---------------------------------------------------------------------------
  // 3. Assign agent to room (agent-runner starts automatically)
  // ---------------------------------------------------------------------------
  try {
    await getChatAPI().assignAgent(roomId, agentId, agentName, {
      skillName: skill,
      systemPrompt: `You are in training mode for skill: ${skill}. Engage with the training room and respond to guidance.`,
    });
    console.log(`[TrainingDeployer] Assigned ${agentName} to room ${roomId}`);
  } catch (e: any) {
    console.error("[TrainingDeployer] Agent assignment failed:", e);
    return { success: false, error: `Agent assignment failed: ${e.message}` };
  }

  // ---------------------------------------------------------------------------
  // 4. Signal navigation to Chat Rooms
  // ---------------------------------------------------------------------------
  const trainingSignal = JSON.stringify({
    roomId,
    roomName,
    agentName,
    agentId,
    skill,
    timestamp: startedAt,
  });
  sessionStorage.setItem("stargate_training_deployment", trainingSignal);
  console.log("[TrainingDeployer] Wrote nav signal to sessionStorage");

  // ---------------------------------------------------------------------------
  // 5. Log session to Vault
  // ---------------------------------------------------------------------------
  const boxId = await ensureTrainingBox();
  if (boxId) {
    await logTrainingSession(boxId, agentName, skill, roomName, roomId, startedAt);
  }

  return { success: true, roomName, roomId };
}

/** Wait for rooms list from server */
function waitForRooms(timeoutMs: number): Promise<any[]> {
  return new Promise((resolve) => {
    let resolved = false;
    const cleanup = getChatAPI().onRoomsUpdated((rooms: any[]) => {
      if (!resolved) {
        resolved = true;
        cleanup && cleanup();
        resolve(rooms);
      }
    });
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        cleanup && cleanup();
        resolve([]);
      }
    }, timeoutMs);
  });
}
