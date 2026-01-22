/**
 * Updater Module
 * Handles electron-updater configuration and update checks.
 * Settings are managed by settings.js module.
 *
 * VERBOSE LOGGING ENABLED FOR MAC DEBUG
 */

import { app, dialog, BrowserWindow } from 'electron';
import electronUpdater from 'electron-updater';
import { getAutoDownload, loadSettings } from './settings.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

// This way to import and destructure fix the error of "VAAPI version too old"
const { autoUpdater } = electronUpdater;

// =============================================================================
// FILE-BASED LOGGING (visible on Mac even without terminal)
// =============================================================================
const LOG_FILE = path.join(app.getPath('userData'), 'update.log');

/**
 * Log to both console and file for maximum visibility.
 * On Mac, the file will be at ~/Library/Application Support/Mosaic Companion/update.log
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

    // Console output (visible in DevTools)
    if (level === 'ERROR') {
        console.error(`🔴 [UPDATER] ${message}`);
    } else if (level === 'WARN') {
        console.warn(`🟡 [UPDATER] ${message}`);
    } else {
        console.log(`🟢 [UPDATER] ${message}`);
    }

    // File output (visible on Mac via Finder)
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

/**
 * Get the log file path (for IPC exposure)
 */
export function getLogFilePath() {
    return LOG_FILE;
}

/**
 * Read the log file contents (for IPC exposure)
 */
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

// Configure logging - pipe through our custom logger
autoUpdater.logger = {
    info: (...args) => log('INFO', '[electron-updater]', ...args),
    warn: (...args) => log('WARN', '[electron-updater]', ...args),
    error: (...args) => log('ERROR', '[electron-updater]', ...args),
    debug: (...args) => log('DEBUG', '[electron-updater]', ...args)
};

// Configure S3 provider
log('INFO', 'Configuring S3 provider for updates');
autoUpdater.setFeedURL({
    provider: 's3',
    bucket: 'mosaic-release',
    region: 'us-east-2',
    path: '/releases'
});
log('INFO', 'S3 feed URL configured: bucket=mosaic-release, region=us-east-2');

/**
 * Initialize updater with settings.
 * Call this after app is ready.
 */
export function initUpdater() {
    rotateLogFile();

    log('INFO', '========================================');
    log('INFO', 'UPDATER INITIALIZATION');
    log('INFO', '========================================');
    log('INFO', `Platform: ${os.platform()} (${os.arch()})`);
    log('INFO', `OS Version: ${os.release()}`);
    log('INFO', `App Version: ${app.getVersion()}`);
    log('INFO', `App Path: ${app.getAppPath()}`);
    log('INFO', `User Data Path: ${app.getPath('userData')}`);
    log('INFO', `Log File: ${LOG_FILE}`);
    log('INFO', `Is Packaged: ${app.isPackaged}`);

    const settings = loadSettings();
    autoUpdater.autoDownload = settings.autoDownload;
    autoUpdater.autoInstallOnAppQuit = true;

    log('INFO', `autoDownload: ${settings.autoDownload}`);
    log('INFO', `autoInstallOnAppQuit: true`);
    log('INFO', '========================================');
}

/**
 * Apply autoDownload setting (called when setting changes).
 */
export function applyAutoDownload(enabled) {
    autoUpdater.autoDownload = enabled;
    log('INFO', `Auto-download setting changed to: ${enabled}`);
}

/**
 * Check for updates on app startup.
 */
export function checkForUpdates() {
    log('INFO', 'Checking for updates (automatic startup check)...');

    autoUpdater
        .checkForUpdates()
        .then((result) => {
            log(
                'INFO',
                'checkForUpdates resolved:',
                result
                    ? {
                          updateInfo: result.updateInfo,
                          cancellationToken: !!result.cancellationToken
                      }
                    : 'null result'
            );
        })
        .catch((err) => {
            log('ERROR', 'Error checking for updates:', err.message);
            log('ERROR', 'Stack trace:', err.stack);
            dialog.showMessageBox({
                type: 'error',
                title: 'Update Error',
                message: 'Failed to check for updates. Please try again later.',
                detail: err.message
            });
        });
}

