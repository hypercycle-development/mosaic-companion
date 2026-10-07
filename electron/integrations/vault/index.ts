/**
 * Vault Module
 *
 * Persistence and CRUD for the user's Vault (named boxes).
 * Stored at: ~/.config/mosaic-companion/vault.json
 *
 * Follows the same JSON-file pattern as settings.ts and ai-agents in main.ts.
 */

import { app } from "electron";
import fs from "fs";
import path from "path";
import type { VaultBox, VaultConfig, VaultEntry, BoxContentResult } from "./types";
import { openRecord, plaintextRecord } from "./crypto";
import { writeFileAtomic } from "../../utils/atomicWrite";

// =============================================================================
// File Paths & Defaults
// =============================================================================

const vaultPath = path.join(app.getPath("userData"), "vault.json");
const vaultContentDir = path.join(app.getPath("userData"), "vault-content");

/** Ensure the vault-content directory exists. */
function ensureContentDir(): void {
  if (!fs.existsSync(vaultContentDir)) {
    fs.mkdirSync(vaultContentDir, { recursive: true });
  }
}

/** Path for a box's content file. */
function boxContentPath(boxId: string): string {
  return path.join(vaultContentDir, `${boxId}.json`);
}

const DEFAULT_VAULT: VaultConfig = {
  boxes: [],
};

// =============================================================================
// Persistence
// =============================================================================

/**
 * Set when `vault.json` exists but could not be read as a vault config, and
 * cleared on every successful load. While it is set, `saveVault` refuses.
 *
 * Without this, a half-written `vault.json` loaded as "no boxes" and the next
 * `addBox` saved that over the top — every box gone from the index, and every
 * content file orphaned on disk with nothing left pointing at it. The config
 * is small and rewritten often, so the window is not theoretical.
 *
 * Read degrades (an unreadable config lists no boxes); writes refuse. That
 * asymmetry is the whole guard: nothing is destroyed, and the file is left
 * exactly as found for manual recovery.
 */
let vaultConfigUnreadable: string | null = null;

/** Whether the vault config on disk is present but unreadable. */
export function vaultConfigError(): string | null {
  return vaultConfigUnreadable;
}

/** Load vault config from disk, returning defaults if missing. */
export function loadVault(): VaultConfig {
  try {
    if (fs.existsSync(vaultPath)) {
      const data = fs.readFileSync(vaultPath, "utf8");
      const parsed = JSON.parse(data);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("vault.json is not a vault config object");
      }
      if (!Array.isArray(parsed.boxes)) {
        throw new Error("vault.json has no box list");
      }
      vaultConfigUnreadable = null;
      return { ...DEFAULT_VAULT, ...parsed, boxes: parsed.boxes };
    }
    // Absent is legitimately empty — a first run. Distinct from unreadable,
    // and the only case where writing a fresh config is correct.
    vaultConfigUnreadable = null;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    vaultConfigUnreadable = msg;
    console.error("[Vault] vault.json is present but unreadable:", msg);
  }
  // Fresh array: a shallow spread would alias DEFAULT_VAULT.boxes, which the
  // callers of addBox and deleteBox then mutate in place.
  return { ...DEFAULT_VAULT, boxes: [] };
}

/** Save vault config to disk. */
function saveVault(config: VaultConfig): { success: boolean; error?: string } {
  if (vaultConfigUnreadable) {
    return {
      success: false,
      error:
        `The vault index could not be read (${vaultConfigUnreadable}), so it will not be ` +
        `overwritten. Your boxes are still on disk.`,
    };
  }
  try {
    writeFileAtomic(vaultPath, JSON.stringify(config, null, 2));
    console.log("[Vault] Config saved to:", vaultPath);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Vault] Failed to save:", msg);
    return { success: false, error: msg };
  }
}

// =============================================================================
// CRUD Operations
// =============================================================================

/** Get all boxes. */
export function getBoxes(): VaultBox[] {
  return loadVault().boxes;
}

/** Get a single box by ID. */
export function getBox(id: string): VaultBox | null {
  return getBoxes().find((b) => b.id === id) ?? null;
}

