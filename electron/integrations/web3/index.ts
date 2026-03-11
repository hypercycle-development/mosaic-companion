/**
 * Web3 Module — Wallet Storage, Address Derivation & Address Book
 *
 * Secure wallet storage using Electron's safeStorage.
 * Address derivation using viem.
 * Address book CRUD stored as JSON in userData.
 */

import { app, safeStorage } from "electron";
import path from "path";
import fs from "fs";
import { privateKeyToAccount, generatePrivateKey, type PrivateKeyAccount } from "viem/accounts";

// =============================================================================
// Constants
// =============================================================================

const WALLET_CONFIG_FILE = "wallet_config.json";
const ADDRESS_BOOK_FILE = "address_book.json";

// =============================================================================
// Address Book Types
// =============================================================================

export interface WalletContact {
  id: string;
  name: string;
  address: string;
  createdAt: number;
}

// =============================================================================
// Renderer-Side Arg Types (exported for src/types/tools.ts)
// =============================================================================

/** Typed argument maps for each Web3 tool — used by the renderer for autocomplete */
export interface Web3ToolArgs {
  "web3:get_crypto_price": { symbol: string };
  "web3:get_market_news": { query: string };
  "web3:get_wallet_balance": { address?: string };
  "web3:get_wallet_address": Record<string, never>;
  "web3:execute_swap": { tokenIn: string; tokenOut: string; amount: string };
  "web3:save-wallet": { privateKey: string };
  "web3:delete-wallet": Record<string, never>;
  "web3:wallet-exists": Record<string, never>;
  "web3:transfer_eth": { to: string; amount: string };
  "web3:transfer_token": { to: string; amount: string; token: string };
  "web3:lookup_saved_wallet": { name: string };
  "web3:save_wallet_contact": { name: string; address: string };
  "web3:delete_wallet_contact": { id: string };
  "web3:list_saved_wallets": Record<string, never>;
}

// =============================================================================
// Secure Wallet Storage
// =============================================================================

function getWalletConfigPath(): string {
  return path.join(app.getPath("userData"), WALLET_CONFIG_FILE);
}

export function saveWalletKey(privateKey: string): boolean {
  // If renderer asked main to generate the key, do it here in the main process
  const PLACEHOLDER = "PRIVATE_KEY_TO_BE_GENERATED";
  if (privateKey === PLACEHOLDER) {
    try {
      privateKey = generatePrivateKey();
    } catch (error) {
      console.error("[Web3] Failed to generate private key in main:", error);
      return false;
    }
  }
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

// =============================================================================
// Wallet Address Derivation (viem)
// =============================================================================

/**
 * Derive the public Ethereum address from the stored private key.
 * Returns null if no wallet is configured.
 */
export function getWalletAddress(): string | null {
  const key = getWalletKey();
  if (!key) return null;

  try {
    // Ensure the key starts with 0x
    const formattedKey = key.startsWith("0x") ? key : `0x${key}`;
    const account: PrivateKeyAccount = privateKeyToAccount(
      formattedKey as `0x${string}`,
    );
    return account.address;
  } catch (error) {
    console.error("[Web3] Failed to derive wallet address:", error);
    return null;
  }
}

// =============================================================================
// Address Book
// =============================================================================

function getAddressBookPath(): string {
  return path.join(app.getPath("userData"), ADDRESS_BOOK_FILE);
}

function readAddressBook(): WalletContact[] {
  try {
    const bookPath = getAddressBookPath();
    if (!fs.existsSync(bookPath)) return [];
    const data = JSON.parse(fs.readFileSync(bookPath, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("[Web3] Failed to read address book:", error);
    return [];
  }
}

function writeAddressBook(contacts: WalletContact[]): boolean {
  try {
    fs.writeFileSync(getAddressBookPath(), JSON.stringify(contacts, null, 2));
    return true;
  } catch (error) {
    console.error("[Web3] Failed to write address book:", error);
    return false;
  }
}

export function getAddressBookContacts(): WalletContact[] {
  return readAddressBook();
}

export function saveAddressBookContact(
  name: string,
  address: string,
): { success: boolean; contact?: WalletContact; error?: string } {
  if (!name.trim()) return { success: false, error: "Name is required" };
  if (!address.trim()) return { success: false, error: "Address is required" };

  const contacts = readAddressBook();

  // Check for duplicate name (case-insensitive)
  const existing = contacts.find(
    (c) => c.name.toLowerCase() === name.trim().toLowerCase(),
  );
  if (existing) {
    // Update existing contact
    existing.address = address.trim();
    const ok = writeAddressBook(contacts);
    return ok
      ? { success: true, contact: existing }
      : { success: false, error: "Failed to save" };
  }

  const contact: WalletContact = {
    id: `contact-${Date.now()}`,
    name: name.trim(),
    address: address.trim(),
    createdAt: Date.now(),
  };
  contacts.push(contact);
  const ok = writeAddressBook(contacts);
  return ok
    ? { success: true, contact }
    : { success: false, error: "Failed to save" };
}

export function deleteAddressBookContact(
  id: string,
): { success: boolean; error?: string } {
  const contacts = readAddressBook();
  const filtered = contacts.filter((c) => c.id !== id);
  if (filtered.length === contacts.length) {
    return { success: false, error: "Contact not found" };
  }
  const ok = writeAddressBook(filtered);
  return ok ? { success: true } : { success: false, error: "Failed to delete" };
}

export function lookupContact(name: string): WalletContact | null {
  const contacts = readAddressBook();
  return (
    contacts.find(
      (c) => c.name.toLowerCase() === name.trim().toLowerCase(),
    ) || null
  );
}
