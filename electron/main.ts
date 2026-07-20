import { app, BrowserWindow, clipboard, ipcMain, IpcMainInvokeEvent, powerMonitor, protocol, net } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { spawn } from "child_process";
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
  getAutoDisplayMedia,
  setAutoDisplayMedia,
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
import { connectOneAmChrome } from "./integrations/oneam/ChromeBridge";
import {
  bridgeConnectWallet,
  bridgeDetectWallets,
  bridgeDisconnect,
} from "./integrations/oneam/CIP30WebViewBridge";
import { initMosaicBot } from "./integrations/mosaicbot/src/main/index";
import { initChat, setMainWindow as setChatMainWindow, stopChat } from "./integrations/chat/index";
import { initIDE, cleanupIDE } from "./integrations/ide/index";
// Plugin IPC handler registrations
import { registerHyperInsightIpc, stopScorePolling } from "../plugins/hyperinsight/main/index.js";
import { registerAimNodesIpc } from "../plugins/aim-nodes/main/index.js";
import { registerPaymentsJitIpc } from "../plugins/payments-jit/main/index.ts";
import { registerCardanoIpc } from "./integrations/cardano/ipcHandlers";
import { registerOneAmCliIpc } from "./integrations/oneam-cli/index";
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
  type NetworkConfig,
  clearTodaTwinInfoAddress,
} from "./integrations/web3/config";
import { saveWalletKey } from "./integrations/web3/index";
import { signHypercycleNonceWithWallet } from "./integrations/web3/hypercycleSign";
import {
  saveTodaApiKey,
  deleteTodaApiKey,
  hasTodaConfig,
  syncTodaTwinInfoAddressFromTwin,
} from "./integrations/web3/toda";
import {
  getCredentials,
  setCredentials,
  clearCredentials,
  midnightCityService,
} from "./integrations/midnight-city";
import type { MidnightCredentials } from "./integrations/midnight-city";
import { skillInjector } from "../src/services/skillInjector";
import { agentForgeEngine } from "./integrations/forge/AgentForgeEngine";
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
import {
  readAgents,
  readAgentsStored,
  writeAgents,
  validateActiveHypercycleAgent,
  validateAgentsListForActivation,
  type AIAgent,
} from "./agents";

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
  // Need licenseKey to connect to node manifests in hyperinsight-aims.json
  licenseKey?: string;
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
  stopScorePolling();
  mcpClient.disconnectAll();
  cleanupTools().catch(console.error);
  if (mosaicBotStop) mosaicBotStop().catch(console.error);
  stopChat();
  cleanupIDE();
});

// Suppress ERR_ABORTED errors from webviews
app.on("web-contents-created", (_event, contents) => {
  contents.on("did-fail-load", (event, errorCode) => {
    if (errorCode === -3) {
      event.preventDefault();
    }
  });
});

// Must be called before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: 'mosaic-media', privileges: { bypassCSP: true, supportFetchAPI: true, corsEnabled: true } }
]);

