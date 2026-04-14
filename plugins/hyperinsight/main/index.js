import { safeStorage, app } from 'electron';
import path from 'path';
import fs from 'fs';

const API_BASE_URL = 'https://api.hyperinsight.app/v1';
const STORAGE_FILE = 'hyperinsight.json';

// --- Score cache (Stage 7C) ---
const TOOL_SCORES_PATH = path.join(app.getPath('userData'), 'hyperinsight-tool-scores.json');
const POLL_INTERVAL_MS = 60 * 1000; // 60 seconds
let _pollIntervalId = null;
// Utility: Get storage path
function getStoragePath() {
  return path.join(app.getPath('userData'), STORAGE_FILE);
}

// Utility: Load key data
function loadKeyData() {
  try {
    const filePath = getStoragePath();
    
    // File doesn't exist? Return null so ensure-key triggers registration.
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    if (data.apiKeyEncB64 && safeStorage.isEncryptionAvailable()) {
      const encryptedBuffer = Buffer.from(data.apiKeyEncB64, 'base64');
      const decrypted = safeStorage.decryptString(encryptedBuffer);
      return { ...data, apiKey: decrypted };
    }
    return null;
  } catch (error) {
    console.error('[HyperInsight] Failed to load key:', error);
    return null;
  }
}

// Utility: Save key data
function saveKeyData(clientId, apiKey, tier) {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available');
    }
    
    const encrypted = safeStorage.encryptString(apiKey);
    const data = {
      clientId,
      apiKeyEncB64: encrypted.toString('base64'),
      tier,
      createdAt: new Date().toISOString(),
      lastValidatedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(getStoragePath(), JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('[HyperInsight] Failed to save key:', error);
    return false;
  }
}

// Helper: Make API request
async function apiRequest(endpoint, method = 'GET', body = null, apiKey = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  
  const options = {
    method,
    headers,
  };
  
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  
  return await response.json();
}

// --- Stage 7C: Background score polling ---

