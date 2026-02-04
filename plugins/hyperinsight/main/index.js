import { safeStorage, app } from 'electron';
import path from 'path';
import fs from 'fs';

const API_BASE_URL = 'https://api.hyperinsight.app/v1';
const STORAGE_FILE = 'hyperinsight.json';

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
  const handleDataRequest = async (endpoint) => {
    const data = loadKeyData();
    if (!data || !data.apiKey) {
      throw new Error('Not registered');
    }
    return await apiRequest(endpoint, 'GET', null, data.apiKey);
  };

  ipcMain.handle('hyperinsight:get-aims', async () => {
    try {
      return await handleDataRequest('/aims/list');
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-leaderboard', async () => {
    try {
      return await handleDataRequest('/aims/leaderboard');
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-nodes', async () => {
    // Current backend doesn't support list nodes yet, return empty or try aims
    // For MVP compliance with prompt
    return []; 
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
      // Handle slash for stats too if needed, but previously it worked? 
      // Actually stats historical endpoint also has {namespace}/{name}/stats, so let's be safe
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await handleDataRequest(`/aims/${pathSafeName}/stats?range=${range || '1d'}`);
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('hyperinsight:get-aim-stats-current', async (event, name) => {
    try {
      const pathSafeName = name.split('/').map(part => encodeURIComponent(part)).join('/');
      return await handleDataRequest(`/aims/${pathSafeName}/stats/current`);
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
}
