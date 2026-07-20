/**
 * 1AM CIP-30 WebView Bridge
 *
 * Loads the 1AM/Midnight browser extension directly into Electron's session,
 * then creates a BrowserWindow running a local HTTP bridge page so the
 * extension's content script can inject (MV3 extensions need http/https).
 * The bridge detects window.cardano / window.oneam and returns wallet data
 * to the main process via IPC.
 */

import { BrowserWindow, session, ipcMain, app } from 'electron';
import * as http from 'http';
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
            const text = (name + ' ' + desc).toLowerCase();
            if (/1am|midnight/i.test(text)) {
              found.push({
                key: name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''),
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
    const sess = session.defaultSession;
    const extensions = (sess as any).extensions || sess;
    const loader = (extensions.loadExtension || (sess as any).loadExtension).bind(extensions !== sess ? extensions : sess);
    await loader(extensionPath, { allowFileAccess: true });
    console.log('[1AM WebView Bridge] Loaded extension from:', extensionPath);
    return true;
  } catch (err: any) {
    console.error('[1AM WebView Bridge] Failed to load extension:', err.message);
    return false;
  }
}

// ─── Bridge HTML ────────────────────────────────────────────────────────────

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
  .wallet-btn { padding: 10px 14px; border-radius: 6px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #e2e8f0; cursor: pointer; margin: 6px 0; display: block; width: 100%; }
  .wallet-btn:hover { background: rgba(99,102,241,0.25); border-color: rgba(99,102,241,0.5); }
  .wallet-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
</head>
<body>
<h3>1AM CIP-30 Bridge</h3>
<div id="status" class="status pending">Detecting wallets...</div>
<div id="wallets"></div>
<pre id="log"></pre>
<script>
const statusEl = document.getElementById('status');
const logEl = document.getElementById('log');
const walletsEl = document.getElementById('wallets');
function log(msg) { logEl.textContent += msg + '\n'; console.log(msg); }
function report(type, data) {
  if (window.bridgeAPI && window.bridgeAPI.report) {
    window.bridgeAPI.report(type, data);
  }
}

function detectProviders() {
  const cardano = window.cardano;
  const providers = [];
  // Prefer 1AM / Midnight globals
  if (window.oneam && typeof window.oneam.enable === 'function') {
    providers.push({ key: 'oneam', wallet: window.oneam, is1AM: true });
  }
  if (window.midnight && typeof window.midnight.enable === 'function') {
    providers.push({ key: 'midnight', wallet: window.midnight, is1AM: true });
  }
  // Then any cardano provider whose name suggests 1AM/Midnight/1am
  if (cardano) {
    for (const [key, wallet] of Object.entries(cardano)) {
      if (!wallet || typeof wallet.enable !== 'function') continue;
      const name = (wallet.name || key).toLowerCase();
      if (/oneam|midnight|1am/i.test(name) && !providers.find(p => p.wallet === wallet)) {
        providers.push({ key, wallet, is1AM: true });
      }
    }
  }
  // Fallback: all CIP-30 providers if none matched 1AM
  if (providers.length === 0 && cardano) {
    for (const [key, wallet] of Object.entries(cardano)) {
      if (wallet && typeof wallet.enable === 'function') {
        providers.push({ key, wallet, is1AM: false });
      }
    }
  }
  return providers;
}

async function detectWallets() {
  log('Scanning window.cardano / window.oneam / window.midnight...');
  const providers = detectProviders();
  log('Found ' + providers.length + ' provider(s): ' + providers.map(p => (p.wallet.name || p.key)).join(', '));

  const names = providers.map(p => ({
    name: p.wallet.name || p.key,
    key: p.key,
    is1AM: p.is1AM,
    version: p.wallet.apiVersion || '1.0',
  }));
  report('detect', { available: providers.length > 0, wallets: names });

  walletsEl.innerHTML = '';
  if (providers.length === 0) {
    statusEl.className = 'status error';
    statusEl.textContent = 'No Cardano wallet extensions found.';
    return;
  }

  statusEl.className = 'status pending';
  statusEl.textContent = 'Found ' + providers.length + ' provider(s)';

  providers.forEach(({ key, wallet }) => {
    const btn = document.createElement('button');
    btn.className = 'wallet-btn';
    btn.textContent = 'Connect ' + (wallet.name || key);
    btn.addEventListener('click', () => connectWallet(key));
    walletsEl.appendChild(btn);
  });

  // Auto-connect if exactly one 1AM provider exists
  const oneamProviders = providers.filter(p => p.is1AM);
  if (oneamProviders.length === 1) {
    statusEl.textContent = 'Auto-connecting 1AM...';
    await new Promise(r => setTimeout(r, 500));
    await connectWallet(oneamProviders[0].key);
  }
}

async function connectWallet(walletKey) {
  try {
    statusEl.className = 'status pending';
    statusEl.textContent = 'Connecting to ' + walletKey + '...';
    log('Connecting to ' + walletKey);

    const providers = detectProviders();
    const provider = providers.find(p => p.key === walletKey);
    if (!provider) throw new Error('Provider ' + walletKey + ' disappeared');

    const api = await provider.wallet.enable();
    log('Enabled wallet');

    const usedAddresses = await api.getUsedAddresses();
    const address = usedAddresses && usedAddresses.length > 0 ? usedAddresses[0] : null;
    log('Address: ' + (address ? address.slice(0, 20) + '...' : 'none'));

    const rewardAddresses = await api.getRewardAddresses();
    const rewardAddress = rewardAddresses && rewardAddresses.length > 0 ? rewardAddresses[0] : null;
    const networkId = await api.getNetworkId();

    let lovelace = 0, night = 0, dust = 0, assets = [];
    try {
      const bal = await api.getBalance();
      lovelace = bal.lovelace || 0;
      assets = bal.tokens || [];
      log('Balance: ' + lovelace + ' lovelace, ' + assets.length + ' assets');
    } catch (e) { log('getBalance failed: ' + (e.message || e)); }
    try { night = await api.getNightBalance(); log('NIGHT: ' + night); } catch (e) {}
    try { dust = await api.getDustBalance(); log('DUST: ' + dust); } catch (e) {}

    statusEl.className = 'status success';
    statusEl.textContent = 'Connected to ' + (provider.wallet.name || walletKey);
    report('connect', {
      success: true,
      walletName: provider.wallet.name || walletKey,
      address,
      rewardAddress,
      networkId,
      lovelace,
      night,
      dust,
      assets,
    });
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

// ─── Local HTTP bridge server ────────────────────────────────────────────────

let bridgeServer: http.Server | null = null;
let bridgeUrl: string | null = null;

function startBridgeServer(preferredPort = 19666): Promise<{ server: http.Server; url: string }> {
  return new Promise((resolve, reject) => {
    if (bridgeServer) return resolve({ server: bridgeServer, url: bridgeUrl! });

    const server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
      if (req.url === '/' || req.url === '/index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(BRIDGE_HTML);
        return;
      }
      res.writeHead(404); res.end('Not found');
    });

    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') server.listen(preferredPort + 1);
      else reject(err);
    });

    server.listen(preferredPort, '127.0.0.1', () => {
      const addr = server.address();
      const port = addr && typeof addr === 'object' ? addr.port : preferredPort;
      bridgeServer = server;
      bridgeUrl = `http://127.0.0.1:${port}/`;
      console.log('[1AM WebView Bridge] Bridge server listening at', bridgeUrl);
      resolve({ server, url: bridgeUrl });
    });
  });
}