async function fetchAndWriteToolScores() {
  const data = loadKeyData();
  if (!data?.apiKey) return; // not registered yet — skip silently

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`${API_BASE_URL}/tools/scores`, {
      headers: { Authorization: `Bearer ${data.apiKey}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();

    // Transform to flat endpointUrl → score map
    const scoreMap = {};
    for (const tool of (body.data?.tools ?? body.tools ?? [])) {
      if (tool.endpointUrl) {
        scoreMap[tool.endpointUrl] = {
          compositeScore:      tool.compositeScore      ?? null,
          healthScore:         tool.healthScore         ?? null,
          latencyScore:        tool.latencyScore        ?? null,
          uptimeScore:         tool.uptimeScore         ?? null,
          pollTier:            tool.pollTier            ?? null,
          lastProbedAt:        tool.lastProbedAt        ?? null,
          consecutiveFailures: tool.consecutiveFailures ?? 0,
          status:              tool.status              ?? null,
          manifestVersion:     tool.manifestVersion     ?? null,
          releaseTagName:      tool.releaseTagName      ?? null,
          measuredUptime7d:    tool.measuredUptime7d    ?? null,
          updatedAt:           new Date().toISOString(),
        };
      }
    }

    // Atomic write: temp file → rename (prevents partial reads by mcp-server)
    const tmpPath = TOOL_SCORES_PATH + '.tmp';
    await fs.promises.writeFile(tmpPath, JSON.stringify(scoreMap, null, 2));
    await fs.promises.rename(tmpPath, TOOL_SCORES_PATH);
    console.log('[HyperInsight] Tool scores updated:', Object.keys(scoreMap).length, 'endpoints');
  } catch (err) {
    clearTimeout(timeout);
    console.error('[HyperInsight] Tool score poll failed (non-fatal):', err.message);
  }
}

function startScorePolling() {
  fetchAndWriteToolScores().catch(console.error); // fire-and-forget on startup
  _pollIntervalId = setInterval(() => {
    fetchAndWriteToolScores().catch(console.error);
  }, POLL_INTERVAL_MS);
}

// Exported Registration Function
export function registerHyperInsightIpc(ipcMain) {
  
  // 1. Get Status
  ipcMain.handle('hyperinsight:get-status', async () => {
    const data = loadKeyData();
    if (data) {
      return { registered: true, tier: data.tier, clientId: data.clientId };
    }
    return { registered: false };
  });

  // 2. Ensure Key (Register if missing)
  ipcMain.handle('hyperinsight:ensure-key', async () => {
    let data = loadKeyData();
    if (data) {
      console.log(`[HyperInsight] Loaded existing client: ${data.clientId}`);
      return { success: true, clientId: data.clientId };
    }

    // Register new key
    try {
      console.log('[HyperInsight] Registering new client...');
      const regData = await apiRequest('/auth/register-client', 'POST', {
        clientName: `Mosaic-${process.platform}`,
        appVersion: app.getVersion() || '1.0.0'
      });
      
      if (regData.apiKey) {
        saveKeyData(regData.clientId, regData.apiKey, regData.tier);
        console.log(`[HyperInsight] Registration successful! Client ID: ${regData.clientId}`);
        return { success: true, clientId: regData.clientId };
      }
      return { success: false, error: 'No API key returned' };
    } catch (error) {
      console.error('[HyperInsight] Registration failed:', error);
      return { success: false, error: error.message };
    }
  });

  // 3. Reset Key
  ipcMain.handle('hyperinsight:reset-key', async () => {
    try {
      const filePath = getStoragePath();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 4. Data Fetching
  const handleDataRequest = async (endpoint, method = 'GET', body = null) => {
    const data = loadKeyData();
    if (!data || !data.apiKey) {
      throw new Error('Not registered');
    }
    return await apiRequest(endpoint, method, body, data.apiKey);
  };

  ipcMain.handle('hyperinsight:get-aims', async () => {
    try {
      return await handleDataRequest('/aims/list');
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-leaderboard', async () => {
    try {
      return await handleDataRequest('/aims/leaderboard?includeTrend=true');
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-nodes', async (event, params) => {
    try {
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return await handleDataRequest(`/nodes${queryString}`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-node-detail', async (event, license) => {
    try {
      return await handleDataRequest(`/nodes/${license}`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-node-profile', async (event, license) => {
    try {
      return await handleDataRequest(`/nodes/${license}/profile`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-node-aim-manifest', async (event, license, aimName) => {
    try {
      return await handleDataRequest(`/nodes/${license}/aims/manifest?aimName=${encodeURIComponent(aimName)}`);
    } catch (e) { return { error: e.message }; }
  });
  
  // Add support for network stats if needed
  ipcMain.handle('hyperinsight:get-network-stats', async () => {
    try {
      return await handleDataRequest('/aims/network-stats');
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-network-history', async () => {
    try {
      return await handleDataRequest('/aims/network-history');
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-aim-stats', async (event, name, range) => {
    try {
      // Use query parameters for stats as per backend controller definition
      return await handleDataRequest(`/aims/stats?name=${encodeURIComponent(name)}&range=${range || '1d'}`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-aim-stats-current', async (event, name) => {
    try {
      // Use query parameters for current stats as per backend controller definition
      return await handleDataRequest(`/aims/stats/current?name=${encodeURIComponent(name)}`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-aim-details', async (event, name) => {
    try {
      return await handleDataRequest(`/aims/${name}`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-aim-releases', async (event, name) => {
    try {
      // Split by slash to handle namespaces (user/repo) correctly without encoding the separator
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await handleDataRequest(`/aims/${pathSafeName}/releases`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-aim-release-detail', async (event, name, tag) => {
    try {
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await handleDataRequest(`/aims/${pathSafeName}/releases/${encodeURIComponent(tag)}`);
    } catch (e) { return { error: e.message }; }
  });

  // --- Stage 8A: AIM Profile endpoints ---

  ipcMain.handle('hyperinsight:get-aim-profile', async (event, name) => {
    try {
      const pathSafeName = name.split('/').map(p => encodeURIComponent(p)).join('/');
      return await handleDataRequest(`/aims/${pathSafeName}/profile`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-aim-nodes', async (event, name, opts = {}) => {
    try {
      const pathSafeName = name.split('/').map(p => encodeURIComponent(p)).join('/');
      const params = new URLSearchParams();
      if (opts.version)         params.set('version', opts.version);
      if (opts.userLat != null) params.set('user_lat', String(opts.userLat));
      if (opts.userLng != null) params.set('user_lng', String(opts.userLng));
      const qs = params.toString() ? `?${params}` : '';
      return await handleDataRequest(`/aims/${pathSafeName}/nodes${qs}`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-aim-best-node', async (event, name, opts = {}) => {
    try {
      const pathSafeName = name.split('/').map(p => encodeURIComponent(p)).join('/');
      const params = new URLSearchParams();
      if (opts.version)         params.set('version', opts.version);
      if (opts.userLat != null) params.set('user_lat', String(opts.userLat));
      if (opts.userLng != null) params.set('user_lng', String(opts.userLng));
      const qs = params.toString() ? `?${params}` : '';
      return await handleDataRequest(`/aims/${pathSafeName}/best-node${qs}`);
    } catch (e) { return { error: e.message }; }
  });

  // --- Stage 8B: New endpoint handlers ---

  ipcMain.handle('hyperinsight:get-aim-deployments', async (event, aimId) => {
    try {
      return await handleDataRequest(`/tools/${aimId}/deployments`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-tool-status', async (event, toolId) => {
    try {
      return await handleDataRequest(`/tools/${toolId}/status`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:subscribe', async (event, payload) => {
    try {
      return await handleDataRequest('/subscriptions', 'POST', payload);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-subscriptions', async () => {
    try {
      return await handleDataRequest('/subscriptions');
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:unsubscribe', async (event, subscriptionId) => {
    try {
      return await handleDataRequest(`/subscriptions/${subscriptionId}`, 'DELETE');
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-verification-history', async (event, subscriptionId) => {
    try {
      return await handleDataRequest(`/subscriptions/${subscriptionId}/verifications`);
    } catch (e) { return { error: e.message }; }
  });

  // --- Stage 7C: Score cache IPC handlers ---

  ipcMain.handle('hyperinsight:get-tool-score', async (_event, endpointUrl) => {
    try {
      const raw = await fs.promises.readFile(TOOL_SCORES_PATH, 'utf8');
      return JSON.parse(raw)[endpointUrl] ?? null;
    } catch { return null; }
  });

  ipcMain.handle('hyperinsight:get-all-tool-scores', async () => {
    try {
      const raw = await fs.promises.readFile(TOOL_SCORES_PATH, 'utf8');
      return JSON.parse(raw);
    } catch { return null; }
  });

  ipcMain.handle('hyperinsight:get-tool-scores-last-updated', async () => {
    try {
      const stat = await fs.promises.stat(TOOL_SCORES_PATH);
      return stat.mtime.toISOString();
    } catch { return null; }
  });

  // Save generated image from base64
  ipcMain.handle('hyperinsight:save-generated-image', async (event, base64Data) => {
    try {
      const generatedImagesPath = path.join(app.getPath('userData'), 'generated_images');
      // Ensure directory exists (redundant if main.js created it, but safe)
      if (!fs.existsSync(generatedImagesPath)) {
        fs.mkdirSync(generatedImagesPath, { recursive: true });
      }

      // Remove header if present (e.g., "data:image/png;base64,")
      const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Image, 'base64');
      
      const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
      const filePath = path.join(generatedImagesPath, filename);
      
      console.log(`[HyperInsight] Saved generated image to: ${filePath}`);
      fs.writeFileSync(filePath, buffer);
      
      // Return custom protocol URL so browser can render it safely
      return { success: true, url: `mosaic-media://${filename}` };
    } catch (error) {
      console.error('[HyperInsight] Failed to save image:', error);
      return { success: false, error: error.message };
    }
  });

  // Start background polling after all handlers are registered (key guaranteed available)
  startScorePolling();

}
