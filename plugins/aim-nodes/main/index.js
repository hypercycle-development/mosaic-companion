import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const AIMS_STORAGE_FILE = 'hyperinsight-aims.json';

// Utility: Get aims storage path
export function getAimsStoragePath() {
  return path.join(app.getPath('userData'), AIMS_STORAGE_FILE);
}

// Utility: Load saved aims
export function loadSavedAims() {
  try {
    const filePath = getAimsStoragePath();
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    }
    return {};
  } catch (error) {
    console.error('[AimNodes] Failed to load saved aims:', error);
    return {};
  }
}

// Utility: Save aims to storage
export function saveAimsToStorage(data) {
  try {
    fs.writeFileSync(getAimsStoragePath(), JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('[AimNodes] Failed to save aims:', error);
    return false;
  }
}

import { pluginManager, mcpClient } from '../../../electron/integrations/mcp/index.js';
import { getWalletKey } from '../../../electron/integrations/web3/index.js';
import { getActiveRpcUrl, loadConfig as loadWeb3Config } from '../../../electron/integrations/web3/config.ts';
import { call_paid_aim } from '../../payments-jit/main/index.ts';
import { BrowserWindow } from 'electron';
import crypto from 'crypto';
import http from 'http';
import https from 'https';
import { privateKeyToAccount } from 'viem/accounts';

// =============================================================================
// SSE Chat Stream Collector (for payment retry path)
// =============================================================================

// Signing helpers for chat stream auth (mirrors mcp-server.js Protocol V2 signing)
function computeHashedBodyChat(bodyString) {
  return crypto.createHash("sha256").update(bodyString, "utf8").digest("hex");
}

function buildSignedHeadersChat(headers, hashedBody) {
  const entries = [];
  const excludeFromSigning = ["tx-signature", "tx-id", "tx-value"];
  const keys = Object.keys(headers).filter(
    (k) => (k.startsWith("tx-") || k === "currency-type") && !excludeFromSigning.includes(k)
  );
  for (const k of keys) entries.push([k, headers[k]]);
  entries.sort((a, b) => a[0].localeCompare(b[0]));
  let result = entries.map(([k, v]) => `${k}: ${v}`).join("\n");
  if (hashedBody) result += `\nhash-body: ${hashedBody}`;
  return result;
}

function buildProtocol2MessageChat({ method, uriPath, signedHeadersStr }) {
  return `AIM ProtocolV2 Signature:\n${method}\n${uriPath}\n${signedHeadersStr}`;
}

async function fetchNonceChat(baseUrl, senderAddress, currencyType, txDriver) {
  const url = `${baseUrl.replace(/\/+$/, '')}/nonce`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'sender': senderAddress,
      'tx-sender': senderAddress,
      'tx-origin': senderAddress,
      'tx-protocol': '2',
      'currency-type': currencyType,
      'tx-driver': txDriver,
      'hypc-program': '',
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch nonce: ${res.status}`);
  const data = await res.json();
  return data.nonce;
}

/**
 * After a paid AIM call succeeds, the node returns { status: "ok", token: "<uuid>" }.
 * We then POST to /aim/<slot>/chat with that token (authenticated) to collect the SSE-streamed LLM response.
 */
async function collectChatStream(baseUrl, chatToken, aimSlot = null, timeoutMs = 120000) {
  const bodyStr = JSON.stringify({ token: chatToken });
  const chatPath = aimSlot !== null ? `/aim/${aimSlot}/chat` : "/chat";

  // Build authenticated headers for the chat stream request
  let authHeaders = {};
  const rawKey = getWalletKey();
  if (rawKey) {
    const trimmedKey = rawKey.trim();
    const pk = trimmedKey.startsWith("0x") ? trimmedKey : `0x${trimmedKey}`;
    const account = privateKeyToAccount(pk);
    const senderAddress = account.address;
    const currencyType = process.env.NM_CURRENCY_TYPE || "USDC";
    const txDriver = process.env.NM_TX_DRIVER || "ethereum";

    const nonce = await fetchNonceChat(baseUrl, senderAddress, currencyType, txDriver);
    console.log(`[AimNodes:Chat] Nonce for chat stream: ${nonce}`);

    const preSignHeaders = {
      "tx-sender": senderAddress,
      "tx-origin": senderAddress,
      "tx-nonce": nonce,
      "tx-protocol": "2",
      "currency-type": currencyType,
      "tx-driver": txDriver,
      "hypc-program": "",
    };

    const hashedBody = computeHashedBodyChat(bodyStr);
    const signedHeadersStr = buildSignedHeadersChat(preSignHeaders, hashedBody);
    const messageToSign = buildProtocol2MessageChat({
      method: "POST",
      uriPath: chatPath,
      signedHeadersStr,
    });

    const signature = await account.signMessage({ message: messageToSign });
    console.log(`[AimNodes:Chat] Signature for chat stream: length=${signature?.length}`);

    authHeaders = {
      ...preSignHeaders,
      "tx-signature": signature,
    };
  }

  return new Promise((resolve, reject) => {
    const client = baseUrl.startsWith("https://") ? https : http;
    const parsedUrl = new URL(baseUrl);

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: chatPath,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
        "Content-Length": Buffer.byteLength(bodyStr),
        ...authHeaders,
      },
    };

    console.log(`[AimNodes:Chat] Collecting authenticated chat stream from ${baseUrl}${chatPath} with token ${chatToken}`);

    let collectedText = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        console.log(`[AimNodes:Chat] Stream timed out after ${timeoutMs}ms. Collected: ${collectedText.length} chars`);
        req.destroy();
        resolve(collectedText || "[Chat stream timed out]");
      }
    }, timeoutMs);

    const req = client.request(options, (res) => {
      console.log(`[AimNodes:Chat] Stream response status: ${res.statusCode}`);

      if (res.statusCode !== 200) {
        let errData = "";
        res.on("data", (chunk) => { errData += chunk; });
        res.on("end", () => {
          clearTimeout(timer);
          finished = true;
          reject(new Error(`Chat stream failed: HTTP ${res.statusCode} — ${errData.slice(0, 200)}`));
        });
        return;
      }

      let buffer = "";
      res.on("data", (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          if (trimmed.startsWith("data: ") || trimmed.startsWith("data:")) {
            const dataStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed.slice(5);
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.done === true) {
                clearTimeout(timer);
                finished = true;
                console.log(`[AimNodes:Chat] Stream complete. Collected ${collectedText.length} chars`);
                resolve(collectedText);
                return;
              }
              if (parsed.token !== undefined) {
                collectedText += parsed.token;
              }
            } catch (_) {
              // Non-JSON SSE line
            }
          }
        }
      });

      res.on("end", () => {
        if (!finished) {
          clearTimeout(timer);
          finished = true;
          resolve(collectedText || "[Chat stream ended with no content]");
        }
      });

      res.on("error", (err) => {
        if (!finished) {
          clearTimeout(timer);
          finished = true;
          resolve(collectedText || `[Chat stream error: ${err.message}]`);
        }
      });
    });

    req.on("error", (err) => {
      if (!finished) {
        clearTimeout(timer);
        finished = true;
        reject(err);
      }
    });

    req.write(bodyStr);
    req.end();
  });
}

// Exported Registration Function
export function registerAimNodesIpc(ipcMain) {
  // Auto-register MCP Adapter
  const adapterName = 'HyperInsight-AIMs';
  const existing = pluginManager.list().find(p => p.name === adapterName);
  const configPath = path.join(app.getPath('userData'), 'app-settings.json');
  const mediaStoragePath = path.join(app.getPath('userData'), 'mosaic-media');
  const serverArgs = [path.join(__dirname, 'mcp-server.js'), getAimsStoragePath(), configPath, mediaStoragePath];
  
  // Read wallet private key from safeStorage (only accessible in main process)
  // Pass it to the child process via env so mcp-server.js can sign NM requests
  const walletKey = getWalletKey() || '';

  const mcpEnv = {
    ELECTRON_RUN_AS_NODE: '1',
    ...(walletKey ? { WALLET_PRIVATE_KEY: walletKey } : {}),
    // Chain configuration for JIT payment orchestrator
    NM_CHAIN_ID: process.env.NM_CHAIN_ID || '1', // Default: ETH mainnet; auto-detected from node /info
    ...(process.env.NM_RPC_URL ? { NM_RPC_URL: process.env.NM_RPC_URL } : {}),
    ...(process.env.NM_CURRENCY_TYPE ? { NM_CURRENCY_TYPE: process.env.NM_CURRENCY_TYPE } : {}),
    ...(process.env.NM_TX_DRIVER ? { NM_TX_DRIVER: process.env.NM_TX_DRIVER } : {}),
  };

  if (!existing) {
    pluginManager.add({
      name: adapterName,
      description: 'Automatically discovered AIM tools from connected HyperInsight nodes',
      transport: 'stdio',
      command: process.execPath, // Node executable (or electron run as node)
      args: serverArgs,
      env: mcpEnv,
      autoConnect: true
    });
  } else {
    // Ensure args and env are up to date (key may have changed since last launch)
    pluginManager.update(existing.id, { args: serverArgs, env: mcpEnv });
  }

  // Node Data Storage (Local)
  ipcMain.handle('aimnodes:save-node-data', async (event, license, data) => {
    try {
      const savedData = loadSavedAims();
      savedData[license] = {
        updatedAt: new Date().toISOString(),
        aims: data.aims,
        info: data.info
      };
      saveAimsToStorage(savedData);
      console.log(`[AimNodes] Saved data for node ${license}`);
      
      // We will also trigger the MCP Server to reload tools if needed.
      // Or simply let the MCP Server read from the file dynamically.
      return { success: true };
    } catch (e) {
      console.error('[AimNodes] Failed to save node data:', e);
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('aimnodes:delete-node-data', async (event, license) => {
    try {
      const savedData = loadSavedAims();
      if (savedData[license]) {
        delete savedData[license];
        saveAimsToStorage(savedData);
        console.log(`[AimNodes] Deleted data for node ${license}`);
      }
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('aimnodes:get-saved-aims', async (event, license) => {
    try {
      const savedData = loadSavedAims();
      if (license) {
        return savedData[license] || null;
      }
      return savedData;
    } catch (e) {
      return { error: e.message };
    }
  });

  // =========================================================================
  // Payment Interception Handler
  // When MCP tool returns __payment_required, the renderer calls this handler.
  // Main process shows the approval modal, executes payment if approved,
  // then retries the original tool call.
  // =========================================================================

  ipcMain.handle('aimnodes:handle-payment', async (event, paymentData) => {
    try {
      console.log('[AimNodes:Payment] Received __payment_required signal:', JSON.stringify(paymentData).slice(0, 200));

      // Extract cost information from the cost_only response
      // The costData can be in multiple formats:
      //   Format A (flat object): { "HyPC": { "estimated_cost": 3556315, ... }, "USDC": { ... } }
      //   Format B (costs array): { "costs": [{ "currency": "USDC", "estimated_cost": 20000 }] }
      const costData = paymentData.costData;
      const currency = paymentData.currencyType || 'USDC';
      let estimatedCostDisplay = 'Unknown';
      let estimatedCostBaseUnits = '0';

      // Source 1 (Primary): uri_cost from nodeInfo — most reliable, gives fixed cost per endpoint per currency.
      // Nodes may use the endpoint path ("/request") OR the catch-all key "default" in uri_cost.
      let costValue = 0;

      if (paymentData.nodeInfo?.aim?.aims) {
        const aim = paymentData.nodeInfo.aim.aims.find(a => a.slot === paymentData.slot);
        if (aim?.uri_cost) {
          // Try endpoint-specific key first (with/without leading slash), then "default" catch-all
          const endpointCost = aim.uri_cost[`/${paymentData.actionPath}`]
            || aim.uri_cost[paymentData.actionPath]
            || aim.uri_cost['default'];

          if (endpointCost) {
            // Case-insensitive currency key lookup — find "USDC" even if stored as "usdc"
            const matchKey = Object.keys(endpointCost).find(k => k.toLowerCase() === currency.toLowerCase());
            const uriEntry = matchKey ? endpointCost[matchKey] : null;
            if (uriEntry) {
              costValue = uriEntry.fixed || uriEntry.estimated_cost || 0;
              // foundCurrency stays as the requested `currency` — don't trust node's embedded string
            }
          }
        }
      }

      // Source 2: cost_only response data (costData) — only used if Source 1 found nothing.
      // IMPORTANT: Only look up the requested currency. Never fall back to a different currency's
      // base units (HyPC and USDC have different decimals, making the numbers meaningless across currencies).
      if (costValue === 0 && costData) {
        // Format A: flat object keyed by currency name (case-insensitive lookup)
        const directKey = Object.keys(costData).find(k => k.toLowerCase() === currency.toLowerCase());
        const directEntry = directKey ? costData[directKey] : null;
        if (directEntry && typeof directEntry === 'object' && !Array.isArray(directEntry)) {
          costValue = directEntry.estimated_cost || directEntry.max || directEntry.used || directEntry.fixed || 0;
        }

        // Format B: costs array — match only the requested currency
        if (costValue === 0 && Array.isArray(costData.costs)) {
          const costEntry = costData.costs.find(c => c.currency?.toLowerCase() === currency.toLowerCase());
          if (costEntry) {
            costValue = costEntry.estimated_cost || costEntry.max || costEntry.used || 0;
          }
        }
      }

      if (costValue > 0) {
        estimatedCostBaseUnits = String(costValue);
        // Always use the REQUESTED currency's decimals — never derive decimals from a fallback currency
        const decimals = currency === 'USDC' ? 6 : 18;
        const costNum = Number(costValue) / Math.pow(10, decimals);
        // Amount is a plain number — the modal's `token` field already displays the currency symbol
        estimatedCostDisplay = costNum.toFixed(decimals > 6 ? 4 : 6);
      }

      console.log(`[AimNodes:Payment] Estimated cost: ${estimatedCostDisplay} (${estimatedCostBaseUnits} base units)`);

      // Check the web3 safety config — "Require user confirmation for payments" toggle
      let approved = false;
      const web3SafetyConfig = loadWeb3Config().safety;
      const requireConfirmation = web3SafetyConfig.requireConfirmation ?? true;

      if (!requireConfirmation) {
        // Auto-approve: user has disabled the confirmation modal
        console.log('[AimNodes:Payment] requireConfirmation=false — auto-approving payment.');
        approved = true;
      } else {
        // Show approval modal via IPC to renderer
        const requestId = crypto.randomUUID();
        const mainWin = BrowserWindow.getAllWindows()[0];

        if (!mainWin || mainWin.isDestroyed()) {
          return { success: false, error: 'No active window to show approval modal.' };
        }

        // Send approval request to renderer (TransactionApprovalModal listens for this)
        const approvalPromise = new Promise((resolve) => {
          if (!(global).__paymentJitResolvers) {
            (global).__paymentJitResolvers = {};
          }
          (global).__paymentJitResolvers[requestId] = resolve;

          // Timeout after 2 minutes
          setTimeout(() => {
            if ((global).__paymentJitResolvers?.[requestId]) {
              (global).__paymentJitResolvers[requestId](false);
              delete (global).__paymentJitResolvers[requestId];
            }
          }, 120000);
        });

        mainWin.webContents.send('payments-jit:request_approval', {
          requestId,
          nodeUrl: paymentData.nodeUrl,
          to: paymentData.tmAddress || 'Unknown',
          token: paymentData.currencyType || 'USDC',
          amount: estimatedCostDisplay,
          chainId: paymentData.chainId || 1,
          reason: `AIM tool call requires payment. Endpoint: /aim/${paymentData.slot}/${paymentData.actionPath}`,
          policySnapshot: `Estimated: ${estimatedCostDisplay} ${currency}`,
          warning: paymentData.costEstimateFailed 
            ? 'Cost estimate could not be retrieved from the AIM. The displayed cost is based on the node\'s advertised fixed price.' 
            : undefined,
        });

        console.log(`[AimNodes:Payment] Approval modal sent to renderer (requestId: ${requestId})`);

        // Wait for user approval
        approved = await approvalPromise;
      }

      if (!approved) {
        console.log('[AimNodes:Payment] User rejected the payment.');
        return { 
          success: false, 
          error: 'Payment rejected by user.',
          result: {
            content: [{ type: 'text', text: `Payment of ${estimatedCostDisplay} ${currency} was rejected by the user. The AIM tool call was not executed.` }],
            isError: true,
          }
        };
      }

      console.log('[AimNodes:Payment] User approved payment. Executing JIT top-up...');

      // Execute payment via JIT orchestrator (runs in main process with full viem access)
      const walletKey = getWalletKey();
      if (!walletKey) {
        return { success: false, error: 'No wallet key configured. Cannot execute payment.' };
      }

      const pk = walletKey.startsWith('0x') ? walletKey : `0x${walletKey}`;

      // Get RPC URL from Web3 config (uses the user's configured ETH mainnet RPC)
      let rpcUrl;
      try {
        rpcUrl = getActiveRpcUrl();
        console.log(`[AimNodes:Payment] Using RPC URL: ${rpcUrl}`);
      } catch (e) {
        console.log('[AimNodes:Payment] Could not get RPC URL from config, using default');
      }

      const result = await call_paid_aim({
        nodeUrl: paymentData.nodeUrl,
        slot: paymentData.slot,
        actionPath: paymentData.actionPath,
        payload: paymentData.payload,
        privateKey: pk,
        chainId: paymentData.chainId || 1,
        rpcUrl,
        currencyType: paymentData.currencyType || 'USDC',
        txDriver: paymentData.txDriver || 'ethereum',
        // Pass the pre-computed USDC cost from uri_cost so the orchestrator uses the correct amount
        costOverrideBaseUnits: estimatedCostBaseUnits !== '0' ? estimatedCostBaseUnits : undefined,
      });

      console.log('[AimNodes:Payment] JIT payment + retry succeeded!');

      // Check if the AIM returned a streaming token response (e.g. ollama AIM):
      // { status: "ok", token: "<uuid>", costs: [...] }
      // If so, collect the SSE chat stream. Otherwise return the result directly
      // (handles direct text, base64 images, JSON responses from non-streaming AIMs).
      let finalText;
      if (result && typeof result === 'object' && result.token && result.status === 'ok') {
        console.log(`[AimNodes:Payment] AIM returned streaming token: ${result.token}. Collecting chat stream from slot ${paymentData.slot}...`);
        try {
          const chatText = await collectChatStream(paymentData.nodeUrl, result.token, paymentData.slot);
          console.log(`[AimNodes:Payment] Chat stream collected: ${chatText.length} chars`);
          finalText = chatText;
        } catch (chatErr) {
          console.error(`[AimNodes:Payment] Chat stream collection failed:`, chatErr.message);
          finalText = `AIM request succeeded (token: ${result.token}) but chat stream failed: ${chatErr.message}`;
        }
      } else if (result && typeof result === 'object' && result.image) {
        // Image response (e.g. lightning AIM /generate) — save to disk instead of passing base64 to AI
        console.log(`[AimNodes:Payment] Image detected in response, saving to disk...`);
        const base64Data = result.image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `generated_image_${Date.now()}.png`;
        const imgMediaPath = path.join(app.getPath('userData'), 'mosaic-media');
        if (!fs.existsSync(imgMediaPath)) fs.mkdirSync(imgMediaPath, { recursive: true });
        const filePath = path.join(imgMediaPath, fileName);
        fs.writeFileSync(filePath, buffer);
        console.log(`[AimNodes:Payment] Image saved to ${filePath} (${buffer.length} bytes)`);
        finalText = `[Image Generated Successfully. Saved locally at: mosaic-media://${fileName}]`;
      } else {
        finalText = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      }

      return {
        success: true,
        result: {
          content: [{ 
            type: 'text', 
            text: finalText,
          }],
          isError: false,
        }
      };

    } catch (error) {
      console.error('[AimNodes:Payment] Payment handler error:', error.message);
      return { 
        success: false, 
        error: error.message,
        result: {
          content: [{ type: 'text', text: `Payment failed: ${error.message}` }],
          isError: true,
        }
      };
    }
  });
}
