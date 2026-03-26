#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import http from "http";
import https from "https";
import { privateKeyToAccount } from "viem/accounts";

// =============================================================================
// Wallet Key — read once from env, then delete from process.env
// =============================================================================

const _walletKey = process.env.WALLET_PRIVATE_KEY || "";
delete process.env.WALLET_PRIVATE_KEY;

function getWalletPrivateKey() {
  return _walletKey || null;
}

// =============================================================================
// CLI Args
// =============================================================================

const aimsStoragePath = process.argv[2];
const configStoragePath = process.argv[3];
const mediaStoragePath = process.argv[4] || path.join(process.cwd(), "mosaic-media");

// Ensure media directory exists
if (!fs.existsSync(mediaStoragePath)) {
  fs.mkdirSync(mediaStoragePath, { recursive: true });
}

// =============================================================================
// MCP Server Setup
// =============================================================================

const server = new Server(
  {
    name: "hyperinsight-aims",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// =============================================================================
// Data Helpers
// =============================================================================

function getSavedAims() {
  try {
    if (fs.existsSync(aimsStoragePath)) {
      return JSON.parse(fs.readFileSync(aimsStoragePath, "utf8"));
    }
  } catch (e) {
    console.error("[NM] Failed to read aims config:", e);
  }
  return {};
}

function getNodesConfig() {
  try {
    if (fs.existsSync(configStoragePath)) {
      const config = JSON.parse(fs.readFileSync(configStoragePath, "utf8"));
      return config.nodes || [];
    }
  } catch (e) {
    console.error("[NM] Failed to read node config:", e);
  }
  return [];
}

// =============================================================================
// Protocol-2 Signing Helpers (backend_viem mode, no browser needed)
// =============================================================================

/**
 * Compute sha256 hash of the body string (raw UTF-8, not hex-encoded).
 * Matches the NodeManagerClient signature.ts implementation.
 */
function computeHashedBody(bodyString) {
  return crypto.createHash("sha256").update(bodyString, "utf8").digest("hex");
}

/**
 * Build the signed headers string for Protocol V2:
 * - Include keys starting with "tx-" plus "currency-type"
 * - Exclude "tx-signature" (it's computed AFTER this step)
 * - If hashedBody is provided, include it as "hash-body: <hash>"
 * - Sort lexicographically
 * - Join as "key: value\n..." (space after colon per node manager spec)
 */
function buildSignedHeaders(headers, hashedBody) {
  const entries = [];

  // Include tx-* and currency-type, but exclude tx-signature, tx-id, tx-value from signing
  const excludeFromSigning = ["tx-signature", "tx-id", "tx-value"];
  const keys = Object.keys(headers).filter(
    (k) => (k.startsWith("tx-") || k === "currency-type") && !excludeFromSigning.includes(k)
  );
  for (const k of keys) {
    entries.push([k, headers[k]]);
  }

  // Sort lexicographically by key
  entries.sort((a, b) => a[0].localeCompare(b[0]));

  let result = entries.map(([k, v]) => `${k}: ${v}`).join("\n");

  // Append hash-body AFTER sorted headers (node manager expects it at the end)
  if (hashedBody) {
    result += `\nhash-body: ${hashedBody}`;
  }

  return result;
}

/**
 * Build the Protocol-2 message string to sign.
 * Format: AIM ProtocolV2 Signature:\nMETHOD\nURI_PATH\nSIGNED_HEADERS_STR
 * (hash-body is included within SIGNED_HEADERS_STR, sorted alphabetically)
 */
function buildProtocol2Message({ method, uriPath, signedHeadersStr }) {
  return `AIM ProtocolV2 Signature:\n${method}\n${uriPath}\n${signedHeadersStr}`;
}

// =============================================================================
// Raw HTTP Request (returns status + body)
// =============================================================================

function makeRawRequest(urlStr, method, headers, bodyStr) {
  return new Promise((resolve, reject) => {
    const client = urlStr.startsWith("https://") ? https : http;
    const parsedUrl = new URL(urlStr);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method,
      headers: headers || { "Content-Type": "application/json" },
    };

    const req = client.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        let parsed;
        try {
          if (
            res.headers["content-type"] &&
            res.headers["content-type"].includes("application/json")
          ) {
            parsed = JSON.parse(data);
          } else {
            parsed = { raw: data };
          }
        } catch (e) {
          parsed = { raw: data };
        }
        resolve({ status: res.statusCode, body: parsed, rawText: data });
      });
    });

    req.on("error", reject);

    if (bodyStr && (method === "POST" || method === "PUT")) {
      req.write(bodyStr);
    }
    req.end();
  });
}

