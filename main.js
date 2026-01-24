// main.js - Complete version with AI agents storage data

// Handle Squirrel.Windows startup events (MUST be first!)
// This handles install, update, and uninstall events on Windows
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
if (process.platform === 'win32') {
  try {
    if (require('electron-squirrel-startup')) {
      process.exit(0);
    }
  } catch (e) {
    // electron-squirrel-startup not available (dev mode or non-Windows)
  }
}

// Single instance lock - prevents multiple instances from running
// This is important to avoid freezing or conflicts on Windows
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  // Focus existing window if a second instance is started
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

import { app, BrowserWindow, ipcMain } from "electron";
import os from "os";
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
} from "./updater.js";
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
} from "./settings.js";
import { authenticate, signOut, isAuthenticated } from "./gmail-auth.js";
import { getRecentEmails, getUserProfile, getEmailDetails, searchEmails, markAsRead, markAsUnread } from "./gmail-service.js";

import {
  getDirectoryStatus,
  readAgentHistories,
  readAgentHistory,
  writeAgentHistory,
  deleteAgentHistory,
  deleteAllAgentHistories,
} from "./utils/index.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Declare variables of paths to folders that will use user data
const agentsHistoryPath = path.join(app.getPath("userData"), "agents_history");
// Keep reference to main window for recreation
let mainWindow = null;

function createWindow(urlToLoad = null) {
  // Get title bar style from settings (default to 'hidden' on non-Mac if not set)
  const titleBarStyle = getTitleBarStyle();

  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, "assets", "icon.png"),
    // Use the setting, or fallback to platform defaults if somehow undefined
    titleBarStyle: titleBarStyle === "default" ? "default" : "hidden",
    trafficLightPosition: { x: 10, y: 10 },
    backgroundColor: "#111827",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      // Suppress console errors from webviews (especially ERR_ABORTED from redirects)
      backgroundThrottling: false,
    },
  });

  // Load specified URL or default to index.html
  if (urlToLoad) {
    win.loadURL(urlToLoad);
  } else {
    win.loadFile(path.join(__dirname, "dist", "index.html"));
  }

  mainWindow = win;
  return win;
}

/**
 * Recreate the window with current settings.
 * Used to apply titleBarStyle changes without full app restart.
 */
