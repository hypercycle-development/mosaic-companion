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
      shell: true,
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
  });
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
}
