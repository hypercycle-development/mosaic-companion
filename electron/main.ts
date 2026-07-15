import { app, BrowserWindow, clipboard, ipcMain, IpcMainInvokeEvent, powerMonitor, protocol, net } from "electron";
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
  getTabVisibility,
  setTabVisibility,
  readThemeSettings,
  writeThemeSettings,
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
import { initIDE, cleanupIDE } from "./integrations/ide/index";
// Plugin IPC handler registrations
// Phase 7 (§9.2): HyperInsight is no longer a static core plugin — it's
// carried entirely by its own addon (mosaic-addons/addons/hyperinsight),
// including registration and score polling. See ./addons/hyperinsight-migration
// for the one-time auto-install that gives upgrading profiles continuity.
import { registerAimNodesIpc } from "../plugins/aim-nodes/main/index.js";
import { registerPaymentsJitIpc } from "../plugins/payments-jit/main/index.ts";
// Addon system
import {
  initAddons,
  deactivateAll,
  activateAddon,
  deactivateAddon,
  installDevAddon,
  listAddons,
  listAddonTabs,
  setAddonEnabled,
  setLinkVisibilityToActivation,
  setUpdateCheckMode,
} from "./addons/loader";
import { installWebviewAttachGuards, ADDON_PRELOAD_PATH, broadcastAddonEvent } from "./addons/webviews";
import { ADDON_SCHEME_PRIVILEGE, registerAddonProtocolHandler } from "./addons/protocol";
import { registerAddonApi } from "./addons/api/index";
import { broadcastThemeToAddons } from "./addons/theme";
import {
  fetchCatalogue,
  beginInstall,
  confirmInstall,
  uninstallAddon,
  getDataSize,
  upgradeAddon,
  getAvailableUpdateVersion,
  runAutomaticUpdateCheckPass,
} from "./addons/installer";
import { runHyperInsightAutoInstallMigration, wasHyperInsightJustAutoInstalled } from "./addons/hyperinsight-migration";
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
import {
  type AIAgent,
  agentsHistoryPath,
  readAgents,
  writeAgents,
  validateActiveHypercycleAgent,
  validateAgentsListForActivation,
  ensureAgentHistoryDir,
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
  // Need licenseKey to connect to node manifests in aim-nodes-data.json
  licenseKey?: string;
}

interface ChatSession {
  id: string;
  agentId: string;
  [key: string]: unknown;
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

  // Addon webview attach guards (§4.2) — main-process enforcement of
  // contextIsolation/sandbox/nodeIntegration/preload for every
  // mosaic-addon:// webview, and preload-stripping for every other one.
  installWebviewAttachGuards(win);

  // Pushed to addon webviews subscribed to "window:focus-changed" (§4.3).
  win.on('focus', () => broadcastAddonEvent('window:focus-changed', { focused: true }));
  win.on('blur', () => broadcastAddonEvent('window:focus-changed', { focused: false }));

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
  deactivateAll().catch((e) => console.error("[Addons] Deactivate-all failed:", e));
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
  { scheme: 'mosaic-media', privileges: { bypassCSP: true, supportFetchAPI: true, corsEnabled: true } },
  ADDON_SCHEME_PRIVILEGE,
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

  // Register mosaic-addon:// (§4.1) — serves each addon's renderer/ dir,
  // 403 unless the addon is currently activated.
  registerAddonProtocolHandler();

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
  registerAimNodesIpc(ipcMain);
  registerPaymentsJitIpc(ipcMain);

  // Addon system — registered after the static core plugins above so
  // reserved-namespace collision checks see reality, and before the
  // renderer subsystems below (§8).
  ipcMain.handle("addons:list", async () =>
    listAddons().map((summary) => ({
      ...summary,
      updateAvailable: getAvailableUpdateVersion(summary.id),
    })),
  );
  ipcMain.handle("addons:list-tabs", async () => listAddonTabs());
  ipcMain.handle("addons:activate", async (_event: IpcMainInvokeEvent, id: string) => {
    const result = await activateAddon(id);
    broadcastAddonsChanged();
    return result;
  });
  ipcMain.handle("addons:deactivate", async (_event: IpcMainInvokeEvent, id: string) => {
    const result = await deactivateAddon(id);
    broadcastAddonsChanged();
    return result;
  });
  ipcMain.handle("addons:set-enabled", async (_event: IpcMainInvokeEvent, id: string, enabled: boolean) => {
    const result = await setAddonEnabled(id, enabled);
    broadcastAddonsChanged();
    broadcastTabPrefsChanged(getTabVisibility());
    return result;
  });
  ipcMain.handle("addons:install-dev", async (_event: IpcMainInvokeEvent, devPath: string) => installDevAddon(devPath));
  ipcMain.handle("addons:get-preload-path", async () => ADDON_PRELOAD_PATH);

