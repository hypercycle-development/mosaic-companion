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
  transferId?: string;
  error?: string;
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

  const result = (await resp.json()) as { transferId?: string; id?: string };
  return {
    success: true,
    transferId: result.transferId ?? result.id,
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
