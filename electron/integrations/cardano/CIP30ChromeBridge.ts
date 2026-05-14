/**
 * CIP-30 Chrome/Brave/Edge Bridge for Desktop Browser Wallets (Lace, Eternl, Nami, etc.)
 *
 * Architecture:
 * 1. Electron starts a temporary HTTP server on 127.0.0.1 serving a bridge HTML page
 * 2. The bridge page runs IN A REAL BROWSER (Chrome), so extensions inject properly
 * 3. The bridge detects window.cardano (injected by Lace/Eternl), enables the wallet
 * 4. POSTs the result back to the temp server; Electron resolves the promise
 *
 * Why not Electron BrowserWindow?
 * - Chrome extensions (MV3) require a real browser profile with service workers
 * - Content scripts only inject into http/https/file URLs, NOT data: URLs
 * - Electron's loadExtension() does not auto-inject content scripts into pages
 * - The ONLY reliable way to access window.cardano is from a real Chrome tab
 */

import * as http from 'http';
import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── Browser Detection ─────────────────────────────────────────────────

export function isChromeInstalled(): boolean {
  return !!getChromeCommand();
}

export function getChromeCommand(): string | null {
  const commands = [
    'google-chrome',
    'chromium-browser',
    'chromium',
    'brave-browser',
    'brave',
    'microsoft-edge',
  ];
  for (const cmd of commands) {
    try {
      const result = execSync(`which ${cmd}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
      if (result) return result;
    } catch { /* ignore */ }
  }
  return null;
}

// ─── Extension Discovery (static scan for detectWallets) ─────────────────

interface DiscoveredExtension {
  key: string;
  name: string;
  path: string;
  version: string;
}

function getChromeExtensionPaths(): string[] {
  const home = os.homedir();
  const platform = os.platform();
  const paths: string[] = [];

  if (platform === 'linux') {
    const profiles = ['Default', 'Profile 1', 'Profile 2', 'Profile 3'];
    for (const profile of profiles) {
      paths.push(
        path.join(home, '.config', 'google-chrome', profile, 'Extensions'),
        path.join(home, '.config', 'chromium', profile, 'Extensions'),
        path.join(home, '.config', 'BraveSoftware', 'Brave-Browser', profile, 'Extensions'),
        path.join(home, '.config', 'microsoft-edge', profile, 'Extensions'),
      );
    }
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
  return paths.filter(p => fs.existsSync(p));
}

function scanExtensionDirectory(extPath: string): DiscoveredExtension[] {
  const found: DiscoveredExtension[] = [];
  try {
    const entries = fs.readdirSync(extPath, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const idDir = path.join(extPath, entry.name);
      const versions = fs.readdirSync(idDir);
      const latestVersion = versions.sort().pop();
      if (latestVersion) {
        const manifestPath = path.join(idDir, latestVersion, 'manifest.json');
        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            const name = manifest.name || '';
            const desc = manifest.description || '';
            if (/cardano|lace|eternl|nami|yoroi|flint|gero/i.test(name + ' ' + desc)) {
              found.push({
                key: name.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, ''),
                name,
                path: path.join(idDir, latestVersion),
                version: latestVersion.replace(/_/g, '.'),
              });
            }
          } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }
  return found;
}

export async function discoverChromeWallets(): Promise<{
  available: boolean;
  wallets: Array<{ name: string; key: string; version: string }>;
}> {
  const allFound: DiscoveredExtension[] = [];
  for (const extPath of getChromeExtensionPaths()) {
    allFound.push(...scanExtensionDirectory(extPath));
  }

  if (allFound.length === 0) {
    return { available: false, wallets: [] };
  }

  return {
    available: true,
    wallets: allFound.map(e => ({
      name: e.name,
      key: e.key,
      version: e.version,
    })),
  };
}

// ─── Temporary Callback Server ──────────────────────────────────────────

export interface ChromeBridgeResult {
  success: boolean;
  walletName?: string;
  address?: string;
  rewardAddress?: string;
  networkId?: number;
  signedTx?: string;
  assets?: Array<{
    policyId: string;
    assetName: string;
    fingerprint: string;
    quantity: number;
  }>;
  error?: string;
}

function startChromeCallbackServer(preferredPort: number = 9876): Promise<{
  server: http.Server;
  port: number;
  getResult: () => ChromeBridgeResult | null;
}> {
  let result: ChromeBridgeResult | null = null;

  const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/callback') {
      let body = '';
      req.on('data', chunk => (body += chunk));
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          result = payload as ChromeBridgeResult;
          console.log('[CIP30Chrome] Callback received:', result?.success ? 'success' : 'error');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ received: true }));
        } catch {
          res.writeHead(400);
          res.end('Invalid JSON');
        }
      });
      return;
    }

    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getBridgePage(preferredPort));
      return;
    }

    if (req.method === 'GET' && req.url === '/sign') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(getSignPage(preferredPort));
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  return new Promise((resolve, reject) => {
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        server.listen(preferredPort + 1);
      } else {
        reject(err);
      }
    });

    server.listen(preferredPort, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve({
          server,
          port: addr.port,
          getResult: () => result,
        });
      } else {
        reject(new Error('Could not determine server port'));
      }
    });
  });
}

// ─── Bridge HTML Page (served to Chrome) ────────────────────────────────

function getBridgePage(port: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Mosaic — Cardano Wallet Bridge</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0f; color: #e2e8f0; margin: 0; padding: 40px; display: flex; flex-direction: column; align-items: center; min-height: 100vh; box-sizing: border-box; }
    .container { max-width: 480px; width: 100%; text-align: center; }
    .logo { font-size: 24px; font-weight: 700; margin-bottom: 8px; color: #6366f1; }
    .subtitle { color: #94a3b8; font-size: 14px; margin-bottom: 32px; }
    .status { padding: 16px 24px; border-radius: 12px; margin: 16px 0; font-size: 14px; }
    .pending { background: rgba(99,102,241,0.15); border: 1px solid rgba(99,102,241,0.3); }
    .success { background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3); color: #22c55e; }
    .error { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); color: #ef4444; }
    .spinner { width: 40px; height: 40px; border: 3px solid rgba(99,102,241,0.2); border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; margin: 24px auto; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .wallet-list { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
    .wallet-btn { padding: 12px 16px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; cursor: pointer; transition: all 0.2s; font-size: 14px; }
    .wallet-btn:hover { background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.4); }
    .detail { font-size: 12px; color: #64748b; margin-top: 8px; font-family: monospace; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Mosaic Companion</div>
    <div class="subtitle">Connect your Cardano wallet via Chrome/Brave</div>
    <div id="spinner" class="spinner"></div>
    <div id="status" class="status pending">Detecting Cardano wallets...</div>
    <div id="wallets" class="wallet-list"></div>
    <div id="detail" class="detail"></div>
  </div>

  <script>
    const CALLBACK_URL = 'http://127.0.0.1:${port}/callback';
    const statusEl = document.getElementById('status');
    const spinnerEl = document.getElementById('spinner');
    const walletsEl = document.getElementById('wallets');
    const detailEl = document.getElementById('detail');

    async function report(type, data) {
      try {
        await fetch(CALLBACK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, walletName: data.walletName || type })
        });
      } catch (e) {
        console.error('Failed to report:', e);
      }
    }

    async function detectWallets() {
      const cardano = window.cardano;
      if (!cardano) {
        spinnerEl.style.display = 'none';
        statusEl.className = 'status error';
        statusEl.textContent = 'No Cardano wallet extensions found. Ensure Lace is installed and enabled in Chrome.';
        report('error', { success: false, error: 'No Cardano wallet extensions found in Chrome' });
        return [];
      }

      const wallets = [];
      for (const [key, wallet] of Object.entries(cardano)) {
        if (wallet && typeof wallet.enable === 'function') {
          wallets.push({ name: wallet.name || key, key, icon: wallet.icon || '' });
        }
      }

      spinnerEl.style.display = wallets.length > 0 ? 'none' : 'block';
      if (wallets.length === 0) {
        statusEl.className = 'status error';
        statusEl.textContent = 'No CIP-30 wallets detected. Ensure Lace extension is installed in Chrome.';
        report('detect', { success: false, available: false, error: 'No CIP-30 wallets in Chrome' });
      } else {
        statusEl.className = 'status success';
        statusEl.textContent = 'Found: ' + wallets.map(w => w.name).join(', ');
        report('detect', { success: true, available: true, wallets: wallets.map(w => ({ name: w.name, key: w.key })) });
      }
      return wallets;
    }

    async function connectWallet(walletKey) {
      try {
        spinnerEl.style.display = 'block';
        walletsEl.innerHTML = '';
        statusEl.className = 'status pending';
        statusEl.textContent = 'Connecting to ' + walletKey + '...';

        const cardano = window.cardano;
        if (!cardano || !cardano[walletKey]) {
          throw new Error('Wallet ' + walletKey + ' not found');
        }

        const wallet = cardano[walletKey];
        const api = await wallet.enable();

        const usedAddresses = await api.getUsedAddresses();
        const address = usedAddresses && usedAddresses.length > 0 ? usedAddresses[0] : null;

        const rewardAddresses = await api.getRewardAddresses();
        const rewardAddress = rewardAddresses && rewardAddresses.length > 0 ? rewardAddresses[0] : null;

        const networkId = await api.getNetworkId();

        // ─── Fetch UTXOs and extract native assets ───
        let assets = [];
        try {
          statusEl.textContent = 'Scanning wallet assets...';
          const utxos = await api.getUtxos();
          if (utxos && utxos.length > 0) {
            const assetMap = new Map();
            for (const utxoHex of utxos) {
              try {
                const utxo = JSON.parse(utxoHex);
                const tokens = utxo.value?.assets || utxo.amount?.tokens || [];
                for (const t of tokens) {
                  const policyId = t.policyId || t.policy_id || '';
                  const assetName = t.assetName || t.asset_name || '';
                  const key = policyId + '.' + assetName;
                  const qty = t.quantity || t.amount || 1;
                  if (assetMap.has(key)) {
                    assetMap.get(key).quantity += qty;
                  } else {
                    assetMap.set(key, {
                      policyId,
                      assetName,
                      fingerprint: t.fingerprint || '',
                      quantity: qty
                    });
                  }
                }
              } catch (e) {
                // Some UTXOs may not parse as JSON; ignore
              }
            }
            assets = Array.from(assetMap.values());
          }
        } catch (assetErr) {
          console.warn('Asset scan failed:', assetErr);
        }

        spinnerEl.style.display = 'none';
        statusEl.className = 'status success';
        statusEl.textContent = 'Connected to ' + (wallet.name || walletKey) + ' on ' + (networkId === 1 ? 'mainnet' : 'testnet') + '!';
        if (assets.length > 0) {
          detailEl.textContent = 'Address: ' + address.slice(0, 20) + '... | ' + assets.length + ' asset(s) found';
        } else {
          detailEl.textContent = address ? 'Address: ' + address.slice(0, 20) + '...' : '';
        }

        await report('connect', {
          success: true,
          walletName: walletKey,
          address,
          rewardAddress,
          networkId,
          assets
        });
      } catch (err) {
        spinnerEl.style.display = 'none';
        statusEl.className = 'status error';
        statusEl.textContent = 'Error: ' + err.message;
        await report('connect', { success: false, error: err.message });
      }
    }

    async function init() {
      const wallets = await detectWallets();
      if (wallets.length > 0) {
        const laceWallet = wallets.find(w => w.key === 'lace' || /lace/i.test(w.name));
        const target = laceWallet || wallets[0];
        if (wallets.length === 1 || laceWallet) {
          await connectWallet(target.key);
        } else {
          spinnerEl.style.display = 'none';
          wallets.forEach(w => {
            const btn = document.createElement('button');
            btn.className = 'wallet-btn';
            btn.textContent = 'Connect ' + w.name;
            btn.addEventListener('click', () => connectWallet(w.key));
            walletsEl.appendChild(btn);
          });
        }
      }
    }

    init();
  </script>
</body>
</html>`;
}

// ─── Sign Transaction Page ──────────────────────────────────────────────

function getSignPage(port: number): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Mosaic — Sign Transaction</title>
<style>
body{font-family:system-ui,sans-serif;background:#0a0a0f;color:#e2e8f0;margin:0;padding:40px;display:flex;flex-direction:column;align-items:center;min-height:100vh;box-sizing:border-box}
.container{max-width:480px;width:100%;text-align:center}
.logo{font-size:24px;font-weight:700;margin-bottom:8px;color:#6366f1}
.subtitle{color:#94a3b8;font-size:14px;margin-bottom:32px}
.status{padding:16px 24px;border-radius:12px;margin:16px 0;font-size:14px}
.pending{background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3)}
.success{background:rgba(34,197,94,0.15);border:1px solid rgba(34,197,94,0.3);color:#22c55e}
.error{background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#ef4444}
.spinner{width:40px;height:40px;border:3px solid rgba(99,102,241,0.2);border-top-color:#6366f1;border-radius:50%;animation:spin 1s linear infinite;margin:24px auto}
@keyframes spin{to{transform:rotate(360deg)}}
</style>
</head>
<body>
<div class="container">
  <div class="logo">Mosaic Companion</div>
  <div class="subtitle">Sign transaction via Chrome/Brave</div>
  <div id="spinner" class="spinner"></div>
  <div id="status" class="status pending">Loading wallet API...</div>
</div>
<script>
const CALLBACK_URL='http://127.0.0.1:${port}/callback';
const statusEl=document.getElementById('status');
const spinnerEl=document.getElementById('spinner');

async function report(type,data){
  try{await fetch(CALLBACK_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...data,type})});}
  catch(e){console.error('Report failed:',e);}
}

async function init(){
  const params=new URLSearchParams(location.hash.slice(1)||location.search);
  const walletKey=params.get('walletKey')||'lace';
  const txHex=params.get('txHex')||'';
  const partialSign=params.get('partialSign')!=='false';

  try{
    const cardano=window.cardano;
    if(!cardano||!cardano[walletKey]){throw new Error('Wallet '+walletKey+' not found');}
    const wallet=cardano[walletKey];
    const api=await wallet.enable();
    statusEl.textContent='Signing transaction...';
    const signedTx=await api.signTx(txHex,partialSign);
    spinnerEl.style.display='none';
    statusEl.className='status success';
    statusEl.textContent='Transaction signed successfully!';
    report('signTx',{success:true,signedTx});
  }catch(err){
    spinnerEl.style.display='none';
    statusEl.className='status error';
    statusEl.textContent='Error: '+err.message;
    report('signTx',{success:false,error:err.message});
  }
}
init();
</script>
</body>
</html>`;
}

// ─── Chrome Bridge Actions ──────────────────────────────────────────────

export async function detectChromeWallets(): Promise<{
  available: boolean;
  wallets: Array<{ name: string; key: string; version: string }>;
}> {
  return discoverChromeWallets();
}

export async function connectChromeWallet(
  walletKey: string = 'lace'
): Promise<{ success: boolean; address?: string; rewardAddress?: string; networkId?: number; assets?: Array<{ policyId: string; assetName: string; fingerprint: string; quantity: number }>; error?: string }> {
  if (!isChromeInstalled()) {
    return { success: false, error: 'Chrome/Chromium/Brave/Edge is not installed on this system' };
  }

  const chromeCmd = getChromeCommand();
  if (!chromeCmd) {
    return { success: false, error: 'Could not find Chrome/Chromium executable' };
  }

  let server: http.Server | null = null;

  try {
    const { server: s, port, getResult } = await startChromeCallbackServer(9876);
    server = s;

    const bridgeUrl = `http://127.0.0.1:${port}/`;
    console.log(`[CIP30Chrome] Opening Chrome at ${bridgeUrl}...`);

    // Note: If Chrome is already running, this opens a new window in the existing
    // process and the child process exits immediately. That's OK - we track the result
    // via the callback server, not the child process.
    const chromeProcess = spawn(chromeCmd, ['--new-window', bridgeUrl], {
      detached: true,
      stdio: 'ignore',
    });
    chromeProcess.unref();

    const startTime = Date.now();
    const TIMEOUT = 120000; // 2 minutes
    const POLL_INTERVAL = 1000;

    return new Promise((resolve) => {
      const check = setInterval(() => {
        const result = getResult();
        // Detect payloads have no address; only resolve on connect payloads
        if (result && result.address) {
          clearInterval(check);
          if (server) { server.close(); server = null; }
          resolve(result);
          return;
        }

        if (Date.now() - startTime > TIMEOUT) {
          clearInterval(check);
          if (server) { server.close(); server = null; }
          resolve({
            success: false,
            error: 'Connection timed out. Please ensure Lace is installed in Chrome/Brave and try again.',
          });
        }
      }, POLL_INTERVAL);
    });
  } catch (error: any) {
    if (server) { server.close(); }
    return { success: false, error: error.message || 'Failed to launch Chrome bridge' };
  }
}

export async function signTxChrome(
  walletKey: string,
  txHex: string,
  partialSign = true
): Promise<{ success: boolean; signedTx?: string; error?: string }> {
  if (!isChromeInstalled()) {
    return { success: false, error: 'Chrome/Chromium/Brave/Edge is not installed' };
  }

  const chromeCmd = getChromeCommand();
  if (!chromeCmd) {
    return { success: false, error: 'Could not find Chrome/Chromium executable' };
  }

  let server: http.Server | null = null;

  try {
    const { server: s, port, getResult } = await startChromeCallbackServer(9877);
    server = s;

    const bridgeUrl = `http://127.0.0.1:${port}/sign#walletKey=${encodeURIComponent(walletKey)}&txHex=${encodeURIComponent(txHex)}&partialSign=${partialSign}`;
    console.log(`[CIP30Chrome] Opening Chrome sign window...`);

    const chromeProcess = spawn(chromeCmd, ['--new-window', bridgeUrl], {
      detached: true,
      stdio: 'ignore',
    });
    chromeProcess.unref();

    const startTime = Date.now();
    const TIMEOUT = 120000;
    const POLL_INTERVAL = 1000;

    return new Promise((resolve) => {
      const check = setInterval(() => {
        const result = getResult();
        if (result && result.signedTx) {
          clearInterval(check);
          if (server) { server.close(); server = null; }
          resolve(result);
          return;
        }

        if (Date.now() - startTime > TIMEOUT) {
          clearInterval(check);
          if (server) { server.close(); server = null; }
          resolve({ success: false, error: 'Signing timed out' });
        }
      }, POLL_INTERVAL);
    });
  } catch (error: any) {
    if (server) { server.close(); }
    return { success: false, error: error.message || 'Failed to launch Chrome sign bridge' };
  }
}

export async function disconnectChromeWallet(): Promise<void> {
  console.log('[CIP30Chrome] Disconnect called (no-op for Chrome bridge)');
}
