// main.js - Complete version with AI agents storage data
import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import {
  checkForUpdates,
  manualCheckForUpdates,
  initUpdater,
  applyAutoDownload,
  getLogFilePath,
  readLogFile,
} from "./updater";
import {
  getUpdateSettings,
  setUpdateSettings,
  getNodes,
  addNode,
  updateNode,
  deleteNode,
  getTitleBarStyle,
} from "./settings";

import {
  getDirectoryStatus,
  readAgentHistories,
  readAgentHistory,
  writeAgentHistory,
  deleteAgentHistory,
  deleteAllAgentHistories,
  getErrorMessage,
} from "./utils/index";
import { mcpClient } from "./integrations/mcp/index";

// ESM equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, "..");
// =============================================================================
// Type Definitions
// =============================================================================

interface Node {
  id: string;
  name: string;
  apiHost: string;
  apiPort: string;
  hasAdminPanel: boolean;
  adminHost: string;
  adminPort: string;
  isActive: boolean;
}

interface AIAgent {
  id: string | number;
  name: string;
  [key: string]: unknown;
}

interface ChatSession {
  id: string;
  agentId: string;
  [key: string]: unknown;
}

interface ThemeSettings {
  activeTheme: string;
}

// =============================================================================
// App Setup
// =============================================================================

// Declare variables of paths to folders that will use user data
const agentsHistoryPath = path.join(app.getPath("userData"), "agents_history");

// Keep reference to main window for recreation
let mainWindow: BrowserWindow | null = null;
function createWindow(urlToLoad: string | null = null): BrowserWindow {
  const titleBarStyle = getTitleBarStyle();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: titleBarStyle === "default" ? "default" : "hidden",
    trafficLightPosition: { x: 10, y: 10 },
    backgroundColor: "#111827",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // preload is in dist_electron
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      backgroundThrottling: false,
    },
  });

  // Load specified URL or default to index.html
  if (urlToLoad) {
    win.loadURL(urlToLoad);
  } else {
    // dist folder is at project root, not inside dist_electron
    win.loadFile(path.join(PROJECT_ROOT, "dist", "index.html"));
  }

  mainWindow = win;
  return win;
}

app.on("before-quit", () => {
  mcpClient.disconnectAll();
});

/**
 * Recreate the window with current settings.
 * Used to apply titleBarStyle changes without full app restart.
 */
function recreateWindow(): void {
  if (!mainWindow) return;

  // Get current state
  const currentURL = mainWindow.webContents.getURL();
  const bounds = mainWindow.getBounds();

  // Close the old window
  mainWindow.close();

  // Create new window with updated settings
  const newWin = createWindow(currentURL);
  newWin.setBounds(bounds);

  console.log("Window recreated with new titleBarStyle");
}

// IPC handler to trigger window recreation from renderer
ipcMain.handle("restart-window", async () => {
  recreateWindow();
  return { success: true };
});

// IPC handler for 3-button confirmation dialog
ipcMain.handle("show-title-bar-confirm", async () => {
  const { dialog } = await import("electron");

  const result = await dialog.showMessageBox(mainWindow!, {
    type: "question",
    title: "Apply Title Bar Style",
    message: "This will refresh the window to apply the new title bar style.",
    detail: "Any unsaved work could be lost.",
    buttons: ["Apply Now", "Apply Later", "Cancel"],
    defaultId: 0,
    cancelId: 2,
  });

  // button index: 0 = Apply Now, 1 = Apply Later, 2 = Cancel
  return { buttonIndex: result.response };
});

// Suppress ERR_ABORTED errors from webviews (harmless redirects, especially Google)
app.on("web-contents-created", (_event, contents) => {
  contents.on(
    "did-fail-load",
    (event, errorCode, _errorDescription, _validatedURL, _isMainFrame) => {
      // Suppress ERR_ABORTED (-3) errors - these are harmless navigation aborts from redirects
      if (errorCode === -3) {
        event.preventDefault();
        return;
      }
    },
  );
});

