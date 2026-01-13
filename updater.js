import { dialog, BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
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


// TODO: Load from config when persistence system is ready
// Default settings 
const updateSettings = {
  /**
   * If true, download updates automatically
   */
  autoDownload: false,       
};

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
 * Set update settings and apply them immediately.
 * @param {object} newSettings - Partial settings to update
 * 
 * TODO: Persist to config when persistence system is ready
 */
export function setUpdateSettings(newSettings) {
  if (typeof newSettings.autoDownload === "boolean") {
    updateSettings.autoDownload = newSettings.autoDownload;
  }
  applyUpdateSettings();
  // TODO: Save to config here when persistence system is ready
}

// Apply initial settings
applyUpdateSettings();

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
