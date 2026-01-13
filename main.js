import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { checkForUpdates, manualCheckForUpdates, getUpdateSettings, setUpdateSettings } from "./updater.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 10, y: 10 },
    backgroundColor: "#111827", // Match dark mode bg
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,

      // Removed webSecurity: false to allow standard secure browsing behavior
    },
  });

  // Load the built index.html from dist
  win.loadFile(path.join(__dirname, "dist", "index.html"));
}

app.whenReady().then(() => {
  console.log("User data path:", app.getPath("userData"));
  createWindow();

  // Check for updates on startup (skip in development)
  if (app.isPackaged) {
    checkForUpdates();
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

// CSV logging handler
const csvPath = path.join(app.getPath("userData"), "input_history.csv");

// Create CSV with headers if it doesn't exist
if (!fs.existsSync(csvPath)) {
  fs.writeFileSync(csvPath, "timestamp,text\n", "utf8");
}

ipcMain.handle("log-input", async (event, text) => {
  const timestamp = new Date().toISOString();
  // Escape quotes and wrap in quotes for CSV safety
  const escapedText = `"${text.replace(/"/g, '""').replace(/\n/g, "\\n")}"`;
  const line = `${timestamp},${escapedText}\n`;

  fs.appendFileSync(csvPath, line, "utf8");
  return { success: true, path: csvPath };
});

// Optional: handler to get the CSV path
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
  setUpdateSettings(newSettings);
  return getUpdateSettings();
});
