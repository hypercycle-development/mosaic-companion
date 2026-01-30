/**
 * Settings Module
 * Handles all app settings persistence to file (nodes, preferences, etc.)
 * Stored in path: ~/.config/mosaic-companion/app-settings.json
 */

import { app } from "electron";
import fs from "fs";
import path from "path";

// =============================================================================
// Settings File Management
// =============================================================================

const settingsPath = path.join(app.getPath("userData"), "app-settings.json");

// Default settings
const DEFAULT_SETTINGS = {
  autoDownload: false,
  titleBarStyle: 'hidden',
  nodes: [],
  screenpipe: {
    enabled: false,
    url: process.env.SCREENPIPE_URL || "",
    command: process.env.SCREENPIPE_CMD || "",
    args: [],
    healthPath: "/health"
  },
  gmailAutoMarkRead: false, // Auto-mark emails as read when viewed
};

// Current settings (loaded from file or defaults)
let settings = { ...DEFAULT_SETTINGS };

/**
 * Load settings from JSON file.
 * Called at module initialization.
 */
export function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf8");
      const loaded = JSON.parse(data);
      settings = { 
        ...DEFAULT_SETTINGS, 
        ...loaded,
        nodes: loaded.nodes || [],
        screenpipe: { ...(loaded.screenpipe || DEFAULT_SETTINGS.screenpipe) }
      };
      
      // Ensure titleBarStyle has a valid default if missing from file
      if (!settings.titleBarStyle) {
        settings.titleBarStyle = DEFAULT_SETTINGS.titleBarStyle;
      }
      if (!settings.screenpipe) {
        settings.screenpipe = { ...DEFAULT_SETTINGS.screenpipe };
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

/**
 * Save current settings to JSON file.
 * @returns {{ success: boolean, error?: string }}
 */
function saveSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    console.log("Settings saved to:", settingsPath);
    return { success: true };
  } catch (error) {
    console.error("Failed to save settings:", error);
    return { success: false, error: error.message };
  }
}

// =============================================================================
// Update Settings
// =============================================================================

/**
 * Get current update settings.
 * @returns {object} Current settings
 */
export function getUpdateSettings() {
  return { 
    autoDownload: settings.autoDownload,
    titleBarStyle: settings.titleBarStyle,
    nodes: [...settings.nodes],
    screenpipe: { ...settings.screenpipe }
  };
}

/**
 * Set update settings and save to file.
 * @param {object} newSettings - Partial settings to update
 * @returns {{ success: boolean, settings: object, error?: string }}
 */
export function setUpdateSettings(newSettings) {
  if (typeof newSettings.autoDownload === "boolean") {
    settings.autoDownload = newSettings.autoDownload;
  }
  if (typeof newSettings.titleBarStyle === "string") {
    settings.titleBarStyle = newSettings.titleBarStyle;
  }
  if (newSettings.screenpipe && typeof newSettings.screenpipe === "object") {
    settings.screenpipe = { ...settings.screenpipe, ...newSettings.screenpipe };
  }
  const saveResult = saveSettings();
  return { ...saveResult, settings: getUpdateSettings() };
}

/**
 * Get autoDownload setting for updater module.
 * @returns {boolean}
 */
export function getAutoDownload() {
  return settings.autoDownload;
}

/**
 * Get titleBarStyle setting.
 * @returns {string}
 */
export function getTitleBarStyle() {
  return settings.titleBarStyle;
}

export function getScreenpipeSettings() {
  return { ...settings.screenpipe };
}

export function setScreenpipeSettings(partial) {
  if (partial && typeof partial === "object") {
    settings.screenpipe = { ...settings.screenpipe, ...partial };
    const saveResult = saveSettings();
    return { ...saveResult, screenpipe: getScreenpipeSettings() };
  }
  return { success: false, error: "Invalid screenpipe settings" };
}

// =============================================================================
// Gmail Settings
// =============================================================================

/**
 * Get Gmail auto-mark-as-read setting.
 * @returns {boolean}
 */
export function getGmailAutoMarkRead() {
  return settings.gmailAutoMarkRead || false;
}

/**
 * Set Gmail auto-mark-as-read setting.
 * @param {boolean} value
 * @returns {{ success: boolean, error?: string }}
 */
export function setGmailAutoMarkRead(value) {
  settings.gmailAutoMarkRead = !!value;
  return saveSettings();
}

// =============================================================================
// =============================================================================
// Hypercycle Nodes Management
// =============================================================================

const MAX_NODES = 3;

/**
 * Get all nodes.
 * @returns {Array} Array of nodes
 */
export function getNodes() {
  return [...settings.nodes];
}

/**
 * Add a new node.
 * @param {object} node - Node configuration
 * @returns {{ success: boolean, nodes?: Array, error?: string }}
 */
export function addNode(node) {
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
    isActive: node.isActive !== undefined ? node.isActive : true,
  };
  
  settings.nodes.push(newNode);
  const saveResult = saveSettings();
  return { ...saveResult, nodes: getNodes() };
}

/**
 * Update an existing node.
 * @param {string} id - Node ID
 * @param {object} updates - Partial node updates
 * @returns {{ success: boolean, nodes?: Array, error?: string }}
 */
export function updateNode(id, updates) {
  const index = settings.nodes.findIndex(n => n.id === id);
  if (index === -1) {
    return { success: false, error: "Node not found" };
  }
  
  settings.nodes[index] = { ...settings.nodes[index], ...updates };
  const saveResult = saveSettings();
  return { ...saveResult, nodes: getNodes() };
}

/**
 * Delete a node.
 * @param {string} id - Node ID
 * @returns {{ success: boolean, nodes?: Array, error?: string }}
 */
export function deleteNode(id) {
  const index = settings.nodes.findIndex(n => n.id === id);
  if (index === -1) {
    return { success: false, error: "Node not found" };
  }
  
  settings.nodes.splice(index, 1);
  const saveResult = saveSettings();
  return { ...saveResult, nodes: getNodes() };
}

// Load settings on module initialization
loadSettings();
