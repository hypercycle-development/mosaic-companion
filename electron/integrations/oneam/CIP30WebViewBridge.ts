/**
 * 1AM CIP-30 WebView Bridge
 *
 * Loads the 1AM/Midnight browser extension directly into Electron's session,
 * then creates a hidden BrowserWindow running a bridge page that detects
 * window.cardano (injected by the loaded extension) and returns wallet data
 * to the main process via IPC.
 *
 * This is the canonical approach for MV3 extensions whose service workers
 * do not activate when spawned in an external Chrome process.
 *
 * Architecture:
 *   Renderer (React)  <--IPC-->  Main process
 *                                  |
 *                                  v
 *                         hidden BrowserWindow (bridge page)
 *                                  |
 *                                  v
 *                         window.cardano injected by loaded extension
 */

import { BrowserWindow, session, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface OneAmBridgeResult {
  success: boolean;
  walletName?: string;
  address?: string;
  rewardAddress?: string;
  networkId?: number;
  lovelace?: number;
  night?: number;
  dust?: number;
  assets?: Array<{ policyId: string; assetName: string; quantity: number }>;
  error?: string;
}

interface DiscoveredExtension {
  key: string;
  name: string;
  path: string;
  version: string;
}

// ─── Extension Discovery ──────────────────────────────────────────────────

function getChromeExtensionPaths(): string[] {
  const home = os.homedir();
  const platform = os.platform();
  const paths: string[] = [];

  if (platform === 'linux') {
    paths.push(
      path.join(home, '.config', 'google-chrome', 'Default', 'Extensions'),
      path.join(home, '.config', 'chromium', 'Default', 'Extensions'),
      path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', 'Default', 'Extensions'),
      path.join(home, '.config', 'microsoft-edge', 'Default', 'Extensions'),
    );
  } else if (platform === 'darwin') {
    paths.push(
      path.join(home, 'Library', 'Application Support', 'Google', 'Chrome', 'Default', 'Extensions'),
      path.join(home, 'Library', 'Application Support', 'Chromium', 'Default', 'Extensions'),
      path.join(home, 'Library', 'Application Support', 'BraveSoftware', 'Brave-Browser', 'Default', 'Extensions'),
    );
  } else if (platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local');
    paths.push(
      path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Extensions'),
      path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data', 'Default', 'Extensions'),
    );
  }
  return paths.filter((p) => fs.existsSync(p));
}

function scanExtensionDirectory(extPath: string): DiscoveredExtension[] {
  const found: DiscoveredExtension[] = [];
  try {
    const entries = fs.readdirSync(extPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const versions = fs.readdirSync(path.join(extPath, entry.name));
      const latestVersion = versions.sort().pop();
      if (latestVersion) {
        const manifestPath = path.join(extPath, entry.name, latestVersion, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            const name = manifest.name || '';
            const desc = manifest.description || '';
            if (/1am|midnight|cardano|lace|eternl|nami|yoroi|flint|gero/i.test(name + ' ' + desc)) {
              found.push({
                key: name.toLowerCase().replace(/\s+/g, ''),
                name,
                path: path.join(extPath, entry.name, latestVersion),
                version: latestVersion,
              });
            }
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }
  return found;
}

export async function discoverWalletExtensions(): Promise<DiscoveredExtension[]> {
  const allFound: DiscoveredExtension[] = [];
  for (const extPath of getChromeExtensionPaths()) {
    allFound.push(...scanExtensionDirectory(extPath));
  }
  return allFound;
}

async function loadWalletExtension(extensionPath: string): Promise<boolean> {
  try {
    await session.defaultSession.loadExtension(extensionPath, { allowFileAccess: true });
    console.log('[1AM WebView Bridge] Loaded extension from:', extensionPath);
    return true;
  } catch (err: any) {
    console.error('[1AM WebView Bridge] Failed to load extension:', err.message);
    return false;
  }
}

// ─── Bridge Window ──────────────────────────────────────────────────────────

let bridgeWindow: BrowserWindow | null = null;

const BRIDGE_HTML = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>1AM CIP-30 Bridge</title>
<style>
  body { font-family: system-ui, sans-serif; background: #0f0c29; color: #e5e5e5; padding: 20px; margin: 0; }
  .status { padding: 12px; border-radius: 8px; margin: 10px 0; }
  .pending { background: #1e3a5f; }
  .success { background: #1e4620; }
  .error { background: #5f1e1e; }
  pre { font-size: 11px; overflow-x: auto; }
</style>
</head>
<body>
<h3>1AM CIP-30 Bridge</h3>
<div id="status" class="status pending">Detecting wallets...</div>
<pre id="log"></pre>
<script>
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
function log(msg) { logEl.textContent += msg + '\n'; console.log(msg); }
function report(type, data) {
  if (window.bridgeAPI && window.bridgeAPI.report) {
    window.bridgeAPI.report(type, data);
  }
}

async function detectWallets() {
  log('Scanning window.cardano...');
  const cardano = window.cardano;
  if (!cardano) {
    statusEl.className = 'status error';
    statusEl.textContent = 'No Cardano wallet extensions found.';
    report('detect', { available: false, wallets: [] });
    return;
  }
  const wallets = [];
  for (const [key, wallet] of Object.entries(cardano)) {
    if (wallet && typeof wallet.enable === 'function') {
      wallets.push({ name: wallet.name || key, key, icon: wallet.icon || '', version: wallet.apiVersion || '1.0' });
    }
  }
  log('Found: ' + wallets.map(w => w.name).join(', '));
  statusEl.className = wallets.length > 0 ? 'status success' : 'status error';
  statusEl.textContent = wallets.length > 0 ? 'Found: ' + wallets.map(w => w.name).join(', ') : 'No CIP-30 wallets detected.';
  report('detect', { available: wallets.length > 0, wallets });
}

async function connectWallet(walletKey) {
  try {
    log('Connecting to ' + walletKey + '...');
    const cardano = window.cardano;
    if (!cardano || !cardano[walletKey]) {
      report('connect', { success: false, error: 'Wallet ' + walletKey + ' not found' });
      return;
    }
    const wallet = cardano[walletKey];
    const api = await wallet.enable();
    log('Enabled, fetching addresses...');
    const usedAddresses = await api.getUsedAddresses();
    const address = usedAddresses && usedAddresses.length > 0 ? usedAddresses[0] : null;
    const rewardAddresses = await api.getRewardAddresses();
    const rewardAddress = rewardAddresses && rewardAddresses.length > 0 ? rewardAddresses[0] : null;
    const networkId = await api.getNetworkId();

    let lovelace = 0, night = 0, dust = 0, assets = [];
    try {
      const bal = await api.getBalance();
      lovelace = bal.lovelace || 0;
      assets = bal.tokens || [];
    } catch (e) { log('getBalance failed: ' + (e.message || e)); }
    try { night = await api.getNightBalance(); } catch (e) {}
    try { dust = await api.getDustBalance(); } catch (e) {}

    log('Addr: ' + (address ? address.slice(0, 20) + '...' : 'none'));
    statusEl.className = 'status success';
    statusEl.textContent = 'Connected to ' + walletKey + ' on ' + (networkId === 1 ? 'mainnet' : 'testnet');
    report('connect', { success: true, walletName: wallet.name || walletKey, address, rewardAddress, networkId, lovelace, night, dust, assets });
  } catch (err) {
    log('Error: ' + (err.message || err));
    statusEl.className = 'status error';
    statusEl.textContent = 'Error: ' + (err.message || err);
    report('connect', { success: false, error: err.message || String(err) });
  }
}

window.addEventListener('message', (event) => {
  if (event.data && event.data.source === 'cip30-bridge-command') {
    const { command, walletKey } = event.data;
    if (command === 'detect') detectWallets();
    if (command === 'connect') connectWallet(walletKey);
  }
});

detectWallets();
</script>
</body>
</html>`;

async function getPreloadPath(): Promise<string> {
  // In dev: __dirname is electron/integrations/oneam
  // In prod: bundled alongside main.js
  const candidates = [
    path.join(__dirname, 'cip30-bridge-preload.js'),
    path.join(__dirname, '..', '..', 'cip30-bridge-preload.js'),
    path.join(process.resourcesPath || '', 'app', 'cip30-bridge-preload.js'),
    path.join(process.resourcesPath || '', 'app.asar.unpacked', 'cip30-bridge-preload.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('cip30-bridge-preload.js not found in any candidate path');
}

export async function createBridgeWindow(): Promise<BrowserWindow> {
  if (bridgeWindow && !bridgeWindow.isDestroyed()) {
    return bridgeWindow;
  }

  const preloadPath = await getPreloadPath().catch((err) => {
    console.warn('[1AM WebView Bridge]', err.message);
    return '';
  });

  bridgeWindow = new BrowserWindow({
    width: 600,
    height: 400,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath || undefined,
    },
  });

  await bridgeWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(BRIDGE_HTML));

  // Try to auto-load discovered extensions, then reload so content scripts inject
  const extensions = await discoverWalletExtensions();
  if (extensions.length > 0) {
    console.log('[1AM WebView Bridge] Discovered:', extensions.map((e) => e.name).join(', '));
    for (const ext of extensions) {
      await loadWalletExtension(ext.path);
    }
    await bridgeWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(BRIDGE_HTML));
  }

  bridgeWindow.on('closed', () => {
    bridgeWindow = null;
  });
  return bridgeWindow;
}

export function showBridgeWindow(): void {
  if (bridgeWindow && !bridgeWindow.isDestroyed()) bridgeWindow.show();
}

export function hideBridgeWindow(): void {
  if (bridgeWindow && !bridgeWindow.isDestroyed()) bridgeWindow.hide();
}

export function destroyBridgeWindow(): void {
  if (bridgeWindow && !bridgeWindow.isDestroyed()) {
    bridgeWindow.destroy();
    bridgeWindow = null;
  }
}

// ─── Bridge Actions ─────────────────────────────────────────────────────────

export async function bridgeDetectWallets(): Promise<{ available: boolean; wallets: Array<{ name: string; key: string; version: string }> }> {
  const win = await createBridgeWindow();
  return new Promise((resolve) => {
    win.webContents.executeJavaScript(`
      window.postMessage({ source: 'cip30-bridge-command', command: 'detect' }, '*')
    `);
    const handler = (_event: any, data: any) => {
      if (data?.type === 'detect') {
        ipcMain.removeListener('bridge:report', handler);
        resolve(data.data);
      }
    };
    ipcMain.on('bridge:report', handler);
    setTimeout(() => {
      ipcMain.removeListener('bridge:report', handler);
      resolve({ available: false, wallets: [] });
    }, 10000);
  });
}

export async function bridgeConnectWallet(walletKey: string): Promise<OneAmBridgeResult> {
  const win = await createBridgeWindow();
  return new Promise((resolve) => {
    win.webContents.executeJavaScript(`
      window.postMessage({ source: 'cip30-bridge-command', command: 'connect', walletKey: '${walletKey}' }, '*')
    `);
    const handler = (_event: any, data: any) => {
      if (data?.type === 'connect') {
        ipcMain.removeListener('bridge:report', handler);
        const result = data.data;
        resolve({
          success: result.success,
          walletName: result.walletName,
          address: result.address,
          networkId: result.networkId,
          lovelace: result.lovelace,
          night: result.night,
          dust: result.dust,
          assets: result.assets,
          error: result.error,
        });
      }
    };
    ipcMain.on('bridge:report', handler);
    setTimeout(() => {
      ipcMain.removeListener('bridge:report', handler);
      resolve({ success: false, error: 'Connection timeout' });
    }, 60000);
  });
}

export async function bridgeDisconnect(): Promise<void> {
  destroyBridgeWindow();
}
