import { dialog, BrowserWindow, app } from "electron";
import electronUpdater from "electron-updater";
import fs from "fs";
import path from "path";

// This way to import and destructure fix the error of "VAAPI version too old"
const { autoUpdater } = electronUpdater;

// Configure logging for debugging (logs to ~/Library/Logs/mosaic-browser/ on macOS, similar on other OS)
autoUpdater.logger = console;

// Configure S3 provider
autoUpdater.setFeedURL({
  provider: "s3",
  bucket: "mosaic-release",
  region: "us-east-2",
  path: "/releases",
});

// =============================================================================
// Settings Persistence
// =============================================================================

// Settings file path (in userData directory alongside other app data)
const settingsPath = path.join(app.getPath("userData"), "update-settings.json");

// Default settings
const DEFAULT_SETTINGS = {
  autoDownload: false,
};

// Current settings (loaded from file or defaults)
let updateSettings = { ...DEFAULT_SETTINGS };

/**
 * Load settings from JSON file.
 * Called at module initialization.
 */
function loadUpdateSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf8");
      const loaded = JSON.parse(data);
      // Merge with defaults to ensure all keys exist
      updateSettings = { ...DEFAULT_SETTINGS, ...loaded };
      console.log("Update settings loaded from:", settingsPath);
    } else {
      console.log("No update settings file found, using defaults");
    }
  } catch (error) {
    console.error("Failed to load update settings:", error);
    updateSettings = { ...DEFAULT_SETTINGS };
  }
  applyUpdateSettings();
}

/**
 * Save current settings to JSON file.
 * @returns {{ success: boolean, error?: string }}
 */
function saveUpdateSettings() {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(updateSettings, null, 2), "utf8");
    console.log("Update settings saved to:", settingsPath);
    return { success: true };
  } catch (error) {
    console.error("Failed to save update settings:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Apply current settings to autoUpdater.
 * Call this after changing settings.
 */
function applyUpdateSettings() {
  autoUpdater.autoDownload = updateSettings.autoDownload;
  console.log("Update settings applied:", updateSettings);
}

/**
 * Get current update settings.
 * @returns {object} Current settings
 */
export function getUpdateSettings() {
  return { ...updateSettings };
}

/**
 * Set update settings, apply them immediately, and save to file.
 * @param {object} newSettings - Partial settings to update
 * @returns {{ success: boolean, settings: object, error?: string }}
 */
export function setUpdateSettings(newSettings) {
  if (typeof newSettings.autoDownload === "boolean") {
    updateSettings.autoDownload = newSettings.autoDownload;
  }
  applyUpdateSettings();
  const saveResult = saveUpdateSettings();
  return { ...saveResult, settings: getUpdateSettings() };
}

// Load settings on module initialization
loadUpdateSettings();

/**
 * Check for updates on app startup.
 * Show a dialog if an update is available.
 */
export function checkForUpdates() {
  autoUpdater.checkForUpdates().catch((err) => {
    console.error("Error checking for updates:", err);
    dialog.showMessageBox({
      type: "error",
      title: "Update Error",
      message: "Failed to check for updates. Please try again later.",
      detail: err.message,
    });
  });
}

/**
 * Manual check for updates (for "Check for Updates" menu/button).
 * Always shows feedback to the user, even if no update is available.
 */
let isManualCheck = false;

export function manualCheckForUpdates() {
  isManualCheck = true;
  autoUpdater
    .checkForUpdates()
    .then((result) => {
      if (!result || !result.updateInfo) {
        dialog.showMessageBox({
          type: "info",
          title: "No Updates",
          message: "You are running the latest version.",
        });
        isManualCheck = false;
      }
    })
    .catch((err) => {
      console.error("Error checking for updates:", err);
      dialog.showMessageBox({
        type: "error",
        title: "Update Error",
        message: "Failed to check for updates. Please try again later.",
        detail: err.message,
      });
      isManualCheck = false;
    });
}

// Event: Update available
autoUpdater.on("update-available", (info) => {
  console.log("Update available:", info.version);
  isManualCheck = false;

  dialog
    .showMessageBox({
      type: "info",
      title: "Update Available",
      message: `A new version (${info.version}) is available.`,
      detail: "Would you like to download and install it now?",
      buttons: ["Download Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    })
    .then((result) => {
      if (result.response === 0) {
        // User chose "Download Now"
        autoUpdater.downloadUpdate();
      }
    });
});

// Event: Update not available
autoUpdater.on("update-not-available", (info) => {
  console.log("No update available. Current version is up to date.");
  
  // Show dialog only for manual checks
  if (isManualCheck) {
    dialog.showMessageBox({
      type: "info",
      title: "No Updates Available",
      message: "You're up to date!",
      detail: `Mosaic Browser ${info.version} is the latest version.`,
    });
    isManualCheck = false;
  }
});

// Event: Download progress
autoUpdater.on("download-progress", (progress) => {
  console.log(`Download progress: ${progress.percent.toFixed(1)}%`);

  // Optional: Send progress to renderer if you want to show a progress bar
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setProgressBar(progress.percent / 100);
  }
});

// Event: Update downloaded
autoUpdater.on("update-downloaded", (info) => {
  console.log("Update downloaded:", info.version);

  // Clear progress bar
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setProgressBar(-1);
  }

  dialog
    .showMessageBox({
      type: "info",
      title: "Update Ready",
      message: "Update downloaded successfully.",
      detail:
        "The application will restart to install the update. Save your work before proceeding.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    })
    .then((result) => {
      if (result.response === 0) {
        // User chose "Restart Now"
        autoUpdater.quitAndInstall();
      }
    });
});

// Event: Error
autoUpdater.on("error", (err) => {
  console.error("Auto-updater error:", err);
});
