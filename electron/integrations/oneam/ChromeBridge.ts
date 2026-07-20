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
    'google-chrome-stable',
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
          console.log('[OneAmChrome] Callback received:', result?.success ? 'success' : 'error', result?.error || '');
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

    // Bind to the loopback hostname so both 127.0.0.1 and ::1 reach us.
    server.listen(preferredPort, 'localhost', () => {
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
        const resp = await fetch('http://localhost:' + PORT + '/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!resp.ok) {
          console.error('Bridge callback HTTP error:', resp.status);
          // Retry once after 1s
          setTimeout(async () => {
            try {
              await fetch('http://localhost:' + PORT + '/callback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
            } catch (e2) { console.error('Bridge callback retry failed:', e2); }
          }, 1000);
        } else {
          console.log('Bridge callback sent successfully');
        }
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
        msg.textContent = 'Could not complete the wallet authorization. Check the details above, click the extension icon if needed, then click Retry.';
      } else if (cls === 'detecting') {
        msg.textContent = 'Scanning for wallet providers...';
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
      // Some extensions expose themselves under window.cardano but with a
      // different key. Inspect all window.cardano.* objects again and look
      // for nested 1AM providers.
      if (cardano) {
        for (const [key, wallet] of Object.entries(cardano)) {
          if (!wallet || typeof wallet !== 'object') continue;
          for (const [nestedKey, nestedWallet] of Object.entries(wallet)) {
            if (nestedWallet && typeof nestedWallet.enable === 'function') {
              const fullKey = key + '.' + nestedKey;
              found.push(fullKey + ' (' + (nestedWallet.name || nestedKey) + ')');
              if (!providers.find(p => p.wallet === nestedWallet)) {
                providers.push({ key: fullKey, wallet: nestedWallet });
              }
            }
          }
        }
      }
      return { found, providers };
    }

    function isOneAmMidnight(provider) {
      // Trust the CIP-30 key, not the display name. The real 1AM extension
      // registers under key '1am'. Other providers (app, lace, nufi, eternl)
      // may claim a similar name but are not 1AM.
      return /^(oneam|midnight|1am|app\.1am)$/i.test(provider.key || '');
    }

    function formatError(e) {
      if (e === null || e === undefined) return 'unknown error';
      if (typeof e === 'string') return e;
      if (e.message && e.code !== undefined) return e.message + ' (code ' + e.code + ')';
      if (e.message) return String(e.message);
      if (e.code !== undefined) return 'code ' + e.code;
      try { return JSON.stringify(e); } catch (_) {}
      return String(e);
    }

    function isLace(provider) {
      const key = provider.key || '';
      const name = (provider.wallet && provider.wallet.name) || key || '';
      return /lace/i.test(key) || /lace/i.test(name);
    }

    async function tryConnectCIP30(targetKey) {
      // Re-detect providers right before connecting so we don't use a stale
      // provider object that the extension may have re-initialized.
      const { providers } = detectCIP30Providers();
      const relevant = providers.filter(p => isOneAmMidnight(p) && !isLace(p));
      if (!relevant.length) return null;

      showProviders(relevant.map(p => p.key));
      setStatus('detecting', 'Connecting via ' + targetKey + '...');

      const candidates = targetKey
        ? relevant.filter(p => p.key === targetKey)
        : relevant;

      for (const { key, wallet } of candidates) {
        try {
          let api;
          // If already enabled, many wallets return the API object on enable()
          // without showing a popup. Try enable() first, then isEnabled().
          try {
            api = await wallet.enable();
          } catch (e) {
            if (wallet.isEnabled) {
              log('First enable attempt failed for ' + key + ', checking isEnabled...');
              const alreadyEnabled = await wallet.isEnabled();
              if (alreadyEnabled) {
                // Some wallets expose the API directly when already enabled
                api = wallet;
              } else {
                throw e;
              }
            } else {
              throw e;
            }
          }

          if (!api) throw new Error('enable() returned no API');

          // Try multiple CIP-30 address sources
          let address = null;
          let rewardAddress = null;
          const addressAttempts = [];
          try {
            if (api.getUsedAddresses) {
              const used = await api.getUsedAddresses();
              if (used?.length) address = used[0];
              addressAttempts.push('getUsedAddresses: ' + (address ? 'ok' : 'empty'));
            }
          } catch (e) { addressAttempts.push('getUsedAddresses: ' + formatError(e)); }
          if (!address) try {
            if (api.getUnusedAddresses) {
              const unused = await api.getUnusedAddresses();
              if (unused?.length) address = unused[0];
              addressAttempts.push('getUnusedAddresses: ' + (address ? 'ok' : 'empty'));
            }
          } catch (e) { addressAttempts.push('getUnusedAddresses: ' + formatError(e)); }
          if (!address) try {
            if (api.getChangeAddress) {
              const change = await api.getChangeAddress();
              if (change) address = change;
              addressAttempts.push('getChangeAddress: ' + (address ? 'ok' : 'empty'));
            }
          } catch (e) { addressAttempts.push('getChangeAddress: ' + formatError(e)); }
          if (!address) try {
            if (api.getAddresses) {
              const addrs = await api.getAddresses();
              if (addrs?.length) address = addrs[0];
              addressAttempts.push('getAddresses: ' + (address ? 'ok' : 'empty'));
            }
          } catch (e) { addressAttempts.push('getAddresses: ' + formatError(e)); }

          try {
            if (api.getRewardAddresses) {
              const rewards = await api.getRewardAddresses();
              if (rewards?.length) rewardAddress = rewards[0];
            }
          } catch (e) {}

          log('Address attempts: ' + addressAttempts.join(' | '));
          if (!address) throw new Error('No address available from wallet API');

          const networkId = await api.getNetworkId ? api.getNetworkId().catch(() => 0) : 0;

          let lovelace = 0, night = 0, dust = 0, assets = [];
          try {
            if (api.getBalance) {
              const bal = await api.getBalance();
              lovelace = bal.lovelace || 0;
              assets = bal.tokens || [];
            }
          } catch (e) {}
          try { if (api.getNightBalance) night = await api.getNightBalance(); } catch (e) {}
          try { if (api.getDustBalance) dust = await api.getDustBalance(); } catch (e) {}

          return { success: true, walletName: wallet.name || key, address, rewardAddress, networkId, lovelace, night, dust, assets };
        } catch (e) {
          console.warn('CIP-30 provider ' + key + ' failed:', e);
          // Return an error object for this provider so the caller can decide
          return { success: false, walletName: wallet.name || key, error: formatError(e) };
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
      // Give extensions a moment to inject content scripts, then try several times
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) {
          setStatus('detecting', 'Retry scan ' + attempt + '/3...');
          await new Promise(r => setTimeout(r, 2000));
        } else {
          await new Promise(r => setTimeout(r, 1500));
        }

        const { found, providers } = detectCIP30Providers();

        if (!providers.length) {
          // Try extension messaging as fallback
          const msgResult = await tryExtensionMessaging();
          if (msgResult) {
            setStatus('connected', 'Connected!');
            await postResult(msgResult);
            return;
          }
          continue; // retry scan
        }

        // Found providers — proceed with connection flow
        return await connectProviders(providers);
      }

      // All attempts exhausted
      setStatus('error', 'Not detected — click Retry after activating the extension');
      document.getElementById('retryBtn').style.display = 'inline-block';
      document.getElementById('msg').textContent = 'No wallet providers found after multiple attempts. Ensure 1AM/Midnight is installed in Chrome/Brave, unlocked, and try clicking Retry.';
      await postResult({
        success: false,
        error: 'No wallet providers detected. Extensions may only inject after user interaction. Try clicking the 1AM extension icon in Chrome first, then click Retry.',
      });
    }

    async function connectProviders(providers) {
      // Only present 1AM/Midnight providers; never Lace, NUFI, Eternl, etc.
      const relevant = providers.filter(p => isOneAmMidnight(p) && !isLace(p));

      // Show detected providers — clear any previous error state
      showProviders(relevant.map(p => p.key));
      setStatus('detecting', 'Found ' + relevant.length + ' 1AM/Midnight provider(s)');

      if (!relevant.length) {
        setStatus('error', 'No 1AM/Midnight provider found');
        document.getElementById('msg').textContent = 'A wallet extension was detected, but it is not 1AM or Midnight. If you see 1AM in your toolbar, click its icon to wake it, then click Retry.';
        document.getElementById('retryBtn').style.display = 'inline-block';
        await postResult({ success: false, error: 'No 1AM/Midnight provider found' });
        return;
      }

      document.getElementById('msg').textContent = 'Click Connect 1AM Wallet below to authorize this site.';

      // Build wallet buttons only for 1AM/Midnight
      const walletsEl = document.getElementById('wallets');
      walletsEl.innerHTML = '';
      relevant.forEach(({ key, wallet }) => {
        const btn = document.createElement('button');
        btn.className = 'wallet-btn';
        const walletName = wallet.name || key;
        btn.textContent = 'Connect ' + walletName + ' [' + key + ']';
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          btn.textContent = 'Connecting ' + walletName + '...';
          const result = await tryConnectCIP30(key);
          if (result && result.success) {
            setStatus('connected', 'Connected to ' + (result.walletName || key) + '!');
            await postResult(result);
          } else {
            btn.disabled = false;
            btn.textContent = 'Connect ' + walletName + ' [' + key + ']';
            const errText = result?.error || 'unknown error';
            setStatus('error', 'Manual connect failed for ' + walletName + ': ' + errText);
            await postResult({ success: false, error: 'Failed to connect to ' + key + ' (' + walletName + '): ' + errText });
          }
        });
        walletsEl.appendChild(btn);
      });

      // Do NOT auto-connect. 1AM's enable() requires a real user gesture
      // (button click). Auto-calling it after setTimeout yields error code -2.
      setStatus('detecting', 'Click Connect 1AM Wallet to authorize');
    }

    document.getElementById('retryBtn').addEventListener('click', async () => {
      document.getElementById('retryBtn').disabled = true;
      document.getElementById('retryBtn').textContent = 'Reloading...';
      // Full page reload so MV3 content scripts can re-inject after extension activation
      window.location.reload();
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
  const bridgeUrl = `http://localhost:${port}/`;

  // Spawn Chrome in a new window pointing to the bridge.
  // We intentionally use the user's default profile so that installed
  // extensions (1AM, Midnight, Lace, etc.) are already available. The bridge
  // page then filters to 1AM/Midnight only and ignores other wallets.
  const chromeProcess = spawn(chromeCmd, [
    '--new-window',
    '--no-first-run',
    '--no-default-browser-check',
    bridgeUrl,
  ], {
    detached: false,
    stdio: 'ignore',
  });
  console.log('[OneAmChrome] Spawning Chrome pointing to', bridgeUrl);

  // Poll for result with timeout
  const timeoutMs = 120000; // 2 minutes
  const pollInterval = 500;
  const start = Date.now();

  return new Promise((resolve) => {
    const timer = setInterval(() => {
      const result = getResult();
      if (result) {
        clearInterval(timer);
        // Don't kill Chrome — let the user see the "Connected" state
        // Only close the callback server
        server.close();
        resolve(result);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        server.close();
        resolve({ success: false, error: 'Timeout: 1AM Wallet did not connect within 2 minutes. Please make sure the extension is enabled, unlocked, and try clicking Retry on the bridge page.' });
      }
    }, pollInterval);
  });
}
