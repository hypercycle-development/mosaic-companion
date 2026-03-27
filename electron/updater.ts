/**
 * Updater Module
 * Handles native Electron autoUpdater configuration and update checks.
 * Settings are managed by settings.js module.
 *
 * MIGRATED FROM ELECTRON-UPDATER TO NATIVE AUTOUPDATER
 */

import { app, dialog, BrowserWindow, shell, autoUpdater } from 'electron';
import { getAutoDownload, loadSettings } from './settings.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import semver from 'semver';

// =============================================================================
// FILE-BASED LOGGING (visible on Mac even without terminal)
// =============================================================================
const LOG_FILE = path.join(app.getPath('userData'), 'update.log');

/**
 * Log to both console and file for maximum visibility.
 */
function log(level, ...args) {
    const timestamp = new Date().toISOString();
    const platform = os.platform();
    const message = args
        .map((arg) =>
            typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        )
        .join(' ');

    const logLine = `[${timestamp}] [${platform}] [${level}] ${message}\n`;

    // Console output
    if (level === 'ERROR') {
        console.error(`🔴 [UPDATER] ${message}`);
    } else if (level === 'WARN') {
        console.warn(`🟡 [UPDATER] ${message}`);
    } else {
        console.log(`🟢 [UPDATER] ${message}`);
    }

    // File output
    try {
        fs.appendFileSync(LOG_FILE, logLine, 'utf8');
    } catch (e) {
        console.error('Failed to write to log file:', e);
    }
}

/**
 * Clear old log entries on startup (keep last 1000 lines)
 */
function rotateLogFile() {
    try {
        if (fs.existsSync(LOG_FILE)) {
            const content = fs.readFileSync(LOG_FILE, 'utf8');
            const lines = content.split('\n');
            if (lines.length > 1000) {
                fs.writeFileSync(
                    LOG_FILE,
                    lines.slice(-500).join('\n'),
                    'utf8'
                );
                log('INFO', 'Log file rotated (kept last 500 lines)');
            }
        }
    } catch (e) {
        console.error('Failed to rotate log file:', e);
    }
}

export function getLogFilePath() {
    return LOG_FILE;
}

export function readLogFile() {
    try {
        if (fs.existsSync(LOG_FILE)) {
            return fs.readFileSync(LOG_FILE, 'utf8');
        }
    } catch (e) {
        console.error('Failed to read log file:', e);
    }
    return '';
}

// =============================================================================
// AUTOUPDATER CONFIGURATION
// =============================================================================

// =============================================================================
// DYNAMIC UPDATE URL RESOLUTION
// =============================================================================
// Main releases: /releases/latest.json
// Experimental releases (mosaic-companion-{experiment}): /releases/experimental/{experiment}/latest.json

const S3_BASE_URL = 'https://mosaic-release.s3.us-east-2.amazonaws.com';

/**
 * Get the latest.json URL based on the app name.
 * - Main release (mosaic-companion): /releases/latest.json
 * - Experimental (mosaic-companion-screenpipe): /releases/experimental/screenpipe/latest.json
 */
function getLatestJsonUrl() {
    const appName = app.getName(); // Returns packageJson.name or packagerConfig.name
    const experimentMatch = appName.match(/^mosaic-companion-(.+)$/);
    
    if (experimentMatch) {
        const experimentName = experimentMatch[1];
        const url = `${S3_BASE_URL}/releases/experimental/${experimentName}/latest.json`;
        log('INFO', `Experimental build detected: ${experimentName}`);
        log('INFO', `Using latest.json URL: ${url}`);
        return url;
    }
    
    // Main release
    return `${S3_BASE_URL}/releases/latest.json`;
}

/**
 * Get the install page URL based on the app name.
 * Each experimental release has its own index.html in its folder.
 */
function getInstallPageUrl() {
    const appName = app.getName();
    const experimentMatch = appName.match(/^mosaic-companion-(.+)$/);
    
    if (experimentMatch) {
        const experimentName = experimentMatch[1];
        return `${S3_BASE_URL}/releases/experimental/${experimentName}/index.html`;
    }
    
    return `${S3_BASE_URL}/index.html`;
}

const isLinux = os.platform() === 'linux';
let isManualCheck = false;

// S3 Bucket URL construction
const getFeedUrl = () => {
    const platform = os.platform();
    const arch = os.arch();

    if (platform === 'win32') {
        // Squirrel.Windows looks for RELEASES file in this directory
        return `https://mosaic-release.s3.us-east-2.amazonaws.com/releases/win32/${arch}`;
    } else if (platform === 'darwin') {
        // Native Mac updater expects a JSON feed, this might need a specific endpoint
        // pointing to a static file might not work out of the box without a server
        // usually requests specific headers or format.
        // For now, mapping to the folder.
        return `https://mosaic-release.s3.us-east-2.amazonaws.com/releases/${platform}/${arch}`;
    }
    return null;
};

/**
 * Initialize updater with settings.
 * Call this after app is ready.
 */