app.whenReady().then(() => {
  console.log("User data path:", app.getPath("userData"));
  const agentsHistoryPathExist = getDirectoryStatus(agentsHistoryPath);
  if (!agentsHistoryPathExist.exists) {
    try {
      fs.mkdirSync(agentsHistoryPath, { recursive: true });
    } catch (e) {
      console.log(`Error when creating agents path: ${e}`);
    }
  }
  createWindow();

  // Initialize updater with settings and check for updates on startup (skip in development)
  if (app.isPackaged) {
    initUpdater();
    checkForUpdates();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ============================================
// CSV Logging
// ============================================
const csvPath = path.join(app.getPath("userData"), "input_history.csv");

if (!fs.existsSync(csvPath)) {
  fs.writeFileSync(csvPath, "timestamp,text\n", "utf8");
}

ipcMain.handle(
  "log-input",
  async (_event: IpcMainInvokeEvent, text: string) => {
    try {
      const timestamp = new Date().toISOString();
      const escapedText = `"${text.replace(/"/g, '""').replace(/\n/g, "\\n")}"`;
      const line = `${timestamp},${escapedText}\n`;
      fs.appendFileSync(csvPath, line, "utf8");
      return { success: true, path: csvPath };
    } catch (error) {
      console.log(error);
      return { success: false, path: csvPath };
    }
  },
);

ipcMain.handle("get-csv-path", () => csvPath);

// Handler for the button "Check for Updates"
ipcMain.handle("check-for-updates", async () => {
  if (app.isPackaged) {
    manualCheckForUpdates();
    return { triggered: true };
  }
  // Development mode: show dialog explaining updates are disabled
  const { dialog } = await import("electron");
  dialog.showMessageBox({
    type: "info",
    title: "Development Mode",
    message: "Updates are disabled in development mode.",
    detail: "Build and run the packaged app to test updates.",
  });
  return { triggered: false, reason: "Updates disabled in development mode" };
});

// Handler to get current update settings
ipcMain.handle("get-update-settings", async () => {
  return getUpdateSettings();
});

// Handler to set update settings
ipcMain.handle(
  "set-update-settings",
  async (
    _event: IpcMainInvokeEvent,
    newSettings: { autoDownload?: boolean; titleBarStyle?: string },
  ) => {
    const result = setUpdateSettings(newSettings);
    // Apply autoDownload to updater if it changed
    if (result.success && result.settings) {
      applyAutoDownload(result.settings.autoDownload);
    }
    return result;
  },
);

// Handler to get update log file path
ipcMain.handle("get-update-log-path", async () => {
  return getLogFilePath();
});

// Handler to read update logs
ipcMain.handle("get-update-logs", async () => {
  return readLogFile();
});

// ============================================
// Hypercycle Nodes
// ============================================

// Helper to broadcast node changes to all windows
function broadcastNodesChanged(nodes: Node[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("nodes-changed", nodes);
  });
}

// Get all nodes
ipcMain.handle("nodes:get", async () => {
  return getNodes();
});

// Add a new node
ipcMain.handle(
  "nodes:add",
  async (_event: IpcMainInvokeEvent, node: Partial<Omit<Node, "id">>) => {
    const result = addNode(node);
    if (result.success && result.nodes) {
      broadcastNodesChanged(result.nodes);
    }
    return result;
  },
);

// Update a node
ipcMain.handle(
  "nodes:update",
  async (
    _event: IpcMainInvokeEvent,
    id: string,
    updates: Partial<Omit<Node, "id">>,
  ) => {
    const result = updateNode(id, updates);
    if (result.success && result.nodes) {
      broadcastNodesChanged(result.nodes);
    }
    return result;
  },
);

// Delete a node
ipcMain.handle(
  "nodes:delete",
  async (_event: IpcMainInvokeEvent, id: string) => {
    const result = deleteNode(id);
    if (result.success && result.nodes) {
      broadcastNodesChanged(result.nodes);
    }
    return result;
  },
);

// ============================================
// AI Agents Storage
// ============================================
const aiAgentsPath = path.join(app.getPath("userData"), "ai-agents.json");
const themesPath = path.join(app.getPath("userData"), "themes.json");

// Helper: Read agents from file
function readAgents(): AIAgent[] {
  try {
    if (fs.existsSync(aiAgentsPath)) {
      const data = fs.readFileSync(aiAgentsPath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read AI agents:", error);
  }
  return [];
}

// Helper: Write agents to file
function writeAgents(agents: AIAgent[]): boolean {
  try {
    fs.writeFileSync(aiAgentsPath, JSON.stringify(agents, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write AI agents:", error);
    return false;
  }
}

// Theme helpers
function readThemeSettings(): ThemeSettings {
  try {
    if (fs.existsSync(themesPath)) {
      const data = fs.readFileSync(themesPath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read theme settings:", error);
  }
  return { activeTheme: "dark" };
}

function writeThemeSettings(settings: ThemeSettings): boolean {
  try {
    fs.writeFileSync(themesPath, JSON.stringify(settings, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write theme settings:", error);
    return false;
  }
}

// Get all agents
ipcMain.handle("ai-agents:get", async () => {
  return readAgents();
});

// Set all agents (replace entire list)
ipcMain.handle(
  "ai-agents:set",
  async (_event: IpcMainInvokeEvent, agents: AIAgent[]) => {
    try {
      writeAgents(agents);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
);

// Add single agent
ipcMain.handle(
  "ai-agents:add",
  async (_event: IpcMainInvokeEvent, agent: AIAgent) => {
    try {
      const agents = readAgents();
      agents.push(agent);
      writeAgents(agents);
      const agentPath = path.join(agentsHistoryPath, agent.id.toString());
      fs.mkdirSync(agentPath, { recursive: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
);

// Update single agent
ipcMain.handle(
  "ai-agents:update",
  async (
    _event: IpcMainInvokeEvent,
    id: string,
    updates: Partial<Omit<AIAgent, "id">>,
  ) => {
    try {
      const agents = readAgents();
      const index = agents.findIndex((a) => a.id === id);
      if (index === -1) {
        return { success: false, error: "Agent not found" };
      }
      agents[index] = { ...agents[index], ...updates };
      writeAgents(agents);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
);

// Delete single agent
ipcMain.handle(
  "ai-agents:delete",
  async (_event: IpcMainInvokeEvent, id: string) => {
    try {
      const agents = readAgents();
      const filtered = agents.filter((a) => a.id !== id);
      writeAgents(filtered);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
);

// Clear all agents
ipcMain.handle("ai-agents:clear", async () => {
  try {
    writeAgents([]);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});

// Theme persistence
ipcMain.handle("themes:get", async () => {
  return readThemeSettings();
});

ipcMain.handle(
  "themes:set",
  async (_event: IpcMainInvokeEvent, activeTheme: string) => {
    const settings: ThemeSettings = { activeTheme };
    const success = writeThemeSettings(settings);
    return { success };
  },
);

// ============================================
// AI Agents History
// ============================================

ipcMain.handle(
  "ai-agents-history:get-all",
  async (_event: IpcMainInvokeEvent, agentId: string) => {
    return readAgentHistories(agentId);
  },
);

ipcMain.handle(
  "ai-agents-history:get",
  async (_event: IpcMainInvokeEvent, agentId: string, sessionId: string) => {
    return readAgentHistory(agentId, sessionId);
  },
);

ipcMain.handle(
  "ai-agents-history:save",
  async (_event: IpcMainInvokeEvent, chatSession: ChatSession) => {
    try {
      const success = writeAgentHistory(chatSession);
      return { success };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
);

ipcMain.handle(
  "ai-agents-history:delete",
  async (_event: IpcMainInvokeEvent, agentId: string, sessionId: string) => {
    try {
      const success = deleteAgentHistory(agentId, sessionId);
      return { success };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
);

ipcMain.handle(
  "ai-agents-history:delete-all",
  async (_event: IpcMainInvokeEvent, agentId: string) => {
    try {
      const success = deleteAllAgentHistories(agentId);
      return { success };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  },
);
