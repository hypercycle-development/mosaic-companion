/**
 * CIP-30 Firefox Bridge for Desktop Browser Wallets (Lace in Firefox)
 *
 * Architecture:
 * 1. Electron spawns Firefox with a local bridge HTML file
 * 2. The bridge page (running IN Firefox) detects window.cardano (injected by Lace)
 * 3. Enables the wallet and POSTs the address back to a temporary HTTP server
 * 4. Electron receives the callback and resolves the connection promise
 *
 * Note: Firefox extensions cannot be loaded into Electron/Chromium.
 * We must open an actual Firefox window to access the extension's CIP-30 API.
 */

import * as http from 'http';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { spawn, execSync } from 'child_process';

// ─── Firefox Detection ─────────────────────────────────────────────────

export function isFirefoxInstalled(): boolean {
  try {
    execSync('which firefox', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function getFirefoxCommand(): string | null {
  try {
    const cmd = execSync('which firefox', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
    return cmd || null;
  } catch {
    return null;
  }
}

// ─── Temporary Callback Server ────────────────────────────────────────

interface FirefoxBridgeResult {
  success: boolean;
  walletName?: string;
  address?: string;
  rewardAddress?: string;
  networkId?: number;
  error?: string;
}

function startFirefoxCallbackServer(preferredPort: number = 9877): Promise<{ server: http.Server; port: number; getResult: () => FirefoxBridgeResult | null }> {
  let result: FirefoxBridgeResult | null = null;

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
      req.on('data', chunk => body += chunk);
      req.on('end', () => {
        try {
          const payload = JSON.parse(body);
          result = payload as FirefoxBridgeResult;
          console.log('[CIP30Firefox] Callback received:', result?.success ? 'success' : 'error');
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
        const actualPort = addr.port;
        resolve({
          server,
          port: actualPort,
          getResult: () => result,
        });
      } else {
        reject(new Error('Could not determine server port'));
      }
    });
  });
}

// ─── Bridge HTML Page (served to Firefox) ─────────────────────────────

function getBridgePage(port: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Mosaic — Lace Bridge</title>
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
    <div class="subtitle">Connect your Cardano wallet via Firefox</div>
    <div id="spinner" class="spinner"></div>
    <div id="status" class="status pending">Detecting Cardano wallets in Firefox...</div>
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
        statusEl.textContent = 'No Cardano wallet extensions found in Firefox. Ensure Lace is installed and enabled.';
        report('error', { success: false, error: 'No Cardano wallet extensions found in Firefox' });
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
        statusEl.textContent = 'No CIP-30 wallets detected. Ensure Lace extension is installed in Firefox.';
        report('detect', { success: false, available: false, error: 'No CIP-30 wallets in Firefox' });
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

        spinnerEl.style.display = 'none';
        statusEl.className = 'status success';
        statusEl.textContent = 'Connected to ' + (wallet.name || walletKey) + ' on ' + (networkId === 1 ? 'mainnet' : 'testnet') + '!';
        detailEl.textContent = address ? 'Address: ' + address.slice(0, 20) + '...' : '';

        await report('connect', {
          success: true,
          walletName: walletKey,
          address,
          rewardAddress,
          networkId
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
        // Auto-connect to Lace if available, otherwise show buttons
        const laceWallet = wallets.find(w => w.key === 'lace' || /lace/i.test(w.name));
        const target = laceWallet || wallets[0];
        if (wallets.length === 1 || laceWallet) {
          await connectWallet(target.key);
        } else {
          // Show buttons for multiple wallets
          spinnerEl.style.display = 'none';
          walletsEl.innerHTML = wallets.map(w =>
            '<button class="wallet-btn" onclick="connectWallet(\\'' + w.key + '\\')">Connect ' + w.name + '</button>'
          ).join('');
        }
      }
    }

    init();
  <\/script>
</body>
</html>`;
}

// ─── Firefox Bridge Actions ───────────────────────────────────────────

export async function detectFirefoxWallets(): Promise<{ available: boolean; wallets: Array<{ name: string; key: string; version: string }> }> {
  if (!isFirefoxInstalled()) {
    return { available: false, wallets: [] };
  }

  // We can't detect Firefox extensions without opening Firefox.
  // Return a placeholder that tells the UI Firefox is available.
  const wallets: Array<{ name: string; key: string; version: string }> = [{ name: 'Lace (Firefox)', key: 'lace', version: '1.0' }];
  return {
    available: true,
    wallets,
  };
}

export async function connectFirefoxWallet(walletKey: string = 'lace'): Promise<{ success: boolean; address?: string; rewardAddress?: string; networkId?: number; error?: string }> {
  if (!isFirefoxInstalled()) {
    return { success: false, error: 'Firefox is not installed on this system' };
  }

  const firefoxCmd = getFirefoxCommand();
  if (!firefoxCmd) {
    return { success: false, error: 'Could not find Firefox executable' };
  }

  let server: http.Server | null = null;
  let firefoxProcess: ReturnType<typeof spawn> | null = null;

  try {
    // Start the temporary callback server
    const { server: s, port, getResult } = await startFirefoxCallbackServer();
    server = s;

    // Open Firefox with the bridge page
    const bridgeUrl = `http://127.0.0.1:${port}/`;
    console.log(`[CIP30Firefox] Opening Firefox at ${bridgeUrl}...`);

    firefoxProcess = spawn(firefoxCmd, ['--new-window', bridgeUrl], {
      detached: true,
      stdio: 'ignore',
    });

    firefoxProcess.unref();

    // Poll for the result
    const startTime = Date.now();
    const timeout = 120000; // 2 minutes
    const pollInterval = 1000;

    return new Promise((resolve) => {
      const check = setInterval(() => {
        const result = getResult();
        if (result) {
          clearInterval(check);
          // Clean up
          if (server) { server.close(); server = null; }
          if (firefoxProcess) { firefoxProcess = null; }
          resolve(result);
          return;
        }

        if (Date.now() - startTime > timeout) {
          clearInterval(check);
          if (server) { server.close(); server = null; }
          if (firefoxProcess) { try { firefoxProcess.kill(); } catch {} firefoxProcess = null; }
          resolve({ success: false, error: 'Connection timed out. Please ensure Lace is installed in Firefox and try again.' });
        }
      }, pollInterval);
    });
  } catch (error: any) {
    if (server) { server.close(); }
    if (firefoxProcess) { try { firefoxProcess.kill(); } catch {} }
    return { success: false, error: error.message || 'Failed to launch Firefox bridge' };
  }
}

export async function disconnectFirefoxWallet(): Promise<void> {
  // No persistent bridge window for Firefox — connection is stateless
  // The Firefox tab can be closed by the user
  console.log('[CIP30Firefox] Disconnect called (no-op for Firefox bridge)');
}
