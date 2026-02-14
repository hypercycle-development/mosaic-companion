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
function log(level: string, ...args: any[]) {
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

/**
 * Initialize updater with settings.
 * Call this after app is ready.
 */
export function initUpdater() {
    rotateLogFile();

    log('INFO', '========================================');
    log('INFO', 'UPDATER INITIALIZATION (MANUAL MODE)');
    log('INFO', '========================================');
    log('INFO', `Platform: ${os.platform()} (${os.arch()})`);
    log('INFO', `App Version: ${app.getVersion()}`);
    log('INFO', `Log File: ${LOG_FILE}`);
    
    log('INFO', 'Native auto-update disabled to prevent signature issues.');
    log('INFO', 'Using manual JSON fetch for version checks.');

    log('INFO', '========================================');
}

export function applyAutoDownload(enabled: boolean) {
    // No-op in manual mode
    log('INFO', `applyAutoDownload: ${enabled} (Ignored in manual mode)`);
}

/**
 * Check for updates on app startup (Quiet mode)
 */
export function checkForUpdates() {
    checkForUpdatesManualFetch(false);
}

/**
 * Manual check for updates (for "Check for Updates" menu/button - Loud mode)
 */
export function manualCheckForUpdates() {
    checkForUpdatesManualFetch(true);
}

/**
 * Generic manual check for updates via JSON fetch.
 * Works on Mac, Windows, and Linux without native updater requirements.
 */
async function checkForUpdatesManualFetch(isManual = false) {
    const latestJsonUrl = getLatestJsonUrl();
    const installPageUrl = getInstallPageUrl();
    
    log('INFO', `Manual fetch check started (isManual: ${isManual})`);
    log('INFO', `Checking URL: ${latestJsonUrl}`);
    try {
        const response = await fetch(latestJsonUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);

        const latest = await response.json();
        const currentVersion = app.getVersion();

        log('INFO', `Version Check: Current=${currentVersion}, Latest=${latest.version}`);

        if (semver.gt(latest.version, currentVersion)) {
            const { response: buttonIndex } = await dialog.showMessageBox({
                type: 'info',
                title: 'Update Available',
                message: `A new version (${latest.version}) is available.`,
                detail: 'A new version is available for download.',
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
    } catch (err: unknown) {
        let errMessage = 'An unknown error occurred.';
        if (err instanceof Error) {
            errMessage = err.message;
        } else {
            console.error(err)
        }
        log('ERROR', 'Manual check failed:', errMessage);
        if (isManual) {
            dialog.showMessageBox({
                type: 'error',
                title: 'Update Error',
                message: 'Failed to check for updates.',
                detail: errMessage
            });
        }
    }
}

// =============================================================================
// NATIVE AUTOUPDATER EVENTS - DISABLED
// =============================================================================

