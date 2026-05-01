/**
 * TODA Twin Container API Client
 *
 * REST API for TODA assets: address (Twin URL), balance (DQ), transfer.
 * Auth via API key in query param. Base URL: https://{twinHostname}/
 *
 * @see https://engineering.todaq.net/twin/
 */

import { app, safeStorage } from "electron";
import path from "path";
import fs from "fs";
import {
  getTodaTwinHostname,
  getTodaTwinInfoAddress,
  loadConfig,
  saveConfig,
} from "./config";

// =============================================================================
// Constants
// =============================================================================

const TODA_API_KEY_FILE = "toda_api_key.json";

// =============================================================================
// Types
// =============================================================================

export interface TodaInfo {
  address: string;
  latest?: string;
  binderId?: string;
  buildId?: string;
  version?: string;
}

export interface TodaDqEntry {
  type: string;
  balance?: number;
  quantity?: number;
  files?: unknown[];
  fileValue?: unknown;
}

export interface TodaTransferResult {
  success: boolean;
  /** Twin /dq/transfer response id fields */
  transferId?: string;
  /** First entry in `entryFiles` (Hypercycle balance tx-id expects this, not always transferId). */
  entryFileId?: string;
  error?: string;
}

function firstEntryFileFromRecord(o: Record<string, unknown>): string | null {
  const ef = o.entryFiles ?? o.entry_files;
  if (!Array.isArray(ef) || ef.length === 0) return null;
  const first = ef[0];
  if (typeof first === "string" && first.trim()) return first.trim();
  if (first && typeof first === "object") {
    const r = first as Record<string, unknown>;
    for (const k of ["id", "hash", "fileId", "entryId"]) {
      const v = r[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return null;
}

/** Walk JSON for the first `entryFiles` array (binder / transaction payloads). */
function findFirstEntryFileIdDeep(value: unknown, depth = 0): string | null {
  if (depth > 12 || value == null) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const hit = firstEntryFileFromRecord(value as Record<string, unknown>);
    if (hit) return hit;
    for (const v of Object.values(value as Record<string, unknown>)) {
      const nested = findFirstEntryFileIdDeep(v, depth + 1);
      if (nested) return nested;
    }
  }
  if (Array.isArray(value)) {
    for (const v of value) {
      const nested = findFirstEntryFileIdDeep(v, depth + 1);
      if (nested) return nested;
    }
  }
  return null;
}

function extractIdsFromTransferJson(raw: Record<string, unknown>): {
  transferId?: string;
  twistId?: string;
  entryFileId?: string;
} {
  const transferId =
    (typeof raw.transferId === "string" && raw.transferId.trim()) ||
    (typeof raw.transactionId === "string" && raw.transactionId.trim()) ||
    (typeof raw.id === "string" && raw.id.trim()) ||
    undefined;

  const twistId =
    typeof raw.twistId === "string" && raw.twistId.trim()
      ? raw.twistId.trim()
      : undefined;

  const entryFileId = findFirstEntryFileIdDeep(raw) ?? undefined;

  return { transferId, twistId, entryFileId };
}

// =============================================================================
// Secure API Key Storage
// =============================================================================

function getTodaKeyPath(): string {
  return path.join(app.getPath("userData"), TODA_API_KEY_FILE);
}

export function saveTodaApiKey(apiKey: string): boolean {
  if (!apiKey?.trim()) return false;
  if (!safeStorage.isEncryptionAvailable()) {
    console.error("[TODA] SafeStorage is not available.");
    return false;
  }
  try {
    const buffer = safeStorage.encryptString(apiKey.trim());
    fs.writeFileSync(
      getTodaKeyPath(),
      JSON.stringify({ encryptedKey: buffer.toString("base64") }),
    );
    return true;
  } catch {
    console.error("[TODA] Failed to save API key.");
    return false;
  }
}

export function getTodaApiKey(): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const keyPath = getTodaKeyPath();
    if (!fs.existsSync(keyPath)) return null;
    const data = JSON.parse(fs.readFileSync(keyPath, "utf8"));
    if (!data.encryptedKey) return null;
    const buffer = Buffer.from(data.encryptedKey, "base64");
    return safeStorage.decryptString(buffer);
  } catch {
    console.error("[TODA] Failed to retrieve API key.");
    return null;
  }
}

export function deleteTodaApiKey(): boolean {
  try {
    const keyPath = getTodaKeyPath();
    if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
    return true;
  } catch {
    return false;
  }
}

export function hasTodaConfig(): boolean {
  const hostname = getTodaTwinHostname();
  const apiKey = getTodaApiKey();
  return !!(hostname?.trim() && apiKey);
}

// =============================================================================
// API Client
// =============================================================================

function getBaseUrl(): string {
  const hostname = getTodaTwinHostname();
  if (!hostname?.trim()) throw new Error("TODA Twin hostname not configured.");
  const base = hostname.startsWith("http") ? hostname : `https://${hostname}`;
  return base.replace(/\/$/, "");
}

