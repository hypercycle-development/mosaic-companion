/**
 * 1AM Chrome Bridge for Desktop Browser Wallet
 *
 * Spawns a real Chrome process with a temporary HTTP bridge server.
 * The bridge page attempts wallet detection via multiple strategies:
 *   1. CIP-30 globals (window.oneam, window.midnight, window.cardano)
 *   2. Chrome extension messaging (chrome.runtime.sendMessage to known IDs)
 *   3. Manual user-triggered retry
 *
 * Why real Chrome?
 * - Chrome extensions (MV3) require a real browser profile with service workers
 * - Content scripts only reliably inject into http/https URLs in real Chrome
 * - chrome.runtime messaging only works inside real Chrome tabs
 */

import * as http from 'http';
import { spawn, execSync } from 'child_process';
import * as path from 'path';

// ─── Known 1AM / Midnight Extension IDs ────────────────────────────────────
const KNOWN_EXTENSION_IDS = [
  'pljbjmehgjnlccgbbhhffncgkfmkbmgl', // 1AM (published)
  'midnight-wallet',                   // Midnight placeholder
];

// ─── Browser Detection ─────────────────────────────────────────────────────

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

// ─── Bridge Result Type ────────────────────────────────────────────────────

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

// ─── Temporary Callback Server ───────────────────────────────────────────

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

// ─── Bridge HTML Page (served to Chrome) ──────────────────────────────────

