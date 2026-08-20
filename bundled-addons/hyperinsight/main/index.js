// =============================================================================
// HyperInsight addon — main process module.
//
// Adapted wholesale from mosaic-companion's
// plugins/hyperinsight/main/index.js (registerHyperInsightIpc + score
// polling), moved to the activate(ctx)/deactivate() contract:
//
//   - `loadKeyData`/`saveKeyData` previously read/wrote a bare
//     `userData/hyperinsight.json`, with the API key safeStorage-encrypted
//     inside it. That file is now `ctx.settings` (the retained-settings
//     store) — still safeStorage-encrypted the same way, just
//     stored under this addon's own settings key instead of a loose core
//     userData file, which is also what survives an uninstall-then-reinstall
//     with "keep settings" checked.
//   - The tool-score cache previously lived at
//     `userData/hyperinsight-tool-scores.json`. It now lives at
//     `ctx.paths.data/tool-scores.json` — inside this addon's own
//     `addons/hyperinsight/data/` jail, so it's subject to the
//     data-retention checkboxes on uninstall like any other addon-owned
//     data, which is the correct behavior since it's
//     HyperInsight-specific.
//   - `registerHyperInsightIpc(ipcMain)` (bare `hyperinsight:*` channels)
//     becomes a set of `ctx.ipc.handle('get-aims', ...)` registrations
//     (channel `addon:hyperinsight:get-aims`), reached from the addon's own
//     renderer via `addonAPI.invoke('get-aims', ...)` — not a
//     bespoke per-addon addonAPI namespace.
//   - `startScorePolling`/`stopScorePolling` become part of
//     activate()/deactivate() — the interval is stopped and cleared on
//     deactivate so a deactivated addon truly does nothing in the
//     background — core must have zero dependency on
//     api.hyperinsight.app when the addon isn't installed and activated,
//     and the same must hold for "installed but deactivated".
//   - `saveGeneratedImage` previously wrote into core's
//     `userData/generated_images/` and returned a `mosaic-media://` URL —
//     a core protocol this addon's webview has no access to serve or
//     resolve. It now writes into this addon's own `ctx.paths.data` (the
//     `addonAPI.files` jail) and returns a relPath; the renderer reads the
//     bytes back via `addonAPI.files.readBinary` and builds a blob: URL
//     (see src/api.ts's `saveAndOpenImage`).
//   - On first activation only, checks for the legacy core files
//     (`userData/hyperinsight.json`, `userData/hyperinsight-tool-scores.json`)
//     and migrates them into ctx.settings / ctx.paths.data, then removes the
//     legacy files — so an upgrading user is never asked to re-register.
//     This is the addon-side half of the auto-install migration; the
//     core-side half (installing + activating this addon at all for an
//     upgrading profile) lives in mosaic-companion's
//     electron/addons/hyperinsight-migration.ts.
// =============================================================================

import { safeStorage, app, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';

const API_BASE_URL = 'https://api.hyperinsight.app/v1';
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const TOOL_SCORES_FILE = 'tool-scores.json';
const MIGRATED_FLAG_KEY = 'legacyMigrationDone';

// --- In-memory TTL response cache (per-process, cleared on deactivate) -----
let _responseCache = new Map();
function getCached(key) {
  const entry = _responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) { _responseCache.delete(key); return null; }
  return entry.data;
}
function setCached(key, data, ttlMs) {
  _responseCache.set(key, { data, expiresAt: Date.now() + ttlMs });
}
function clearResponseCache() {
  _responseCache.clear();
}

// --- Key storage, now backed by ctx.settings instead of a bare file --------
function loadKeyData(ctx) {
  try {
    const settings = ctx.settings.get();
    if (!settings.apiKeyEncB64 || !safeStorage.isEncryptionAvailable()) return null;
    const encryptedBuffer = Buffer.from(settings.apiKeyEncB64, 'base64');
    const decrypted = safeStorage.decryptString(encryptedBuffer);
    return { ...settings, apiKey: decrypted };
  } catch (error) {
    ctx.log('Failed to load key:', error?.message || error);
    return null;
  }
}

function saveKeyData(ctx, clientId, apiKey, tier) {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available');
    }
    const encrypted = safeStorage.encryptString(apiKey);
    ctx.settings.set({
      clientId,
      apiKeyEncB64: encrypted.toString('base64'),
      tier,
      createdAt: new Date().toISOString(),
      lastValidatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    ctx.log('Failed to save key:', error?.message || error);
    return false;
  }
}

