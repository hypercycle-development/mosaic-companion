import { dialog, BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
// This way to import and destructure fix the error of "VAAPI version too old"
const { autoUpdater } = electronUpdater;

// Configure logging for debugging (logs to ~/Library/Logs/mosaic-browser/ on macOS, similar on other OS)
autoUpdater.logger = console;

// Configure S3 provider
// TODO: Replace with our values
autoUpdater.setFeedURL({
  provider: "s3",
  bucket: "BUCKET_NAME",
  region: "BUCKET_REGION",
  path: "/releases",
});

// Disable auto-download - Ask to the user first
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

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
export function manualCheckForUpdates() {
  autoUpdater
    .checkForUpdates()
    .then((result) => {
      if (!result || !result.updateInfo) {
        dialog.showMessageBox({
          type: "info",
          title: "No Updates",
          message: "You are running the latest version.",
        });
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
    });
}

// Event: Update available
autoUpdater.on("update-available", (info) => {
  console.log("Update available:", info.version);

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