export function initUpdater() {
    rotateLogFile();

    log('INFO', '========================================');
    log('INFO', 'UPDATER INITIALIZATION (NATIVE)');
    log('INFO', '========================================');
    log('INFO', `Platform: ${os.platform()} (${os.arch()})`);
    log('INFO', `App Version: ${app.getVersion()}`);
    log('INFO', `Log File: ${LOG_FILE}`);

    // Native autoUpdater config
    const feedUrl = getFeedUrl();
    if (feedUrl && !isLinux) {
        try {
            log('INFO', `Configuring feed URL: ${feedUrl}`);
            autoUpdater.setFeedURL({ url: feedUrl });
        } catch (e) {
            log('ERROR', 'Failed to set feed URL:', e.message);
        }
    } else if (isLinux) {
        log('INFO', 'Linux detected: Using manual update check');
    }

    log('INFO', '========================================');
}

export function applyAutoDownload(enabled) {
    // Native autoUpdater always downloads automatically when check is triggered
    // We can't easily toggle "download" separate from "check" in the native module
    // typically. But strictly speaking, checkForUpdates() initiates the flow.
    log('INFO', `applyAutoDownload: ${enabled} (Note: native autoUpdater downloads automatically upon checking)`);
}

/**
 * Check for updates on app startup.
 */
export function checkForUpdates() {
    if (isLinux) {
        checkForUpdatesLinux(false);
        return;
    }

    log('INFO', 'Checking for updates (automatic startup check)...');
    try {
        autoUpdater.checkForUpdates();
    } catch (e) {
        log('ERROR', 'Failed to check for updates:', e.message);
    }
}

/**
 * Manual check for updates (for "Check for Updates" menu/button).
 */
export function manualCheckForUpdates() {
    if (isLinux) {
        checkForUpdatesLinux(true);
        return;
    }

    log('INFO', 'MANUAL UPDATE CHECK TRIGGERED');
    isManualCheck = true;

    try {
        autoUpdater.checkForUpdates();
    } catch (e) {
        log('ERROR', 'Failed to check for updates manually:', e.message);
        dialog.showMessageBox({
            type: 'error',
            title: 'Update Error',
            message: 'Failed to start update check.',
            detail: e.message
        });
        isManualCheck = false;
    }
}

/**
 * Linux-specific manual check.
 */
async function checkForUpdatesLinux(isManual = false) {
    const latestJsonUrl = getLatestJsonUrl();
    const installPageUrl = getInstallPageUrl();
    
    log('INFO', `Linux check started (isManual: ${isManual})`);
    log('INFO', `Checking URL: ${latestJsonUrl}`);
    try {
        const response = await fetch(latestJsonUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

        const latest = await response.json();
        const currentVersion = app.getVersion();

        log('INFO', `Linux Version: Current=${currentVersion}, Latest=${latest.version}`);

        if (semver.gt(latest.version, currentVersion)) {
            const { response: buttonIndex } = await dialog.showMessageBox({
                type: 'info',
                title: 'Update Available',
                message: `A new version (${latest.version}) is available.`,
                detail: 'Linux auto-updates are not supported. Open download page?',
                buttons: ['Open Download Page', 'Later'],
                defaultId: 0
            });

            if (buttonIndex === 0) {
                shell.openExternal(installPageUrl);
            }
        } else if (isManual) {
            dialog.showMessageBox({
                type: 'info',
                title: 'No Updates',
                message: "You're up to date!",
                detail: `Mosaic Companion ${currentVersion} is the latest version.`
            });
        }
    } catch (err) {
        log('ERROR', 'Linux check failed:', err.message);
        if (isManual) {
            dialog.showMessageBox({
                type: 'error',
                title: 'Update Error',
                message: 'Failed to check for updates.',
                detail: err.message
            });
        }
    }
}

// =============================================================================
// NATIVE AUTOUPDATER EVENTS
// =============================================================================

autoUpdater.on('error', (err) => {
    log('ERROR', '>>> EVENT: error');
    log('ERROR', err.message);
    if (err.stack) log('ERROR', err.stack);

    if (isManualCheck) {
        dialog.showMessageBox({
            type: 'error',
            title: 'Update Error',
            message: 'An error occurred while checking for updates.',
            detail: err.message
        });
        isManualCheck = false;
    }
});

autoUpdater.on('checking-for-update', () => {
    log('INFO', '>>> EVENT: checking-for-update');
});

autoUpdater.on('update-available', () => {
    log('INFO', '>>> EVENT: update-available');
    // Native autoUpdater automatically starts downloading
    log('INFO', 'Update available, downloading in background...');

    if (isManualCheck) {
        // Optional: Notify user that query was successful and download started
        /*
        dialog.showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: 'A new version was found and is downloading in the background.'
        });
        */
        // Often better to disable manual check flag so we don't show "No updates" later
        isManualCheck = false;
    }
});

autoUpdater.on('update-not-available', () => {
    log('INFO', '>>> EVENT: update-not-available');
    if (isManualCheck) {
        dialog.showMessageBox({
            type: 'info',
            title: 'No Updates',
            message: 'You remain on the bleeding edge.',
            detail: `Version ${app.getVersion()} is the latest.`
        });
        isManualCheck = false;
    }
});

autoUpdater.on('update-downloaded', (event, releaseNotes, releaseName, releaseDate, updateURL) => {
    log('INFO', '>>> EVENT: update-downloaded');
    log('INFO', `Release Name: ${releaseName}`);

    dialog.showMessageBox({
        type: 'info',
        title: 'Update Ready',
        message: 'A new version has been downloaded.',
        detail: 'The application will restart to install the update.',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0
    }).then((result) => {
        if (result.response === 0) {
            log('INFO', 'User accepted restart');
            autoUpdater.quitAndInstall();
        } else {
            log('INFO', 'User deferred restart');
        }
    });
});