function buildUrl(path: string, apiKey: string): string {
  const base = getBaseUrl();
  const sep = path.includes("?") ? "&" : "?";
  return `${base}${path.startsWith("/") ? path : `/${path}`}${sep}apiKey=${encodeURIComponent(apiKey)}`;
}

/**
 * Binder JSON (with `data.entryFiles`) is served from the Twin — not the Hypercycle node.
 * When POST /transfer omits entryFiles, GET binder by twist/transfer id.
 */
async function fetchEntryFileIdFromTwinBinder(ref: string): Promise<string | null> {
  const key = getTodaApiKey();
  if (!key?.trim() || !ref.trim()) return null;
  const id = ref.trim();
  const paths = [
    `/binder/${encodeURIComponent(id)}`,
    `/binder/tx/${encodeURIComponent(id)}`,
    `/binder/transaction/${encodeURIComponent(id)}`,
    `/binder/transactions/${encodeURIComponent(id)}`,
  ];
  for (const p of paths) {
    try {
      const url = buildUrl(p, key);
      const r = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
      if (!r.ok) continue;
      const text = await r.text();
      let body: unknown = null;
      try {
        body = text.trim() ? (JSON.parse(text) as unknown) : null;
      } catch {
        continue;
      }
      const hit = findFirstEntryFileIdDeep(body);
      if (hit) return hit;
    } catch {
      /* try next path */
    }
  }
  return null;
}

/** GET /info — returns Twin address and metadata */
export async function fetchTodaInfo(): Promise<TodaInfo> {
  const apiKey = getTodaApiKey();
  if (!apiKey) throw new Error("TODA API key not configured.");

  const url = buildUrl("/info", apiKey);
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`TODA /info failed (${resp.status}): ${text || resp.statusText}`);
  }

  const data = (await resp.json()) as Record<string, unknown>;
  const address = data.address as string;
  if (!address) throw new Error("TODA /info did not return address.");
  return {
    address,
    latest: data.latest as string | undefined,
    binderId: data.binderId as string | undefined,
    buildId: data.buildId as string | undefined,
    version: data.version as string | undefined,
  };
}

// --- User Twin GET /binder: rows with send → tm.host_address (transfer destination) → entryFiles[0] ---