  // Phase 4 — registry/installer surface
  ipcMain.handle(
    "addons:fetch-catalogue",
    async (_event: IpcMainInvokeEvent, opts?: { registryUrl?: string; sigUrl?: string }) => fetchCatalogue(opts),
  );
  ipcMain.handle("addons:install", async (_event: IpcMainInvokeEvent, id: string) => beginInstall(id));
  ipcMain.handle(
    "addons:install-confirm",
    async (_event: IpcMainInvokeEvent, id: string, acceptedPermissions: string[]) => {
      const result = await confirmInstall(id, acceptedPermissions);
      broadcastAddonsChanged();
      return result;
    },
  );
  ipcMain.handle(
    "addons:uninstall",
    async (_event: IpcMainInvokeEvent, id: string, opts: { keepSettings: boolean; keepData: boolean }) => {
      const result = await uninstallAddon(id, opts);
      broadcastAddonsChanged();
      broadcastTabPrefsChanged(getTabVisibility());
      return result;
    },
  );
  ipcMain.handle("addons:get-data-size", async (_event: IpcMainInvokeEvent, id: string) => getDataSize(id));
  ipcMain.handle(
    "addons:upgrade",
    async (_event: IpcMainInvokeEvent, id: string, acceptedPermissions?: string[]) => {
      const result = await upgradeAddon(id, acceptedPermissions);
      broadcastAddonsChanged();
      return result;
    },
  );
  ipcMain.handle(
    "addons:set-visibility-link",
    async (_event: IpcMainInvokeEvent, id: string, linked: boolean) => {
      setLinkVisibilityToActivation(id, linked);
      broadcastAddonsChanged();
      return { success: true };
    },
  );
  ipcMain.handle(
    "addons:set-update-check-mode",
    async (_event: IpcMainInvokeEvent, id: string, mode: "manual" | "automatic") => {
      setUpdateCheckMode(id, mode);
      broadcastAddonsChanged();
      return { success: true };
    },
  );
  // §9.2/§10 Phase 7 — queried once by the renderer on startup to show the
  // one-time "HyperInsight is now an addon" non-blocking notice. True only
  // for the launch that actually performed the auto-install (see
  // ./addons/hyperinsight-migration); false on every later launch.
  ipcMain.handle("addons:was-hyperinsight-just-migrated", async () => wasHyperInsightJustAutoInstalled());

  // The addonAPI dispatcher (§5.1) — one invoke channel + one event channel
  // for every addon webview.
  registerAddonApi();

  // §8/§9.2: the one-time HyperInsight auto-install migration runs before
  // initAddons()'s regular activation convergence, so — for an upgrading
  // profile — the newly-installed addon activates in the very same pass as
  // every other already-installed addon, not a separate later step.
  runHyperInsightAutoInstallMigration()
    .catch((e) => console.error("[Addons] HyperInsight auto-install migration failed:", e))
    .then(() => initAddons())
    .then(() => {
      // Once-per-launch automatic-update-check pass (§7.2, decision 7) — not
      // a recurring poll. Only addons opted into "Automatic" are checked,
      // and only via a single registry fetch. Best-effort: failures (e.g.
      // no network) just mean no "Update available" badge this session.
      runAutomaticUpdateCheckPass()
        .then(() => broadcastAddonsChanged())
        .catch((e) => console.error("[Addons] Automatic update check failed:", e));
    })
    .catch((e) => console.error("[Addons] Init failed:", e));

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

// Directory picker — used by Settings → Addons → Dev corner's "Load unpacked
// addon…" (§7.4).
ipcMain.handle("dialog:open-directory", async () => {
  const { dialog } = await import("electron");
  const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openDirectory"] });
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
  // addonAPI.wallet:changed (§5.2/§5.3, wallet:read) — same trigger point as
  // the core-renderer "wallet:imported" notice above.
  broadcastAddonEvent("wallet:changed", { address: getWalletAddress() });
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
  const success = writeThemeSettings({ activeTheme });
  if (success) {
    broadcastThemeToAddons(activeTheme);
  }
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

ipcMain.handle("media:set-auto-display", (_event, enabled: boolean) => {
  const result = setAutoDisplayMedia(enabled);
  return { ...result, enabled: getAutoDisplayMedia() };
});

// =============================================================================
// Sidebar Tab Visibility
// =============================================================================

function broadcastTabPrefsChanged(visibility: Record<string, boolean>): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("tab-prefs:changed", visibility);
  });
}

ipcMain.handle("tab-prefs:get", () => {
  return getTabVisibility();
});

ipcMain.handle(
  "tab-prefs:set-visibility",
  (_event: IpcMainInvokeEvent, tabId: string, visible: boolean) => {
    const result = setTabVisibility(tabId, visible);
    if (result.success) {
      broadcastTabPrefsChanged(getTabVisibility());
    }
    return result;
  },
);

// =============================================================================
// Addon lifecycle broadcast — tells the main app renderer (Sidebar,
// AddonHostView), not addon webviews, that installed/activated/tab state may
// have changed. Addon webviews get their own, differently-scoped pushes via
// addon-api:event (webviews.ts's broadcastAddonEvent).
// =============================================================================

function broadcastAddonsChanged(): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("addons:changed", listAddonTabs());
  });
}