/**
 * Manual check for updates (for "Check for Updates" menu/button).
 * Always shows feedback to the user.
 */
let isManualCheck = false;

export function manualCheckForUpdates() {
    log('INFO', '========================================');
    log('INFO', 'MANUAL UPDATE CHECK TRIGGERED');
    log('INFO', '========================================');

    isManualCheck = true;

    autoUpdater
        .checkForUpdates()
        .then((result) => {
            log(
                'INFO',
                'Manual checkForUpdates resolved:',
                result
                    ? {
                          updateInfo: result.updateInfo,
                          cancellationToken: !!result.cancellationToken
                      }
                    : 'null result'
            );

            if (!result || !result.updateInfo) {
                log(
                    'INFO',
                    'No update info returned, showing "no updates" dialog'
                );
                dialog.showMessageBox({
                    type: 'info',
                    title: 'No Updates',
                    message: 'You are running the latest version.'
                });
                isManualCheck = false;
            }
        })
        .catch((err) => {
            log('ERROR', 'Manual update check failed:', err.message);
            log('ERROR', 'Stack trace:', err.stack);
            dialog.showMessageBox({
                type: 'error',
                title: 'Update Error',
                message: 'Failed to check for updates. Please try again later.',
                detail: err.message
            });
            isManualCheck = false;
        });
}

// =============================================================================
// AutoUpdater Events (with verbose logging)
// =============================================================================

// Event: Checking for update
autoUpdater.on('checking-for-update', () => {
    log('INFO', '>>> EVENT: checking-for-update');
});

// Event: Update available
autoUpdater.on('update-available', (info) => {
    log('INFO', '========================================');
    log('INFO', '>>> EVENT: update-available');
    log('INFO', 'Update Info:', JSON.stringify(info, null, 2));
    log('INFO', '========================================');

    isManualCheck = false;

    log('INFO', 'Showing update available dialog...');

    dialog
        .showMessageBox({
            type: 'info',
            title: 'Update Available',
            message: `A new version (${info.version}) is available.`,
            detail: 'Would you like to download and install it now?',
            buttons: ['Download Now', 'Later'],
            defaultId: 0,
            cancelId: 1
        })
        .then((result) => {
            log(
                'INFO',
                `User clicked button index: ${result.response} (${
                    result.response === 0 ? 'Download Now' : 'Later'
                })`
            );

            if (result.response === 0) {
                log('INFO', '========================================');
                log('INFO', 'STARTING DOWNLOAD');
                log('INFO', '========================================');
                log('INFO', 'Calling autoUpdater.downloadUpdate()...');

                // CRITICAL FIX: Properly handle the promise returned by downloadUpdate
                autoUpdater
                    .downloadUpdate()
                    .then((downloadPath) => {
                        log('INFO', 'downloadUpdate() promise resolved!');
                        log('INFO', 'Download path:', downloadPath);
                    })
                    .catch((downloadErr) => {
                        log(
                            'ERROR',
                            '========================================'
                        );
                        log('ERROR', 'DOWNLOAD FAILED!');
                        log(
                            'ERROR',
                            '========================================'
                        );
                        log('ERROR', 'Error message:', downloadErr.message);
                        log('ERROR', 'Error name:', downloadErr.name);
                        log('ERROR', 'Error code:', downloadErr.code);
                        log('ERROR', 'Stack trace:', downloadErr.stack);
                        log(
                            'ERROR',
                            'Full error object:',
                            JSON.stringify(
                                downloadErr,
                                Object.getOwnPropertyNames(downloadErr),
                                2
                            )
                        );

                        // Show error dialog to user
                        dialog.showMessageBox({
                            type: 'error',
                            title: 'Download Failed',
                            message: 'Failed to download the update.',
                            detail: `${downloadErr.message}\n\nCheck the log file for details:\n${LOG_FILE}`
                        });
                    });

                log(
                    'INFO',
                    'downloadUpdate() called (async operation started)'
                );
            } else {
                log('INFO', 'User chose to update later');
            }
        })
        .catch((dialogErr) => {
            log('ERROR', 'Dialog error:', dialogErr.message);
            log('ERROR', 'Stack:', dialogErr.stack);
        });
});