function normalizeTwinRef(s: string): string {
  const t = s.trim().toLowerCase();
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    return `${u.hostname}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return t.replace(/\/$/, "");
  }
}

function twinUrlsMatch(a: string, b: string): boolean {
  return normalizeTwinRef(a) === normalizeTwinRef(b);
}

function collectBinderTwistRows(root: unknown): Array<{ ts: number; data: Record<string, unknown> }> {
  const out: Array<{ ts: number; data: Record<string, unknown> }> = [];
  const add = (obj: unknown) => {
    if (!obj || typeof obj !== "object") return;
    const o = obj as Record<string, unknown>;
    const data = o.data;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      const d = data as Record<string, unknown>;
      const ts = typeof o.timestamp === "string" ? Date.parse(o.timestamp) : 0;
      out.push({ ts: Number.isFinite(ts) ? ts : 0, data: d });
    }
  };
  if (Array.isArray(root)) {
    for (const el of root) add(el);
  } else if (root && typeof root === "object") {
    const o = root as Record<string, unknown>;
    if (Array.isArray(o.twists)) for (const el of o.twists) add(el);
    else if (Array.isArray(o.entries)) for (const el of o.entries) add(el);
    else if (Array.isArray(o.data)) for (const el of o.data) add(el);
    else add(root);
  }
  return out;
}

function isSendOperation(d: Record<string, unknown>): boolean {
  const op = String(d.entryOperation ?? d.entry_operation ?? "").toLowerCase();
  return op === "send";
}

function entryDestinationMatchesTmTwin(d: Record<string, unknown>, destTwinUrl: string): boolean {
  const entry =
    d.entry && typeof d.entry === "object" && !Array.isArray(d.entry)
      ? (d.entry as Record<string, unknown>)
      : {};
  const keys = [
    "toTwin",
    "to_twin",
    "destination",
    "destinationTwin",
    "recipientTwin",
    "recipient",
    "to",
  ];
  for (const k of keys) {
    const v = entry[k] ?? d[k];
    if (typeof v === "string" && v.trim() && twinUrlsMatch(v.trim(), destTwinUrl)) return true;
  }
  return false;
}

/**
 * Latest twist: user **send** to Hypercycle tm Twin (`destination`), then first `entryFiles` id.
 */
function pickEntryFileFromBinderSendToDestination(
  binderJson: unknown,
  destTwinUrl: string,
): string | null {
  const rows = collectBinderTwistRows(binderJson);
  rows.sort((a, b) => b.ts - a.ts);
  for (const { data } of rows) {
    if (!isSendOperation(data)) continue;
    if (!entryDestinationMatchesTmTwin(data, destTwinUrl)) continue;
    const id = firstEntryFileFromRecord(data);
    if (id) return id;
  }
  for (const { data } of rows) {
    const op = String(data.entryOperation ?? data.entry_operation ?? "").toLowerCase();
    if (op === "receive") continue;
    const et = String(data.entryType ?? data.entry_type ?? "").toLowerCase();
    if (et !== "dqtx") continue;
    if (!entryDestinationMatchesTmTwin(data, destTwinUrl)) continue;
    const id = firstEntryFileFromRecord(data);
    if (id) return id;
  }
  return null;
}

async function fetchUserTwinBinderJson(apiKey: string): Promise<unknown | null> {
  const paths: string[] = ["/binder"];
  try {
    const info = await fetchTodaInfo();
    if (typeof info.binderId === "string" && info.binderId.trim()) {
      paths.push(`/binder/${encodeURIComponent(info.binderId.trim())}`);
    }
  } catch {
    /* still try /binder */
  }
  for (const p of paths) {
    try {
      const url = buildUrl(p, apiKey);
      const r = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
      if (!r.ok) continue;
      const text = await r.text();
      if (!text.trim()) continue;
      return JSON.parse(text) as unknown;
    } catch {
      /* next */
    }
  }
  return null;
}

/** POST /transfer then GET user Twin binder; match send row for this `destination` (tm Twin URL). */
async function resolveEntryFileFromUserBinderSendToTm(
  apiKey: string,
  destinationTwinUrl: string,
): Promise<string | null> {
  const dest = destinationTwinUrl.trim();
  if (!dest) return null;
  const delaysMs = [0, 450, 1100];
  for (const wait of delaysMs) {
    if (wait > 0) await new Promise((res) => setTimeout(res, wait));
    const body = await fetchUserTwinBinderJson(apiKey);
    if (body == null) continue;
    const hit = pickEntryFileFromBinderSendToDestination(body, dest);
    if (hit) return hit;
  }
  return null;
}

/** GET /dq — returns all DQ balances */
export async function fetchTodaBalance(): Promise<TodaDqEntry[]> {
  const apiKey = getTodaApiKey();
  if (!apiKey) throw new Error("TODA API key not configured.");

  const url = buildUrl("/dq", apiKey);
  const resp = await fetch(url);
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`TODA /dq failed (${resp.status}): ${text || resp.statusText}`);
  }

  const data = (await resp.json()) as TodaDqEntry[] | { dq?: TodaDqEntry[] };
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as { dq?: TodaDqEntry[] }).dq)) {
    return (data as { dq: TodaDqEntry[] }).dq;
  }
  return [];
}

/** POST /dq/{type}/transfer — transfer DQ to destination Twin URL */
export async function executeTodaTransfer(
  typeHash: string,
  amount: number,
  destination: string,
  metadata?: Record<string, unknown>,
): Promise<TodaTransferResult> {
  const apiKey = getTodaApiKey();
  if (!apiKey) return { success: false, error: "TODA API key not configured." };

  const url = buildUrl(`/dq/${encodeURIComponent(typeHash)}/transfer`, apiKey);
  const body: { amount: number; destination: string; metadata?: Record<string, unknown> } = {
    amount,
    destination: destination.trim(),
  };
  if (metadata && Object.keys(metadata).length > 0) body.metadata = metadata;

  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    return { success: false, error: `TODA transfer failed (${resp.status}): ${text || resp.statusText}` };
  }

  const result = (await resp.json()) as Record<string, unknown>;
  const { transferId, twistId, entryFileId } = extractIdsFromTransferJson(result);
  let entry = entryFileId;
  const destTrim = destination.trim();
  if (!entry) {
    entry = (await resolveEntryFileFromUserBinderSendToTm(apiKey, destTrim)) ?? undefined;
  }
  if (!entry) {
    const refs = [twistId, transferId].filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
    for (const ref of refs) {
      const fromBinder = await fetchEntryFileIdFromTwinBinder(ref);
      if (fromBinder) {
        entry = fromBinder;
        break;
      }
    }
  }
  return {
    success: true,
    transferId,
    entryFileId: entry,
  };
}

/**
 * Persist Twin GET /info `address` into web3 config (after hostname + API key are saved).
 */
export async function syncTodaTwinInfoAddressFromTwin(): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!hasTodaConfig()) {
    return { ok: false, error: "TODA Twin hostname and API key required." };
  }
  try {
    const info = await fetchTodaInfo();
    const addr = typeof info.address === "string" ? info.address.trim() : "";
    if (!addr) return { ok: false, error: "TODA /info did not return address." };
    const config = loadConfig();
    if (!config.networks.toda) return { ok: false, error: "Invalid Web3 config." };
    config.networks.toda = { ...config.networks.toda, twinInfoAddress: addr };
    saveConfig(config);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Get Twin address (TODA equivalent of wallet address) */
export async function getTodaAddress(): Promise<string | null> {
  const cached = getTodaTwinInfoAddress();
  if (cached) return cached;
  try {
    const info = await fetchTodaInfo();
    const addr = typeof info.address === "string" ? info.address.trim() : "";
    if (addr) {
      const config = loadConfig();
      if (config.networks.toda) {
        config.networks.toda = { ...config.networks.toda, twinInfoAddress: addr };
        saveConfig(config);
      }
    }
    return addr || null;
  } catch {
    return null;
  }
}