/** Create a new box. */
export function addBox(
  input: Partial<Omit<VaultBox, "id" | "createdAt" | "updatedAt">>,
): { success: boolean; box?: VaultBox; error?: string } {
  if (!input.name || input.name.trim().length === 0) {
    return { success: false, error: "Box name is required" };
  }

  const vault = loadVault();

  // Prevent duplicate names
  const nameExists = vault.boxes.some(
    (b) => b.name.toLowerCase() === input.name!.trim().toLowerCase(),
  );
  if (nameExists) {
    return { success: false, error: `A box named "${input.name.trim()}" already exists` };
  }

  const now = Date.now();
  const box: VaultBox = {
    id: `box-${now}`,
    name: input.name.trim(),
    description: input.description?.trim() || undefined,
    sourceType: input.sourceType || "manual",
    createdAt: now,
    updatedAt: now,
  };

  vault.boxes.push(box);
  const result = saveVault(vault);
  return { ...result, box };
}

/** Update an existing box (partial update). */
export function updateBox(
  id: string,
  updates: Partial<Omit<VaultBox, "id" | "createdAt">>,
): { success: boolean; box?: VaultBox; error?: string } {
  const vault = loadVault();
  const index = vault.boxes.findIndex((b) => b.id === id);

  if (index === -1) {
    return { success: false, error: "Box not found" };
  }

  // If renaming, check for duplicates (exclude self)
  if (updates.name) {
    const nameExists = vault.boxes.some(
      (b) =>
        b.id !== id &&
        b.name.toLowerCase() === updates.name!.trim().toLowerCase(),
    );
    if (nameExists) {
      return { success: false, error: `A box named "${updates.name.trim()}" already exists` };
    }
  }

  vault.boxes[index] = {
    ...vault.boxes[index],
    ...updates,
    updatedAt: Date.now(),
  };

  const result = saveVault(vault);
  return { ...result, box: vault.boxes[index] };
}

/** Delete a box by ID. */
export function deleteBox(
  id: string,
): { success: boolean; error?: string; setAside?: string } {
  // Read the content before touching the config, so the decision below is made
  // on what is actually on disk rather than on what survived the delete.
  const loaded = loadBoxContent(id);
  const vault = loadVault();
  const index = vault.boxes.findIndex((b) => b.id === id);

  if (index === -1) {
    return { success: false, error: "Box not found" };
  }

  vault.boxes.splice(index, 1);
  const result = saveVault(vault);
  if (!result.success) {
    // The box is still listed on disk; deleting its content now would leave a
    // box whose entries are gone.
    return result;
  }

  // Clean up the content file — unless we could not read it, in which case it
  // is the only surviving copy of data the user was never shown. Deleting a
  // box is a deliberate act, but "delete the box that looks empty" is not a
  // deliberate act about *this* data: a collapsed box card cannot show that the
  // content is unreadable, so the user making this choice may not know there is
  // anything in it. Set it aside instead, and say so.
  let setAside: string | undefined;
  try {
    const contentFile = boxContentPath(id);
    if (fs.existsSync(contentFile)) {
      if (loaded.state === "unreadable") {
        setAside = `${contentFile}.unreadable-${Date.now()}`;
        fs.renameSync(contentFile, setAside);
        console.warn("[Vault] Box content was unreadable; set aside rather than deleted:", setAside);
      } else {
        fs.unlinkSync(contentFile);
        console.log("[Vault] Content file deleted for box:", id);
      }
    }
  } catch (err) {
    console.warn("[Vault] Could not clean up content file for box:", id, err);
  }

  return setAside ? { ...result, setAside } : result;
}

// =============================================================================
// Agent Access Helpers
// =============================================================================

/**
 * Get all boxes that a specific agent has access to.
 * Reads the agent's config from ai-agents.json to find its boxAccess array,
 * then returns matching boxes from the vault.
 */
export function getAgentBoxes(agentId: string): VaultBox[] {
  const agentsPath = path.join(app.getPath("userData"), "ai-agents.json");

  let agents: Array<{ id: string; boxAccess?: string[]; [key: string]: unknown }> = [];
  try {
    if (fs.existsSync(agentsPath)) {
      agents = JSON.parse(fs.readFileSync(agentsPath, "utf8"));
    }
  } catch {
    return [];
  }

  const agent = agents.find((a) => a.id === agentId);
  if (!agent || !agent.boxAccess || agent.boxAccess.length === 0) {
    return [];
  }

  const allBoxes = getBoxes();
  const accessSet = new Set(agent.boxAccess);
  return allBoxes.filter((b) => accessSet.has(b.id));
}

/**
 * Check whether an agent has access to a specific box.
 */
export function canAgentAccessBox(agentId: string, boxId: string): boolean {
  const agentBoxes = getAgentBoxes(agentId);
  return agentBoxes.some((b) => b.id === boxId);
}

