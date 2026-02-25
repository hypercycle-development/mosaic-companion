/**
 * Web3 Module — Wallet Storage & Config
 *
 * Secure wallet storage using Electron's safeStorage.
 * This module provides the wallet management functions used by
 * the Web3Module ToolModule (in tools/modules/web3.ts).
 */

import { app, safeStorage } from "electron";
import path from "path";
import fs from "fs";

// =============================================================================
// Constants
// =============================================================================

const WALLET_CONFIG_FILE = "wallet_config.json";

// =============================================================================
// Renderer-Side Arg Types (exported for src/types/tools.ts)
// =============================================================================

/** Typed argument maps for each Web3 tool — used by the renderer for autocomplete */
export interface Web3ToolArgs {
  "web3:get_crypto_price": { symbol: string };
  "web3:get_market_news": { query: string };
  "web3:get_wallet_balance": { address?: string };
  "web3:execute_swap": { tokenIn: string; tokenOut: string; amount: string };
  "web3:save-wallet": { privateKey: string };
  "web3:delete-wallet": Record<string, never>;
  "web3:wallet-exists": Record<string, never>;
}

// =============================================================================
// Secure Wallet Storage
// =============================================================================

function getWalletConfigPath(): string {
  return path.join(app.getPath("userData"), WALLET_CONFIG_FILE);
}

export function saveWalletKey(privateKey: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) {
    console.error("[Web3] SafeStorage is not available on this system.");
    return false;
  }
  try {
    const buffer = safeStorage.encryptString(privateKey);
    fs.writeFileSync(
      getWalletConfigPath(),
      JSON.stringify({ encryptedKey: buffer.toString("base64") }),
    );
    return true;
  } catch (error) {
    console.error("[Web3] Failed to save wallet key:", error);
    return false;
  }
}

export function getWalletKey(): string | null {
  if (!safeStorage.isEncryptionAvailable()) return null;
  try {
    const configPath = getWalletConfigPath();
    if (!fs.existsSync(configPath)) return null;
    const data = JSON.parse(fs.readFileSync(configPath, "utf8"));
    if (!data.encryptedKey) return null;

    const buffer = Buffer.from(data.encryptedKey, "base64");
    return safeStorage.decryptString(buffer);
  } catch (error) {
    console.error("[Web3] Failed to retrieve wallet key:", error);
    return null;
  }
}

export function deleteWalletKey(): boolean {
  try {
    const configPath = getWalletConfigPath();
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    return true;
  } catch {
    return false;
  }
}
