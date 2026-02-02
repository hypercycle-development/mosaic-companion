// electron/main.ts
import { app as app5, BrowserWindow as BrowserWindow3, ipcMain as ipcMain2 } from "electron";
import path5 from "path";
import { fileURLToPath } from "url";
import fs4 from "fs";

// electron/updater.ts
import { app as app3, dialog, BrowserWindow } from "electron";
import electronUpdater from "electron-updater";

// electron/settings.ts
import { app as app2 } from "electron";
import fs2 from "fs";
import path2 from "path";

// electron/utils/index.ts
import fs from "fs";
import { app } from "electron";
import path from "path";
function getDirectoryStatus(dirPath) {
  try {
    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return { exists: true, isDirectory: false, isEmpty: null };
    }
    const files = fs.readdirSync(dirPath);
    return { exists: true, isDirectory: true, isEmpty: files.length === 0 };
  } catch (err) {
    if (err instanceof Error && err.code === "ENOENT") {
      return { exists: false, isDirectory: false, isEmpty: null };
    }
    throw err;
  }
}
var agentsHistoryPath = path.join(app.getPath("userData"), "agents_history");
function getAgentHistoryFolder(agentId) {
  return path.join(agentsHistoryPath, agentId.toString());
}
function getChatSessionPath(agentId, sessionId) {
  return path.join(getAgentHistoryFolder(agentId), `${sessionId}.json`);
}
function ensureAgentFolder(agentId) {
  const folderPath = getAgentHistoryFolder(agentId);
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }
  return folderPath;
}
function readAgentHistories(agentId) {
  try {
    const folderPath = getAgentHistoryFolder(agentId);
    if (!fs.existsSync(folderPath)) {
      return [];
    }
    const files = fs.readdirSync(folderPath);
    const sessions = [];
    for (const file of files) {
      if (path.extname(file).toLowerCase() !== ".json") {
        continue;
      }
      try {
        const filePath = path.join(folderPath, file);
        const fileContent = fs.readFileSync(filePath, "utf-8");
        const session = JSON.parse(fileContent);
        sessions.push(session);
      } catch (parseError) {
        console.error(`Failed to parse ${file}:`, parseError);
      }
    }
    sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return sessions;
  } catch (error) {
    console.error("Failed to read agent histories:", error);
    return [];
  }
}
function readAgentHistory(agentId, sessionId) {
  try {
    const filePath = getChatSessionPath(agentId, sessionId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const data = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to read agent history:", error);
    return null;
  }
}
function writeAgentHistory(chatSession) {
  try {
    ensureAgentFolder(chatSession.agentId);
    const filePath = getChatSessionPath(chatSession.agentId, chatSession.id);
    fs.writeFileSync(filePath, JSON.stringify(chatSession, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Failed to write agent history:", error);
    return false;
  }
}
function deleteAgentHistory(agentId, sessionId) {
  try {
    const filePath = getChatSessionPath(agentId, sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return true;
  } catch (error) {
    console.error("Failed to delete agent history:", error);
    return false;
  }
}
function deleteAllAgentHistories(agentId) {
  try {
    const folderPath = getAgentHistoryFolder(agentId);
    if (fs.existsSync(folderPath)) {
      fs.rmSync(folderPath, { recursive: true, force: true });
    }
    return true;
  } catch (error) {
    console.error("Failed to delete all agent histories:", error);
    return false;
  }
}
function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

// electron/settings.ts
var settingsPath = path2.join(app2.getPath("userData"), "app-settings.json");
var DEFAULT_SETTINGS = {
  autoDownload: false,
  titleBarStyle: process.platform === "darwin" ? "default" : "hidden",
  nodes: []
};
var settings = { ...DEFAULT_SETTINGS };
function loadSettings() {
  try {
    if (fs2.existsSync(settingsPath)) {
      const data = fs2.readFileSync(settingsPath, "utf8");
      const loaded = JSON.parse(data);
      settings = {
        ...DEFAULT_SETTINGS,
        ...loaded,
        nodes: loaded.nodes || []
      };
      if (!settings.titleBarStyle) {
        settings.titleBarStyle = DEFAULT_SETTINGS.titleBarStyle;
      }
      console.log("Settings loaded from:", settingsPath);
    } else {
      console.log("No settings file found, using defaults");
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
    settings = { ...DEFAULT_SETTINGS };
  }
  return settings;
}
function saveSettings() {
  try {
    fs2.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    console.log("Settings saved to:", settingsPath);
    return { success: true };
  } catch (error) {
    console.error("Failed to save settings:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}
function getUpdateSettings() {
  return {
    autoDownload: settings.autoDownload,
    titleBarStyle: settings.titleBarStyle,
    nodes: [...settings.nodes]
  };
}
function setUpdateSettings(newSettings) {
  if (typeof newSettings.autoDownload === "boolean") {
    settings.autoDownload = newSettings.autoDownload;
  }
  if (typeof newSettings.titleBarStyle === "string") {
    settings.titleBarStyle = newSettings.titleBarStyle;
  }
  const saveResult = saveSettings();
  return { ...saveResult, settings: getUpdateSettings() };
}
function getTitleBarStyle() {
  return settings.titleBarStyle;
}
var MAX_NODES = 3;
function getNodes() {
  return [...settings.nodes];
}
function addNode(node) {
  if (settings.nodes.length >= MAX_NODES) {
    return { success: false, error: `Maximum ${MAX_NODES} nodes allowed` };
  }
  const newNode = {
    id: `node-${Date.now()}`,
    name: node.name || "New Node",
    apiHost: node.apiHost || "",
    apiPort: node.apiPort || "8000",
    hasAdminPanel: node.hasAdminPanel || false,
    adminHost: node.adminHost || "",
    adminPort: node.adminPort || "8006",
    isActive: node.isActive !== void 0 ? node.isActive : true
  };
  settings.nodes.push(newNode);
  const saveResult = saveSettings();
  return { ...saveResult, nodes: getNodes() };
}
function updateNode(id, updates) {
  const index = settings.nodes.findIndex((n) => n.id === id);
  if (index === -1) {
    return { success: false, error: "Node not found" };
  }
  settings.nodes[index] = { ...settings.nodes[index], ...updates };
  const saveResult = saveSettings();
  return { ...saveResult, nodes: getNodes() };
}
function deleteNode(id) {
  const index = settings.nodes.findIndex((n) => n.id === id);
  if (index === -1) {
    return { success: false, error: "Node not found" };
  }
  settings.nodes.splice(index, 1);
  const saveResult = saveSettings();
  return { ...saveResult, nodes: getNodes() };
}
loadSettings();

// electron/updater.ts
import fs3 from "fs";
import path3 from "path";
import os from "os";
import { autoUpdater as nativeUpdater } from "electron";
var { autoUpdater } = electronUpdater;
var LOG_FILE = path3.join(app3.getPath("userData"), "update.log");
function log(level, ...args) {
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const platform = os.platform();
  const message = args.map(
    (arg) => typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)
  ).join(" ");
  const logLine = `[${timestamp}] [${platform}] [${level}] ${message}
`;
  if (level === "ERROR") {
    console.error(`\u{1F534} [UPDATER] ${message}`);
  } else if (level === "WARN") {
    console.warn(`\u{1F7E1} [UPDATER] ${message}`);
  } else {
    console.log(`\u{1F7E2} [UPDATER] ${message}`);
  }
  try {
    fs3.appendFileSync(LOG_FILE, logLine, "utf8");
  } catch (e) {
    console.error("Failed to write to log file:", e);
  }
}
function rotateLogFile() {
  try {
    if (fs3.existsSync(LOG_FILE)) {
      const content = fs3.readFileSync(LOG_FILE, "utf8");
      const lines = content.split("\n");
      if (lines.length > 1e3) {
        fs3.writeFileSync(LOG_FILE, lines.slice(-500).join("\n"), "utf8");
        log("INFO", "Log file rotated (kept last 500 lines)");
      }
    }
  } catch (e) {
    console.error("Failed to rotate log file:", e);
  }
}
function getLogFilePath() {
  return LOG_FILE;
}
function readLogFile() {
  try {
    if (fs3.existsSync(LOG_FILE)) {
      return fs3.readFileSync(LOG_FILE, "utf8");
    }
  } catch (e) {
    console.error("Failed to read log file:", e);
  }
  return "";
}
autoUpdater.logger = {
  info: (...args) => log("INFO", "[electron-updater]", ...args),
  warn: (...args) => log("WARN", "[electron-updater]", ...args),
  error: (...args) => log("ERROR", "[electron-updater]", ...args),
  debug: (...args) => log("DEBUG", "[electron-updater]", ...args)
};
log("INFO", "Configuring S3 provider for updates");
autoUpdater.setFeedURL({
  provider: "s3",
  bucket: "mosaic-release",
  region: "us-east-2",
  path: "/releases"
});
log("INFO", "S3 feed URL configured: bucket=mosaic-release, region=us-east-2");
function initUpdater() {
  rotateLogFile();
  log("INFO", "========================================");
  log("INFO", "UPDATER INITIALIZATION");
  log("INFO", "========================================");
  log("INFO", `Platform: ${os.platform()} (${os.arch()})`);
  log("INFO", `OS Version: ${os.release()}`);
  log("INFO", `App Version: ${app3.getVersion()}`);
  log("INFO", `App Path: ${app3.getAppPath()}`);
  log("INFO", `User Data Path: ${app3.getPath("userData")}`);
  log("INFO", `Log File: ${LOG_FILE}`);
  log("INFO", `Is Packaged: ${app3.isPackaged}`);
  const settings2 = loadSettings();
  autoUpdater.autoDownload = settings2.autoDownload;
  autoUpdater.autoInstallOnAppQuit = true;
  log("INFO", `autoDownload: ${settings2.autoDownload}`);
  log("INFO", `autoInstallOnAppQuit: true`);
  log("INFO", "========================================");
}
function applyAutoDownload(enabled) {
  autoUpdater.autoDownload = enabled;
  log("INFO", `Auto-download setting changed to: ${enabled}`);
}
function checkForUpdates() {
  log("INFO", "Checking for updates (automatic startup check)...");
  autoUpdater.checkForUpdates().then((result) => {
    log(
      "INFO",
      "checkForUpdates resolved:",
      result ? {
        updateInfo: result.updateInfo,
        cancellationToken: !!result.cancellationToken
      } : "null result"
    );
  }).catch((err) => {
    log("ERROR", "Error checking for updates:", err.message);
    log("ERROR", "Stack trace:", err.stack);
    dialog.showMessageBox({
      type: "error",
      title: "Update Error",
      message: "Failed to check for updates. Please try again later.",
      detail: err.message
    });
  });
}
var isManualCheck = false;
function manualCheckForUpdates() {
  log("INFO", "========================================");
  log("INFO", "MANUAL UPDATE CHECK TRIGGERED");
  log("INFO", "========================================");
  isManualCheck = true;
  autoUpdater.checkForUpdates().then((result) => {
    log(
      "INFO",
      "Manual checkForUpdates resolved:",
      result ? {
        updateInfo: result.updateInfo,
        cancellationToken: !!result.cancellationToken
      } : "null result"
    );
    if (!result || !result.updateInfo) {
      log("INFO", 'No update info returned, showing "no updates" dialog');
      dialog.showMessageBox({
        type: "info",
        title: "No Updates",
        message: "You are running the latest version."
      });
      isManualCheck = false;
    }
  }).catch((err) => {
    log("ERROR", "Manual update check failed:", err.message);
    log("ERROR", "Stack trace:", err.stack);
    dialog.showMessageBox({
      type: "error",
      title: "Update Error",
      message: "Failed to check for updates. Please try again later.",
      detail: err.message
    });
    isManualCheck = false;
  });
}
autoUpdater.on("checking-for-update", () => {
  log("INFO", ">>> EVENT: checking-for-update");
});
autoUpdater.on("update-available", (info) => {
  log("INFO", "========================================");
  log("INFO", ">>> EVENT: update-available");
  log("INFO", "Update Info:", JSON.stringify(info, null, 2));
  log("INFO", "========================================");
  isManualCheck = false;
  log("INFO", "Showing update available dialog...");
  dialog.showMessageBox({
    type: "info",
    title: "Update Available",
    message: `A new version (${info.version}) is available.`,
    detail: "Would you like to download and install it now?",
    buttons: ["Download Now", "Later"],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    log(
      "INFO",
      `User clicked button index: ${result.response} (${result.response === 0 ? "Download Now" : "Later"})`
    );
    if (result.response === 0) {
      log("INFO", "========================================");
      log("INFO", "STARTING DOWNLOAD");
      log("INFO", "========================================");
      log("INFO", "Calling autoUpdater.downloadUpdate()...");
      autoUpdater.downloadUpdate().then((downloadPath) => {
        log("INFO", "downloadUpdate() promise resolved!");
        log("INFO", "Download path:", downloadPath);
      }).catch((downloadErr) => {
        log("ERROR", "========================================");
        log("ERROR", "DOWNLOAD FAILED!");
        log("ERROR", "========================================");
        log("ERROR", "Error message:", downloadErr.message);
        log("ERROR", "Error name:", downloadErr.name);
        log("ERROR", "Error code:", downloadErr.code);
        log("ERROR", "Stack trace:", downloadErr.stack);
        log(
          "ERROR",
          "Full error object:",
          JSON.stringify(
            downloadErr,
            Object.getOwnPropertyNames(downloadErr),
            2
          )
        );
        dialog.showMessageBox({
          type: "error",
          title: "Download Failed",
          message: "Failed to download the update.",
          detail: `${downloadErr.message}

Check the log file for details:
${LOG_FILE}`
        });
      });
      log("INFO", "downloadUpdate() called (async operation started)");
    } else {
      log("INFO", "User chose to update later");
    }
  }).catch((dialogErr) => {
    log("ERROR", "Dialog error:", dialogErr.message);
    log("ERROR", "Stack:", dialogErr.stack);
  });
});
autoUpdater.on("update-not-available", (info) => {
  log("INFO", ">>> EVENT: update-not-available");
  log("INFO", "Current version is up to date:", info.version);
  if (isManualCheck) {
    log("INFO", 'Showing "no updates" dialog (manual check)');
    dialog.showMessageBox({
      type: "info",
      title: "No Updates Available",
      message: "You're up to date!",
      detail: `Mosaic Browser ${info.version} is the latest version.`
    });
    isManualCheck = false;
  }
});
autoUpdater.on("download-progress", (progress) => {
  const percent = progress.percent.toFixed(1);
  const transferred = (progress.transferred / 1024 / 1024).toFixed(2);
  const total = (progress.total / 1024 / 1024).toFixed(2);
  const speed = (progress.bytesPerSecond / 1024).toFixed(1);
  log(
    "INFO",
    `>>> EVENT: download-progress - ${percent}% (${transferred}/${total} MB, ${speed} KB/s)`
  );
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setProgressBar(progress.percent / 100);
  }
});
autoUpdater.on("update-downloaded", (info) => {
  log("INFO", "========================================");
  log("INFO", ">>> EVENT: update-downloaded");
  log("INFO", "Version:", info.version);
  log("INFO", "Release Date:", info.releaseDate);
  log("INFO", "Download Info:", JSON.stringify(info, null, 2));
  log("INFO", "========================================");
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setProgressBar(-1);
  }
  log("INFO", 'Showing "update ready" dialog...');
  dialog.showMessageBox({
    type: "info",
    title: "Update Ready",
    message: "Update downloaded successfully.",
    detail: "The application will restart to install the update. Save your work before proceeding.",
    buttons: ["Restart Now", "Later"],
    defaultId: 0,
    cancelId: 1
  }).then((result) => {
    log(
      "INFO",
      `User clicked button index: ${result.response} (${result.response === 0 ? "Restart Now" : "Later"})`
    );
    if (result.response === 0) {
      if (process.platform === "darwin") {
        app3.removeAllListeners("before-quit");
        app3.removeAllListeners("window-all-closed");
        BrowserWindow.getAllWindows().forEach((win2) => {
          if (win2.isDestroyed()) return;
          win2.removeAllListeners("close");
          win2.close();
        });
        nativeUpdater.once("before-quit-for-update", () => {
          app3.exit();
        });
      }
      log("INFO", "Calling quitAndInstall()...");
      autoUpdater.quitAndInstall(true, true);
    } else {
      log("INFO", "User chose to restart later");
    }
  });
});
autoUpdater.on("error", (err) => {
  log("ERROR", "========================================");
  log("ERROR", ">>> EVENT: error");
  log("ERROR", "Error message:", err.message);
  log("ERROR", "Error name:", err.name);
  log("ERROR", "Error code:", err.code);
  log("ERROR", "Stack trace:", err.stack);
  log(
    "ERROR",
    "Full error:",
    JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
  );
  log("ERROR", "========================================");
  if (os.platform() === "darwin") {
    dialog.showMessageBox({
      type: "error",
      title: "Update Error",
      message: "An error occurred during the update process.",
      detail: `${err.message}

Log file: ${LOG_FILE}`
    });
  }
});

// electron/integrations/mcp/index.ts
import { app as app4, BrowserWindow as BrowserWindow2, ipcMain } from "electron";
import { spawn } from "child_process";
import * as path4 from "path";
import * as readline from "readline";
var MCPClient = class {
  constructor() {
    this.connections = /* @__PURE__ */ new Map();
    this.mainWindow = null;
  }
  setMainWindow(window) {
    this.mainWindow = window;
  }
  // ============ STDIO TRANSPORT ============
  async connectStdio(config) {
    if (!config.command) {
      throw new Error("STDIO transport requires a command");
    }
    console.log(`[MCP] Connecting to ${config.name} via STDIO...`);
    const connection = {
      config,
      requestId: 0,
      pendingRequests: /* @__PURE__ */ new Map(),
      tools: [],
      resources: [],
      prompts: [],
      initialized: false
    };
    const childProcess = spawn(config.command, config.args || [], {
      env: { ...process.env, ...config.env },
      stdio: ["pipe", "pipe", "pipe"]
    });
    connection.process = childProcess;
    const rl = readline.createInterface({
      input: childProcess.stdout,
      crlfDelay: Infinity
    });
    rl.on("line", (line) => {
      try {
        const message = JSON.parse(line);
        this.handleMessage(config.name, message);
      } catch (error) {
        console.error(
          `[MCP] Failed to parse message from ${config.name}:`,
          error
        );
      }
    });
    childProcess.stderr?.on("data", (data) => {
      console.log(`[MCP] ${config.name} stderr:`, data.toString());
    });
    childProcess.on("exit", (code) => {
      console.log(`[MCP] ${config.name} exited with code ${code}`);
      this.connections.delete(config.name);
      this.notifyRenderer("mcp:server-disconnected", {
        name: config.name,
        code
      });
    });
    childProcess.on("error", (error) => {
      console.error(`[MCP] ${config.name} error:`, error);
      this.notifyRenderer("mcp:server-error", {
        name: config.name,
        error: error.message
      });
    });
    this.connections.set(config.name, connection);
    await this.initializeConnection(config.name);
  }
  // ============ HTTP TRANSPORT ============
  async connectHttp(config) {
    if (!config.url) {
      throw new Error("HTTP transport requires a URL");
    }
    console.log(
      `[MCP] Connecting to ${config.name} via HTTP at ${config.url}...`
    );
    const connection = {
      config,
      requestId: 0,
      pendingRequests: /* @__PURE__ */ new Map(),
      tools: [],
      resources: [],
      prompts: [],
      initialized: false
    };
    this.connections.set(config.name, connection);
    await this.initializeConnection(config.name);
  }
  // ============ CONNECTION MANAGEMENT ============
  async initializeConnection(serverName) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);
    const initResult = await this.sendRequest(serverName, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {
        roots: { listChanged: true },
        sampling: {}
      },
      clientInfo: {
        name: "electron-mcp-client",
        version: "1.0.0"
      }
    });
    console.log(`[MCP] ${serverName} initialized:`, initResult);
    await this.sendNotification(serverName, "notifications/initialized", {});
    connection.initialized = true;
    await this.refreshCapabilities(serverName);
    this.notifyRenderer("mcp:server-connected", {
      name: serverName,
      tools: connection.tools,
      resources: connection.resources,
      prompts: connection.prompts
    });
  }
  async refreshCapabilities(serverName) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);
    try {
      const toolsResult = await this.sendRequest(
        serverName,
        "tools/list",
        {}
      );
      connection.tools = toolsResult.tools || [];
      console.log(
        `[MCP] ${serverName} tools:`,
        connection.tools.map((t) => t.name)
      );
    } catch (error) {
      console.log(`[MCP] ${serverName} does not support tools`);
    }
    try {
      const resourcesResult = await this.sendRequest(
        serverName,
        "resources/list",
        {}
      );
      connection.resources = resourcesResult.resources || [];
      console.log(
        `[MCP] ${serverName} resources:`,
        connection.resources.map((r) => r.uri)
      );
    } catch (error) {
      console.log(`[MCP] ${serverName} does not support resources`);
    }
    try {
      const promptsResult = await this.sendRequest(
        serverName,
        "prompts/list",
        {}
      );
      connection.prompts = promptsResult.prompts || [];
      console.log(
        `[MCP] ${serverName} prompts:`,
        connection.prompts.map((p) => p.name)
      );
    } catch (error) {
      console.log(`[MCP] ${serverName} does not support prompts`);
    }
  }
  async disconnect(serverName) {
    const connection = this.connections.get(serverName);
    if (!connection) return;
    if (connection.process) {
      connection.process.kill();
    }
    this.connections.delete(serverName);
    console.log(`[MCP] Disconnected from ${serverName}`);
  }
  async disconnectAll() {
    for (const name of this.connections.keys()) {
      await this.disconnect(name);
    }
  }
  // ============ MESSAGE HANDLING ============
  async sendRequest(serverName, method, params) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);
    const id = ++connection.requestId;
    const request = {
      jsonrpc: "2.0",
      id,
      method,
      params
    };
    return new Promise((resolve, reject) => {
      connection.pendingRequests.set(id, { resolve, reject });
      const timeout = setTimeout(() => {
        connection.pendingRequests.delete(id);
        reject(new Error(`Request ${method} timed out`));
      }, 3e4);
      if (connection.config.transport === "stdio" && connection.process) {
        connection.process.stdin?.write(JSON.stringify(request) + "\n");
      } else if (connection.config.transport === "http") {
        this.sendHttpRequest(connection, request).then(resolve).catch(reject).finally(() => {
          clearTimeout(timeout);
          connection.pendingRequests.delete(id);
        });
        return;
      }
      const originalResolve = connection.pendingRequests.get(id).resolve;
      connection.pendingRequests.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          originalResolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });
    });
  }
  async sendHttpRequest(connection, request) {
    const headers = {
      "Content-Type": "application/json"
    };
    if (connection.config.apiKey) {
      headers["Authorization"] = `Bearer ${connection.config.apiKey}`;
    }
    const response = await fetch(connection.config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    if (result.error) {
      throw new Error(`MCP Error: ${result.error.message}`);
    }
    return result.result;
  }
  async sendNotification(serverName, method, params) {
    const connection = this.connections.get(serverName);
    if (!connection) throw new Error(`Server ${serverName} not found`);
    const notification = {
      jsonrpc: "2.0",
      method,
      params
    };
    if (connection.config.transport === "stdio" && connection.process) {
      connection.process.stdin?.write(JSON.stringify(notification) + "\n");
    } else if (connection.config.transport === "http") {
      fetch(connection.config.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...connection.config.apiKey && {
            Authorization: `Bearer ${connection.config.apiKey}`
          }
        },
        body: JSON.stringify(notification)
      }).catch(console.error);
    }
  }
  handleMessage(serverName, message) {
    const connection = this.connections.get(serverName);
    if (!connection) return;
    if ("id" in message && message.id !== null) {
      const pending = connection.pendingRequests.get(message.id);
      if (pending) {
        connection.pendingRequests.delete(message.id);
        if (message.error) {
          pending.reject(
            new Error(message.error.message)
          );
        } else {
          pending.resolve(message.result);
        }
      }
    } else {
      this.handleNotification(serverName, message);
    }
  }
  handleNotification(serverName, notification) {
    console.log(`[MCP] ${serverName} notification:`, notification.method);
    switch (notification.method) {
      case "notifications/tools/list_changed":
        this.refreshCapabilities(serverName);
        break;
      case "notifications/resources/list_changed":
        this.refreshCapabilities(serverName);
        break;
      case "notifications/prompts/list_changed":
        this.refreshCapabilities(serverName);
        break;
      default:
        this.notifyRenderer("mcp:notification", {
          server: serverName,
          method: notification.method,
          params: notification.params
        });
    }
  }
  notifyRenderer(channel, data) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
  // ============ PUBLIC API (exposed via IPC) ============
  async callTool(serverName, toolName, args) {
    console.log(`[MCP] Calling tool ${toolName} on ${serverName}`);
    return this.sendRequest(serverName, "tools/call", {
      name: toolName,
      arguments: args
    });
  }
  async readResource(serverName, uri) {
    console.log(`[MCP] Reading resource ${uri} from ${serverName}`);
    return this.sendRequest(serverName, "resources/read", { uri });
  }
  async getPrompt(serverName, promptName, args) {
    console.log(`[MCP] Getting prompt ${promptName} from ${serverName}`);
    return this.sendRequest(serverName, "prompts/get", {
      name: promptName,
      arguments: args
    });
  }
  getServers() {
    return Array.from(this.connections.entries()).map(([name, conn]) => ({
      name,
      transport: conn.config.transport,
      initialized: conn.initialized,
      tools: conn.tools,
      resources: conn.resources,
      prompts: conn.prompts
    }));
  }
};
var mcpClient = new MCPClient();
var mainWindow = null;
function createWindow() {
  mainWindow = new BrowserWindow2({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path4.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mcpClient.setMainWindow(mainWindow);
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path4.join(__dirname, "../renderer/index.html"));
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}
ipcMain.handle("mcp:connect", async (_event, config) => {
  try {
    if (config.transport === "stdio") {
      await mcpClient.connectStdio(config);
    } else {
      await mcpClient.connectHttp(config);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
ipcMain.handle("mcp:disconnect", async (_event, serverName) => {
  await mcpClient.disconnect(serverName);
  return { success: true };
});
ipcMain.handle("mcp:list-servers", () => {
  return mcpClient.getServers();
});
ipcMain.handle(
  "mcp:call-tool",
  async (_event, serverName, toolName, args) => {
    try {
      const result = await mcpClient.callTool(serverName, toolName, args);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);
ipcMain.handle(
  "mcp:read-resource",
  async (_event, serverName, uri) => {
    try {
      const result = await mcpClient.readResource(serverName, uri);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);
ipcMain.handle(
  "mcp:get-prompt",
  async (_event, serverName, promptName, args) => {
    try {
      const result = await mcpClient.getPrompt(serverName, promptName, args);
      return { success: true, result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
);
app4.whenReady().then(() => {
  createWindow();
  app4.on("activate", () => {
    if (BrowserWindow2.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
app4.on("window-all-closed", () => {
  mcpClient.disconnectAll();
  if (process.platform !== "darwin") {
    app4.quit();
  }
});
app4.on("before-quit", () => {
  mcpClient.disconnectAll();
});

// electron/main.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname2 = path5.dirname(__filename);
var PROJECT_ROOT = path5.join(__dirname2, "..");
var agentsHistoryPath2 = path5.join(app5.getPath("userData"), "agents_history");
var mainWindow2 = null;
function createWindow2(urlToLoad = null) {
  const titleBarStyle = getTitleBarStyle();
  const win = new BrowserWindow3({
    width: 1280,
    height: 800,
    titleBarStyle: titleBarStyle === "default" ? "default" : "hidden",
    trafficLightPosition: { x: 10, y: 10 },
    backgroundColor: "#111827",
    webPreferences: {
      preload: path5.join(__dirname2, "preload.js"),
      // preload is in dist_electron
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      backgroundThrottling: false
    }
  });
  if (urlToLoad) {
    win.loadURL(urlToLoad);
  } else {
    win.loadFile(path5.join(PROJECT_ROOT, "dist", "index.html"));
  }
  mainWindow2 = win;
  return win;
}
app5.on("before-quit", () => {
  mcpClient.disconnectAll();
});
function recreateWindow() {
  if (!mainWindow2) return;
  const currentURL = mainWindow2.webContents.getURL();
  const bounds = mainWindow2.getBounds();
  mainWindow2.close();
  const newWin = createWindow2(currentURL);
  newWin.setBounds(bounds);
  console.log("Window recreated with new titleBarStyle");
}
ipcMain2.handle("restart-window", async () => {
  recreateWindow();
  return { success: true };
});
ipcMain2.handle("show-title-bar-confirm", async () => {
  const { dialog: dialog2 } = await import("electron");
  const result = await dialog2.showMessageBox(mainWindow2, {
    type: "question",
    title: "Apply Title Bar Style",
    message: "This will refresh the window to apply the new title bar style.",
    detail: "Any unsaved work could be lost.",
    buttons: ["Apply Now", "Apply Later", "Cancel"],
    defaultId: 0,
    cancelId: 2
  });
  return { buttonIndex: result.response };
});
app5.on("web-contents-created", (_event, contents) => {
  contents.on(
    "did-fail-load",
    (event, errorCode, _errorDescription, _validatedURL, _isMainFrame) => {
      if (errorCode === -3) {
        event.preventDefault();
        return;
      }
    }
  );
});
app5.whenReady().then(() => {
  console.log("User data path:", app5.getPath("userData"));
  const agentsHistoryPathExist = getDirectoryStatus(agentsHistoryPath2);
  if (!agentsHistoryPathExist.exists) {
    try {
      fs4.mkdirSync(agentsHistoryPath2, { recursive: true });
    } catch (e) {
      console.log(`Error when creating agents path: ${e}`);
    }
  }
  createWindow2();
  if (app5.isPackaged) {
    initUpdater();
    checkForUpdates();
  }
});
app5.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app5.quit();
  }
});
app5.on("activate", () => {
  if (BrowserWindow3.getAllWindows().length === 0) {
    createWindow2();
  }
});
var csvPath = path5.join(app5.getPath("userData"), "input_history.csv");
if (!fs4.existsSync(csvPath)) {
  fs4.writeFileSync(csvPath, "timestamp,text\n", "utf8");
}
ipcMain2.handle(
  "log-input",
  async (_event, text) => {
    try {
      const timestamp = (/* @__PURE__ */ new Date()).toISOString();
      const escapedText = `"${text.replace(/"/g, '""').replace(/\n/g, "\\n")}"`;
      const line = `${timestamp},${escapedText}
`;
      fs4.appendFileSync(csvPath, line, "utf8");
      return { success: true, path: csvPath };
    } catch (error) {
      console.log(error);
      return { success: false, path: csvPath };
    }
  }
);
ipcMain2.handle("get-csv-path", () => csvPath);
ipcMain2.handle("check-for-updates", async () => {
  if (app5.isPackaged) {
    manualCheckForUpdates();
    return { triggered: true };
  }
  const { dialog: dialog2 } = await import("electron");
  dialog2.showMessageBox({
    type: "info",
    title: "Development Mode",
    message: "Updates are disabled in development mode.",
    detail: "Build and run the packaged app to test updates."
  });
  return { triggered: false, reason: "Updates disabled in development mode" };
});
ipcMain2.handle("get-update-settings", async () => {
  return getUpdateSettings();
});
ipcMain2.handle(
  "set-update-settings",
  async (_event, newSettings) => {
    const result = setUpdateSettings(newSettings);
    if (result.success && result.settings) {
      applyAutoDownload(result.settings.autoDownload);
    }
    return result;
  }
);
ipcMain2.handle("get-update-log-path", async () => {
  return getLogFilePath();
});
ipcMain2.handle("get-update-logs", async () => {
  return readLogFile();
});
function broadcastNodesChanged(nodes) {
  BrowserWindow3.getAllWindows().forEach((win) => {
    win.webContents.send("nodes-changed", nodes);
  });
}
ipcMain2.handle("nodes:get", async () => {
  return getNodes();
});
ipcMain2.handle(
  "nodes:add",
  async (_event, node) => {
    const result = addNode(node);
    if (result.success && result.nodes) {
      broadcastNodesChanged(result.nodes);
    }
    return result;
  }
);
ipcMain2.handle(
  "nodes:update",
  async (_event, id, updates) => {
    const result = updateNode(id, updates);
    if (result.success && result.nodes) {
      broadcastNodesChanged(result.nodes);
    }
    return result;
  }
);
ipcMain2.handle(
  "nodes:delete",
  async (_event, id) => {
    const result = deleteNode(id);
    if (result.success && result.nodes) {
      broadcastNodesChanged(result.nodes);
    }
    return result;
  }
);
var aiAgentsPath = path5.join(app5.getPath("userData"), "ai-agents.json");
var themesPath = path5.join(app5.getPath("userData"), "themes.json");
function readAgents() {
  try {
    if (fs4.existsSync(aiAgentsPath)) {
      const data = fs4.readFileSync(aiAgentsPath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read AI agents:", error);
  }
  return [];
}
function writeAgents(agents) {
  try {
    fs4.writeFileSync(aiAgentsPath, JSON.stringify(agents, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write AI agents:", error);
    return false;
  }
}
function readThemeSettings() {
  try {
    if (fs4.existsSync(themesPath)) {
      const data = fs4.readFileSync(themesPath, "utf8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to read theme settings:", error);
  }
  return { activeTheme: "dark" };
}
function writeThemeSettings(settings2) {
  try {
    fs4.writeFileSync(themesPath, JSON.stringify(settings2, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write theme settings:", error);
    return false;
  }
}
ipcMain2.handle("ai-agents:get", async () => {
  return readAgents();
});
ipcMain2.handle(
  "ai-agents:set",
  async (_event, agents) => {
    try {
      writeAgents(agents);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }
);
ipcMain2.handle(
  "ai-agents:add",
  async (_event, agent) => {
    try {
      const agents = readAgents();
      agents.push(agent);
      writeAgents(agents);
      const agentPath = path5.join(agentsHistoryPath2, agent.id.toString());
      fs4.mkdirSync(agentPath, { recursive: true });
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }
);
ipcMain2.handle(
  "ai-agents:update",
  async (_event, id, updates) => {
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
  }
);
ipcMain2.handle(
  "ai-agents:delete",
  async (_event, id) => {
    try {
      const agents = readAgents();
      const filtered = agents.filter((a) => a.id !== id);
      writeAgents(filtered);
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }
);
ipcMain2.handle("ai-agents:clear", async () => {
  try {
    writeAgents([]);
    return { success: true };
  } catch (error) {
    return { success: false, error: getErrorMessage(error) };
  }
});
ipcMain2.handle("themes:get", async () => {
  return readThemeSettings();
});
ipcMain2.handle(
  "themes:set",
  async (_event, activeTheme) => {
    const settings2 = { activeTheme };
    const success = writeThemeSettings(settings2);
    return { success };
  }
);
ipcMain2.handle(
  "ai-agents-history:get-all",
  async (_event, agentId) => {
    return readAgentHistories(agentId);
  }
);
ipcMain2.handle(
  "ai-agents-history:get",
  async (_event, agentId, sessionId) => {
    return readAgentHistory(agentId, sessionId);
  }
);
ipcMain2.handle(
  "ai-agents-history:save",
  async (_event, chatSession) => {
    try {
      const success = writeAgentHistory(chatSession);
      return { success };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }
);
ipcMain2.handle(
  "ai-agents-history:delete",
  async (_event, agentId, sessionId) => {
    try {
      const success = deleteAgentHistory(agentId, sessionId);
      return { success };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }
);
ipcMain2.handle(
  "ai-agents-history:delete-all",
  async (_event, agentId) => {
    try {
      const success = deleteAllAgentHistories(agentId);
      return { success };
    } catch (error) {
      return { success: false, error: getErrorMessage(error) };
    }
  }
);