function recreateWindow() {
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

  const result = await dialog.showMessageBox(mainWindow, {
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
app.on("web-contents-created", (event, contents) => {
  contents.on(
    "did-fail-load",
    (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      // Suppress ERR_ABORTED (-3) errors - these are harmless navigation aborts from redirects
      if (errorCode === -3) {
        event.preventDefault();
        return;
      }
    }
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
    
    // FIX: Delay the check by 2 seconds so the app UI loads first
    setTimeout(() => {
      console.log("Starting update check...");
      checkForUpdates();
    }, 2000);
  }

  // Pre-initialize Gmail OAuth to load tokens early
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

// ============================================
// CSV Logging
// ============================================
const csvPath = path.join(app.getPath("userData"), "input_history.csv");

if (!fs.existsSync(csvPath)) {
  fs.writeFileSync(csvPath, "timestamp,text\n", "utf8");
}

ipcMain.handle("log-input", async (event, text) => {
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
ipcMain.handle("set-update-settings", async (event, newSettings) => {
  const result = setUpdateSettings(newSettings);
  // Apply autoDownload to updater if it changed
  if (result.success && result.settings) {
    applyAutoDownload(result.settings.autoDownload);
  }
  return result;
});

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
function broadcastNodesChanged(nodes) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("nodes-changed", nodes);
  });
}

// Get all nodes
ipcMain.handle("nodes:get", async () => {
  return getNodes();
});

// Add a new node
ipcMain.handle("nodes:add", async (event, node) => {
  const result = addNode(node);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});

// Update a node
ipcMain.handle("nodes:update", async (event, id, updates) => {
  const result = updateNode(id, updates);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});

// Delete a node
ipcMain.handle("nodes:delete", async (event, id) => {
  const result = deleteNode(id);
  if (result.success && result.nodes) {
    broadcastNodesChanged(result.nodes);
  }
  return result;
});

// ============================================
// AI Agents Storage
// ============================================
const aiAgentsPath = path.join(app.getPath("userData"), "ai-agents.json");
const themesPath = path.join(app.getPath("userData"), "themes.json");

// Helper: Read agents from file
function readAgents() {
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
function writeAgents(agents) {
  try {
    fs.writeFileSync(aiAgentsPath, JSON.stringify(agents, null, 2), "utf8");
    return true;
  } catch (error) {
    console.error("Failed to write AI agents:", error);
    return false;
  }
}

// Theme helpers
function readThemeSettings() {
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

function writeThemeSettings(settings) {
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
ipcMain.handle("ai-agents:set", async (event, agents) => {
  try {
    writeAgents(agents);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Add single agent
ipcMain.handle("ai-agents:add", async (event, agent) => {
  try {
    const agents = readAgents();
    agents.push(agent);
    writeAgents(agents);
    const agentPath = path.join(agentsHistoryPath, agent.id.toString());
    fs.mkdirSync(agentPath, { recursive: true });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Update single agent
ipcMain.handle("ai-agents:update", async (event, id, updates) => {
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
    return { success: false, error: error.message };
  }
});

// Delete single agent
ipcMain.handle("ai-agents:delete", async (event, id) => {
  try {
    const agents = readAgents();
    const filtered = agents.filter((a) => a.id !== id);
    writeAgents(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Clear all agents
ipcMain.handle("ai-agents:clear", async () => {
  try {
    writeAgents([]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================
// Gmail Integration
// ============================================

// Sign in with Google
ipcMain.handle("gmail:sign-in", async () => {
  try {
    const tokens = await authenticate();
    const profile = await getUserProfile();
    return { success: true, email: profile.emailAddress };
  } catch (error) {
    console.error("Gmail sign-in error:", error);
    return { success: false, error: error.message };
  }
});

// Sign out of Gmail
ipcMain.handle("gmail:sign-out", async () => {
  try {
    signOut();
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Check Gmail authentication status
ipcMain.handle("gmail:get-status", async () => {
  try {
    const authenticated = isAuthenticated();
    if (authenticated) {
      const profile = await getUserProfile();
      return { authenticated: true, email: profile.emailAddress };
    }
    return { authenticated: false };
  } catch (error) {
    return { authenticated: false, error: error.message };
  }
});

// Get recent emails
ipcMain.handle("gmail:get-emails", async (event, count = 10) => {
  try {
    const emails = await getRecentEmails(count);
    return { success: true, emails };
  } catch (error) {
    console.error("Gmail fetch error:", error);
    return { success: false, error: error.message };
  }
});

// Get email details
ipcMain.handle("gmail:get-email-details", async (event, messageId) => {
  try {
    const email = await getEmailDetails(messageId);
    return { success: true, email };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// ============================================
// Theme persistence
// ============================================

ipcMain.handle("themes:get", async () => {
  return readThemeSettings();
});

ipcMain.handle("themes:set", async (event, activeTheme) => {
  const settings = { activeTheme };
  const success = writeThemeSettings(settings);
  return { success };
});

// ============================================
// AI Agents History
// ============================================

ipcMain.handle("ai-agents-history:get-all", async (event, agentId) => {
  return readAgentHistories(agentId);
});

ipcMain.handle("ai-agents-history:get", async (event, agentId, sessionId) => {
  return readAgentHistory(agentId, sessionId);
});

ipcMain.handle("ai-agents-history:save", async (event, chatSession) => {
  try {
    const success = writeAgentHistory(chatSession);
    return { success };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle(
  "ai-agents-history:delete",
  async (event, agentId, sessionId) => {
    try {
      const success = deleteAgentHistory(agentId, sessionId);
      return { success };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
);

ipcMain.handle("ai-agents-history:delete-all", async (event, agentId) => {
  try {
    const success = deleteAllAgentHistories(agentId);
    return { success };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Search emails
ipcMain.handle("gmail:search-emails", async (event, query, count = 10) => {
  try {
    const emails = await searchEmails(query, count);
    return { success: true, emails };
  } catch (error) {
    console.error("Gmail search error:", error);
    return { success: false, error: error.message };
  }
});

// Mark email as read
ipcMain.handle("gmail:mark-read", async (event, messageId) => {
  try {
    await markAsRead(messageId);
    return { success: true };
  } catch (error) {
    console.error("Gmail mark read error:", error);
    return { success: false, error: error.message };
  }
});

// Mark email as unread
ipcMain.handle("gmail:mark-unread", async (event, messageId) => {
  try {
    await markAsUnread(messageId);
    return { success: true };
  } catch (error) {
    console.error("Gmail mark unread error:", error);
    return { success: false, error: error.message };
  }
});

// Get Gmail auto-mark-as-read setting
ipcMain.handle("gmail:get-auto-mark-read", () => {
  return { enabled: getGmailAutoMarkRead() };
});

// Set Gmail auto-mark-as-read setting
ipcMain.handle("gmail:set-auto-mark-read", (event, enabled) => {
  const result = setGmailAutoMarkRead(enabled);
  return { ...result, enabled: getGmailAutoMarkRead() };
});