function resetKeyData(ctx) {
  const current = ctx.settings.get();
  ctx.settings.set({
    clientId: undefined,
    apiKeyEncB64: undefined,
    tier: undefined,
    createdAt: undefined,
    lastValidatedAt: undefined,
    // Preserve the migration flag and anything else across a reset —
    // ctx.settings.set is a shallow merge, so explicitly-undefined keys
    // above just clear those specific fields.
    [MIGRATED_FLAG_KEY]: current[MIGRATED_FLAG_KEY],
  });
}

async function apiRequest(endpoint, method = 'GET', body = null, apiKey = null) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;
  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);
  const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
  if (!response.ok) throw new Error(`API Error: ${response.status} ${response.statusText}`);
  return await response.json();
}

// --- Legacy-file migration (first activation only, upgrading profiles) -----
function migrateLegacyFilesIfPresent(ctx) {
  const settings = ctx.settings.get();
  if (settings[MIGRATED_FLAG_KEY]) return; // already handled, including "nothing to migrate"

  const legacyKeyPath = path.join(app.getPath('userData'), 'hyperinsight.json');
  const legacyScoresPath = path.join(app.getPath('userData'), 'hyperinsight-tool-scores.json');

  try {
    if (fs.existsSync(legacyKeyPath) && !settings.apiKeyEncB64) {
      const raw = fs.readFileSync(legacyKeyPath, 'utf8');
      const legacy = JSON.parse(raw);
      if (legacy.apiKeyEncB64) {
        ctx.settings.set({
          clientId: legacy.clientId,
          apiKeyEncB64: legacy.apiKeyEncB64,
          tier: legacy.tier,
          createdAt: legacy.createdAt,
          lastValidatedAt: legacy.lastValidatedAt,
        });
        ctx.log(`Migrated legacy registration for client ${legacy.clientId}`);
      }
    }
  } catch (error) {
    ctx.log('Legacy key migration failed (non-fatal):', error?.message || error);
  }

  try {
    if (fs.existsSync(legacyScoresPath)) {
      const dest = path.join(ctx.paths.data, TOOL_SCORES_FILE);
      fs.copyFileSync(legacyScoresPath, dest);
      ctx.log('Migrated legacy tool-scores cache');
    }
  } catch (error) {
    ctx.log('Legacy score-cache migration failed (non-fatal):', error?.message || error);
  }

  // Remove the legacy files regardless of whether there was anything usable
  // in them — they're core-owned files this addon now fully supersedes, and
  // leaving them behind would just be stale core-directory clutter.
  for (const p of [legacyKeyPath, legacyScoresPath]) {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch (error) {
      ctx.log(`Failed to remove legacy file ${p} (non-fatal):`, error?.message || error);
    }
  }

  ctx.settings.set({ [MIGRATED_FLAG_KEY]: true });
}

// --- Background score polling ----------------------------------------------
let _pollIntervalId = null;