function getBridgePage(port: number): string {
  const extensionIds = JSON.stringify(KNOWN_EXTENSION_IDS);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>1AM Wallet Bridge</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0c29; color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .container { text-align: center; padding: 40px; max-width: 480px; }
    .logo { font-size: 56px; margin-bottom: 16px; }
    h1 { font-weight: 600; margin-bottom: 8px; }
    p { color: #a0a0c0; margin-bottom: 24px; line-height: 1.5; }
    .status { padding: 14px 28px; border-radius: 10px; background: rgba(255,255,255,0.08); font-weight: 500; font-size: 15px; margin-bottom: 20px; transition: all 0.3s; }
    .status.detecting { background: rgba(255,193,7,0.15); color: #ffc107; }
    .status.connected { background: rgba(76,175,80,0.15); color: #4caf50; }
    .status.error { background: rgba(244,67,54,0.15); color: #f44336; }
    .btn { padding: 12px 24px; border-radius: 8px; border: none; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; font-weight: 600; font-size: 15px; cursor: pointer; margin-top: 12px; }
    .btn:hover { opacity: 0.9; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .detail { font-size: 12px; color: #666; margin-top: 16px; }
    .providers { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-top: 8px; }
    .tag { padding: 4px 10px; border-radius: 12px; background: rgba(255,255,255,0.06); font-size: 11px; color: #888; }
    .wallet-list { display: flex; flex-direction: column; gap: 8px; margin: 16px 0; }
    .wallet-btn { padding: 12px 16px; border-radius: 8px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #e2e8f0; cursor: pointer; transition: all 0.2s; font-size: 14px; font-weight: 500; }
    .wallet-btn:hover { background: rgba(99,102,241,0.2); border-color: rgba(99,102,241,0.4); }
    .wallet-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">1AM</div>
    <h1>1AM Wallet Bridge</h1>
    <p id="msg">Scanning for wallet providers...</p>
    <div id="status" class="status detecting">Detecting...</div>
    <div class="providers" id="providers">
      <div class="tag">Scanning window.cardano...</div>
      <div class="tag">window.oneam</div>
      <div class="tag">window.midnight</div>
      <div class="tag">chrome.runtime</div>
    </div>
    <div class="wallet-list" id="wallets"></div>
    <button id="retryBtn" class="btn" style="display:none;">Retry Detection</button>
    <div class="detail">This tab will close automatically after connecting.</div>
  </div>
  <script>
    const PORT = ${port};
    const EXTENSION_IDS = ${extensionIds};

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
        msg.textContent = 'Wallet connected successfully. You can close this tab.';
      } else if (cls === 'error') {
        msg.textContent = 'Could not detect the 1AM extension. Try clicking the extension icon in Chrome, then click Retry.';
      }
    }

    function showProviders(found) {
      const container = document.getElementById('providers');
      container.innerHTML = '';
      found.forEach(name => {
        const tag = document.createElement('div');
        tag.className = 'tag';
        tag.style.color = '#4caf50';
        tag.textContent = '✓ ' + name;
        container.appendChild(tag);
      });
    }

    // ── Strategy 1: CIP-30 global providers ────────────────────────────────
    function detectCIP30Providers() {
      const found = [];
      const providers = [];
      const cardano = window.cardano;
      if (cardano) {
        for (const [key, wallet] of Object.entries(cardano)) {
          if (wallet && typeof wallet.enable === 'function') {
            found.push(key + ' (' + (wallet.name || key) + ')');
            providers.push({ key, wallet });
          }
        }
      }
      // Also check top-level globals (non-standard extensions)
      if (window.oneam && typeof window.oneam.enable === 'function') {
        found.push('window.oneam');
        providers.push({ key: 'oneam', wallet: window.oneam });
      }
      if (window.midnight && typeof window.midnight.enable === 'function') {
        found.push('window.midnight');
        providers.push({ key: 'midnight', wallet: window.midnight });
      }
      return { found, providers };
    }

    async function tryConnectCIP30(targetKey) {
      const { providers } = detectCIP30Providers();
      if (!providers.length) return null;
      showProviders(providers.map(p => p.key));
      setStatus('detecting', 'Connecting via ' + (targetKey || providers[0].key) + '...');

      // If a specific key requested, use it; otherwise try all
      const candidates = targetKey
        ? providers.filter(p => p.key === targetKey)
        : providers;

      for (const { key, wallet } of candidates) {
        try {
          const api = await wallet.enable();
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

          return { success: true, walletName: wallet.name || key, address, networkId, lovelace, night, dust, assets };
        } catch (e) {
          console.warn('CIP-30 provider ' + key + ' failed:', e);
        }
      }
      return null;
    }

    // ── Strategy 2: Chrome extension messaging ────────────────────────────
    async function tryExtensionMessaging() {
      if (!window.chrome?.runtime?.sendMessage) return null;
      const found = [];
      for (const extId of EXTENSION_IDS) {
        try {
          const response = await new Promise((resolve) => {
            chrome.runtime.sendMessage(extId, { action: 'PING' }, (resp) => {
              resolve(resp || chrome.runtime.lastError);
            });
          });
          if (response && !response.message) {
            found.push('ext:' + extId.slice(0, 8));
          }
        } catch (e) {}
      }
      if (!found.length) return null;
      showProviders(found);
      setStatus('detecting', 'Connecting via extension messaging...');

      for (const extId of EXTENSION_IDS) {
        try {
          const state = await new Promise((resolve) => {
            chrome.runtime.sendMessage(extId, { action: 'GET_WALLET_STATE' }, (resp) => {
              resolve(resp || chrome.runtime.lastError);
            });
          });
          if (state && state.address) {
            return {
              success: true,
              walletName: '1AM Wallet (messaging)',
              address: state.address,
              networkId: state.networkId || 0,
              lovelace: state.balance?.lovelace || 0,
              night: state.balance?.night || 0,
              dust: state.balance?.dust || 0,
              assets: state.balance?.assets || [],
            };
          }
        } catch (e) {}
      }
      return null;
    }

    // ── Strategy 3: Manual user retry ─────────────────────────────────────
    async function run() {
      // Give extensions a moment to inject content scripts
      await new Promise(r => setTimeout(r, 2000));

      const { found, providers } = detectCIP30Providers();

      if (!providers.length) {
        // Try extension messaging as fallback
        const msgResult = await tryExtensionMessaging();
        if (msgResult) {
          setStatus('connected', 'Connected!');
          await postResult(msgResult);
          return;
        }

        // Show retry button for manual user intervention
        setStatus('error', 'Not detected');
        document.getElementById('retryBtn').style.display = 'inline-block';
        document.getElementById('msg').textContent = 'No wallet providers found. Ensure 1AM/Midnight is installed in Chrome/Brave, unlocked, and try clicking Retry.';
        await postResult({
          success: false,
          error: 'No wallet providers detected on this page. Extensions may only inject after user interaction. Try clicking the 1AM extension icon in Chrome first, then click Retry.',
        });
        return;
      }

      // Show detected providers
      showProviders(providers.map(p => p.key));
      setStatus('detecting', 'Found ' + providers.length + ' provider(s)');
      document.getElementById('msg').textContent = 'Select a wallet below or auto-connecting in 3 seconds...';

      // Build wallet buttons
      const walletsEl = document.getElementById('wallets');
      walletsEl.innerHTML = '';
      providers.forEach(({ key, wallet }) => {
        const btn = document.createElement('button');
        btn.className = 'wallet-btn';
        btn.textContent = 'Connect ' + (wallet.name || key);
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = 'Connecting...';
          const result = await tryConnectCIP30(key);
          if (result && result.success) {
            setStatus('connected', 'Connected to ' + (result.walletName || key) + '!');
            await postResult(result);
          } else {
            btn.disabled = false;
            btn.textContent = 'Connect ' + (wallet.name || key);
            setStatus('error', 'Connection failed');
            await postResult({ success: false, error: 'Failed to connect to ' + key });
          }
        });
        walletsEl.appendChild(btn);
      });

      // Auto-connect if only one provider (or if 'oneam'/'midnight'/'lace' specifically)
      const oneamProvider = providers.find(p => /oneam|midnight|lace/i.test(p.key));
      const target = oneamProvider || (providers.length === 1 ? providers[0] : null);

      if (target && providers.length <= 2) {
        setStatus('detecting', 'Auto-connecting ' + target.key + '...');
        await new Promise(r => setTimeout(r, 1500));
        const result = await tryConnectCIP30(target.key);
        if (result && result.success) {
          setStatus('connected', 'Connected to ' + (result.walletName || target.key) + '!');
          await postResult(result);
          return;
        }
      }

      // Multiple providers found — show buttons and wait for user
      setStatus('detecting', 'Select a wallet to connect');
    }

    document.getElementById('retryBtn').addEventListener('click', async () => {
      document.getElementById('retryBtn').disabled = true;
      document.getElementById('retryBtn').textContent = 'Retrying...';
      setStatus('detecting', 'Retrying...');
      await run();
      document.getElementById('retryBtn').disabled = false;
      document.getElementById('retryBtn').textContent = 'Retry Detection';
    });

    run();
  </script>
</body>
</html>`;
}

// ─── Public API ─────────────────────────────────────────────────────────────

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
        resolve({ success: false, error: 'Timeout: 1AM Wallet did not connect within 2 minutes. Please make sure the extension is enabled, unlocked, and try clicking Retry on the bridge page.' });
      }
    }, pollInterval);
  });
}