function stopBridgeServer() {
  if (bridgeServer) {
    bridgeServer.close();
    bridgeServer = null;
    bridgeUrl = null;
  }
}

// ─── Bridge Window ──────────────────────────────────────────────────────────

let bridgeWindow: BrowserWindow | null = null;

async function getPreloadPath(): Promise<string> {
  const candidates = [
    path.join(__dirname, 'cip30-bridge-preload.js'),
    path.join(__dirname, '..', '..', 'cip30-bridge-preload.js'),
    path.join(__dirname, '..', '..', 'electron', 'integrations', 'oneam', 'cip30-bridge-preload.js'),
    path.join(app.getAppPath(), 'cip30-bridge-preload.js'),
    path.join(app.getAppPath(), 'electron', 'integrations', 'oneam', 'cip30-bridge-preload.js'),
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

  const { url } = await startBridgeServer();
  const extensions = await discoverWalletExtensions();
  console.log('[1AM WebView Bridge] Discovered:', extensions.map((e) => e.name).join(', ') || 'none');

  // Load discovered 1AM/Midnight extensions into Electron session
  for (const ext of extensions) {
    await loadWalletExtension(ext.path);
  }

  const preloadPath = await getPreloadPath().catch((err) => {
    console.warn('[1AM WebView Bridge]', err.message);
    return '';
  });

  bridgeWindow = new BrowserWindow({
    width: 700,
    height: 520,
    show: true, // always show for manual selection and debugging
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: preloadPath || undefined,
    },
  });

  await bridgeWindow.loadURL(url);

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
  stopBridgeServer();
}

// ─── Bridge Actions ─────────────────────────────────────────────────────────

export async function bridgeDetectWallets(): Promise<{ available: boolean; wallets: Array<{ name: string; key: string; version: string }> }> {
  const win = await createBridgeWindow();
  return new Promise((resolve) => {
    const handler = (_event: any, data: any) => {
      if (data?.type === 'detect') {
        ipcMain.removeListener('bridge:report', handler);
        resolve(data.data);
      }
    };
    ipcMain.on('bridge:report', handler);
    win.webContents.executeJavaScript(`
      window.postMessage({ source: 'cip30-bridge-command', command: 'detect' }, '*')
    `);
    setTimeout(() => {
      ipcMain.removeListener('bridge:report', handler);
      resolve({ available: false, wallets: [] });
    }, 15000);
  });
}

export async function bridgeConnectWallet(walletKey: string): Promise<OneAmBridgeResult> {
  const win = await createBridgeWindow();
  return new Promise((resolve) => {
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
    win.webContents.executeJavaScript(`
      window.postMessage({ source: 'cip30-bridge-command', command: 'connect', walletKey: ${JSON.stringify(walletKey)} }, '*')
    `);
    setTimeout(() => {
      ipcMain.removeListener('bridge:report', handler);
      resolve({ success: false, error: 'Connection timeout' });
    }, 60000);
  });
}

export async function bridgeDisconnect(): Promise<void> {
  destroyBridgeWindow();
}
