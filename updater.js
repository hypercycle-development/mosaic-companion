/**
 * Updater Module
 * Handles electron-updater configuration and update checks.
 * Settings are managed by settings.js module.
 */

import { dialog, BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
import { getAutoDownload, loadSettings } from "./settings.js";

// This way to import and destructure fix the error of "VAAPI version too old"
const { autoUpdater } = electronUpdater;

// Configure logging for debugging
autoUpdater.logger = console;

// Configure S3 provider
autoUpdater.setFeedURL({
  provider: "s3",
  bucket: "mosaic-release",
  region: "us-east-2",
  path: "/releases",
});

/**
 * Initialize updater with settings.
 * Call this after app is ready.
 */
export function initUpdater() {
  const settings = loadSettings();
  autoUpdater.autoDownload = settings.autoDownload;
  autoUpdater.autoInstallOnAppQuit = true;
  console.log("Updater initialized with autoDownload:", settings.autoDownload);
}

/**
 * Apply autoDownload setting (called when setting changes).
 */
export function applyAutoDownload(enabled) {
  autoUpdater.autoDownload = enabled;
  console.log("Auto-download setting applied:", enabled);
}

/**
 * Check for updates on app startup.
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
 * Always shows feedback to the user.
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

// =============================================================================
// AutoUpdater Events
// =============================================================================

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
        autoUpdater.downloadUpdate();
      }
    });
});

// Event: Update not available
autoUpdater.on("update-not-available", (info) => {
  console.log("No update available. Current version is up to date.");
  
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

  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setProgressBar(progress.percent / 100);
  }
});

// Event: Update downloaded
autoUpdater.on("update-downloaded", (info) => {
  console.log("Update downloaded:", info.version);

  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.setProgressBar(-1);
  }

  dialog
    .showMessageBox({
      type: "info",
      title: "Update Ready",
      message: "Update downloaded successfully.",
      detail: "The application will restart to install the update. Save your work before proceeding.",
      buttons: ["Restart Now", "Later"],
      defaultId: 0,
      cancelId: 1,
    })
    .then((result) => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
});

// Event: Error
autoUpdater.on("error", (err) => {
  console.error("Auto-updater error:", err);
});
