import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent, powerMonitor } from "electron";
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
  getGmailAutoMarkRead,
  setGmailAutoMarkRead,
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
import { mcpClient, setMainWindow as mcpSetMainWindow, initPlugins } from "./integrations/mcp/index";
import { initializeTools, cleanupTools } from "./integrations/tools";
import { initMosaicBot } from "./integrations/mosaicbot/src/main/index";
import { initChat, setMainWindow as setChatMainWindow, stopChat } from "./integrations/chat/index";
import { createRequire } from 'module';
import { authenticate, isAuthenticated, signOut } from "./integrations/gmail";
import { getUserProfile, getRecentEmails, getEmailDetails, searchEmails, markAsRead, markAsUnread } from "./integrations/gmail/gmailClient";
import {
  loadConfig,
  saveConfig,
  setActiveNetwork,
  setCustomRpc,
  addToken,
  updateToken,
  deleteToken,
  setTransferLimit,
  removeTransferLimit,
  addBannedAddress,
  removeBannedAddress,
  updateSafetySettings,
  type Web3Config,
  type NetworkId,
} from "./integrations/web3/config";
import {
  getBoxes,
  getBox,
  addBox,
  updateBox,
  deleteBox,
  getAgentBoxes,
  getBoxContent,
  addEntry,
  updateEntry,
  deleteEntry,
} from "./integrations/vault";
import type { VaultBox } from "./integrations/vault/types";

// =============================================================================
// ESM Path Setup
// =============================================================================

// In packaged app: __dirname = /path/to/resources/app.asar/dist/main
// In development:  __dirname = /path/to/project/dist/main
// PROJECT_ROOT should be two levels up (the app.asar root or project root)
const PROJECT_ROOT = path.join(__dirname, "..", "..");

// Helper to check if we're running in development
const isDev = !app.isPackaged;

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
// Linux Sandbox State Detection
// =============================================================================
const sandboxState = {
  isFallback: process.env.MOSAIC_SANDBOX_FALLBACK === '1',
  isLinux: process.platform === 'linux',
  isAppImage: !!process.env.APPIMAGE,
  noSandboxFlag: process.argv.includes('--no-sandbox'),
};

if (sandboxState.isLinux && sandboxState.isAppImage) {
  console.log('🐧 Linux AppImage detected');
  console.log(`   Sandbox fallback: ${sandboxState.isFallback}`);
  console.log(`   No-sandbox flag: ${sandboxState.noSandboxFlag}`);
}

// =============================================================================
// Windows Squirrel Startup Handler (MUST be first!)
// =============================================================================
const require = createRequire(__filename);
if (process.platform === 'win32') {
  try {
    if (require('electron-squirrel-startup')) {
      process.exit(0);
    }
  } catch (e) {
    // electron-squirrel-startup not available (dev mode or non-Windows)
  }
}

// =============================================================================
// Single Instance Lock
// =============================================================================
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

// =============================================================================
// App Paths
// =============================================================================
const agentsHistoryPath = path.join(app.getPath("userData"), "agents_history");

// =============================================================================
// Window Management
// =============================================================================
let mainWindow: BrowserWindow | null = null;
let mosaicBotStop: (() => Promise<void>) | null = null;

function getIconPath(): string {
  // In packaged app, assets are at PROJECT_ROOT/assets
  // In dev, they're also at PROJECT_ROOT/assets (since PROJECT_ROOT = project root)
  const iconPath = path.join(PROJECT_ROOT, "assets", "icon.png");
  
  if (fs.existsSync(iconPath)) {
    return iconPath;
  }
  
  // Fallback for different platforms
  if (process.platform === 'win32') {
    const icoPath = path.join(PROJECT_ROOT, "assets", "icon.ico");
    if (fs.existsSync(icoPath)) return icoPath;
  }
  
  console.warn('Icon not found at:', iconPath);
  return iconPath; // Return anyway, Electron will handle missing icon gracefully
}

