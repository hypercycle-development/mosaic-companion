# macOS Auto-Update Verification Guide

This guide outlines the steps to verify the native auto-update functionality on macOS. We have migrated from `electron-updater` to Electron's native `autoUpdater` to align with our Windows strategy.

## Prerequisites

> [!IMPORTANT]
> **Code Signing Required**: macOS auto-updates **will not work** unless the application is code-signed. You cannot test auto-updates in development (`npm run dev`) or with unsigned builds.

1.  **Apple Developer ID**: You must have a valid Apple Developer ID Certificate.
2.  **S3 Access**: Ensure you have read access to the `mosaic-release` bucket to verify files exist.

## Update Flow Differences

Unlike the previous implementation:
*   **No Progress Bar**: The native macOS updater processes the download in the background. The app will receive an `update-downloaded` event when ready. There is no intermediate progress UI.
*   **Feed Format**: The native updater expects a specific JSON response or XML feed. We are currently pointing it to the S3 bucket path.
    *   *Note*: If the S3 bucket listing is disabled or formatting is incorrect for Mac, the check may fail silently or log an error.

## Verification Steps

### 1. Build and Sign the App
To test updates, you verify strict behavior: "Older Version -> Newer Version".

1.  **Modify Version**: Open `package.json` and set the version to something older than what is currently on S3 (e.g., `0.0.1`).
2.  **Package**: Run the make command for Mac.
    ```bash
    npm run make:mac:x64
    # or
    npm run make:mac:arm64
    ```
    *Ensure the output app is signed.*

### 2. Run the Application
1.  Launch the packaged application (from `out/make/...`).
2.  Open the Console app on macOS (Applications > Utilities > Console) and filter for "Mosaic".
    *   Alternatively, check the local log file: `~/Library/Application Support/mosaic-companion/update.log`.
3.  Observe the logs.

### 3. Check for Updates
1.  Wait for the automatic check on startup, or trigger "Check for Updates" manually.
2.  **Expected Log Output**:
    ```
    [INFO] Checking for updates...
    [INFO] Feed URL: https://mosaic-release.s3.us-east-2.amazonaws.com/releases/darwin/x64
    [INFO] update-available
    ```
    *(Note: If it says "update-not-available" or "error", follow the troubleshooting below)*

### 4. Install Update
1.  Wait for the background download to complete.
2.  A dialog should appear: "Update Ready - A new version has been downloaded."
3.  Click "Restart Now".
4.  Verify the app restarts and the version in `package.json` (or About menu) matches the latest version.

## Troubleshooting

### "Update check failed: 404" or "XML Parsing Error"
The native macOS `autoUpdater` is picky. If pointing directly to an S3 folder doesn't work (because S3 returns an XML file list instead of the expected JSON feed), we may need to deploy a `feed.json` or use a lightweight update server.

**Workaround Test**:
If direct S3 access fails for Mac, we might need to upload a `RELEASES.json` or similar to the darwin folder that matches the Squirrel.Mac expectation, or set up a small static JSON file like:
```json
{
  "url": "https://mosaic-release.s3.us-east-2.amazonaws.com/releases/darwin/x64/Mosaic-Companion-0.0.30-mac.zip",
  "name": "0.0.30",
  "notes": "Release notes",
  "pub_date": "2025-01-24T12:00:00Z"
}
```
And point the `feedUrl` to this JSON file specifically.

**Contact the release team** if you see XML errors in the logs.