// =============================================================================
// Box Content CRUD
// =============================================================================

/** Load a box's content from disk. Returns empty content if not found. */
function loadBoxContent(boxId: string): BoxContentResult {
  ensureContentDir();
  const filePath = boxContentPath(boxId);
  let raw: string;
  try {
    if (!fs.existsSync(filePath)) {
      // Absent is a legitimately empty box, and the only empty a write may
      // proceed from.
      return { state: "ok", entries: [], encrypted: false };
    }
    raw = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Vault] Failed to read content for box:", boxId, msg);
    return { state: "unreadable", reason: msg };
  }

  // `openRecord` owns every question about what a content file may contain —
  // shape, discrimination, and (once WP4 lands) decryption. It never throws.
  const record = openRecord(boxId, raw);
  if (record.state === "unreadable") {
    console.error("[Vault] Box content unreadable:", boxId, record.reason);
    return { state: "unreadable", reason: record.reason };
  }
  return { state: "ok", entries: record.entries, encrypted: record.state === "encrypted" };
}

/**
 * Save a box's content to disk.
 *
 * Takes `(boxId, entries)` and not a `BoxContent`, deliberately: an object
 * parameter invites `{ ...content, enc }` at the call site, which would
 * serialise the plaintext entries into the same file as the ciphertext and
 * `JSON.stringify` would happily emit both. This signature makes that
 * unrepresentable — the function never receives an object it could spread.
 */
function saveBoxContent(
  boxId: string,
  entries: VaultEntry[],
): { success: boolean; error?: string } {
  ensureContentDir();
  try {
    // Plaintext for now; WP4 swaps this one call for `sealEntries`. The file
    // shape has a single owner either way.
    const record = plaintextRecord(boxId, entries);
    writeFileAtomic(boxContentPath(boxId), record.json);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Vault] Failed to save content for box:", boxId, msg);
    return { success: false, error: msg };
  }
}

/** Get all entries in a box, or why they could not be read. */
export function getBoxContent(boxId: string): BoxContentResult {
  return loadBoxContent(boxId);
}

/** The refusal every mutator returns for a box that could not be read. */
function refuseUnreadable(reason: string): { success: false; error: string } {
  return {
    success: false,
    error:
      `This box could not be read (${reason}), so it will not be overwritten. ` +
      `Its file has been left exactly as it is.`,
  };
}

/** Add a new entry to a box. */
export function addEntry(
  boxId: string,
  input: { content: string; label?: string },
): { success: boolean; entry?: VaultEntry; error?: string } {
  if (!input.content || input.content.trim().length === 0) {
    return { success: false, error: "Entry content cannot be empty" };
  }

  const loaded = loadBoxContent(boxId);
  // The one path that actually destroyed data: an unreadable box read as empty,
  // then a new entry saved over the top of whatever was really there.
  if (loaded.state === "unreadable") return refuseUnreadable(loaded.reason);

  const now = Date.now();
  const entry: VaultEntry = {
    id: `entry-${now}`,
    label: input.label?.trim() || undefined,
    content: input.content.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const entries = [...loaded.entries, entry];
  const result = saveBoxContent(boxId, entries);
  return { ...result, entry };
}

/** Update an existing entry (partial). */
export function updateEntry(
  boxId: string,
  entryId: string,
  updates: { content?: string; label?: string },
): { success: boolean; entry?: VaultEntry; error?: string } {
  const loaded = loadBoxContent(boxId);
  if (loaded.state === "unreadable") return refuseUnreadable(loaded.reason);

  const entries = [...loaded.entries];
  const index = entries.findIndex((e) => e.id === entryId);

  if (index === -1) {
    return { success: false, error: "Entry not found" };
  }

  entries[index] = {
    ...entries[index],
    ...updates,
    updatedAt: Date.now(),
  };

  const result = saveBoxContent(boxId, entries);
  return { ...result, entry: entries[index] };
}

/** Delete an entry from a box. */
export function deleteEntry(
  boxId: string,
  entryId: string,
): { success: boolean; error?: string } {
  const loaded = loadBoxContent(boxId);
  if (loaded.state === "unreadable") return refuseUnreadable(loaded.reason);

  const entries = [...loaded.entries];
  const index = entries.findIndex((e) => e.id === entryId);

  if (index === -1) {
    return { success: false, error: "Entry not found" };
  }

  entries.splice(index, 1);
  return saveBoxContent(boxId, entries);
}
