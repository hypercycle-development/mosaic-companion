/**
 * 1AM Chrome Bridge for Desktop Browser Wallet
 *
 * Architecture:
 * 1. Electron starts a temporary HTTP server on 127.0.0.1 serving bridge HTML
 * 2. spawns a real Chrome process with the bridge URL
 * 3. The bridge page runs in REAL Chrome, so the 1AM extension injects window.oneam
 * 4. The bridge connects to the wallet and POSTs the result back to the temp server
 * 5. Electron resolves the promise with wallet data
 *
 * Why not Electron BrowserWindow?
 * - Chrome extensions (MV3) require a real browser profile with service workers
 * - Content scripts only inject into http/https/file URLs, NOT data: URLs or iframes
 * - The ONLY reliable way to access window.oneam is from a real Chrome tab
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

// ─── Temporary Callback Server ──────────────────────────────────────────

export interface OneAmBridgeResult {
  success: boolean;
  walletName?: string;
  address?: string;
  networkId?: number;
  lovelace?: number;
  night?: number;
  dust?: number;
  assets?: Array<{ policyId: string; assetName: string; quantity: number }>;
  error?: string;
}

function startOneAmCallbackServer(preferredPort: number = 9877): Promise<{
  server: http.Server;
  port: number;
  getResult: () => OneAmBridgeResult | null;
}> {
  let result: OneAmBridgeResult | null = null;

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
          result = payload as OneAmBridgeResult;
          console.log('[OneAmChrome] Callback received:', result?.success ? 'success' : 'error');
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
  <meta charset="utf-8">
  <title>1AM Wallet Bridge</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #0f0c29; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .container { text-align: center; padding: 40px; }
    .logo { font-size: 48px; margin-bottom: 20px; }
    h1 { font-weight: 600; margin-bottom: 10px; }
    p { color: #a0a0c0; margin-bottom: 30px; }
    .status { padding: 12px 24px; border-radius: 8px; background: rgba(255,255,255,0.1); font-weight: 500; }
    .status.detecting { background: rgba(255,193,7,0.2); color: #ffc107; }
    .status.connected { background: rgba(76,175,80,0.2); color: #4caf50; }
    .status.error { background: rgba(244,67,54,0.2); color: #f44336; }
    .close-hint { margin-top: 30px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">1AM</div>
    <h1>1AM Wallet Bridge</h1>
    <p id="msg">Detecting 1AM Wallet extension...</p>
    <div id="status" class="status detecting">Detecting...</div>
    <div class="close-hint">This tab will close automatically after connecting.</div>
  </div>
  <script>
    const PORT = ${port};

    async function postResult(payload) {
      try {
        await fetch('http://127.0.0.1:' + PORT + '/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } catch (e) {
        console.error('Bridge callback failed:', e);
      }
    }

    function setStatus(cls, text) {
      const el = document.getElementById('status');
      const msg = document.getElementById('msg');
      el.className = 'status ' + cls;
      el.textContent = text;
      if (cls === 'connected') {
        msg.textContent = 'You can close this tab now.';
      } else if (cls === 'error') {
        msg.textContent = 'Please make sure the 1AM extension is enabled.';
      }
    }

    async function run() {
      const provider = window.oneam || window.midnight;
      if (!provider) {
        setStatus('error', 'Not detected');
        await postResult({ success: false, error: '1AM Wallet extension not detected. Please install and enable it in Chrome.' });
        return;
      }

      try {
        setStatus('detecting', 'Connecting...');
        const api = await provider.enable();
        const addresses = await api.getUsedAddresses();
        const address = addresses?.[0] || null;
        const networkId = await api.getNetworkId().catch(() => 0);

        let lovelace = 0, night = 0, dust = 0, assets = [];
        try {
          const bal = await api.getBalance();
          lovelace = bal.lovelace || 0;
          assets = bal.tokens || [];
        } catch (e) {}
        try { night = await api.getNightBalance(); } catch (e) {}
        try { dust = await api.getDustBalance(); } catch (e) {}

        setStatus('connected', 'Connected!');
        await postResult({ success: true, walletName: '1AM Wallet', address, networkId, lovelace, night, dust, assets });
      } catch (err) {
        setStatus('error', 'Connection failed');
        await postResult({ success: false, error: err.message || 'Failed to connect 1AM Wallet' });
      }
    }

    run();
  </script>
</body>
</html>`;
}

// ─── Public API ─────────────────────────────────────────────────────────

export async function connectOneAmChrome(): Promise<OneAmBridgeResult> {
  const chromeCmd = getChromeCommand();
  if (!chromeCmd) {
    return { success: false, error: 'Chrome/Brave/Chromium not found. Please install a Chromium-based browser with the 1AM extension.' };
  }

  const { server, port, getResult } = await startOneAmCallbackServer(9877);
  const bridgeUrl = `http://127.0.0.1:${port}/`;

  // Spawn Chrome in a new window pointing to the bridge
  const chromeProcess = spawn(chromeCmd, [
    '--new-window',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions-except=' + (process.env.ONEAM_EXT_ID || ''),
    bridgeUrl,
  ], {
    detached: false,
    stdio: 'ignore',
  });

  // Poll for result with timeout
  const timeoutMs = 120000; // 2 minutes
  const pollInterval = 500;
  const start = Date.now();

  return new Promise((resolve) => {
    const timer = setInterval(() => {
      const result = getResult();
      if (result) {
        clearInterval(timer);
        chromeProcess.kill();
        server.close();
        resolve(result);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        chromeProcess.kill();
        server.close();
        resolve({ success: false, error: 'Timeout: 1AM Wallet did not connect within 2 minutes. Please make sure the extension is enabled and unlocked.' });
      }
    }, pollInterval);
  });
}
