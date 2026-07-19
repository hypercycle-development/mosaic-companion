// ============================================
// EXTERNAL BROWSER BRIDGE — 1AM Wallet
// Electron opens Chrome; wallet connects there
// ============================================
//
// Problem: Browser extensions cannot inject into Electron renderer.
// Solution: Electron opens Chrome with a bridge page. The 1AM extension
// injects into Chrome. After connect, data is relayed back to Electron
// via a localhost HTTP callback.
//
// Flow:
//   1. User clicks "Connect 1AM" in Electron
//   2. Main process starts temp HTTP server + opens Chrome at localhost:PORT/bridge.html
//   3. Bridge page in Chrome detects window.oneam
//   4. User approves connection in 1AM popup
//   5. Bridge page fetches address + balance, POSTs to localhost:PORT/callback
//   6. Main process receives data, shuts down server, resolves IPC
//   7. Electron UI updates with wallet session

import { shell } from "electron";
import http from "http";
import path from "path";
import { URL } from "url";

const BRIDGE_HTML = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Connect 1AM Wallet — MosAIc</title>
<style>
  body{margin:0;padding:0;background:#0f172a;color:#e2e8f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;}
  .card{background:#1e293b;border:1px solid #334155;border-radius:16px;padding:32px;max-width:420px;width:90%;text-align:center;box-shadow:0 10px 40px rgba(0,0,0,.3);}
  .logo{width:64px;height:64px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:16px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;font-size:28px;}
  h1{margin:0 0 8px;font-size:20px;font-weight:600;}
  p{margin:0 0 24px;color:#94a3b8;font-size:14px;line-height:1.5;}
  .btn{background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;padding:12px 28px;color:#fff;font-size:15px;font-weight:600;cursor:pointer;transition:opacity .2s;}
  .btn:hover{opacity:.9;}
  .btn:disabled{opacity:.5;cursor:not-allowed;}
  .status{margin-top:20px;font-size:13px;color:#94a3b8;}
  .success{color:#4ade80;}
  .error{color:#f87171;}
  .network-badge{display:inline-block;background:rgba(99,102,241,.15);color:#818cf8;border:1px solid rgba(99,102,241,.3);border-radius:6px;padding:2px 10px;font-size:12px;margin-top:12px;}
  .address{font-family:monospace;font-size:12px;color:#cbd5e1;background:#0f172a;border-radius:6px;padding:6px 10px;margin-top:8px;word-break:break-all;}
  .token-row{display:flex;justify-content:space-around;margin-top:16px;}
  .token{display:flex;flex-direction:column;align-items:center;}
  .token .label{font-size:11px;color:#64748b;text-transform:uppercase;}
  .token .value{font-size:16px;font-weight:700;color:#e2e8f0;}
  .spinner{border:3px solid rgba(99,102,241,.2);border-top-color:#6366f1;border-radius:50%;width:24px;height:24px;animation:spin 1s linear infinite;margin:0 auto 12px;}
  @keyframes spin{to{transform:rotate(360deg);}}
</style>
</head><body>
<div class="card" id="card">
  <div class="logo">🌙</div>
  <h1>Connect 1AM Wallet</h1>
  <p id="msg">MosAIc needs access to your Midnight Network wallet to manage NIGHT, DUST, and agent identities.</p>
  <button class="btn" id="btn" onclick="connect()">Connect 1AM Wallet</button>
  <div class="status" id="status"></div>
</div>
<script>
  const qs = new URLSearchParams(location.search);
  const PORT = qs.get('port') || '39475';
  let api = null;

  function setStatus(html, cls='') {
    const el = document.getElementById('status');
    el.innerHTML = html;
    el.className = 'status ' + cls;
  }

  function renderDiagnosticReport(report) {
    const card = document.getElementById('card');
    let html = '<div class="logo">' + (report.address ? '✅' : '⚠️') + '</div>' +
      '<h1 class="success">' + (report.address ? 'Wallet Connected' : 'Partially Connected') + '</h1>' +
      '<p>You can close this tab and return to MosAIc.</p>' +
      '<div class="network-badge">' + (report.network || 'unknown') + '</div>' +
      '<div class="address">' + (report.address || 'No address') + '</div>' +
      '<div class="token-row">' +
        '<div class="token"><span class="label">Lovelace</span><span class="value">' + (report.lovelace/1_000_000).toFixed(2) + '</span></div>' +
        '<div class="token"><span class="label">NIGHT</span><span class="value">' + report.night.toLocaleString() + '</span></div>' +
        '<div class="token"><span class="label">DUST</span><span class="value">' + report.dust.toLocaleString() + '</span></div>' +
      '</div>';

    // Diagnostic: show what methods/properties were tried and what was found
    html += '<div style="margin-top:20px;border-top:1px solid #334155;padding-top:12px;text-align:left;">';
    html += '<h3 style="font-size:13px;color:#94a3b8;margin:0 0 8px;">Discovery Report</h3>';
    html += '<pre style="font-size:11px;color:#64748b;white-space:pre-wrap;word-break:break-all;background:#0f172a;border-radius:6px;padding:8px;margin:0;">';
    html += JSON.stringify(report, null, 2);
    html += '</pre>';
    html += '</div>';
    card.innerHTML = html;
  }

  async function tryMethod(obj, names) {
    for (const name of names) {
      if (typeof obj[name] === 'function') {
        try {
          const result = await obj[name]();
          return { found: true, name: name, value: result, error: null };
        } catch(e) {
          return { found: true, name: name, value: null, error: e.message };
        }
      }
    }
    return { found: false, name: null, value: null, error: null };
  }

  async function tryProperty(obj, names) {
    for (const name of names) {
      if (obj[name] !== undefined) {
        return { found: true, name: name, value: obj[name] };
      }
    }
    return { found: false, name: null, value: null };
  }

  async function tryRequest(provider, methods) {
    // EIP-1193 / modern wallet pattern: provider.request({method, params})
    if (typeof provider.request !== 'function') {
      return { found: false, name: null, value: null, error: 'no request() method' };
    }
    for (const name of methods) {
      try {
        const result = await provider.request({ method: name });
        return { found: true, name: 'request:' + name, value: result, error: null };
      } catch(e) {
        // continue to next method name
      }
    }
    return { found: false, name: null, value: null, error: 'all request methods failed' };
  }

  function getAllPropertyNames(obj) {
    const names = new Set();
    let current = obj;
    while (current && current !== Object.prototype) {
      Object.getOwnPropertyNames(current).forEach(n => names.add(n));
      Object.getOwnPropertySymbols(current).forEach(s => names.add(s.toString()));
      current = Object.getPrototypeOf(current);
    }
    return Array.from(names);
  }

  async function connect() {
    const btn = document.getElementById('btn');
    btn.disabled = true;
    setStatus('<div class="spinner"></div>Scanning 1AM Wallet API...');

    let provider = window.oneam || window.midnight || window.cardano?.oneam;
    if (!provider) {
      setStatus('<strong>1AM Wallet not detected</strong><br>Please install the 1AM Wallet extension and refresh this page.', 'error');
      btn.disabled = false;
      btn.textContent = 'Retry';
      return;
    }

    // DEEP INSPECTION: walk prototype chain for non-enumerable + Symbol properties
    const deepNames = getAllPropertyNames(provider);
    const deepMethods = deepNames.filter(k => typeof provider[k] === 'function');
    const deepProps = deepNames.filter(k => typeof provider[k] !== 'function');
    console.log('[1AM Bridge] DEEP names:', deepNames);
    console.log('[1AM Bridge] DEEP methods:', deepMethods);
    console.log('[1AM Bridge] DEEP properties:', deepProps);
    console.log('[1AM Bridge] enumerable keys:', Object.keys(provider));

    setStatus('<div class="spinner"></div>Found ' + deepMethods.length + ' hidden methods...');

    try {
      // --- Step 1: Get API handle ---
      // Try every known pattern using deep inspection
      const connectMethods = ['enable', 'connect', 'authenticate', 'open', 'init', 'start', 'login'];
      const connectResult = await tryMethod(provider, connectMethods);
      api = connectResult.found ? connectResult.value : provider;
      console.log('[1AM Bridge] connect attempt:', connectResult.name || 'none', '→ api type:', typeof api);

      // If api is not an object (maybe a string/bool response), use provider
      if (api && typeof api !== 'object') api = provider;

      const apiMethods = api ? getAllPropertyNames(api).filter(k => typeof api[k] === 'function') : [];
      console.log('[1AM Bridge] api methods (deep):', apiMethods);

      // --- Step 2: Get address (exhaustive search) ---
      let address = null, addrSource = 'none';

      // Try direct methods first (using deep names)
      const addressMethods = ['getUsedAddresses', 'getAddresses', 'getAddress', 'getStakeAddress', 'getPaymentAddress', 'getWalletAddress', 'getAccounts', 'getAccount'];
      const addrMethod = await tryMethod(api || provider, addressMethods);
      if (addrMethod.found && addrMethod.value) {
        addrSource = addrMethod.name;
        if (Array.isArray(addrMethod.value)) {
          address = addrMethod.value[0];
        } else if (typeof addrMethod.value === 'string') {
          address = addrMethod.value;
        } else if (typeof addrMethod.value === 'object' && addrMethod.value.address) {
          address = addrMethod.value.address;
        }
      }

      // Try EIP-1193 request() pattern for address
      if (!address && typeof provider.request === 'function') {
        const reqAddr = await tryRequest(provider, [
          'cardano_getUsedAddresses',
          'cip30_getUsedAddresses',
          'midnight_getAddress',
          'eth_requestAccounts'
        ]);
        if (reqAddr.found && reqAddr.value) {
          addrSource = reqAddr.name;
          if (Array.isArray(reqAddr.value)) {
            address = reqAddr.value[0];
          } else if (typeof reqAddr.value === 'string') {
            address = reqAddr.value;
          } else if (typeof reqAddr.value === 'object' && reqAddr.value.address) {
            address = reqAddr.value.address;
          }
        }
      }

      // Fallback: direct property (deep)
      let addrPropName = null;
      if (!address) {
        const addrProp = await tryProperty(api || provider, ['address', 'stakeAddress', 'paymentAddress', 'walletAddress', 'bech32', 'addr']);
        if (addrProp.found) {
          address = addrProp.value;
          addrPropName = addrProp.name;
          addrSource = addrPropName;
        }
      }
      console.log('[1AM Bridge] address:', address, '(via:', addrSource || 'none', ')');

      // --- Step 3: Get network ---
      const networkMethods = ['getNetworkId', 'getNetwork', 'getChainId', 'getNetworkName', 'network'];
      const netMethod = await tryMethod(api || provider, networkMethods);
      let network = netMethod.found ? netMethod.value : 'unknown';
      let netMethodName = netMethod.name;
      if (!network || typeof network !== 'string') network = String(network);
      console.log('[1AM Bridge] network:', network, '(via:', netMethodName || 'none', ')');

      // --- Step 4: Get balance (exhaustive) ---
      setStatus('<div class="spinner"></div>Fetching balance...', '');
      let lovelace=0, night=0, dust=0, assets=[], rawBalance=null;
      let balMethodName = null, nightMethodName = null, dustMethodName = null;

      // Try EIP-1193 request() for balance first
      if (!rawBalance && typeof provider.request === 'function') {
        const reqBal = await tryRequest(provider, [
          'cardano_getBalance',
          'cip30_getBalance',
          'midnight_getBalance',
          'eth_getBalance'
        ]);
        if (reqBal.found && reqBal.value) {
          balMethodName = reqBal.name;
          rawBalance = reqBal.value;
          console.log('[1AM Bridge] raw balance (request):', rawBalance, '(via:', reqBal.name, ')');
          if (typeof rawBalance === 'string' || typeof rawBalance === 'number') {
            lovelace = Number(rawBalance);
          } else if (rawBalance && typeof rawBalance === 'object') {
            lovelace = rawBalance.lovelace || rawBalance.ada || rawBalance.amount || rawBalance.value || 0;
            assets = rawBalance.tokens || rawBalance.assets || rawBalance.coins || [];
          }
        }
      }

      // Try every known direct balance getter (deep inspection)
      if (!rawBalance) {
        const balanceMethods = ['getBalance', 'getLovelace', 'getAdaBalance', 'getCardanoBalance', 'balance', 'getAssets', 'getUtxos'];
        const balMethod = await tryMethod(api || provider, balanceMethods);
        if (balMethod.found) {
          balMethodName = balMethod.name;
          rawBalance = balMethod.value;
          console.log('[1AM Bridge] raw balance result:', rawBalance, '(via:', balMethod.name, ')');
          if (typeof rawBalance === 'string' || typeof rawBalance === 'number') {
            lovelace = Number(rawBalance);
          } else if (rawBalance && typeof rawBalance === 'object') {
            lovelace = rawBalance.lovelace || rawBalance.ada || rawBalance.amount || rawBalance.value || 0;
            assets = rawBalance.tokens || rawBalance.assets || rawBalance.coins || [];
          }
        }
      }

      // Midnight-specific direct methods (deep)
      const nightMethod = await tryMethod(api || provider, ['getNightBalance', 'nightBalance', 'getNight']);
      if (nightMethod.found) {
        night = Number(nightMethod.value) || 0;
        nightMethodName = nightMethod.name;
      }

      const dustMethod = await tryMethod(api || provider, ['getDustBalance', 'dustBalance', 'getDust']);
      if (dustMethod.found) {
        dust = Number(dustMethod.value) || 0;
        dustMethodName = dustMethod.name;
      }

      // Midnight-specific request() methods
      if (typeof provider.request === 'function' && !night) {
        const reqNight = await tryRequest(provider, ['midnight_getNightBalance', 'cardano_getNightBalance']);
        if (reqNight.found) {
          night = Number(reqNight.value) || 0;
          nightMethodName = reqNight.name;
        }
      }
      if (typeof provider.request === 'function' && !dust) {
        const reqDust = await tryRequest(provider, ['midnight_getDustBalance', 'cardano_getDustBalance']);
        if (reqDust.found) {
          dust = Number(reqDust.value) || 0;
          dustMethodName = reqDust.name;
        }
      }

      console.log('[1AM Bridge] final balance — lovelace:', lovelace, 'night:', night, 'dust:', dust);

      // --- Step 5: Build diagnostic report ---
      const report = {
        address,
        network,
        lovelace,
        night,
        dust,
        assets,
        connected: !!address,
        deepMethods,
        deepProperties: deepProps,
        enumerableKeys: Object.keys(provider),
        connectMethod: connectResult.name,
        addressMethod: addrMethod.name,
        balanceMethod: balMethodName,
        networkMethod: netMethodName,
        nightMethod: nightMethodName,
        dustMethod: dustMethodName,
        rawBalance,
        timestamp: new Date().toISOString()
      };

      // Send back to Electron
      await fetch('http://localhost:'+PORT+'/callback', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify(report)
      });

      renderDiagnosticReport(report);
    } catch(err) {
      console.error('[1AM Bridge] connect error:', err);
      setStatus('<strong>' + (err.message || 'Connection failed') + '</strong><br><small>Check DevTools console for details</small>', 'error');
      btn.disabled = false;
      btn.textContent = 'Retry';
    }
  }

  // Auto-detect on load
  window.addEventListener('DOMContentLoaded', () => {
    const provider = window.oneam || window.midnight;
    if (provider) {
      document.getElementById('msg').textContent = '1AM Wallet detected! Click below to connect.';
    }
  });
</script>
</body></html>
`;

// =====================================================
// SERVER + IPC HANDLER
// =====================================================

let oneAmServer: http.Server | null = null;
let oneAmServerPort = 0;

export function registerOneAmExternalBridge(ipcMain: Electron.IpcMain) {
  ipcMain.handle("oneam:openExternal", async () => {
    return new Promise((resolve, reject) => {
      // Pick a random available port
      const server = http.createServer((req, res) => {
        const url = new URL(req.url || "/", `http://localhost:${oneAmServerPort}`);

        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        // Serve bridge HTML
        if (url.pathname === "/bridge.html" || url.pathname === "/") {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(BRIDGE_HTML.replace(/PORT_PLACEHOLDER/g, String(oneAmServerPort)));
          return;
        }

        // Receive callback from Chrome
        if (url.pathname === "/callback" && req.method === "POST") {
          let body = "";
          req.on("data", (chunk) => (body += chunk));
          req.on("end", () => {
            try {
              const data = JSON.parse(body);
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ ok: true }));

              // Resolve the IPC promise with wallet session
              resolve(data);

              // Shut down server after a brief delay
              setTimeout(() => {
                server.closeAllConnections?.();
                server.close(() => {
                  console.log("[1AM] External bridge server closed");
                });
                oneAmServer = null;
                oneAmServerPort = 0;
              }, 500);
            } catch (e) {
              res.writeHead(400);
              res.end("Bad Request");
            }
          });
          return;
        }

        res.writeHead(404);
        res.end("Not Found");
      });

      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (!addr || typeof addr === "string") {
          reject(new Error("Failed to bind server"));
          return;
        }
        oneAmServerPort = addr.port;
        oneAmServer = server;
        console.log(`[1AM] External bridge server listening on http://127.0.0.1:${oneAmServerPort}`);

        // Open Chrome / default browser with the bridge page
        const bridgeUrl = `http://127.0.0.1:${oneAmServerPort}/bridge.html?port=${oneAmServerPort}`;
        shell.openExternal(bridgeUrl).catch((err) => {
          console.error("[1AM] Failed to open browser:", err);
          reject(err);
        });
      });

      // Timeout after 5 minutes (user might abandon)
      setTimeout(() => {
        if (oneAmServer) {
          oneAmServer.closeAllConnections?.();
          oneAmServer.close();
          oneAmServer = null;
          oneAmServerPort = 0;
          reject(new Error("1AM Wallet connection timed out (5 min). Please try again."));
        }
      }, 300000);
    });
  });
}
