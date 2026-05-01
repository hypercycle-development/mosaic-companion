import { safeStorage, app } from 'electron';
import path from 'path';
import fs from 'fs';

const API_BASE_URL = 'https://api.hyperinsight.app/v1';
const STORAGE_FILE = 'hyperinsight.json';

// ============================================================================
// ENTERPRISE KEY SUPPORT — Provided keyed access for HPEC DAO
// ============================================================================
// When this is set, the plugin uses the provided key directly (enterprise tier).
// Otherwise, it falls back to the self-registration flow.
const HYPERINSIGHT_PROVIDED_KEY = 'wq2YvVU4SXPekQzAKJfmDJ4cdSV0yquHEihaY3vMYwk';

// Utility: Get storage path
function getStoragePath() {
  return path.join(app.getPath('userData'), STORAGE_FILE);
}

// Utility: Load key data
function loadKeyData() {
  try {
    const filePath = getStoragePath();
    if (!fs.existsSync(filePath)) return null;
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

// ============================================================================
// API REQUEST HELPER
// ============================================================================
async function apiRequest(endpoint, method = 'GET', body = null, apiKey = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const options = { method, headers };
  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    throw new Error(`HyperInsight API error: ${response.status} ${errorText}`);
  }

  // Response envelope: { data, meta, pagination? }
  const responseBody = await response.json();
  return responseBody; // Return full envelope; caller extracts .data
}

// ============================================================================
// REGISTERED IPC
// ============================================================================
export function registerHyperInsightIpc(ipcMain) {

  // 1. Get Status
  ipcMain.handle('hyperinsight:get-status', async () => {
    // Check if we have a provided enterprise key loaded
    if (HYPERINSIGHT_PROVIDED_KEY) {
      try {
        const me = await apiRequest('/auth/me', 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
        if (me.data) {
          return {
            registered: true,
            tier: me.data.tier || 'enterprise',
            clientId: me.data.clientId || 'provided',
            rpmRemaining: me.data.rpmRemaining,
            dailyRemaining: me.data.dailyRemaining
          };
        }
        return { registered: false, error: me.error || 'Invalid key' };
      } catch (e) {
        console.error('[HyperInsight] Provided key validation failed:', e.message);
        return { registered: false, error: e.message };
      }
    }

    // Otherwise check stored key
    const data = loadKeyData();
    if (data) {
      return { registered: true, tier: data.tier, clientId: data.clientId };
    }
    return { registered: false };
  });

  // 2. Ensure Key (Use provided key, then register if needed)
  ipcMain.handle('hyperinsight:ensure-key', async () => {
    // Priority 1: Use provided enterprise key directly
    if (HYPERINSIGHT_PROVIDED_KEY) {
      try {
        const me = await apiRequest('/auth/me', 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
        const tier = me.data?.tier || me.tier;
        const clientId = me.data?.clientId || me.clientId;
        if (tier) {
          console.log(`[HyperInsight] Using provided enterprise key (Tier: ${tier})`);
          saveKeyData(clientId || 'provided', HYPERINSIGHT_PROVIDED_KEY, tier);
          return { success: true, clientId: clientId || 'provided', tier };
        }
        return { success: false, error: me.error || 'Provided key invalid' };
      } catch (error) {
        console.error('[HyperInsight] Provided key failed:', error);
        return { success: false, error: error.message };
      }
    }

    // Priority 2: Check existing stored key
    let data = loadKeyData();
    if (data) {
      try {
        const me = await apiRequest('/auth/me', 'GET', null, data.apiKey);
        if (me.data) {
          console.log(`[HyperInsight] Loaded existing client: ${data.clientId}`);
          return { success: true, clientId: data.clientId, tier: me.data.tier };
        }
      } catch (e) {
        console.warn('[HyperInsight] Stored key invalid, re-registering...');
      }
    }

    // Priority 3: Self-registration flow (register + keys)
    try {
      console.log('[HyperInsight] Registering new client...');
      const reg = await apiRequest('/auth/register-client', 'POST', {
        name: `Mosaic-${process.platform}`
      });
      const clientId = reg.data?.clientId;
      if (!clientId) {
        return { success: false, error: 'No clientId returned from register-client' };
      }

      console.log(`[HyperInsight] Creating API key for client ${clientId}...`);
      const keyData = await apiRequest('/auth/keys', 'POST', {
        clientId,
        name: 'Mosaic-Companion-Default'
      });

      if (keyData.data?.key) {
        saveKeyData(clientId, keyData.data.key, keyData.data.tier || 'free');
        console.log(`[HyperInsight] Registration successful! Client ID: ${clientId}, Tier: ${keyData.data.tier}`);
        return { success: true, clientId, tier: keyData.data.tier };
      }
      return { success: false, error: 'No API key returned from /auth/keys' };
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

  // 4. Auth Me
  ipcMain.handle('hyperinsight:auth-me', async () => {
    try {
      const data = loadKeyData();
      if (!data?.apiKey) throw new Error('Not registered');
      const result = await apiRequest('/auth/me', 'GET', null, data.apiKey);
      return result;
    } catch (e) { return { error: e.message }; }
  });

  // 5. Catalog (public, no auth)
  ipcMain.handle('hyperinsight:get-catalog', async () => {
    try {
      // No auth required, use provided key if available for tracking
      const result = await apiRequest('/catalog', 'GET', null, HYPERINSIGHT_PROVIDED_KEY || null);
      return result;
    } catch (e) { return { error: e.message }; }
  });

  // 6. Discover (AIM search)
  ipcMain.handle('hyperinsight:get-discover', async (event, params = {}) => {
    try {
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return await apiRequest(`/discover${queryString}`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 7. AIM Leaderboard
  ipcMain.handle('hyperinsight:get-leaderboard', async () => {
    try {
      return await apiRequest('/aims/leaderboard?includeTrend=true', 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 8. AIMs Compare
  ipcMain.handle('hyperinsight:compare-aims', async (event, names) => {
    try {
      if (!Array.isArray(names)) return { error: 'names must be an array' };
      const namesParam = names.map(n => encodeURIComponent(n)).join(',');
      return await apiRequest(`/aims/compare?names=${namesParam}`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 9. AIM Profile
  ipcMain.handle('hyperinsight:get-aim-profile', async (event, name) => {
    try {
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await apiRequest(`/aims/${pathSafeName}/profile`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 10. AIM Capabilities
  ipcMain.handle('hyperinsight:get-aim-capabilities', async (event, name) => {
    try {
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await apiRequest(`/aims/${pathSafeName}/capabilities`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 11. AIM Nodes (best nodes running this AIM)
  ipcMain.handle('hyperinsight:get-aim-nodes', async (event, name, params = {}) => {
    try {
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return await apiRequest(`/aims/${pathSafeName}/nodes${queryString}`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 12. AIM Stats
  ipcMain.handle('hyperinsight:get-aim-stats', async (event, name, range) => {
    try {
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await apiRequest(`/aims/${pathSafeName}/stats?range=${range || '1d'}`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 13. AIM Current Stats
  ipcMain.handle('hyperinsight:get-aim-stats-current', async (event, name) => {
    try {
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await apiRequest(`/aims/${pathSafeName}/stats/current`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 14. AIM Releases
  ipcMain.handle('hyperinsight:get-aim-releases', async (event, name) => {
    try {
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await apiRequest(`/aims/${pathSafeName}/releases`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 15. AIM Release Detail
  ipcMain.handle('hyperinsight:get-aim-release-detail', async (event, name, tag) => {
    try {
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await apiRequest(`/aims/${pathSafeName}/releases/${encodeURIComponent(tag)}`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 16. AIM Release Requirements
  ipcMain.handle('hyperinsight:get-aim-release-requirements', async (event, name, tag) => {
    try {
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await apiRequest(`/aims/${pathSafeName}/releases/${encodeURIComponent(tag)}/requirements`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 17. Nodes List (paginated)
  ipcMain.handle('hyperinsight:get-nodes', async (event, params = {}) => {
    try {
      const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
      return await apiRequest(`/nodes${queryString}`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 18. Node Profile
  ipcMain.handle('hyperinsight:get-node-detail', async (event, license) => {
    try {
      return await apiRequest(`/nodes/${license}/profile`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 19. Node Capabilities
  ipcMain.handle('hyperinsight:get-node-capabilities', async (event, license, includeDeployed = true) => {
    try {
      return await apiRequest(`/nodes/${license}/capabilities?includeDeployed=${includeDeployed}`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 20. Network Status (public)
  ipcMain.handle('hyperinsight:get-network-status', async () => {
    try {
      return await apiRequest('/network/status', 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 21. Network Regions
  ipcMain.handle('hyperinsight:get-network-regions', async () => {
    try {
      return await apiRequest('/network/regions', 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 22. Network History
  ipcMain.handle('hyperinsight:get-network-history', async () => {
    try {
      return await apiRequest('/aims/network-history', 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // 23. Network Stats
  ipcMain.handle('hyperinsight:get-network-stats', async () => {
    try {
      return await apiRequest('/aims/network-stats', 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // Legacy handler: get-aims (redirects to discover)
  ipcMain.handle('hyperinsight:get-aims', async () => {
    console.warn('[HyperInsight] get-aims is deprecated, use get-discover');
    try {
      return await apiRequest('/discover?alive_only=true&sort_by=liveness&limit=50', 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // Legacy handler: get-aim-details (redirects to profile)
  ipcMain.handle('hyperinsight:get-aim-details', async (event, name) => {
    console.warn('[HyperInsight] get-aim-details is deprecated, use get-aim-profile');
    try {
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await apiRequest(`/aims/${pathSafeName}/profile`, 'GET', null, HYPERINSIGHT_PROVIDED_KEY);
    } catch (e) { return { error: e.message }; }
  });

  // Save generated image from base64
  ipcMain.handle('hyperinsight:save-generated-image', async (event, base64Data) => {
    try {
      const generatedImagesPath = path.join(app.getPath('userData'), 'generated_images');
      if (!fs.existsSync(generatedImagesPath)) {
        fs.mkdirSync(generatedImagesPath, { recursive: true });
      }
      const base64Image = base64Data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64Image, 'base64');
      const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
      const filePath = path.join(generatedImagesPath, filename);
      console.log(`[HyperInsight] Saved generated image to: ${filePath}`);
      fs.writeFileSync(filePath, buffer);
      return { success: true, url: `mosaic-media://${filename}` };
    } catch (error) {
      console.error('[HyperInsight] Failed to save image:', error);
      return { success: false, error: error.message };
    }
  });

}