function createWindow(urlToLoad: string | null = null): BrowserWindow {
  const titleBarStyle = getTitleBarStyle();
  const useFrame = titleBarStyle === "default";
  const electronTitleBarStyle = titleBarStyle === "default" ? "default" : "hidden";

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: getIconPath(),
    frame: useFrame,
    titleBarStyle: electronTitleBarStyle,
    trafficLightPosition: { x: 10, y: 10 },
    backgroundColor: "#111827",
    webPreferences: {
      // preload.js is in the same directory as main.js (dist/main)
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      backgroundThrottling: false,
    },
  });

  // Load the app
  if (urlToLoad) {
    win.loadURL(urlToLoad);
  } else if (isDev && process.env.VITE_DEV_SERVER_URL) {
    // Development: load from Vite dev server
    console.log('Loading from Vite dev server:', process.env.VITE_DEV_SERVER_URL);
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    // Production: load from built files
    // Renderer build is at PROJECT_ROOT/dist/renderer
    const indexPath = path.join(PROJECT_ROOT, "dist", "renderer", "index.html");
    console.log("Loading index from:", indexPath);
    console.log("File exists:", fs.existsSync(indexPath));
    win.loadFile(indexPath);
  }

  // Debug: Log load failures
  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Failed to load ${validatedURL}: ${errorCode} (${errorDescription})`);
  });

  // Handle loss of CSS syles after hibernation (Mac)
  powerMonitor.on('resume', () => {
    if (win) {
      // Force reload to re-apply CSS
      win.reload()
    }
  })

  mainWindow = win;
  return win;
}

// Handle second instance (focus existing window)
app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

function recreateWindow(): void {
  if (!mainWindow) return;

  const currentURL = mainWindow.webContents.getURL();
  const bounds = mainWindow.getBounds();

  mainWindow.close();

  const newWin = createWindow(currentURL);
  newWin.setBounds(bounds);

  console.log("Window recreated with new titleBarStyle");
}

// =============================================================================
// App Lifecycle
// =============================================================================
app.on("before-quit", () => {
  mcpClient.disconnectAll();
  cleanupTools().catch(console.error);
  if (mosaicBotStop) mosaicBotStop().catch(console.error);
  stopChat();
});

// Suppress ERR_ABORTED errors from webviews
app.on("web-contents-created", (_event, contents) => {
  contents.on("did-fail-load", (event, errorCode) => {
    if (errorCode === -3) {
      event.preventDefault();
    }
  });
});

app.whenReady().then(() => {
  console.log("App is packaged:", app.isPackaged);
  console.log("User data path:", app.getPath("userData"));
  console.log("__dirname:", __dirname);
  console.log("PROJECT_ROOT:", PROJECT_ROOT);

  // Ensure agents history directory exists
  const agentsHistoryPathExist = getDirectoryStatus(agentsHistoryPath);
  if (!agentsHistoryPathExist.exists) {
    try {
      fs.mkdirSync(agentsHistoryPath, { recursive: true });
    } catch (e) {
      console.log(`Error when creating agents path: ${e}`);
    }
  }

  const win = createWindow();
  mcpSetMainWindow(win);
  setChatMainWindow(win);
  initPlugins().catch((e) => console.error("[MCP] Plugin init failed:", e));
  initChat();

  // Initialize tool registry
  initializeTools().catch((e) => console.error("[Tools] Init failed:", e));

  // Initialize MosaicBot agent subsystem
  initMosaicBot().then((bot) => {
    mosaicBotStop = bot.stop.bind(bot);
  }).catch((e) => {
    console.error("[MosaicBot] Init failed:", e);
  });

  // Initialize updater (production only)
  if (app.isPackaged) {
    initUpdater();
    setTimeout(() => {
      console.log("Starting update check...");
      checkForUpdates();
    }, 2000);
  }

  // Pre-initialize Gmail OAuth
  try {
    if (isAuthenticated()) {
      console.log("Gmail: Already authenticated, tokens loaded");
    }
  } catch (e) {
    // Ignore
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

// =============================================================================
// IPC Handlers
// =============================================================================

// Window Controls
ipcMain.handle("restart-window", async () => {
  recreateWindow();
  return { success: true };
});

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
  return { buttonIndex: result.response };
});

ipcMain.handle("window:minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.handle("window:maximize", () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.handle("window:close", () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle("window:is-maximized", () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// CSV Logging
const csvPath = path.join(app.getPath("userData"), "input_history.csv");

if (!fs.existsSync(csvPath)) {
  fs.writeFileSync(csvPath, "timestamp,text\n", "utf8");
}

ipcMain.handle("log-input", async (_event: IpcMainInvokeEvent, text: string) => {
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
});

ipcMain.handle("get-csv-path", () => csvPath);

// Update Handlers
ipcMain.handle("check-for-updates", async () => {
  if (app.isPackaged) {
    manualCheckForUpdates();
    return { triggered: true };
  }
  const { dialog } = await import("electron");
  dialog.showMessageBox({
    type: "info",
    title: "Development Mode",
    message: "Updates are disabled in development mode.",
    detail: "Build and run the packaged app to test updates.",
  });
  return { triggered: false, reason: "Updates disabled in development mode" };
});

ipcMain.handle("get-update-settings", async () => {
  return getUpdateSettings();
});

ipcMain.handle(
  "set-update-settings",
  async (_event: IpcMainInvokeEvent, newSettings: { autoDownload?: boolean; titleBarStyle?: string }) => {
    const result = setUpdateSettings(newSettings);
    if (result.success && result.settings) {
      applyAutoDownload(result.settings.autoDownload);
    }
    return result;
  }
);

ipcMain.handle("get-update-log-path", async () => {
  return getLogFilePath();
});

ipcMain.handle("get-update-logs", async () => {
  return readLogFile();
});

// Node Handlers
function broadcastNodesChanged(nodes: Node[]): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("nodes-changed", nodes);
  });
}

ipcMain.handle("nodes:get", async () => {
  return getNodes();
});

ipcMain.handle("nodes:add", async (_event: IpcMainInvokeEvent, node: Partial<Omit<Node, "id">>) => {
  const result = addNode(node);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});

ipcMain.handle("nodes:update", async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Omit<Node, "id">>) => {
  const result = updateNode(id, updates);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});

ipcMain.handle("nodes:delete", async (_event: IpcMainInvokeEvent, id: string) => {
  const result = deleteNode(id);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});

// Sandbox State
ipcMain.handle("sandbox:get-state", async () => sandboxState);

// AI Agents Storage
const aiAgentsPath = path.join(app.getPath("userData"), "ai-agents.json");
const themesPath = path.join(app.getPath("userData"), "themes.json");

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

function writeAgents(agents: AIAgent[]): boolean {
  try {
    fs.writeFileSync(aiAgentsPath, JSON.stringify(agents, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write AI agents:", error);
    return false;
  }
}

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

ipcMain.handle("ai-agents:get", async () => {
  return readAgents();
});

ipcMain.handle("ai-agents:set", async (_event: IpcMainInvokeEvent, agents: AIAgent[]) => {
  try {
    writeAgents(agents);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});

ipcMain.handle("ai-agents:add", async (_event: IpcMainInvokeEvent, agent: AIAgent) => {
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
});

ipcMain.handle("ai-agents:update", async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Omit<AIAgent, "id">>) => {
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
});

ipcMain.handle("ai-agents:delete", async (_event: IpcMainInvokeEvent, id: string) => {
  try {
    const agents = readAgents();
    const filtered = agents.filter((a) => a.id !== id);
    writeAgents(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});

ipcMain.handle("ai-agents:clear", async () => {
  try {
    writeAgents([]);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});

// Gmail Integration
ipcMain.handle("gmail:sign-in", async () => {
  try {
    await authenticate();
    const profile = await getUserProfile();
    return { success: true, email: profile.emailAddress };
  } catch (error: any) {
    console.error("Gmail sign-in error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("gmail:sign-out", async () => {
  try {
    signOut();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("gmail:get-status", async () => {
  try {
    const authenticated = isAuthenticated();
    if (authenticated) {
      const profile = await getUserProfile();
      return { authenticated: true, email: profile.emailAddress };
    }
    return { authenticated: false };
  } catch (error: any) {
    return { authenticated: false, error: error.message };
  }
});

ipcMain.handle("gmail:get-emails", async (_event, count = 10) => {
  try {
    const emails = await getRecentEmails(count);
    return { success: true, emails };
  } catch (error: any) {
    console.error("Gmail fetch error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("gmail:get-email-details", async (_event, messageId) => {
  try {
    const email = await getEmailDetails(messageId);
    return { success: true, email };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("gmail:search-emails", async (_event, query, count = 10) => {
  try {
    const emails = await searchEmails(query, count);
    return { success: true, emails };
  } catch (error: any) {
    console.error("Gmail search error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("gmail:mark-read", async (_event, messageId) => {
  try {
    await markAsRead(messageId);
    return { success: true };
  } catch (error: any) {
    console.error("Gmail mark read error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("gmail:mark-unread", async (_event, messageId) => {
  try {
    await markAsUnread(messageId);
    return { success: true };
  } catch (error: any) {
    console.error("Gmail mark unread error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("gmail:get-auto-mark-read", () => {
  return { enabled: getGmailAutoMarkRead() };
});

ipcMain.handle("gmail:set-auto-mark-read", (_event, enabled) => {
  const result = setGmailAutoMarkRead(enabled);
  return { ...result, enabled: getGmailAutoMarkRead() };
});

// Web3 Config Handlers (direct access for UI)
ipcMain.handle("web3:get-config", async () => {
  return loadConfig();
});

ipcMain.handle("web3:update-config", async (_event, updates: Partial<Web3Config>) => {
  try {
    const config = loadConfig();
    // Apply granular updates
    if (updates.activeNetwork) setActiveNetwork(updates.activeNetwork);
    if (updates.safety) updateSafetySettings(updates.safety);
    // For full config replacement (tokens, limits, bans updated via their own tools/IPC)
    const merged = { ...config, ...updates, safety: { ...config.safety, ...(updates.safety || {}) } };
    saveConfig(merged);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// Theme Handlers
ipcMain.handle("themes:get", async () => {
  return readThemeSettings();
});

ipcMain.handle("themes:set", async (_event: IpcMainInvokeEvent, activeTheme: string) => {
  const settings: ThemeSettings = { activeTheme };
  const success = writeThemeSettings(settings);
  return { success };
});

// Agent History Handlers
ipcMain.handle("ai-agents-history:get-all", async (_event: IpcMainInvokeEvent, agentId: string) => {
  return readAgentHistories(agentId);
});

ipcMain.handle("ai-agents-history:get", async (_event: IpcMainInvokeEvent, agentId: string, sessionId: string) => {
  return readAgentHistory(agentId, sessionId);
});

ipcMain.handle("ai-agents-history:save", async (_event: IpcMainInvokeEvent, chatSession: ChatSession) => {
  try {
    const success = writeAgentHistory(chatSession);
    return { success };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});

ipcMain.handle("ai-agents-history:delete", async (_event: IpcMainInvokeEvent, agentId: string, sessionId: string) => {
  try {
    const success = deleteAgentHistory(agentId, sessionId);
    return { success };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});

ipcMain.handle("ai-agents-history:delete-all", async (_event: IpcMainInvokeEvent, agentId: string) => {
  try {
    const success = deleteAllAgentHistories(agentId);
    return { success };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});

// =============================================================================
// Vault Handlers
// =============================================================================

ipcMain.handle("vault:get-boxes", async () => {
  return getBoxes();
});

ipcMain.handle("vault:get-box", async (_event: IpcMainInvokeEvent, id: string) => {
  return getBox(id);
});

ipcMain.handle(
  "vault:add-box",
  async (_event: IpcMainInvokeEvent, input: Partial<Omit<VaultBox, "id" | "createdAt" | "updatedAt">>) => {
    return addBox(input);
  },
);

ipcMain.handle(
  "vault:update-box",
  async (_event: IpcMainInvokeEvent, id: string, updates: Partial<Omit<VaultBox, "id" | "createdAt">>) => {
    return updateBox(id, updates);
  },
);

ipcMain.handle("vault:delete-box", async (_event: IpcMainInvokeEvent, id: string) => {
  return deleteBox(id);
});

ipcMain.handle("vault:get-agent-boxes", async (_event: IpcMainInvokeEvent, agentId: string) => {
  return getAgentBoxes(agentId);
});

ipcMain.handle("vault:get-box-content", async (_event: IpcMainInvokeEvent, boxId: string) => {
  return getBoxContent(boxId);
});

ipcMain.handle(
  "vault:add-entry",
  async (_event: IpcMainInvokeEvent, boxId: string, input: { content: string; label?: string }) => {
    return addEntry(boxId, input);
  },
);

ipcMain.handle(
  "vault:update-entry",
  async (_event: IpcMainInvokeEvent, boxId: string, entryId: string, updates: { content?: string; label?: string }) => {
    return updateEntry(boxId, entryId, updates);
  },
);

ipcMain.handle(
  "vault:delete-entry",
  async (_event: IpcMainInvokeEvent, boxId: string, entryId: string) => {
    return deleteEntry(boxId, entryId);
  },
);
