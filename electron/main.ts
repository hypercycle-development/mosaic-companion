import { app, BrowserWindow, clipboard, ipcMain, IpcMainInvokeEvent, powerMonitor, protocol, net, Menu, MenuItem, shell } from "electron";
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
import { mcpClient, setMainWindow as mcpSetMainWindow, initPlugins } from "./integrations/mcp";
import { startMarketplaceService } from "./services/marketplace/MarketplaceService";
import { initializeTools, cleanupTools } from "./integrations/tools";
import { initMosaicBot } from "./integrations/mosaicbot/src/main/index";
import { initChat, setMainWindow as setChatMainWindow, stopChat } from "./integrations/chat/index";
import { initIDE, cleanupIDE } from "./integrations/ide/index";
import { registerCardanoIpc } from "./integrations/cardano/ipcHandlers";
import { agentForgeEngine } from "./integrations/forge/AgentForgeEngine";
// Plugin IPC handler registrations
import { registerHyperInsightIpc } from "../plugins/hyperinsight/main/index.js";
import { registerAimNodesIpc } from "../plugins/aim-nodes/main/index.js";
import { registerPaymentsJitIpc } from "../plugins/payments-jit/main/index.ts";
import { createRequire } from 'module';
import { KreaClient } from "../src/services/krea/KreaClient";
import { authenticate, isAuthenticated, signOut } from "./integrations/gmail";
import { skillInjector } from "../src/services/skillInjector";
import { startVaultSkillWatcher } from "../src/services/vaultSkillCache";
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
import { getWalletKey, saveWalletKey, getWalletAddress } from "./integrations/web3/index";
import { signHypercycleNonceWithWallet } from "./integrations/web3/hypercycleSign";
import {
  saveTodaApiKey,
  deleteTodaApiKey,
  hasTodaConfig,
  syncTodaTwinInfoAddressFromTwin,
} from "./integrations/web3/toda";
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
import { mergeBuiltinAgents } from "./defaultAiAgents";

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