// Event: Update not available
autoUpdater.on('update-not-available', (info) => {
    log('INFO', '>>> EVENT: update-not-available');
    log('INFO', 'Current version is up to date:', info.version);

    if (isManualCheck) {
        log('INFO', 'Showing "no updates" dialog (manual check)');
        dialog.showMessageBox({
            type: 'info',
            title: 'No Updates Available',
            message: "You're up to date!",
            detail: `Mosaic Companion ${info.version} is the latest version.`
        });
        isManualCheck = false;
    }
});

// Event: Download progress
autoUpdater.on('download-progress', (progress) => {
    const percent = progress.percent.toFixed(1);
    const transferred = (progress.transferred / 1024 / 1024).toFixed(2);
    const total = (progress.total / 1024 / 1024).toFixed(2);
    const speed = (progress.bytesPerSecond / 1024).toFixed(1);

    log(
        'INFO',
        `>>> EVENT: download-progress - ${percent}% (${transferred}/${total} MB, ${speed} KB/s)`
    );

    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        win.setProgressBar(progress.percent / 100);
    }
});

// Event: Update downloaded
autoUpdater.on('update-downloaded', (info) => {
    log('INFO', '========================================');
    log('INFO', '>>> EVENT: update-downloaded');
    log('INFO', 'Version:', info.version);
    log('INFO', 'Release Date:', info.releaseDate);
    log('INFO', 'Download Info:', JSON.stringify(info, null, 2));
    log('INFO', '========================================');

    const win = BrowserWindow.getFocusedWindow();
    if (win) {
        win.setProgressBar(-1);
    }

    log('INFO', 'Showing "update ready" dialog...');

    dialog
        .showMessageBox({
            type: 'info',
            title: 'Update Ready',
            message: 'Update downloaded successfully.',
            detail: 'The application will restart to install the update. Save your work before proceeding.',
            buttons: ['Restart Now', 'Later'],
            defaultId: 0,
            cancelId: 1
        })
        .then((result) => {
            log(
                'INFO',
                `User clicked button index: ${result.response} (${
                    result.response === 0 ? 'Restart Now' : 'Later'
                })`
            );

            if (result.response === 0) {
                if (process.platform === 'darwin') {
                    app.removeAllListeners('before-quit');
                    app.removeAllListeners('window-all-closed');
                    BrowserWindow.getAllWindows().forEach((win) => {
                        if (win.isDestroyed()) return;
                        win.removeAllListeners('close');
                        win.close();
                    });

                    nativeUpdater.once('before-quit-for-update', () => {
                        app.exit();
                    });
                }

                log('INFO', 'Calling quitAndInstall()...');
                autoUpdater.quitAndInstall(true, true);
            } else {
                log('INFO', 'User chose to restart later');
            }
        });
});

// Event: Error
autoUpdater.on('error', (err) => {
    log('ERROR', '========================================');
    log('ERROR', '>>> EVENT: error');
    log('ERROR', 'Error message:', err.message);
    log('ERROR', 'Error name:', err.name);
    log('ERROR', 'Error code:', err.code);
    log('ERROR', 'Stack trace:', err.stack);
    log(
        'ERROR',
        'Full error:',
        JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
    );
    log('ERROR', '========================================');

    // Show error dialog on Mac for visibility
    if (os.platform() === 'darwin') {
        dialog.showMessageBox({
            type: 'error',
            title: 'Update Error',
            message: 'An error occurred during the update process.',
            detail: `${err.message}\n\nLog file: ${LOG_FILE}`
        });
    }
});
