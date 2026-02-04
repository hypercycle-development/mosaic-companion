/**
 * Settings Module
 * Handles all app settings persistence to file (nodes, preferences, etc.)
 * Stored in path: ~/.config/mosaic-companion/app-settings.json
 */

import { app } from "electron";
import fs from "fs";
import path from "path";
import { getErrorMessage } from "./utils";

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

interface Settings {
  autoDownload: boolean;
  titleBarStyle: string;
  nodes: Node[];
  gmailAutoMarkRead: boolean
}

// =============================================================================
// Settings File Management
// =============================================================================

const settingsPath = path.join(app.getPath("userData"), "app-settings.json");

// Default settings
const DEFAULT_SETTINGS: Settings = {
  autoDownload: false,
  titleBarStyle: process.platform === "darwin" ? "default" : "hidden",
  nodes: [],
  gmailAutoMarkRead: false, // Auto-mark emails as read when viewed
};

// Current settings (loaded from file or defaults)
let settings: Settings = { ...DEFAULT_SETTINGS };

/**
 * Load settings from JSON file.
 * Called at module initialization.
 */
export function loadSettings(): Settings {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf8");
      const loaded = JSON.parse(data);
      settings = {
        ...DEFAULT_SETTINGS,
        ...loaded,
        nodes: loaded.nodes || [],
      };

      // Ensure titleBarStyle has a valid default if missing from file
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

/**
 * Save current settings to JSON file.
 */
function saveSettings(): { success: boolean; error?: string } {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
    console.log("Settings saved to:", settingsPath);
    return { success: true };
  } catch (error) {
    console.error("Failed to save settings:", error);
    return { success: false, error: getErrorMessage(error) };
  }
}

// =============================================================================
// Update Settings
// =============================================================================

/**
 * Get current update settings.
 */
export function getUpdateSettings(): {
  autoDownload: boolean;
  titleBarStyle: string;
  nodes: Node[];
} {
  return {
    autoDownload: settings.autoDownload,
    titleBarStyle: settings.titleBarStyle,
    nodes: [...settings.nodes],
  };
}

/**
 * Set update settings and save to file.
 */
export function setUpdateSettings(newSettings: Partial<Settings>): {
  success: boolean;
  settings: ReturnType<typeof getUpdateSettings>;
  error?: string;
} {
  if (typeof newSettings.autoDownload === "boolean") {
    settings.autoDownload = newSettings.autoDownload;
  }
  if (typeof newSettings.titleBarStyle === "string") {
    settings.titleBarStyle = newSettings.titleBarStyle;
  }
  const saveResult = saveSettings();
  return { ...saveResult, settings: getUpdateSettings() };
}

/**
 * Get autoDownload setting for updater module.
 */
export function getAutoDownload(): boolean {
  return settings.autoDownload;
}

/**
 * Get titleBarStyle setting.
 */
export function getTitleBarStyle(): string {
  return settings.titleBarStyle;
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
 */
export function getNodes(): Node[] {
  return [...settings.nodes];
}

/**
 * Add a new node.
 */
export function addNode(node: Partial<Omit<Node, "id">>): {
  success: boolean;
  error?: string;
  nodes?: Node[];
} {
  if (settings.nodes.length >= MAX_NODES) {
    return { success: false, error: `Maximum ${MAX_NODES} nodes allowed` };
  }

  const newNode: Node = {
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
 */
export function updateNode(
  id: string,
  updates: Partial<Omit<Node, "id">>,
): { success: boolean; nodes?: Node[]; error?: string } {
  const index = settings.nodes.findIndex((n) => n.id === id);
  if (index === -1) {
    return { success: false, error: "Node not found" };
  }

  settings.nodes[index] = { ...settings.nodes[index], ...updates };
  const saveResult = saveSettings();
  return { ...saveResult, nodes: getNodes() };
}

/**
 * Delete a node.
 */
export function deleteNode(id: string): {
  success: boolean;
  nodes?: Node[];
  error?: string;
} {
  const index = settings.nodes.findIndex((n) => n.id === id);
  if (index === -1) {
    return { success: false, error: "Node not found" };
  }

  settings.nodes.splice(index, 1);
  const saveResult = saveSettings();
  return { ...saveResult, nodes: getNodes() };
}

// Load settings on module initialization
loadSettings();