// Enable copy/paste context menu (fix from community installer)
app.on('browser-window-created', (_, win) => {
  win.webContents.on('context-menu', (e, params) => {
    const menu = new Menu();
    if (params.isEditable) {
      menu.append(new MenuItem({ role: 'paste', label: 'Paste' }));
      menu.append(new MenuItem({ role: 'copy', label: 'Copy' }));
      menu.append(new MenuItem({ role: 'cut', label: 'Cut' }));
      menu.append(new MenuItem({ type: 'separator' }));
      menu.append(new MenuItem({ role: 'selectAll', label: 'Select All' }));
    } else if (params.selectionText) {
      menu.append(new MenuItem({ role: 'copy', label: 'Copy' }));
    }
    menu.popup();
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

  // ── Start internal marketplace service ──
  // Provides the REST API that the MCP bridge and the frontend panel consume.
  // Runs on port 13000 by default (override via STARGATE_INTERNAL_MARKETPLACE_PORT).
  startMarketplaceService();

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
  registerCardanoIpc();

  // Now auto-connect MCP plugins (with correct env already set)
  initPlugins().catch((e) => console.error("[MCP] Plugin init failed:", e));
  initChat();
  initIDE();

  // Initialize tool registry
  initializeTools().catch((e) => console.error("[Tools] Init failed:", e));

  // Start vault skill watcher so skillInjector cache clears when vault skills are edited at runtime
  try {
    startVaultSkillWatcher();
  } catch (e) {
    console.warn("[VaultSkillCache] Failed to start watcher:", e);
  }

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

// HyperCycle Node status IPC (from community installer)
ipcMain.handle("get-node-status", async () => {
  try {
    const http = await import('http');
    return new Promise((resolve) => {
      http.get('http://localhost:8000/info', (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      }).on('error', () => resolve(null));
    });
  } catch {
    return null;
  }
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

// Open external URLs in default browser (from community installer)
ipcMain.on("open-external", (event, url) => {
  // Only open known-safe local URLs in the system browser (prevent external nav)
  const isLocal =
    url.startsWith('http://localhost') ||
    url.startsWith('http://127.0.') ||
    url.startsWith('https://localhost') ||
    url.startsWith('https://127.0.') ||
    url.startsWith('file://');
  if (isLocal) {
    shell.openExternal(url);
  } else {
    console.warn(`[open-external] Blocked non-local URL: ${url}`);
  }
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

ipcMain.handle("dialog:open-directory", async () => {
  const { dialog } = await import("electron");
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ["openDirectory"],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// ── Node Factory Tracker IPC ───────────────────────────────────────────────
// Loads a licenses.json from the user's filesystem (sandbox-safe via renderer → main)
ipcMain.handle("nodeFactory:loadJsonFile", async (_event, filePath: string) => {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(data);
    return { success: true, data: parsed };
  } catch (e: any) {
    return { success: false, error: e.message || "Failed to load JSON file" };
  }
});

// Proxies license_status checks through the main process so renderer doesn't
// need CORS permissions against the CBNO API.
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

// =============================================================================
// AIMIFIER IPC — Hermes → HyperCycle AIM Pipeline
// =============================================================================

import { spawn } from "child_process";

ipcMain.handle("aimify:exec", async (_event, command: string, args: string[], options?: { cwd?: string; timeout?: number }) => {
  return new Promise((resolve) => {
    const { cwd, timeout = 300000 } = options || {};
    const proc = spawn(command, args, { cwd, shell: false });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({ success: false, exitCode: -1, stdout, stderr: stderr + "\n[TIMEOUT]" });
    }, timeout);
    proc.stdout.on("data", (data) => { stdout += data.toString(); });
    proc.stderr.on("data", (data) => { stderr += data.toString(); });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ success: code === 0, exitCode: code || 0, stdout, stderr });
    });
  });
});

ipcMain.handle("aimify:write-file", async (_event, filePath: string, content: string) => {
  try {
    const fs = require("fs");
    const path = require("path");
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("aimify:read-file", async (_event, filePath: string) => {
  try {
    const fs = require("fs");
    const content = fs.readFileSync(filePath, "utf8");
    return { success: true, content };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
});

// =============================================================================
// HERMES DASHBOARD LIFECYCLE — spawn/stop/status for kanban UI
// =============================================================================
let hermesDashboardProc: any = null;

ipcMain.handle("hermes:start-dashboard", async (event, port?: number) => {
  const p = port || 9000;
  // If already running, just report status
  if (hermesDashboardProc && !hermesDashboardProc.killed) {
    return { success: true, status: 'already-running', port: p, pid: hermesDashboardProc.pid };
  }
  // Check if another dashboard is already running (e.g., user started manually)
  try {
    const { execSync } = require("child_process");
    const psOut = execSync(`hermes dashboard --status 2>/dev/null || true`, { encoding: "utf8", timeout: 5000 });
    if (psOut.includes("PID")) {
      return { success: true, status: 'externally-running', port: p };
    }
  } catch (_e) {}
  // Spawn daemonized process so it outlives Electron
  try {
    hermesDashboardProc = spawn("hermes", ["dashboard", "--port", String(p), "--no-open", "--skip-build"], {
      detached: true,
      stdio: "ignore",
      env: { ...process.env, HERMES_KANBAN_BOARD: process.env.HERMES_KANBAN_BOARD || "stargate" },
    });
    hermesDashboardProc.unref(); // allow parent to exit without killing child
    // Wait up to 10s for HTTP readiness
    for (let attempt = 0; attempt <= 20; attempt++) {
      try {
        const { execSync } = require("child_process");
        const probe = execSync(`curl -s -o /dev/null -w "%{http_code}" --max-time 1 http://127.0.0.1:${p}`, {
          encoding: "utf8", timeout: 1500,
        });
        if (probe.trim() === "200") {
          return { success: true, status: 'ready', port: p, pid: hermesDashboardProc.pid };
        }
      } catch (_e) {}
      await new Promise(r => setTimeout(r, 500));
    }
    return { success: true, status: 'started-but-not-ready', port: p, pid: hermesDashboardProc.pid };
  } catch (error: any) {
    return { success: false, status: 'error', error: error.message };
  }
});

ipcMain.handle("hermes:stop-dashboard", async () => {
  if (hermesDashboardProc && !hermesDashboardProc.killed) {
    hermesDashboardProc.kill("SIGTERM");
    hermesDashboardProc = null;
  }
  return { success: true, status: 'stopped' };
});

ipcMain.handle("hermes:dashboard-status", async (event, port?: number) => {
  const p = port || 9000;
  const isOursRunning = !!(hermesDashboardProc && !hermesDashboardProc.killed);
  // Also probe the HTTP endpoint
  try {
    const { execSync } = require("child_process");
    const probe = execSync(`curl -s -o /dev/null -w "%{http_code}" --max-time 2 http://127.0.0.1:${p}`, {
      encoding: "utf8", timeout: 3000,
    });
    const httpOk = probe.trim() === "200";
    return { success: true, running: isOursRunning || httpOk, port: p, httpOk };
  } catch (_e) {
    return { success: true, running: isOursRunning, port: p, httpOk: false };
  }
});

// Sandbox State
ipcMain.handle("sandbox:get-state", async () => sandboxState);

// AI Agents Storage
const aiAgentsPath = path.join(app.getPath("userData"), "ai-agents.json");
const themesPath = path.join(app.getPath("userData"), "themes.json");

function validateActiveHypercycleAgent(agent: AIAgent): string | null {
  if (agent.provider !== "hypercycle") return null;
  if (agent.isActive !== true) return null;
  const basechain = agent.hypercycleBackend === "basechain";
  if (basechain) {
    if (!getWalletKey()) {
      return "Import an EVM wallet in Web3 settings (Base) before activating this Basechain Hypercycle agent.";
    }
  } else if (!hasTodaConfig()) {
    return "Configure TODA Twin (hostname + API key) in Web3 settings before activating this TODA Hypercycle agent.";
  }
  return null;
}

function validateAgentsListForActivation(agents: AIAgent[]): string | null {
  for (const a of agents) {
    const err = validateActiveHypercycleAgent(a);
    if (err) return err;
  }
  return null;
}

function readAgents(): AIAgent[] {
  let raw: AIAgent[] = [];
  try {
    if (fs.existsSync(aiAgentsPath)) {
      const data = fs.readFileSync(aiAgentsPath, "utf8");
      raw = JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read AI agents:", error);
  }
  // Migrate old Ollama agents that were saved with cloud model names to ollama-cloud provider
  let sanitized = false;
  for (const a of raw) {
    const model = (a as any).model as string;
    if (a.provider === "ollama" && model && model.includes(":cloud")) {
      console.log(`[Main] Migrating Ollama agent "${a.name}" model ${a.model} → ollama-cloud provider`);
      a.provider = "ollama-cloud" as AIAgent["provider"];
      a.baseUrl = a.baseUrl || "https://ollama.com";
      a.model = (a.model as string).replace(/:cloud$/, ""); // strip :cloud suffix
      sanitized = true;
    }
  }
  if (sanitized) {
    writeAgents(raw);
  }
  const { agents, changed } = mergeBuiltinAgents(raw);
  if (changed) {
    writeAgents(agents);
  }
  return agents;
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
  // Strip ALL whitespace (spaces, newlines, tabs) that copy/paste often introduces
  const cleaned = key.replace(/\s+/g, "").trim();
  if (!cleaned) return false;
  const hex = cleaned.startsWith("0x") ? cleaned.slice(2) : cleaned;
  return /^[a-fA-F0-9]{64}$/.test(hex);
}

ipcMain.handle("web3:import-from-clipboard", async () => {
  try {
    const text = clipboard.readText();
    if (!isValidPrivateKey(text)) {
      return { success: false, error: "Clipboard does not contain a valid Ethereum private key (64 hex chars, optional 0x prefix)." };
    }
    const ok = saveWalletKey(text.trim());
    if (!ok.success) return { success: false, error: ok.error || "Failed to save wallet key." };
    const address = getWalletAddress();
    mainWindow?.webContents.send("wallet:imported");
    mainWindow?.webContents.send("wallet:changed", { address });
    return { success: true, address };
  } catch {
    return { success: false, error: "Failed to import from clipboard." };
  }
});

ipcMain.handle("web3:import-wallet-secure", async (_event, privateKey: string) => {
  try {
    // Strip internal whitespace that copy-paste often introduces
    const cleaned = privateKey.replace(/\s+/g, "").trim();
    if (!isValidPrivateKey(cleaned)) {
      return { success: false, error: "Invalid private key format." };
    }
    const ok = saveWalletKey(cleaned);
    if (!ok.success) return { success: false, error: ok.error || "Failed to save wallet." };
    const address = getWalletAddress();
    mainWindow?.webContents.send("wallet:imported");
    mainWindow?.webContents.send("wallet:changed", { address });
    return { success: true, address };
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
  async (_event: IpcMainInvokeEvent, boxId: string, input: any) => {
    return addEntry(boxId, input);
  },
);

ipcMain.handle(
  "vault:update-entry",
  async (_event: IpcMainInvokeEvent, boxId: string, entryId: string, updates: any) => {
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

ipcMain.handle("media:set-auto-display", (_event, enabled: boolean) => {
  const result = setAutoDisplayMedia(enabled);
  return { ...result, enabled: getAutoDisplayMedia() };
});

// =============================================================================
// Fleet Mesh Dispatch — Tailscale SSH cross-node command execution
// =============================================================================

import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

ipcMain.handle(
  "mesh:dispatch",
  async (_event: IpcMainInvokeEvent, payload: { host: string; user: string; command: string; timeout?: number }) => {
    const start = Date.now();
    try {
      const { host, user, command, timeout = 30000 } = payload;
      console.log(`[MAIN mesh:dispatch] start — host=${host}, user=${user}, timeout=${timeout}ms, cmdChars=${command.length}`);
      const sshCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no ${user}@${host} '${command.replace(/'/g, "'\\''")}'`;
      const { stdout, stderr } = await execAsync(sshCmd, { timeout });
      console.log(`[MAIN mesh:dispatch] success — host=${host}, stdoutChars=${stdout.trim().length}, stderrChars=${stderr.trim().length}, latency=${Date.now()-start}ms`);
      return { success: true, exitCode: 0, stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (error: any) {
      console.error(`[MAIN mesh:dispatch] FAILED — host=${payload.host}, code=${error.code || '?'}, latency=${Date.now()-start}ms, stderr=${(error.stderr || error.message).slice(0, 200)}`);
      return {
        success: false,
        exitCode: error.code || 1,
        stdout: error.stdout || '',
        stderr: error.stderr || error.message,
      };
    }
  },
);

ipcMain.handle("stargate:dispatchPrompt", async (_event, nodeId: string, prompt: string) => {
  try {
    const nodes = getNodes();
    const node = nodes.find((n: any) => n.nodeId === nodeId || n.id === nodeId);
    if (!node?.apiHost) {
      return { success: false, error: `Node ${nodeId} not found or no apiHost` };
    }
    const safeCommand = `~/.local/bin/hermes chat -q ${JSON.stringify(prompt)}`;
    const { exec } = require("child_process");
    const { promisify } = require("util");
    const execAsync = promisify(exec);
    const sshCmd = `ssh -o ConnectTimeout=10 -o StrictHostKeyChecking=no hyperai@${node.apiHost} '${safeCommand.replace(/'/g, "'\\''")}'`;
    const { stdout, stderr } = await execAsync(sshCmd, { timeout: 30000 });
    return { success: true, response: stdout.trim(), stderr: stderr.trim() };
  } catch (error: any) {
    console.error(`[stargate:dispatchPrompt] failed:`, error);
    return { success: false, error: error.message || String(error), response: '' };
  }
});

ipcMain.handle("stargate:runJob", async (_event, jobType: string, params: Record<string, any>) => {
  try {
    const { spawn } = require("child_process");
    const hermesPath = require("os").homedir() + "/.local/bin/hermes";
    let args: string[] = [];
    let description = "";
    if (jobType === "hire") {
      const p = params;
      args = ["kanban", "create", `Deploy ${p.agentName || "agent"}`, "--body", p.description || "", "--assignee", p.profile || "backend-eng"];
      description = `Hire ${p.agentName}`;
    } else if (jobType === "train") {
      const p = params;
      args = ["kanban", "create", `Train ${p.agentId} on ${p.skillName}`, "--body", p.description || "", "--assignee", p.profile || "researcher"];
      description = `Train ${p.agentId}`;
    } else {
      return { success: false, error: `Unknown job type: ${jobType}` };
    }
    return new Promise((resolve) => {
      const child = spawn(hermesPath, args, { detached: false });
      let stdout = "";
      let stderr = "";
      child.stdout?.on("data", (d: Buffer) => stdout += d.toString());
      child.stderr?.on("data", (d: Buffer) => stderr += d.toString());
      child.on("close", (code) => {
        resolve({
          success: code === 0,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          description,
        });
      });
      child.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });
    });
  } catch (error: any) {
    return { success: false, error: error.message || String(error) };
  }
});

// =============================================================================
// IDE Agent Forge — Test + Deploy IPC handlers (v2: AgentForgeEngine)
// =============================================================================

ipcMain.handle("stargate:testAgentCode", async (_event, code: string, templateId: string) => {
  return agentForgeEngine.runTest(code, templateId);
});

ipcMain.handle("stargate:deployAgentCode", async (_event, code: string, config: Record<string, unknown>) => {
  return agentForgeEngine.deploy(code, config as any);
});

ipcMain.handle("stargate:forge:listDeployed", async () => {
  return { success: true, agents: agentForgeEngine.getDeployedAgents() };
});

ipcMain.handle("stargate:forge:listRunning", async () => {
  return { success: true, agents: agentForgeEngine.getRunningAgents() };
});

ipcMain.handle("stargate:forge:stopAgent", async (_event, agentId: string) => {
  return { success: agentForgeEngine.stopAgent(agentId) };
});

// =============================================================================
// IDE Agent Forge — Cross-node Deploy (v2.1: SSH to Fleet Nodes)
// =============================================================================

ipcMain.handle("stargate:deployAgentToNode", async (_event, code: string, config: Record<string, unknown>) => {
  const { templateId, nodeConfig, autoStart, enableWallet, tier } = config as any;
  if (!nodeConfig?.host || !nodeConfig?.user) {
    return { success: false, error: "nodeConfig requires host and user fields" };
  }
  return agentForgeEngine.deployToNode(code, {
    templateId,
    nodeConfig: { host: nodeConfig.host, user: nodeConfig.user, agentDir: nodeConfig.agentDir },
    autoStart: autoStart ?? true,
    enableWallet: enableWallet ?? false,
    tier: tier ?? "standard",
  });
});

// =============================================================================
// IDE Agent Forge — Health Monitoring (v2.2)
// =============================================================================

ipcMain.handle("stargate:forge:enableHealthCheck", async (_event, agentId: string, intervalMs?: number, maxRestarts?: number) => {
  const manifest = agentForgeEngine.getDeployedAgents().find(m => m.id === agentId);
  if (!manifest) return { success: false, error: "Agent not found" };
  agentForgeEngine.enableHealthCheck(agentId, manifest, { intervalMs, maxRestarts });
  return { success: true };
});

ipcMain.handle("stargate:forge:disableHealthCheck", async (_event, agentId: string) => {
  agentForgeEngine.disableHealthCheck(agentId);
  return { success: true };
});

ipcMain.handle("stargate:forge:isHealthy", async (_event, agentId: string) => {
  return { healthy: agentForgeEngine.isHealthy(agentId) };
});

// =============================================================================
// Skill Delivery Pipeline — sync Hermes skills to fleet node before dispatch
// =============================================================================
// PHASE 1+2+3 combined: resolve skill path → SCP to node → verify → activate
// =============================================================================

ipcMain.handle(
  "skill:buildSystemPrompt",
  async (
    _event: IpcMainInvokeEvent,
    payload: { baseSystemPrompt?: string; skillNames: string[]; includeReferences?: boolean; maxTokens?: number; dialOverrides?: { designVariance?: number; motionIntensity?: number; visualDensity?: number } }
  ): Promise<{ systemPrompt: string; loadedSkills: string[]; failedSkills: string[]; totalTokens: number }> => {
    // Phase A+B: try Hermes skills dir (local + Vault)
    const result = skillInjector.buildSystemPrompt(
      payload.baseSystemPrompt ?? "",
      payload.skillNames,
      { includeReferences: payload.includeReferences ?? true, maxTokens: payload.maxTokens, dialOverrides: payload.dialOverrides }
    );

    // Phase C: try Hermes MCP for any still-failed skills (e.g. kanban-orchestrator)
    if (result.failedSkills.length > 0) {
      try {
        const mcpImports = await Promise.all(
          result.failedSkills.map(async (name) => {
            try {
              // Lazy-load mcpSkillResolver only in this branch
              const { loadMcpSkill } = require("../src/services/mcpSkillResolver");
              const mcpSkill = await loadMcpSkill(name);
              return { name, mcpSkill };
            } catch (e) {
              return { name, mcpSkill: null };
            }
          })
        );

        for (const { name, mcpSkill } of mcpImports) {
          if (mcpSkill?.skillMd) {
            // Inject into system prompt just like a local skill
            const skillSection = `--- BEGIN SKILL: ${name} ---\n\n${mcpSkill.skillMd}\n\n--- END SKILL: ${name} ---`;
            result.systemPrompt += (result.systemPrompt ? "\n\n" : "") + skillSection;
            result.loadedSkills.push(name);
            result.totalTokens = Math.ceil(result.systemPrompt.length / 4);
            console.log(`[main.ts] Skill "${name}" resolved via Hermes MCP server`);
          }
        }

        // Remove successfully loaded skills from failed list
        const loadedFromMcp = new Set(result.loadedSkills);
        result.failedSkills = result.failedSkills.filter(
          (name) => !loadedFromMcp.has(name)
        );
      } catch (e) {
        console.warn("[main.ts] MCP skill resolution failed:", e);
      }
    }

    return result;
  }
);

ipcMain.handle(
  "stargate:skill:syncToNode",
  async (
    _event: IpcMainInvokeEvent,
    payload: { skillNames: string[]; nodeId: string; nodeHost?: string }
  ): Promise<{
    success: boolean;
    synced: string[];
    failed: string[];
    verified: string[];
    activated: string[];
    remoteSkillDir: string;
    logs: string[];
  }> => {
    const { skillNames, nodeId, nodeHost } = payload;
    const logs: string[] = [];
    const remoteSkillDir = '~/.hermes/skills/stargate-incoming';

    logs.push(`[SkillDelivery] Starting sync of ${skillNames.length} skills to ${nodeId}`);

    // Resolve node host
    const host = nodeHost || (() => {
      try {
        const fs = require('fs');
        const path = require('path');
        const home = require('os').homedir();
        // Read fleet registry from settings or fallback to known locations
        const registryPath = path.join(home, '.config', 'mosaic-companion', 'fleet_registry.json');
        if (fs.existsSync(registryPath)) {
          const data = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
          const node = (data.nodes || []).find((n: any) => n.nodeId === nodeId);
          return node?.apiHost || null;
        }
        return null;
      } catch { return null; }
    })();

    if (!host) {
      logs.push(`[SkillDelivery] ERROR: no host resolved for node ${nodeId}`);
      return { success: false, synced: [], failed: skillNames, verified: [], activated: [], remoteSkillDir, logs };
    }
    logs.push(`[SkillDelivery] Resolved host: ${host}`);

    const synced: string[] = [];
    const failed: string[] = [];

    // PHASE 1: Sync each skill via SCP
    for (const skillName of skillNames) {
      try {
        // Resolve skill path
        const skillPath = (() => {
          const path = require('path');
          const fs = require('fs');
          const hermesHome = process.env.HERMES_HOME || path.join(require('os').homedir(), '.hermes');
          const skillsBase = path.join(hermesHome, 'skills');
          if (!fs.existsSync(skillsBase)) return null;

          const direct = path.join(skillsBase, skillName, 'SKILL.md');
          if (fs.existsSync(direct)) return path.join(skillsBase, skillName);

          try {
            const cats = fs.readdirSync(skillsBase, { withFileTypes: true })
              .filter((d: any) => d.isDirectory()).map((d: any) => d.name);
            for (const cat of cats) {
              const nested = path.join(skillsBase, cat, skillName, 'SKILL.md');
              if (fs.existsSync(nested)) return path.join(skillsBase, cat, skillName);
              // Deep: ~/.hermes/skills/<category>/<subcategory>/<name>/
              try {
                const subs = fs.readdirSync(path.join(skillsBase, cat), { withFileTypes: true })
                  .filter((d: any) => d.isDirectory()).map((d: any) => d.name);
                for (const sub of subs) {
                  const deep = path.join(skillsBase, cat, sub, skillName, 'SKILL.md');
                  if (fs.existsSync(deep)) return path.join(skillsBase, cat, sub, skillName);
                }
              } catch { /* subdir unreadable */ }
            }
          } catch { }
          return null;
        })();

        if (!skillPath) {
          failed.push(`${skillName}: path not found`);
          logs.push(`[SkillDelivery] FAIL: skill path not found for ${skillName}`);
          continue;
        }

        // Create remote directory via SSH
        const mkdirResult = await (async () => {
          try {
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);
            const sshCmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no hyperai@${host} 'mkdir -p ${remoteSkillDir}/${skillName}'`;
            await execAsync(sshCmd, { timeout: 10000 });
            return true;
          } catch { return false; }
        })();

        if (!mkdirResult) {
          failed.push(`${skillName}: mkdir failed`);
          logs.push(`[SkillDelivery] FAIL: mkdir failed for ${skillName}`);
          continue;
        }

        // SCP skill directory
        const scpResult = await (async () => {
          try {
            const { execSync } = require('child_process');
            const cmd = `scp -r -o ConnectTimeout=5 -o StrictHostKeyChecking=no "${skillPath}" hyperai@${host}:${remoteSkillDir}/${skillName}`;
            execSync(cmd, { timeout: 30000, stdio: 'pipe' });
            return true;
          } catch { return false; }
        })();

        if (!scpResult) {
          failed.push(`${skillName}: scp failed`);
          logs.push(`[SkillDelivery] FAIL: scp failed for ${skillName}`);
          continue;
        }

        synced.push(skillName);
        logs.push(`[SkillDelivery] OK: ${skillName} synced to ${nodeId}`);
      } catch (e: any) {
        failed.push(`${skillName}: ${e.message}`);
        logs.push(`[SkillDelivery] FAIL: ${skillName} exception: ${e.message}`);
      }
    }

    // PHASE 3: Verify
    const verified: string[] = [];
    for (const skillName of synced) {
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const checkCmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no hyperai@${host} 'test -f ${remoteSkillDir}/${skillName}/SKILL.md && echo OK || echo MISSING'`;
        const { stdout } = await execAsync(checkCmd, { timeout: 10000 });
        if (stdout.trim() === 'OK') {
          verified.push(skillName);
          logs.push(`[SkillDelivery] VERIFY: ${skillName} present`);
        } else {
          logs.push(`[SkillDelivery] VERIFY: ${skillName} MISSING`);
        }
      } catch {
        logs.push(`[SkillDelivery] VERIFY: ${skillName} check failed`);
      }
    }

    // PHASE 4: Activate into Hermes skills path
    const activated: string[] = [];
    for (const skillName of verified) {
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const activateCmd = `ssh -o ConnectTimeout=5 -o StrictHostKeyChecking=no hyperai@${host} 'mkdir -p ~/.hermes/skills && cp -r ${remoteSkillDir}/${skillName} ~/.hermes/skills/ && echo OK || echo FAIL'`;
        const { stdout } = await execAsync(activateCmd, { timeout: 10000 });
        if (stdout.trim() === 'OK') {
          activated.push(skillName);
          logs.push(`[SkillDelivery] ACTIVATE: ${skillName} ready`);
        } else {
          logs.push(`[SkillDelivery] ACTIVATE: ${skillName} failed`);
        }
      } catch {
        logs.push(`[SkillDelivery] ACTIVATE: ${skillName} exception`);
      }
    }

    logs.push(`[SkillDelivery] DONE: synced=${synced.length}, verified=${verified.length}, activated=${activated.length}`);
    return { success: activated.length > 0, synced, failed, verified, activated, remoteSkillDir, logs };
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// Krea AI Image Generation IPC Handlers
// ═══════════════════════════════════════════════════════════════════════════

ipcMain.handle(
  "krea:generate",
  async (_event: IpcMainInvokeEvent, payload: any) => {
    try {
      const apiKey = process.env.KREA_API_KEY || "";
      if (!apiKey) {
        return { success: false, error: "KREA_API_KEY not configured" };
      }
      const client = new KreaClient({ apiKey });
      const result = await client.generate(payload);
      return { success: true, ...result };
    } catch (e: any) {
      console.error("[Krea] Generation failed:", e);
      return { success: false, error: e.message };
    }
  }
);

ipcMain.handle(
  "krea:checkStatus",
  async (_event: IpcMainInvokeEvent, generationId: string) => {
    try {
      const apiKey = process.env.KREA_API_KEY || "";
      if (!apiKey) {
        return { success: false, error: "KREA_API_KEY not configured" };
      }
      const client = new KreaClient({ apiKey });
      const result = await client.getStatus(generationId);
      return { success: true, ...result };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
);

ipcMain.handle(
  "krea:downloadImage",
  async (_event: IpcMainInvokeEvent, imageUrl: string, destPath: string) => {
    try {
      const fs = require("fs");
      const https = require("https");
      const http = require("http");
      const url = new URL(imageUrl);
      const protocol = url.protocol === "https:" ? https : http;

      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        protocol.get(imageUrl, (response: any) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Download failed: ${response.statusCode}`));
            return;
          }
          response.pipe(file);
          file.on("finish", () => {
            file.close();
            resolve({ success: true, path: destPath });
          });
        }).on("error", (err: any) => {
          fs.unlink(destPath, () => {});
          reject(err);
        });
      });
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
);