// =============================================================================
// SSE Chat Stream Collector
// =============================================================================

/**
 * After a successful /aim/<slot>/request, the node returns { status: "ok", token: "<uuid>" }.
 * We must then POST to /chat with that token to receive the streamed LLM response
 * as Server-Sent Events (SSE): data: {"token": "word"}\n\n ... data: {"done": true}
 *
 * This function collects all streamed tokens and returns the concatenated text.
 */
async function collectChatStream(baseUrl, chatToken, aimSlot = null, timeoutMs = 120000) {
  const bodyStr = JSON.stringify({ token: chatToken });
  const chatPath = aimSlot !== null ? `/aim/${aimSlot}/chat` : "/chat";

  // Build authenticated headers for the chat stream request (node manager requires Protocol V2 auth)
  let authHeaders = {};
  const rawKey = getWalletPrivateKey();
  if (rawKey) {
    const trimmedKey = rawKey.trim();
    const pk = trimmedKey.startsWith("0x") ? trimmedKey : `0x${trimmedKey}`;
    const account = privateKeyToAccount(pk);
    const senderAddress = account.address;
    const currencyType = process.env.NM_CURRENCY_TYPE || "USDC";
    const txDriver = process.env.NM_TX_DRIVER || "ethereum";

    // Fetch fresh nonce for the /chat request
    const nonce = await fetchNonce(baseUrl, senderAddress, currencyType, txDriver);

    const preSignHeaders = {
      "tx-sender": senderAddress,
      "tx-origin": senderAddress,
      "tx-nonce": nonce,
      "tx-protocol": "2",
      "currency-type": currencyType,
      "tx-driver": txDriver,
      "hypc-program": "",
    };

    const hashedBody = computeHashedBody(bodyStr);
    const signedHeadersStr = buildSignedHeaders(preSignHeaders, hashedBody);
    const messageToSign = buildProtocol2Message({
      method: "POST",
      uriPath: chatPath,
      signedHeadersStr,
    });

    const signature = await account.signMessage({ message: messageToSign });
    console.error(`[NM] Chat stream auth: signature length=${signature?.length}`);

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

    console.error(`[NM] Collecting authenticated chat stream from ${baseUrl}${chatPath} with token ${chatToken}`);

    let collectedText = "";
    let finished = false;

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        console.error(`[NM] Chat stream timed out after ${timeoutMs}ms. Collected so far: ${collectedText.length} chars`);
        req.destroy();
        // Return whatever we collected so far rather than failing
        resolve(collectedText || "[Chat stream timed out with no response]");
      }
    }, timeoutMs);

    const req = client.request(options, (res) => {
      console.error(`[NM] Chat stream response status: ${res.statusCode}`);

      if (res.statusCode !== 200) {
        let errData = "";
        res.on("data", (chunk) => { errData += chunk; });
        res.on("end", () => {
          clearTimeout(timer);
          finished = true;
          console.error(`[NM] Chat stream error: ${res.statusCode} — ${errData.slice(0, 200)}`);
          reject(new Error(`Chat stream failed: HTTP ${res.statusCode} — ${errData.slice(0, 200)}`));
        });
        return;
      }

      let buffer = "";
      res.on("data", (chunk) => {
        buffer += chunk.toString();

        // Process complete SSE lines (each ends with \n\n or \n)
        const lines = buffer.split("\n");
        // Keep the last potentially incomplete line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue; // Skip empty lines and SSE comments

          if (trimmed.startsWith("data: ") || trimmed.startsWith("data:")) {
            const dataStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed.slice(5);
            try {
              const parsed = JSON.parse(dataStr);

              // Check for completion signal
              if (parsed.done === true) {
                clearTimeout(timer);
                finished = true;
                console.error(`[NM] Chat stream complete. Collected ${collectedText.length} chars`);
                resolve(collectedText);
                return;
              }

              // Accumulate token text
              if (parsed.token !== undefined) {
                collectedText += parsed.token;
              }
            } catch (parseErr) {
              // Non-JSON SSE line — might be a keepalive or raw text
              console.error(`[NM] Chat stream non-JSON line: ${dataStr.slice(0, 100)}`);
            }
          }
        }
      });

      res.on("end", () => {
        if (!finished) {
          clearTimeout(timer);
          finished = true;
          console.error(`[NM] Chat stream ended. Collected ${collectedText.length} chars`);
          resolve(collectedText || "[Chat stream ended with no content]");
        }
      });

      res.on("error", (err) => {
        if (!finished) {
          clearTimeout(timer);
          finished = true;
          console.error(`[NM] Chat stream error:`, err.message);
          // Return partial content if available
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

// =============================================================================
// Auth Detection
// =============================================================================

/**
 * Returns true if the response indicates authentication/payment is required.
 * Handles:
 *   - HTTP 400 with "invalid nonce" body (missing auth headers)
 *   - HTTP 401 (unauthorized)
 *   - HTTP 402 (payment required)
 * Only checks body text for non-2xx responses to avoid false positives
 * on successful responses that may contain the word "nonce".
 */
function needsAuthentication(status, rawText) {
  if (status === 401 || status === 402) return true;
  // Only check body text on error status codes (4xx/5xx)
  if (status >= 400) {
    const lower = (rawText || "").toLowerCase();
    if (lower.includes("invalid nonce") || lower.includes("unauthorized")) {
      return true;
    }
  }
  return false;
}

// =============================================================================
// Nonce Fetch
// =============================================================================

async function fetchNonce(baseUrl, senderAddress, currencyType = "USDC", txDriver = "ethereum") {
  console.error(`[NM] Fetching nonce from ${baseUrl}/nonce for sender ${senderAddress}`);
  const result = await makeRawRequest(
    `${baseUrl}/nonce`,
    "GET",
    { 
      "sender": senderAddress,
      "tx-sender": senderAddress, 
      "tx-origin": senderAddress,
      "tx-protocol": "2",
      "currency-type": currencyType,
      "tx-driver": txDriver,
      "hypc-program": "",
      "Content-Type": "application/json" 
    },
    null
  );

  if (result.status !== 200) {
    throw new Error(`[NM] Failed to fetch nonce (sender: ${senderAddress}): HTTP ${result.status} — ${result.rawText}`);
  }

  const nonce = result.body?.nonce;
  if (!nonce) {
    throw new Error(`[NM] Nonce response missing 'nonce' field (sender: ${senderAddress}): ${result.rawText}`);
  }
  console.error(`[NM] Nonce received: ${nonce}`);
  return nonce;
}

// =============================================================================
// Authenticated AIM Request (Protocol-2)
// =============================================================================

async function makeAuthenticatedRequest(baseUrl, uriPath, method, args) {
  const rawKey = getWalletPrivateKey();
  if (!rawKey) {
    throw new Error("[NM] WALLET_PRIVATE_KEY not set — cannot sign request. Please configure your wallet in Settings.");
  }

  const trimmedKey = rawKey.trim();
  if (trimmedKey.length < 64) {
    throw new Error(`[NM] WALLET_PRIVATE_KEY is too short (${trimmedKey.length} chars). Check your wallet settings.`);
  }

  const privateKey = trimmedKey.startsWith("0x") ? trimmedKey : `0x${trimmedKey}`;
  const account = privateKeyToAccount(privateKey.trim());
  const senderAddress = account.address;

  console.error(`[NM] Initiating Protocol-2 signed request as ${senderAddress}`);

  // Fetch fresh nonce
  const nonce = await fetchNonce(baseUrl, senderAddress);

  // Build pre-signature headers
  const currencyType = process.env.NM_CURRENCY_TYPE || "USDC";
  const txDriver = process.env.NM_TX_DRIVER || "ethereum";

  const preSignHeaders = {
    "tx-sender": senderAddress,
    "tx-origin": senderAddress,
    "tx-nonce": nonce,
    "tx-protocol": "2",
    "currency-type": currencyType,
    "tx-driver": txDriver,
    "hypc-program": "",
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Build body
  const bodyString = args && Object.keys(args).length > 0 ? JSON.stringify(args) : "";

  // Compute hash & sign
  const hashedBody = computeHashedBody(bodyString);
  const signedHeadersStr = buildSignedHeaders(preSignHeaders, hashedBody);
  const messageToSign = buildProtocol2Message({
    method: method.toUpperCase(),
    uriPath,
    signedHeadersStr,
  });

  console.error(`[NM] Protocol-2 message to sign (first 120 chars): ${messageToSign.slice(0, 120)}`);

  // Sign with viem (personal_sign / eth_sign with Ethereum prefix)
  const signature = await account.signMessage({ message: messageToSign });

  // Debug: log signature details to diagnose node-side IndexError
  console.error(`[NM] Signature generated: length=${signature?.length}, prefix=${signature?.slice(0, 6)}, tail=${signature?.slice(-4)}`);
  if (!signature || signature.length < 130) {
    console.error(`[NM] ⚠️ WARNING: Signature appears malformed or too short! Full value: ${signature}`);
  }

  const finalHeaders = {
    ...preSignHeaders,
    "tx-signature": signature,
  };

  // Explicitly set Content-Length for the body to avoid chunked transfer encoding
  // (some node manager implementations require Content-Length)
  if (bodyString) {
    finalHeaders["Content-Length"] = Buffer.byteLength(bodyString).toString();
  }

  console.error(`[NM] Sending authenticated ${method} ${baseUrl}${uriPath}`);
  console.error(`[NM] Auth headers being sent: ${Object.keys(finalHeaders).filter(k => k.startsWith('tx-') || k === 'currency-type').join(', ')}`);

  const result = await makeRawRequest(
    `${baseUrl}${uriPath}`,
    method.toUpperCase(),
    finalHeaders,
    bodyString || null
  );

  console.error(`[NM] Authenticated response status: ${result.status}`);
  return result;
}

// =============================================================================
// Cost Estimation (cost_only — no auth required)
// =============================================================================

async function fetchCostEstimate(baseUrl, aimIndex, uri, args, currencyType = "USDC", txDriver = "ethereum") {
  const uriPath = `/aim/${aimIndex}${uri}`;
  const fullUrl = `${baseUrl}${uriPath}`;
  const bodyStr = args && Object.keys(args).length > 0 ? JSON.stringify(args) : JSON.stringify({ message: "", priority: 0 });

  console.error(`[NM] Fetching cost estimate (cost_only) for ${fullUrl}`);

  const result = await makeRawRequest(
    fullUrl,
    "POST",
    {
      "Content-Type": "application/json",
      Accept: "application/json",
      "cost_only": "1",
      "cost-only": "1",
      "currency-type": currencyType,
      "tx-driver": txDriver,
      "hypc-program": "",
      "ngrok-skip-browser-warning": "true",
    },
    bodyStr
  );

  console.error(`[NM] Cost estimate response: status=${result.status}, body=${result.rawText.slice(0, 300)}`);

  if (result.status !== 200) {
    console.error(`[NM] Cost estimate failed with status ${result.status}`);
    return null;
  }

  return result.body;
}

// =============================================================================
// Balance Check
// =============================================================================

async function fetchBalance(baseUrl, senderAddress, currencyType = "USDC", txDriver = "ethereum") {
  console.error(`[NM] Fetching balance from ${baseUrl}/balance for ${senderAddress}`);
  const result = await makeRawRequest(
    `${baseUrl}/balance`,
    "GET",
    {
      "tx-sender": senderAddress,
      "tx-origin": senderAddress,
      "currency-type": currencyType,
      "tx-driver": txDriver,
      "hypc-program": "",
      "ngrok-skip-browser-warning": "true",
      "Content-Type": "application/json",
    },
    null
  );

  if (result.status !== 200) {
    console.error(`[NM] Balance check failed: ${result.status}`);
    return null;
  }

  console.error(`[NM] Balance response: ${result.rawText.slice(0, 300)}`);
  return result.body;
}

// =============================================================================
// Node Info Fetch
// =============================================================================

async function fetchNodeInfo(baseUrl) {
  console.error(`[NM] Fetching node /info from ${baseUrl}`);
  const result = await makeRawRequest(`${baseUrl}/info`, "GET", { Accept: "application/json" }, null);
  if (result.status !== 200) {
    console.error(`[NM] Failed to fetch /info: ${result.status}`);
    return null;
  }
  return result.body;
}

// =============================================================================
// 2-Phase Request Dispatcher (with 402 → cost_only → structured payment_required)
// =============================================================================

async function dispatchAimRequest(baseUrl, aimIndex, uri, method, args) {
  const uriPath = `/aim/${aimIndex}${uri}`;
  const fullUrl = `${baseUrl}${uriPath}`;
  const bodyStr = args && Object.keys(args).length > 0 ? JSON.stringify(args) : null;
  const currencyType = process.env.NM_CURRENCY_TYPE || "USDC";
  const txDriver = process.env.NM_TX_DRIVER || "ethereum";

  // --- Phase 1: Try unauthenticated (free endpoints work, paid endpoints will fail) ---
  console.error(`[NM] Phase 1: unauthenticated ${method} ${fullUrl}`);
  const freeResult = await makeRawRequest(
    fullUrl,
    method.toUpperCase(),
    { "Content-Type": "application/json", Accept: "application/json" },
    bodyStr
  );
  console.error(`[NM] Phase 1 status: ${freeResult.status}, body preview: ${freeResult.rawText.slice(0, 200)}`);

  if (!needsAuthentication(freeResult.status, freeResult.rawText)) {
    console.error(`[NM] Phase 1 succeeded (free endpoint)`);
    return { __success: true, data: freeResult.body };
  }

  // --- Phase 2: Endpoint requires auth — sign and retry ---
  console.error(`[NM] Phase 2: endpoint requires authentication (status=${freeResult.status})`);
  const authResult = await makeAuthenticatedRequest(baseUrl, uriPath, method, args || {});

  // Check if authentication succeeded
  if (!needsAuthentication(authResult.status, authResult.rawText)) {
    console.error(`[NM] Phase 2 succeeded (authenticated)`);
    return { __success: true, data: authResult.body };
  }

  // --- Phase 3: 402 Payment Required — estimate cost and return structured result ---
  if (authResult.status === 402) {
    console.error(`[NM] Phase 3: 402 Payment Required — fetching cost estimate and node info`);

    // Fetch cost estimate via cost_only (no auth needed)
    let costData = null;
    let costEstimateFailed = false;
    try {
      costData = await fetchCostEstimate(baseUrl, aimIndex, uri, args, currencyType, txDriver);
    } catch (costErr) {
      console.error(`[NM] cost_only estimation failed: ${costErr.message}. Will fall back to uri_cost from /info.`);
      costEstimateFailed = true;
    }

    // Fetch node info for tm.address (payment destination)
    const nodeInfo = await fetchNodeInfo(baseUrl);

    // If cost_only failed, extract cost from nodeInfo uri_cost as fallback
    if (costEstimateFailed && nodeInfo?.aim?.aims) {
      const aim = nodeInfo.aim.aims.find(a => a.slot === aimIndex);
      if (aim?.uri_cost) {
        const endpointCost = aim.uri_cost[uri] || aim.uri_cost[`/${uri.replace(/^\/+/, '')}`];
        if (endpointCost) {
          // Build a costData-like structure from uri_cost
          costData = {};
          for (const [currency, entry] of Object.entries(endpointCost)) {
            costData[currency] = {
              currency: entry.currency || currency,
              estimated_cost: entry.fixed || 0,
              min: entry.fixed || 0,
              max: entry.fixed || 0,
              used: entry.fixed || 0,
            };
          }
          console.error(`[NM] Using uri_cost fallback: ${JSON.stringify(costData)}`);
        }
      }
    }

    // Derive sender address and check existing balance
    const rawKey = getWalletPrivateKey();
    let senderAddress = null;
    let balanceData = null;
    if (rawKey) {
      const trimmedKey = rawKey.trim();
      const pk = trimmedKey.startsWith("0x") ? trimmedKey : `0x${trimmedKey}`;
      const account = privateKeyToAccount(pk);
      senderAddress = account.address;

      // Check existing balance on the node
      balanceData = await fetchBalance(baseUrl, senderAddress, currencyType, txDriver);
    }

    return {
      __payment_required: true,
      nodeUrl: baseUrl,
      slot: aimIndex,
      actionPath: uri.replace(/^\/+/, ""),
      payload: args || {},
      method,
      costData,
      nodeInfo,
      tmAddress: nodeInfo?.tm?.address || null,
      nodeNetwork: nodeInfo?.tm?.network || "mainnet",
      nodeDriver: nodeInfo?.tm?.driver || txDriver,
      currencyType,
      txDriver,
      senderAddress,
      balanceData,
      costEstimateFailed,
      chainId: parseInt(process.env.NM_CHAIN_ID || "1", 10),
    };
  }

  // Other auth failure
  throw new Error(`[NM] Authentication failed after signing: ${authResult.rawText}`);
}

// =============================================================================
// ListTools Handler
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const aimsData = getSavedAims();
  const nodesConfig = getNodesConfig();
  const tools = [];

  for (const [license, nodeData] of Object.entries(aimsData)) {
    if (!nodeData.aims || !Array.isArray(nodeData.aims)) continue;

    const activeNode = nodesConfig.find(
      (n) => n.licenseKey === license && n.isActive
    );
    if (!activeNode) continue;

    for (let aimIndex = 0; aimIndex < nodeData.aims.length; aimIndex++) {
      const aim = nodeData.aims[aimIndex];
      if (!aim.manifest || !Array.isArray(aim.manifest.endpoints)) continue;

      const shortName =
        aim.manifest.short_name ||
        aim.manifest.name.toLowerCase().replace(/\s+/g, "-");

      for (const endpoint of aim.manifest.endpoints) {
        const toolName = `${shortName}_${endpoint.uri.replace(/[^a-zA-Z0-9]/g, "")}`.substring(0, 64);

        const properties = {};
        if (endpoint.example_calls && endpoint.example_calls.length > 0) {
          const exampleBody = endpoint.example_calls[0].body || {};
          for (const key of Object.keys(exampleBody)) {
            properties[key] = { type: "string" };
          }
        }

        tools.push({
          name: toolName,
          description: `AIM: ${aim.manifest.name}. Endpoint: ${endpoint.uri}. ${endpoint.documentation || ""}`,
          inputSchema: {
            type: "object",
            properties,
            required: [],
          },
          _metadata: {
            license,
            aimIndex,
            uri: endpoint.uri,
            method: Array.isArray(endpoint.methods)
              ? endpoint.methods[0]
              : endpoint.methods || "POST",
          },
        });
      }
    }
  }

  return { tools };
});

// =============================================================================
// CallTool Handler
// =============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const aimsData = getSavedAims();
  const nodesConfig = getNodesConfig();

  // Find the target tool
  let targetTool = null;

  for (const [license, nodeData] of Object.entries(aimsData)) {
    if (!nodeData.aims) continue;
    const activeNode = nodesConfig.find(
      (n) => n.licenseKey === license && n.isActive
    );
    if (!activeNode) continue;

    for (let aimIndex = 0; aimIndex < nodeData.aims.length; aimIndex++) {
      const aim = nodeData.aims[aimIndex];
      if (!aim.manifest) continue;

      const shortName =
        aim.manifest.short_name ||
        aim.manifest.name.toLowerCase().replace(/\s+/g, "-");

      for (const endpoint of aim.manifest.endpoints) {
        const toolName = `${shortName}_${endpoint.uri.replace(/[^a-zA-Z0-9]/g, "")}`.substring(0, 64);
        if (toolName === request.params.name) {
          targetTool = {
            activeNode,
            aimIndex,
            uri: endpoint.uri,
            method: Array.isArray(endpoint.methods)
              ? endpoint.methods[0]
              : endpoint.methods || "POST",
          };
          break;
        }
      }
      if (targetTool) break;
    }
    if (targetTool) break;
  }

  if (!targetTool) {
    throw new Error(`Tool not found: ${request.params.name}`);
  }

  const { activeNode, aimIndex, uri, method } = targetTool;
  const baseUrl = `http://${activeNode.apiHost}:${activeNode.apiPort || "8000"}`;

  try {
    // Dispatch request — handles free, authenticated, and 402 detection with cost estimation
    const dispatchResult = await dispatchAimRequest(baseUrl, aimIndex, uri, method, request.params.arguments);

    // --- Handle 402: return structured payment_required for main process to intercept ---
    if (dispatchResult.__payment_required) {
      console.error(`[NM] Returning __payment_required signal to main process`);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(dispatchResult, null, 2),
          },
        ],
        isError: false, // Not an error — it's a payment request signal
      };
    }

    // --- Success: extract data ---
    let result = dispatchResult.__success ? dispatchResult.data : dispatchResult;

    // Handle token-based streaming responses (e.g. ollama AIM):
    // The /aim/<slot>/request endpoint returns { status: "ok", token: "<uuid>", costs: [...] }
    // We then POST to /chat with that token to collect the SSE-streamed LLM response.
    if (result && typeof result === "object" && result.token && result.status === "ok") {
      console.error(`[NM] AIM returned token: ${result.token}. Collecting chat stream from slot ${aimIndex}...`);
      try {
        const chatText = await collectChatStream(baseUrl, result.token, aimIndex);
        console.error(`[NM] Chat stream collected: ${chatText.length} chars`);
        return {
          content: [
            {
              type: "text",
              text: chatText,
            },
          ],
        };
      } catch (chatErr) {
        console.error(`[NM] Chat stream collection failed:`, chatErr.message);
        // Fall through to return the raw token response so the caller knows what happened
        return {
          content: [
            {
              type: "text",
              text: `AIM request succeeded (token: ${result.token}) but chat stream collection failed: ${chatErr.message}`,
            },
          ],
          isError: true,
        };
      }
    }

    // Handle image responses — write to disk to avoid heap exhaustion
    if (result && typeof result === "object" && result.image) {
      console.error(`[NM] Found image in response, writing to disk...`);
      const base64Data = result.image.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      const fileName = `generated_image_${Date.now()}.png`;
      const filePath = path.join(mediaStoragePath, fileName);
      fs.writeFileSync(filePath, buffer);
      console.error(`[NM] Image written to ${filePath} (${buffer.length} bytes)`);

      return {
        content: [
          {
            type: "text",
            text: `[Image Generated Successfully. Saved locally at: mosaic-media://${fileName}]`,
          },
        ],
      };
    }

    return {
      content: [
        {
          type: "text",
          text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    console.error(`[NM] Tool execution error for ${request.params.name}:`, error.message);
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// =============================================================================
// Start
// =============================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[NM] MCP server started. Wallet configured:", !!getWalletPrivateKey());
}

main().catch(console.error);
