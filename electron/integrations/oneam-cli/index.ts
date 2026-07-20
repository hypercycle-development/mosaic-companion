/**
 * 1AM CLI Integration — Main Process
 *
 * Spawns the `1am` CLI binary installed globally on the system and parses
 * its JSON output for wallet/explorer operations. All wallet files live
 * under `~/.1am/wallets` (managed by 1am itself), so this service does NOT
 * handle seed material directly — it only calls the CLI.
 *
 * Architecture:
 *   Renderer ──IPC──► Main Process (this service) ──spawn──► `1am` CLI
 */

import { spawn } from "node:child_process";
import { IpcMain, ipcMain } from "electron";

/* ─── Types ─────────────────────────────────────────────── */

export interface OneAmWallet {
  name: string;
  path: string;
  encrypted: boolean;
  createdAt: string;
  updatedAt: string;
  public: {
    coinPublicKey: string;
    encryptionPublicKey: string;
    dustPublicKey: string;
    shielded: Record<string, string>;
    unshielded: Record<string, string>;
    dust: Record<string, string>;
  };
  sync: Record<string, unknown>;
}

export interface OneAmWalletCreateResult {
  wallet: OneAmWallet;
  path: string;
  recoveryMnemonic?: string;
  seedHex?: string;
  default: boolean;
}

export interface OneAmSyncResult {
  path: string;
  wallet: string;
  snapshot: {
    address: string;
    availableCoins: number;
    pendingCoins: number;
    balances: Record<string, unknown>;
  };
}

export interface OneAmCliError {
  error: string;
  stderr?: string;
}

/* ─── Internal CLI spawner ──────────────────────────────── */

function runOneAm(args: string[], env?: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const child = spawn("1am", args, {
      shell: false, // SECURITY: never use shell for user-provided args
      env: { ...process.env, ...env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject({
          error: `1am exited with code ${code}`,
          stderr: stderr.trim(),
        });
        return;
      }
      try {
        const trimmed = stdout.trim();
        // Try JSON first, fall back to plain text
        if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
          resolve(JSON.parse(trimmed));
        } else {
          resolve({ raw: trimmed, stderr: stderr.trim() || undefined });
        }
      } catch {
        resolve({ raw: stdout.trim(), stderr: stderr.trim() || undefined });
      }
    });

    child.on("error", (err) => {
      reject({ error: err.message, stderr: stderr.trim() });
    });

    // Hard timeout safety net
    const timeoutMs = 120_000;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000);
      reject({ error: `1am command timed out after ${timeoutMs}ms` });
    }, timeoutMs);
    child.on("close", () => clearTimeout(timer));
  });
}

/** Verify the 1am binary exists and is callable */
export async function oneamCheckBinary(): Promise<{ ok: boolean; version?: string; error?: string }> {
  try {
    const result = await runOneAm(["--version"]);
    if (result && typeof result === "string") {
      return { ok: true, version: result.trim() };
    }
    return { ok: true, version: String(result).trim() };
  } catch (e: any) {
    return { ok: false, error: e.error || e.message || "1am binary not found" };
  }
}

/* ─── Public API ────────────────────────────────────────── */

export async function oneamCreateWallet(
  name: string,
  options?: { setDefault?: boolean; password?: string; insecurePlain?: boolean }
): Promise<OneAmWalletCreateResult | OneAmCliError> {
  const args = ["wallet", "create", name, "--json"];
  if (options?.setDefault) args.push("--set-default");
  if (options?.insecurePlain) args.push("--insecure-plain");

  const env: Record<string, string> = {};
  if (options?.password) env.ONE_AM_WALLET_PASSWORD = options.password;

  try {
    return await runOneAm(args, env);
  } catch (e: any) {
    return { error: e.error || String(e), stderr: e.stderr };
  }
}

export async function oneamListWallets(): Promise<OneAmWallet[] | OneAmCliError> {
  try {
    return await runOneAm(["wallet", "list", "--json"]);
  } catch (e: any) {
    return { error: e.error || String(e), stderr: e.stderr };
  }
}

