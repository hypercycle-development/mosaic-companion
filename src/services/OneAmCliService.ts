/**
 * OneAmCliService — Renderer-side wrapper for the 1AM CLI integration
 *
 * Mirrors the CardanoWalletService pattern but targets the `oneam-cli` IPC
 * namespace that spawns the globally-installed `1am` binary.
 */

export interface OneAmCliWallet {
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
  sync: Record<string, any>;
}

export interface OneAmCliSyncResult {
  path: string;
  wallet: string;
  snapshot: {
    address: string;
    availableCoins: number;
    pendingCoins: number;
    balances: Record<string, any>;
  };
}

export interface OneAmCliError {
  error: string;
  stderr?: string;
}

/* ─── Wallet Operations ─────────────────────────────────── */

export async function createAgentWallet(
  name: string,
  options?: { setDefault?: boolean; password?: string; insecurePlain?: boolean }
): Promise<{ wallet: OneAmCliWallet; path: string; recoveryMnemonic?: string; seedHex?: string; default: boolean } | OneAmCliError> {
  const api = getApi();
  if (!api) return { error: "1AM CLI bridge not available" };
  return api.createWallet(name, options);
}

export async function listWallets(): Promise<OneAmCliWallet[] | OneAmCliError> {
  const api = getApi();
  if (!api) return { error: "1AM CLI bridge not available" };
  return api.listWallets();
}

export async function showWallet(name?: string): Promise<{ wallet: OneAmCliWallet; path: string } | OneAmCliError> {
  const api = getApi();
  if (!api) return { error: "1AM CLI bridge not available" };
  return api.showWallet(name);
}

export async function syncWallet(
  name: string,
  network: "preview" | "preprod" | "mainnet",
  options?: { password?: string; timeout?: number }
): Promise<OneAmCliSyncResult | OneAmCliError> {
  const api = getApi();
  if (!api) return { error: "1AM CLI bridge not available" };
  return api.syncWallet(name, network, options);
}

export async function setDefaultWallet(name: string): Promise<{ defaultWallet: string } | OneAmCliError> {
  const api = getApi();
  if (!api) return { error: "1AM CLI bridge not available" };
  return api.useWallet(name);
}

/* ─── Explorer Operations ───────────────────────────────── */

export async function getExplorerSummary(): Promise<any | OneAmCliError> {
  const api = getApi();
  if (!api) return { error: "1AM CLI bridge not available" };
  return api.explorerSummary();
}

export async function getAddressActivity(identifier: string): Promise<any | OneAmCliError> {
  const api = getApi();
  if (!api) return { error: "1AM CLI bridge not available" };
  return api.explorerAddressActivity(identifier);
}

/* ─── Helpers ─────────────────────────────────────────────── */

function getApi() {
  return (window as any).electronAPI?.oneamCli;
}

export function isOneAmCliAvailable(): boolean {
  return !!getApi();
}