async function fetchAndWriteToolScores(ctx) {
  const data = loadKeyData(ctx);
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

    const scoreMap = {};
    for (const tool of (body.data?.tools ?? body.tools ?? [])) {
      if (tool.endpointUrl) {
        scoreMap[tool.endpointUrl] = {
          compositeScore: tool.compositeScore ?? null,
          healthScore: tool.healthScore ?? null,
          latencyScore: tool.latencyScore ?? null,
          uptimeScore: tool.uptimeScore ?? null,
          pollTier: tool.pollTier ?? null,
          lastProbedAt: tool.lastProbedAt ?? null,
          consecutiveFailures: tool.consecutiveFailures ?? 0,
          status: tool.status ?? null,
          manifestVersion: tool.manifestVersion ?? null,
          releaseTagName: tool.releaseTagName ?? null,
          measuredUptime7d: tool.measuredUptime7d ?? null,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    const scoresPath = path.join(ctx.paths.data, TOOL_SCORES_FILE);
    const tmpPath = scoresPath + '.tmp';
    await fs.promises.writeFile(tmpPath, JSON.stringify(scoreMap, null, 2));
    await fs.promises.rename(tmpPath, scoresPath);
    ctx.log('Tool scores updated:', Object.keys(scoreMap).length, 'endpoints');
  } catch (err) {
    clearTimeout(timeout);
    ctx.log('Tool score poll failed (non-fatal):', err.message);
  }
}

function startScorePolling(ctx) {
  fetchAndWriteToolScores(ctx).catch((e) => ctx.log(e));
  _pollIntervalId = setInterval(() => {
    const anyFocused = BrowserWindow.getAllWindows().some((w) => w.isFocused() && !w.isMinimized());
    if (!anyFocused) return;
    fetchAndWriteToolScores(ctx).catch((e) => ctx.log(e));
  }, POLL_INTERVAL_MS);
}

function stopScorePolling() {
  if (_pollIntervalId !== null) {
    clearInterval(_pollIntervalId);
    _pollIntervalId = null;
  }
}

// --- activate()/deactivate() ------------------------------------------------

export async function activate(ctx) {
  migrateLegacyFilesIfPresent(ctx);
  _responseCache = new Map();

  const handleDataRequest = async (endpoint, method = 'GET', body = null, ttlMs = 0) => {
    const data = loadKeyData(ctx);
    if (!data || !data.apiKey) throw new Error('Not registered');

    if (method === 'GET' && ttlMs > 0) {
      const cached = getCached(endpoint);
      if (cached !== null) return cached;
    }
    const result = await apiRequest(endpoint, method, body, data.apiKey);
    if (method === 'GET' && ttlMs > 0) setCached(endpoint, result, ttlMs);
    return result;
  };
  const safe = (fn) => async (...args) => {
    try {
      return await fn(...args);
    } catch (e) {
      return { error: e.message };
    }
  };

  ctx.ipc.handle('get-status', async () => {
    const data = loadKeyData(ctx);
    if (data) return { registered: true, tier: data.tier, clientId: data.clientId };
    return { registered: false };
  });

  ctx.ipc.handle('ensure-key', async () => {
    const existing = loadKeyData(ctx);
    if (existing) {
      ctx.log(`Loaded existing client: ${existing.clientId}`);
      return { success: true, clientId: existing.clientId };
    }
    try {
      ctx.log('Registering new client...');
      const regData = await apiRequest('/auth/register-client', 'POST', {
        clientName: `Mosaic-${process.platform}`,
        appVersion: app.getVersion() || '1.0.0',
      });
      if (regData.apiKey) {
        saveKeyData(ctx, regData.clientId, regData.apiKey, regData.tier);
        ctx.log(`Registration successful! Client ID: ${regData.clientId}`);
        return { success: true, clientId: regData.clientId };
      }
      return { success: false, error: 'No API key returned' };
    } catch (error) {
      ctx.log('Registration failed:', error.message);
      return { success: false, error: error.message };
    }
  });

  ctx.ipc.handle('reset-key', async () => {
    try {
      resetKeyData(ctx);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ctx.ipc.handle('get-aims', safe(() => handleDataRequest('/aims/list', 'GET', null, 10 * 60 * 1000)));
  ctx.ipc.handle(
    'get-leaderboard',
    safe(() => handleDataRequest('/aims/leaderboard?includeTrend=true', 'GET', null, 3 * 60 * 1000)),
  );
  ctx.ipc.handle('get-nodes', safe((params) => {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    return handleDataRequest(`/nodes${queryString}`, 'GET', null, 2 * 60 * 1000);
  }));
  ctx.ipc.handle('get-node-detail', safe((license) => handleDataRequest(`/nodes/${license}`, 'GET', null, 2 * 60 * 1000)));
  ctx.ipc.handle('get-node-profile', safe((license) =>
    handleDataRequest(`/nodes/${encodeURIComponent(String(license))}/profile`, 'GET', null, 5 * 60 * 1000),
  ));
  ctx.ipc.handle('get-node-aim-manifest', safe((license, aimName) =>
    handleDataRequest(`/nodes/${license}/aims/manifest?aimName=${encodeURIComponent(aimName)}`),
  ));
  ctx.ipc.handle('get-network-stats', safe(() => handleDataRequest('/aims/network-stats', 'GET', null, 5 * 60 * 1000)));
  ctx.ipc.handle('get-network-history', safe(() => handleDataRequest('/aims/network-history', 'GET', null, 15 * 60 * 1000)));
  ctx.ipc.handle('get-aim-stats', safe((name, range) =>
    handleDataRequest(`/aims/stats?name=${encodeURIComponent(name)}&range=${range || '1d'}`, 'GET', null, 5 * 60 * 1000),
  ));
  ctx.ipc.handle('get-aim-stats-current', safe((name) =>
    handleDataRequest(`/aims/stats/current?name=${encodeURIComponent(name)}`, 'GET', null, 2 * 60 * 1000),
  ));
  ctx.ipc.handle('get-aim-details', safe((name) => handleDataRequest(`/aims/${name}`, 'GET', null, 10 * 60 * 1000)));
  ctx.ipc.handle('get-aim-releases', safe((name) => {
    const pathSafeName = name.split('/').map((part) => encodeURIComponent(part)).join('/');
    return handleDataRequest(`/aims/${pathSafeName}/releases`, 'GET', null, 15 * 60 * 1000);
  }));
  ctx.ipc.handle('get-aim-release-detail', safe((name, tag) => {
    const pathSafeName = name.split('/').map((part) => encodeURIComponent(part)).join('/');
    return handleDataRequest(`/aims/${pathSafeName}/releases/${encodeURIComponent(tag)}`, 'GET', null, 15 * 60 * 1000);
  }));
  ctx.ipc.handle('get-aim-profile', safe((name) => {
    const pathSafeName = name.split('/').map((p) => encodeURIComponent(p)).join('/');
    return handleDataRequest(`/aims/${pathSafeName}/profile`, 'GET', null, 10 * 60 * 1000);
  }));
  ctx.ipc.handle('get-aim-nodes', safe((name, opts = {}) => {
    const pathSafeName = name.split('/').map((p) => encodeURIComponent(p)).join('/');
    const params = new URLSearchParams();
    if (opts.version) params.set('version', opts.version);
    if (opts.userLat != null) params.set('user_lat', String(opts.userLat));
    if (opts.userLng != null) params.set('user_lng', String(opts.userLng));
    const qs = params.toString() ? `?${params}` : '';
    return handleDataRequest(`/aims/${pathSafeName}/nodes${qs}`, 'GET', null, 3 * 60 * 1000);
  }));
  ctx.ipc.handle('get-aim-best-node', safe((name, opts = {}) => {
    const pathSafeName = name.split('/').map((p) => encodeURIComponent(p)).join('/');
    const params = new URLSearchParams();
    if (opts.version) params.set('version', opts.version);
    if (opts.userLat != null) params.set('user_lat', String(opts.userLat));
    if (opts.userLng != null) params.set('user_lng', String(opts.userLng));
    const qs = params.toString() ? `?${params}` : '';
    return handleDataRequest(`/aims/${pathSafeName}/best-node${qs}`, 'GET', null, 2 * 60 * 1000);
  }));
  ctx.ipc.handle('get-aim-deployments', safe((aimId) =>
    handleDataRequest(`/tools/${encodeURIComponent(String(aimId))}/deployments`, 'GET', null, 2 * 60 * 1000),
  ));
  ctx.ipc.handle('get-tool-status', safe((toolId) =>
    handleDataRequest(`/tools/${encodeURIComponent(String(toolId))}/status`, 'GET', null, 1 * 60 * 1000),
  ));
  ctx.ipc.handle('subscribe', safe((payload) => {
    const { endpointUrl, aimId, nodeLicense } = payload ?? {};
    return handleDataRequest('/subscriptions', 'POST', { endpointUrl, aimId, nodeLicense });
  }));
  ctx.ipc.handle('get-subscriptions', safe(() => handleDataRequest('/subscriptions', 'GET', null, 2 * 60 * 1000)));
  ctx.ipc.handle('unsubscribe', safe((subscriptionId) =>
    handleDataRequest(`/subscriptions/${encodeURIComponent(String(subscriptionId))}`, 'DELETE'),
  ));
  ctx.ipc.handle('get-verification-history', safe((subscriptionId) =>
    handleDataRequest(`/subscriptions/${encodeURIComponent(String(subscriptionId))}/verifications`),
  ));

  ctx.ipc.handle('get-tool-score', async (endpointUrl) => {
    try {
      const raw = await fs.promises.readFile(path.join(ctx.paths.data, TOOL_SCORES_FILE), 'utf8');
      return JSON.parse(raw)[endpointUrl] ?? null;
    } catch {
      return null;
    }
  });
  ctx.ipc.handle('get-all-tool-scores', async () => {
    try {
      const raw = await fs.promises.readFile(path.join(ctx.paths.data, TOOL_SCORES_FILE), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });
  ctx.ipc.handle('get-tool-scores-last-updated', async () => {
    try {
      const stat = await fs.promises.stat(path.join(ctx.paths.data, TOOL_SCORES_FILE));
      return stat.mtime.toISOString();
    } catch {
      return null;
    }
  });

  ctx.ipc.handle('save-generated-image', async (base64Data) => {
    try {
      const imagesDir = path.join(ctx.paths.data, 'generated_images');
      fs.mkdirSync(imagesDir, { recursive: true });
      const base64Image = String(base64Data).replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Image, 'base64');
      const filename = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.png`;
      fs.writeFileSync(path.join(imagesDir, filename), buffer);
      return { success: true, relPath: `generated_images/${filename}` };
    } catch (error) {
      ctx.log('Failed to save generated image:', error.message);
      return { success: false, error: error.message };
    }
  });

  ctx.ipc.handle('clear-cache', () => {
    clearResponseCache();
    return { success: true };
  });

  startScorePolling(ctx);
}

export function deactivate() {
  stopScorePolling();
  clearResponseCache();
}