export async function oneamShowWallet(
  name?: string
): Promise<{ wallet: OneAmWallet; path: string } | OneAmCliError> {
  const args = ["wallet", "show", "--json"];
  if (name) args.push(name);
  try {
    return await runOneAm(args);
  } catch (e: any) {
    return { error: e.error || String(e), stderr: e.stderr };
  }
}

export async function oneamSyncWallet(
  name: string,
  network: "preview" | "preprod" | "mainnet",
  options?: { password?: string; timeout?: number; indexer?: string }
): Promise<OneAmSyncResult | OneAmCliError> {
  const args = ["wallet", "sync", name, "--network", network, "--json"];
  if (options?.timeout) args.push("--timeout", String(options.timeout));
  if (options?.indexer) args.push("--indexer", options.indexer);

  const env: Record<string, string> = {};
  if (options?.password) env.ONE_AM_WALLET_PASSWORD = options.password;

  try {
    return await runOneAm(args, env);
  } catch (e: any) {
    return { error: e.error || String(e), stderr: e.stderr };
  }
}

export async function oneamUseWallet(name: string): Promise<{ defaultWallet: string } | OneAmCliError> {
  try {
    return await runOneAm(["wallet", "use", name, "--json"]);
  } catch (e: any) {
    return { error: e.error || String(e), stderr: e.stderr };
  }
}

export async function oneamExplorerSummary(): Promise<any | OneAmCliError> {
  try {
    return await runOneAm(["explorer", "summary", "--json"]);
  } catch (e: any) {
    return { error: e.error || String(e), stderr: e.stderr };
  }
}

export async function oneamExplorerAddressActivity(
  identifier: string
): Promise<any | OneAmCliError> {
  try {
    return await runOneAm(["explorer", "address-activity", identifier, "--json"]);
  } catch (e: any) {
    return { error: e.error || String(e), stderr: e.stderr };
  }
}

export async function oneamExplorerTx(hash: string): Promise<any | OneAmCliError> {
  try {
    return await runOneAm(["explorer", "tx", hash, "--json"]);
  } catch (e: any) {
    return { error: e.error || String(e), stderr: e.stderr };
  }
}

export async function oneamExplorerSearch(
  query: string,
  options?: { limit?: number }
): Promise<any | OneAmCliError> {
  const args = ["explorer", "search", query, "--json"];
  if (options?.limit) args.push("--limit", String(options.limit));
  try {
    return await runOneAm(args);
  } catch (e: any) {
    return { error: e.error || String(e), stderr: e.stderr };
  }
}

/* ─── IPC Registration ──────────────────────────────────── */

export function registerOneAmCliIpc(ipcMainRef: IpcMain = ipcMain) {
  ipcMainRef.handle("oneam-cli:createWallet", async (_, name: string, options?: any) => {
    return oneamCreateWallet(name, options);
  });

  ipcMainRef.handle("oneam-cli:listWallets", async () => {
    return oneamListWallets();
  });

  ipcMainRef.handle("oneam-cli:showWallet", async (_, name?: string) => {
    return oneamShowWallet(name);
  });

  ipcMainRef.handle("oneam-cli:syncWallet", async (_, name: string, network: string, options?: any) => {
    return oneamSyncWallet(name, network as any, options);
  });

  ipcMainRef.handle("oneam-cli:useWallet", async (_, name: string) => {
    return oneamUseWallet(name);
  });

  ipcMainRef.handle("oneam-cli:explorerSummary", async () => {
    return oneamExplorerSummary();
  });

  ipcMainRef.handle("oneam-cli:explorerAddressActivity", async (_, identifier: string) => {
    return oneamExplorerAddressActivity(identifier);
  });

  ipcMainRef.handle("oneam-cli:explorerTx", async (_, hash: string) => {
    return oneamExplorerTx(hash);
  });

  ipcMainRef.handle("oneam-cli:explorerSearch", async (_, query: string, limit?: number) => {
    return oneamExplorerSearch(query, { limit });
  });

  ipcMainRef.handle("oneam-cli:checkBinary", async () => {
    return oneamCheckBinary();
  });
}