app.whenReady().then(() => {
  console.log("App is packaged:", app.isPackaged);
  console.log("User data path:", app.getPath("userData"));
  console.log("__dirname:", __dirname);
  console.log("PROJECT_ROOT:", PROJECT_ROOT);

  // Register custom protocol for safely serving local media files
  protocol.handle('mosaic-media', (request) => {
    // URL looks like: mosaic-media://generated_image_123.png
    const urlStr = request.url.replace(/^mosaic-media:\/\//, '');
    const mediaDir = path.join(app.getPath('userData'), 'mosaic-media');
    // Ensure the requested file is safely resolved inside the media directory to prevent directory traversal attacks
    const filePath = path.join(mediaDir, path.normalize(urlStr));
    
    // Only serve files that actually live inside the media directory
    if (!filePath.startsWith(mediaDir)) {
       return new Response('Access Denied', { status: 403 });
    }
    
    return net.fetch(`file://${filePath}`);
  });

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

  // ==========================================================================
  // IMPORTANT: Register plugin IPC handlers BEFORE initPlugins().
  // registerAimNodesIpc() reads the wallet key via getWalletKey() and writes
  // it into the plugin's env config. initPlugins() then spawns the MCP child
  // process using that env, so the key is available from process start.
  // Reversing this order causes the MCP server to launch without WALLET_PRIVATE_KEY.
  // ==========================================================================
  registerHyperInsightIpc(ipcMain);
  registerAimNodesIpc(ipcMain);
  registerPaymentsJitIpc(ipcMain);
  // Remove duplicate oneam:openExternal handler from old external bridge
  // registerOneAmExternalBridge(ipcMain);
  registerOneAmCliIpc(ipcMain);
  registerCardanoIpc();

  // Now auto-connect MCP plugins (with correct env already set)
  initPlugins().catch((e) => console.error("[MCP] Plugin init failed:", e));
  initChat();
  initIDE();

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

// File dialog for sandbox tool installation
ipcMain.handle("dialog:open-file", async (_event, options?: { filters?: Array<{ name: string; extensions: string[] }> }) => {
  const { dialog } = await import("electron");
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openFile"],
    filters: options?.filters ?? [{ name: "WebAssembly", extensions: ["wasm"] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
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

// AI Agents Storage (persistence + key encryption live in ./agents)
const themesPath = path.join(app.getPath("userData"), "themes.json");

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

// Note: writeAgents encrypts keys. A renderer-supplied full list would persist
// "" for keys it couldn't decrypt (apiKeyUnavailable) — acceptable since no
// renderer calls ai-agents:set today.
ipcMain.handle("ai-agents:set", async (_event: IpcMainInvokeEvent, agents: AIAgent[]) => {
  try {
    const err = validateAgentsListForActivation(agents);
    if (err) return { success: false, error: err };
    writeAgents(agents);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});

ipcMain.handle("ai-agents:add", async (_event: IpcMainInvokeEvent, agent: AIAgent) => {
  try {
    // Stored (encrypted) form: keeps existing key blobs verbatim on rewrite.
    const agents = readAgentsStored();
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
    // Merge partial updates into the stored (encrypted) agents so blobs that
    // can't be decrypted here survive; a new plaintext updates.apiKey gets
    // encrypted by writeAgents.
    const agents = readAgentsStored();
    const index = agents.findIndex((a) => a.id === id);
    if (index === -1) {
      return { success: false, error: "Agent not found" };
    }
    const merged = { ...agents[index], ...updates };
    const err = validateActiveHypercycleAgent(merged);
    if (err) return { success: false, error: err };
    agents[index] = merged;
    writeAgents(agents);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});

ipcMain.handle("ai-agents:delete", async (_event: IpcMainInvokeEvent, id: string) => {
  try {
    const agents = readAgentsStored();
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
    const prevTodaHost = config.networks.toda?.twinHostname?.trim() ?? "";
    if (updates.activeNetwork) setActiveNetwork(updates.activeNetwork);
    if (updates.safety) updateSafetySettings(updates.safety);

    const baseNetworks = config.networks;
    const networks: Record<string, NetworkConfig> = updates.networks
      ? Object.fromEntries(
          Object.entries({ ...baseNetworks, ...updates.networks }).map(([k, v]) => [
            k,
            { ...baseNetworks[k as NetworkId], ...v } as NetworkConfig,
          ]),
        ) as Record<NetworkId, NetworkConfig>
      : baseNetworks;

    const merged: Web3Config = {
      ...config,
      ...updates,
      networks,
      safety: { ...config.safety, ...(updates.safety || {}) },
    };
    saveConfig(merged);

    const todaNet = merged.networks.toda;
    const nextTodaHost = todaNet?.twinHostname?.trim() ?? "";
    if (todaNet && !nextTodaHost) {
      if (todaNet.twinInfoAddress) {
        todaNet.twinInfoAddress = "";
        saveConfig(merged);
      }
    } else if (hasTodaConfig() && prevTodaHost !== nextTodaHost) {
      const sr = await syncTodaTwinInfoAddressFromTwin();
      if (!sr.ok) {
        console.warn("[Web3] TODA Twin /info sync after hostname change:", sr.error);
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// TODA Twin config (API key stored separately, encrypted)
ipcMain.handle("web3:save-toda-api-key", async (_event, apiKey: string) => {
  try {
    if (!apiKey?.trim()) return { success: false, error: "API key is required." };
    const saved = saveTodaApiKey(apiKey.trim());
    if (saved && hasTodaConfig()) {
      const sr = await syncTodaTwinInfoAddressFromTwin();
      if (!sr.ok) {
        console.warn("[Web3] TODA Twin /info sync after API key save:", sr.error);
      }
    }
    return { success: saved };
  } catch {
    return { success: false, error: "Failed to save TODA API key." };
  }
});

ipcMain.handle("web3:delete-toda-api-key", async () => {
  const ok = deleteTodaApiKey();
  if (ok) clearTodaTwinInfoAddress();
  return { success: ok };
});

ipcMain.handle("web3:toda-has-config", async () => {
  return { configured: hasTodaConfig() };
});

ipcMain.handle("web3:sign-hypercycle-nonce", async (_event, nonce: string) => {
  return signHypercycleNonceWithWallet(typeof nonce === "string" ? nonce : "");
});

// Web3 wallet import (secure paths — key never passes through renderer IPC)
function isValidPrivateKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  const hex = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
  return /^[a-fA-F0-9]{64}$/.test(hex);
}

ipcMain.handle("web3:import-from-clipboard", async () => {
  try {
    const text = clipboard.readText();
    if (!isValidPrivateKey(text)) {
      return { success: false, error: "Clipboard does not contain a valid Ethereum private key (64 hex chars, optional 0x prefix)." };
    }
    const ok = saveWalletKey(text.trim());
    if (ok) clipboard.clear();
    return { success: ok };
  } catch {
    return { success: false, error: "Failed to import from clipboard." };
  }
});

ipcMain.handle("web3:import-wallet-secure", async (_event, privateKey: string) => {
  try {
    if (!isValidPrivateKey(privateKey)) {
      return { success: false, error: "Invalid private key format." };
    }
    return { success: saveWalletKey(privateKey.trim()) };
  } catch {
    return { success: false, error: "Failed to save wallet." };
  }
});

const SECURE_IMPORT_HTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Import Wallet</title><style>*{box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#0f0f0f;color:#e5e5e5;padding:24px;margin:0;min-width:360px}h2{font-size:1rem;margin:0 0 16px;color:#a3a3a3}input{width:100%;padding:12px;background:#171717;border:1px solid #404040;border-radius:8px;color:#e5e5e5;font-family:monospace;font-size:13px;margin-bottom:12px}input:focus{outline:none;border-color:#6366f1}button{width:100%;padding:12px;background:#6366f1;border:none;border-radius:8px;color:#fff;font-weight:600;cursor:pointer}button:hover{background:#4f46e5}.hint{font-size:11px;color:#737373;margin-top:8px}</style></head><body><h2>Import private key</h2><p class="hint">Paste your key here. It is sent directly to the main process.</p><input type="password" id="key" placeholder="0x..." autocomplete="off"/><button id="submit">Import</button><script>document.getElementById("submit").onclick=async()=>{const k=document.getElementById("key").value.trim();if(!k)return;const b=document.getElementById("submit");b.disabled=true;try{const r=await window.secureWalletImport.submit(k);r.success?window.close():alert(r.error||"Import failed")}catch{alert("Import failed")}b.disabled=false}<\/script></body></html>`;

ipcMain.on("web3:wallet-imported", () => {
  mainWindow?.webContents.send("wallet:imported");
});

ipcMain.handle("web3:open-secure-import-window", async () => {
  const preloadPath = path.join(__dirname, "secure-wallet-import-preload.js");
  const win = new BrowserWindow({
    width: 420,
    height: 280,
    title: "Import Wallet",
    parent: mainWindow ?? undefined,
    modal: !!mainWindow,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  win.setMenuBarVisibility(false);
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(SECURE_IMPORT_HTML));
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

// =============================================================================
// Media Handlers — safe base64 delivery for tool-generated media
// =============================================================================

/**
 * Read a mosaic-media:// file from disk and return it as a data: URI.
 * The renderer never gets raw filesystem access — only sanitized base64 data.
 */
ipcMain.handle("media:read-as-data-uri", async (_event, mediaUrl: string) => {
  try {
    // Strip protocol prefix  — "mosaic-media://filename.png" → "filename.png"
    const filename = mediaUrl.replace(/^mosaic-media:\/\//, "");
    const mediaDir = path.join(app.getPath("userData"), "mosaic-media");
    const filePath = path.join(mediaDir, path.normalize(filename));

    // Directory traversal guard
    if (!filePath.startsWith(mediaDir + path.sep) && filePath !== mediaDir) {
      console.error("[Media] Directory traversal attempt blocked:", filename);
      return { success: false, error: "Access denied" };
    }

    if (!fs.existsSync(filePath)) {
      return { success: false, error: "File not found" };
    }

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filename).toLowerCase().replace(".", "");
    const mimeTypes: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      svg: "image/svg+xml",
    };
    const mimeType = mimeTypes[ext] ?? "image/png";
    const dataUri = `data:${mimeType};base64,${buffer.toString("base64")}`;
    return { success: true, dataUri };
  } catch (error: any) {
    console.error("[Media] Failed to read media file:", error.message);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("media:get-auto-display", () => {
  return { enabled: getAutoDisplayMedia() };
});

// Move imports to top of file — they don't belong here
ipcMain.handle("media:set-auto-display", (_event, enabled: boolean) => {
  const result = setAutoDisplayMedia(enabled);
  return { ...result, enabled: getAutoDisplayMedia() };
});

// ═══ Midnight City IPC Handlers ════════════════════════════════════════

ipcMain.handle("midnight:connect", async (_event, params: { agentId: string }) => {
  return midnightCityService.connect(params.agentId);
});

ipcMain.handle("midnight:disconnect", async (_event, params?: { force?: boolean }) => {
  return midnightCityService.disconnect(params?.force);
});

ipcMain.handle("midnight:getStatus", async () => {
  return midnightCityService.getStatus();
});

ipcMain.handle("midnight:getLogs", async () => {
  return midnightCityService.getLogs();
});

ipcMain.handle("midnight:setLock", async (_event, locked: boolean) => {
  midnightCityService.setLock(locked);
  return { locked };
});

ipcMain.handle("midnight:apiCall", async (_event, params: { endpoint: string; method: "GET" | "POST"; body?: any }) => {
  return midnightCityService.apiCall(params);
});

ipcMain.handle("midnight:readScript", async (_event, filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) return { success: false, error: "File not found" };
    const content = fs.readFileSync(filePath, "utf8");
    return { success: true, content };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("midnight:writeScript", async (_event, params: { path: string; content: string }) => {
  try {
    fs.writeFileSync(params.path, params.content, "utf8");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("midnight:restartMiner", async () => {
  try {
    const scriptPath = "/home/mauricio/.hermes/scripts/sonofanton_miner.py";
    const { spawn } = require("child_process");
    const fs = require("fs");
    const path = require("path");
    const pidFile = path.join(path.dirname(scriptPath), ".sonofanton.pid");

    // Kill existing process if PID file exists
    if (fs.existsSync(pidFile)) {
      try {
        const oldPid = parseInt(fs.readFileSync(pidFile, "utf8"), 10);
        process.kill(oldPid, "SIGTERM");
      } catch (e) { /* best-effort */ }
      fs.unlinkSync(pidFile);
    }

    // Start new process
    const child = spawn("python3", [scriptPath], {
      detached: true,
      stdio: "ignore",
      cwd: path.dirname(scriptPath),
    });
    child.unref();

    // Write PID
    fs.writeFileSync(pidFile, child.pid.toString());

    return { success: true, pid: child.pid };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("midnight:deployAgent", async (_event, params: { name: string; profession: string; baseImage: string }) => {
  return { success: false, error: "deployAgent not yet implemented" };
});

ipcMain.handle("midnight:getConfig", async () => {
  const creds = getCredentials();
  if (!creds) return { configured: false };
  return {
    configured: true,
    agentId: creds.agentId,
    profession: creds.profession,
    apiBase: creds.apiBase,
  };
});

ipcMain.handle("midnight:setConfig", async (_event, creds: MidnightCredentials) => {
  try {
    setCredentials(creds);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("midnight:clearConfig", async () => {
  clearCredentials();
  return { success: true };
});
// ═══ End Midnight City ════════════════════════════════════════════════

// ═══ 1AM Wallet IPC Handlers ═══════════════════════════════════════════
// Bridge to the Midnight DApp Connector injected by 1AM Wallet extension.
// These handlers proxy renderer requests to the in-page API when available.

interface OneAMSessionCache {
  connected: boolean;
  balance?: any;
  connectedAt?: string;
  address: string | null;
  network: string | null;
  addresses?: {
    shielded: string[];
    unshielded: string | null;
    dust: string | null;
    cardano: string | null;
  };
  txHistory?: any[];
  agentWallets: Array<{ agentId: string; agentName: string; address: string | null; delegated: boolean; permissions: string[] }>;
}

let oneamCache: OneAMSessionCache = {
  connected: false,
  address: null,
  network: null,
  agentWallets: [],
};

ipcMain.handle("oneam:detect", async () => {
  // We can't directly query the browser extension from main process.
  // The renderer will detect via window.oneam; main process just returns cached state.
  return {
    available: oneamCache.connected || false,
    name: "1AM Wallet",
    version: "4.0",
  };
});

ipcMain.handle("oneam:connect", async () => {
  // Handled in renderer via OneAmWalletService; main process stores cache
  return {
    success: true,
    session: oneamCache,
    note: "Use window.electronAPI.oneam.connect() in renderer to trigger actual wallet flow",
  };
});

ipcMain.handle("oneam:disconnect", async () => {
  oneamCache.connected = false;
  oneamCache.address = null;
  oneamCache.network = null;
  oneamCache.balance = null;
  await bridgeDisconnect().catch(() => {});
  return { success: true };
});

ipcMain.handle("oneam:getSession", async () => {
  return {
    connected: oneamCache.connected,
    address: oneamCache.address,
    network: oneamCache.network,
    balance: null,
  };
});

ipcMain.handle("oneam:fetchData", async () => {
  return {
    success: oneamCache.connected,
    balance: null,
    assets: [],
    error: oneamCache.connected ? undefined : "Not connected",
  };
});

ipcMain.handle("oneam:signTx", async (_event, txHex: string, _partialSign?: boolean) => {
  // Proxy: renderer does actual signing via window.oneam API
  return {
    success: false,
    error: "SignTx must be called from renderer process via injected API",
    txHex,
  };
});

ipcMain.handle("oneam:submitTx", async (_event, txHex: string) => {
  // Proxy: renderer does actual submit
  return {
    success: false,
    error: "SubmitTx must be called from renderer process via injected API",
    txHex,
  };
});

ipcMain.handle("oneam:createAgentWallet", async (_event, agentId: string, agentName: string) => {
  const wallet = {
    agentId,
    agentName,
    address: oneamCache.address,
    delegated: false,
    permissions: ["read"],
  };
  oneamCache.agentWallets.push(wallet);
  return { success: true, wallet };
});

ipcMain.handle("oneam:delegateAgent", async (_event, agentId: string, permissions: string[]) => {
  const wallet = oneamCache.agentWallets.find((w) => w.agentId === agentId);
  if (!wallet) return { success: false, error: "Agent wallet not found" };
  wallet.delegated = true;
  wallet.permissions = permissions;
  return { success: true };
});

ipcMain.handle("oneam:revokeAgent", async (_event, agentId: string) => {
  const wallet = oneamCache.agentWallets.find((w) => w.agentId === agentId);
  if (!wallet) return { success: false, error: "Agent wallet not found" };
  wallet.delegated = false;
  wallet.permissions = [];
  return { success: true };
});

ipcMain.handle("oneam:listAgentWallets", async () => {
  return { wallets: oneamCache.agentWallets };
});
ipcMain.handle("oneam:openExternal", async () => {
  // WebView bridge works for some CIP-30 extensions, but 1AM's MV3 service
  // worker doesn't fully activate inside Electron. Fall back to spawning real
  // Chrome in a temp profile with ONLY the 1AM extension loaded.
  try {
    const webViewResult = await tryWebViewBridgeFirst();
    if (webViewResult.connected) return webViewResult;
  } catch (e: any) {
    console.log('[1AM] WebView bridge did not connect:', e.message);
  }

  console.log('[1AM] Falling back to isolated Chrome bridge with 1AM only');
  try {
    const result = await connectOneAmChrome();
    console.log('[1AM] Chrome bridge result:', result);
    if (result.success) {
      oneamCache = {
        connected: true,
        address: result.address || null,
        network: result.networkId === 1 ? 'mainnet' : 'preprod',
        balance: {
          lovelace: result.lovelace || 0,
          nightTokens: result.night || 0,
          dustTokens: result.dust || 0,
          shieldedTokens: result.shieldedTokens || 0,
          unshieldedTokens: result.unshieldedTokens || 0,
          cardanoAda: result.cardanoAda || 0,
          assets: result.assets || [],
        },
        addresses: result.addresses || { shielded: [], unshielded: null, dust: null, cardano: null },
        txHistory: result.txHistory || [],
        agentWallets: [],
        connectedAt: new Date().toISOString(),
      };
    }
    return {
      connected: result.success,
      address: result.address || null,
      network: result.networkId === 1 ? 'mainnet' : 'preprod',
      lovelace: result.lovelace || 0,
      night: result.night || 0,
      dust: result.dust || 0,
      shieldedTokens: result.shieldedTokens || 0,
      unshieldedTokens: result.unshieldedTokens || 0,
      cardanoAda: result.cardanoAda || 0,
      oneamConnected: result.oneamConnected,
      assets: result.assets || [],
      addresses: result.addresses || { shielded: [], unshielded: null, dust: null, cardano: null },
      txHistory: result.txHistory || [],
      rawOneAmResponses: result.rawOneAmResponses || [],
      rawCaptures: result.rawCaptures || [],
      error: result.error,
    };
  } catch (e: any) {
    return {
      connected: false,
      error: e.message || '1AM Chrome bridge failed',
    };
  }
});

async function tryWebViewBridgeFirst(): Promise<{
  connected: boolean;
  address?: string;
  network?: string;
  lovelace?: number;
  night?: number;
  dust?: number;
  assets?: any[];
  error?: string;
}> {
  const detected = await bridgeDetectWallets();
  console.log('[1AM] WebView detection result:', detected);
  if (!detected.available || detected.wallets.length === 0) {
    return {
      connected: false,
      error: 'No Cardano wallet extensions detected in Electron.',
    };
  }
  const oneam = detected.wallets.find(
    (w) => /oneam|midnight/i.test(w.key) || /oneam|midnight/i.test(w.name)
  );
  const target = oneam || detected.wallets[0];
  console.log('[1AM] Connecting via WebView to:', target);
  const result = await bridgeConnectWallet(target.key);
  if (result.success && result.address) {
    oneamCache = {
      connected: true,
      address: result.address,
      network: result.networkId === 1 ? 'mainnet' : 'preprod',
      balance: {
        lovelace: result.lovelace || 0,
        nightTokens: result.night || 0,
        dustTokens: result.dust || 0,
        assets: result.assets || [],
      },
      agentWallets: [],
      connectedAt: new Date().toISOString(),
    };
  }
  return {
    connected: result.success,
    address: result.address,
    network: result.networkId === 1 ? 'mainnet' : 'preprod',
    lovelace: result.lovelace || 0,
    night: result.night || 0,
    dust: result.dust || 0,
    assets: result.assets || [],
    error: result.error,
  };
}

ipcMain.handle("oneam:generateDust", async () => {
  // Dust generation is handled in renderer via bridge to the 1AM extension
  // Main process just returns cache status
  return {
    success: oneamCache.connected,
    dustAmount: 0,
    error: oneamCache.connected ? undefined : "Not connected — use renderer bridge",
  };
});

// ═══ End 1AM Wallet ═══════════════════════════════════════════════════

// ═══ Node Factory IPC Handlers ════════════════════════════════════════
ipcMain.handle("nodeFactory:loadJsonFile", async (_event, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(data);
    return { success: true, data: parsed };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("nodeFactory:checkLicense", async (_event, licenseId: string, apiBase: string) => {
  try {
    const response = await fetch(`${apiBase}/license_status?license=${encodeURIComponent(licenseId)}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { success: false, error: `HTTP ${response.status}: ${text.slice(0, 200)}` };
    }
    const data = await response.json();
    if (data.error) {
      return { success: false, error: data.error, data };
    }
    return { success: true, data };
  } catch (e: any) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return { success: false, error: "Request timed out after 10s" };
    }
    return { success: false, error: e.message || "Network error" };
  }
});
// ═══ End Node Factory ═════════════════════════════════════════════════

// ═══ Aimify (Docker build) IPC Handlers ═════════════════════════════════

ipcMain.handle("stargate:aimify:exec", async (_event, command: string, args: string[], options?: { cwd?: string; timeout?: number }) => {
  return new Promise((resolve) => {
    const cwd = options?.cwd || undefined;
    const timeoutMs = options?.timeout || 30000;
    const proc = spawn(command, args, { cwd });

    let stdout = "";
    let stderr = "";
    let killed = false;

    const timer = setTimeout(() => {
      killed = true;
      proc.kill();
      resolve({ stdout, stderr, exitCode: -1, success: false, error: `Timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    proc.stdout?.on("data", (data: Buffer) => { stdout += data.toString(); });
    proc.stderr?.on("data", (data: Buffer) => { stderr += data.toString(); });

    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (!killed) {
        resolve({ stdout, stderr, exitCode: code ?? -1, success: code === 0 });
      }
    });

    proc.on("error", (err: Error) => {
      clearTimeout(timer);
      if (!killed) {
        resolve({ stdout, stderr, exitCode: -1, success: false, error: err.message });
      }
    });
  });
});

ipcMain.handle("stargate:aimify:readFile", async (_event, filePath: string) => {
  try {
    if (!fs.existsSync(filePath)) return { success: false, error: "File not found" };
    const content = fs.readFileSync(filePath, "utf8");
    return { success: true, content };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle("stargate:aimify:writeFile", async (_event, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, "utf8");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ═══ Skill System Prompt Builder ══════════════════════════════════════════
ipcMain.handle(
  "skill:buildSystemPrompt",
  async (
    _event: IpcMainInvokeEvent,
    payload: {
      baseSystemPrompt?: string;
      skillNames: string[];
      includeReferences?: boolean;
      maxTokens?: number;
      dialOverrides?: {
        designVariance?: number;
        motionIntensity?: number;
        visualDensity?: number;
      };
    }
  ) => {
    const result = skillInjector.buildSystemPrompt(
      payload.baseSystemPrompt ?? "",
      payload.skillNames,
      {
        includeReferences: payload.includeReferences ?? true,
        maxTokens: payload.maxTokens,
        dialOverrides: payload.dialOverrides,
      }
    );

    return result;
  }
);

// ═══ End Skill System Prompt Builder ══════════════════════════════════════

// ═══ End Aimify ════════════════════════════════════════════════════════

// ═══ Agent Forge Engine IPC Handlers ════════════════════════════════════

ipcMain.handle(
  "stargate:testAgentCode",
  async (_event: IpcMainInvokeEvent, code: string, templateId: string) => {
    return agentForgeEngine.runTest(code, templateId);
  }
);

ipcMain.handle(
  "stargate:deployAgentCode",
  async (
    _event: IpcMainInvokeEvent,
    code: string,
    config: Record<string, unknown>
  ) => {
    return agentForgeEngine.deploy(code, config as any);
  }
);

ipcMain.handle("stargate:forge:listDeployed", async () => {
  return { success: true, agents: agentForgeEngine.getDeployedAgents() };
});

ipcMain.handle("stargate:forge:listRunning", async () => {
  return { success: true, agents: agentForgeEngine.getRunningAgents() };
});

ipcMain.handle(
  "stargate:forge:stopAgent",
  async (_event: IpcMainInvokeEvent, agentId: string) => {
    return { success: agentForgeEngine.stopAgent(agentId) };
  }
);

ipcMain.handle(
  "stargate:forge:enableHealthCheck",
  async (
    _event: IpcMainInvokeEvent,
    agentId: string,
    intervalMs?: number,
    maxRestarts?: number
  ) => {
    try {
      const agents = agentForgeEngine.getDeployedAgents();
      const manifest = agents.find((a) => a.id === agentId);
      if (!manifest) {
        return {
          success: false,
          error: `Agent ${agentId} not found among deployed agents.`,
        };
      }
      agentForgeEngine.enableHealthCheck(agentId, manifest, {
        intervalMs,
        maxRestarts,
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
);

ipcMain.handle(
  "stargate:forge:disableHealthCheck",
  async (_event: IpcMainInvokeEvent, agentId: string) => {
    agentForgeEngine.disableHealthCheck(agentId);
    return { success: true };
  }
);

ipcMain.handle(
  "stargate:forge:isHealthy",
  async (_event: IpcMainInvokeEvent, agentId: string) => {
    return { success: true, healthy: agentForgeEngine.isHealthy(agentId) };
  }
);

ipcMain.handle(
  "stargate:deployAgentToNode",
  async (
    _event: IpcMainInvokeEvent,
    code: string,
    config: Record<string, unknown>
  ) => {
    const { templateId, nodeConfig, autoStart, enableWallet, tier } =
      config as any;
    if (!nodeConfig?.host || !nodeConfig?.user) {
      return {
        success: false,
        error: "nodeConfig requires host and user fields",
      };
    }
    return agentForgeEngine.deployToNode(code, {
      templateId,
      nodeConfig,
      autoStart,
      enableWallet,
      tier,
    });
  }
);

// ═══ End Agent Forge Engine ═════════════════════════════════════════════

