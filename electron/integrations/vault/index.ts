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
import { openRecord, sealEntries, encryptionStatus, type EncryptionStatus } from "./crypto";
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
 * The vault config as read, or why it could not be read.
 *
 * A returned value rather than a module flag. The guard has to be tied to the
 * very read a mutation was computed from — a flag set by one call and consulted
 * by another is only correct while nothing can interleave between them, and
 * that invariant is not one the type system or the reviewer can see.
 */
type VaultConfigResult =
  | { state: "ok"; config: VaultConfig }
  | { state: "unreadable"; reason: string };

function readVault(): VaultConfigResult {
  try {
    if (!fs.existsSync(vaultPath)) {
      // Absent is legitimately empty — a first run, and the only case where
      // writing a fresh config is correct.
      return { state: "ok", config: { ...DEFAULT_VAULT, boxes: [] } };
    }
    const parsed = JSON.parse(fs.readFileSync(vaultPath, "utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("vault.json is not a vault config object");
    }
    if (!Array.isArray(parsed.boxes)) {
      throw new Error("vault.json has no box list");
    }
    // Fresh array: a shallow spread would alias DEFAULT_VAULT.boxes, which the
    // callers of addBox and deleteBox then mutate in place.
    return { state: "ok", config: { ...DEFAULT_VAULT, ...parsed, boxes: parsed.boxes } };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Vault] vault.json is present but unreadable:", msg);
    return { state: "unreadable", reason: msg };
  }
}

/** Whether the vault config on disk is present but unreadable. */
export function vaultConfigError(): string | null {
  const read = readVault();
  return read.state === "unreadable" ? read.reason : null;
}

/**
 * Load vault config from disk, degrading an unreadable one to an empty list.
 *
 * Reads degrade; writes refuse. Only `mutateVault` may write, and it makes its
 * own read, so a caller of this can never use it as the basis for a save.
 */
export function loadVault(): VaultConfig {
  const read = readVault();
  return read.state === "ok" ? read.config : { ...DEFAULT_VAULT, boxes: [] };
}

/**
 * The only path that writes `vault.json`.
 *
 * Reads, refuses if unreadable, applies `mutate`, writes. Load and save are the
 * same call, so there is no window in which the config could be repaired — or
 * corrupted — between the two, and no way to save a config derived from a read
 * that failed.
 */
function mutateVault<T>(
  mutate: (vault: VaultConfig) => { error: string } | { value: T },
): { success: boolean; error?: string; value?: T } {
  const read = readVault();
  if (read.state === "unreadable") {
    return {
      success: false,
      error:
        `The vault index could not be read (${read.reason}), so it will not be ` +
        `overwritten. Your boxes are still on disk.`,
    };
  }
  const outcome = mutate(read.config);
  if ("error" in outcome) return { success: false, error: outcome.error };
  try {
    writeFileAtomic(vaultPath, JSON.stringify(read.config, null, 2));
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[Vault] Failed to save:", msg);
    return { success: false, error: msg };
  }
  return { success: true, value: outcome.value };
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

  const result = mutateVault<VaultBox>((vault) => {
    // Prevent duplicate names
    const nameExists = vault.boxes.some(
      (b) => b.name.toLowerCase() === input.name!.trim().toLowerCase(),
    );
    if (nameExists) {
      return { error: `A box named "${input.name.trim()}" already exists` };
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
    return { value: box };
  });
  return { success: result.success, error: result.error, box: result.value };
}

/** Update an existing box (partial update). */
export function updateBox(
  id: string,
  updates: Partial<Omit<VaultBox, "id" | "createdAt">>,
): { success: boolean; box?: VaultBox; error?: string } {
  const result = mutateVault<VaultBox>((vault) => {
    const index = vault.boxes.findIndex((b) => b.id === id);
    if (index === -1) return { error: "Box not found" };

    // If renaming, check for duplicates (exclude self)
    if (updates.name) {
      const nameExists = vault.boxes.some(
        (b) =>
          b.id !== id &&
          b.name.toLowerCase() === updates.name!.trim().toLowerCase(),
      );
      if (nameExists) {
        return { error: `A box named "${updates.name.trim()}" already exists` };
      }
    }

    vault.boxes[index] = { ...vault.boxes[index], ...updates, updatedAt: Date.now() };
    return { value: vault.boxes[index] };
  });
  return { success: result.success, error: result.error, box: result.value };
}

/** Delete a box by ID. */
export function deleteBox(
  id: string,
): { success: boolean; error?: string; setAside?: string } {
  // Read the content before touching the config, so the decision below is made
  // on what is actually on disk rather than on what survived the delete.
  const loaded = loadBoxContent(id);
  const result = mutateVault<true>((vault) => {
    const index = vault.boxes.findIndex((b) => b.id === id);
    if (index === -1) return { error: "Box not found" };
    vault.boxes.splice(index, 1);
    return { value: true };
  });
  if (!result.success) {
    // The box is still listed on disk; deleting its content now would leave a
    // box whose entries are gone.
    return { success: false, error: result.error };
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
  if (record.state === "encrypted") {
    // A successful decrypt is real evidence — it proves the backend works and
    // that this box is sealed. Recording it here is what stops a session that
    // only *reads* encrypted boxes from telling the user their vault is stored
    // in the clear, which is a false statement rather than a cautious one.
    // `encryptionStatus()` cannot prompt at this point: the key was just used.
    noteEncryptionStatus(encryptionStatus());
  }
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
  wasEncrypted: boolean,
): { success: boolean; error?: string } {
  ensureContentDir();
  const record = sealEntries(boxId, entries);
  // The record's own status, never `record.encrypted` collapsed to a boolean.
  // A Linux `basic_text` backend seals successfully — `encrypted` is true — over
  // data that is obfuscated, not protected. Deriving the banner from the boolean
  // showed exactly those users a green light saying their vault was safe.
  noteEncryptionStatus(record.status);

  // **Never downgrade a box that was encrypted.** `sealEntries` falls back to
  // plaintext when the backend is unavailable — which, on macOS, is what
  // clicking Cancel on the keychain prompt produces. Without this check a user
  // who dismissed that dialog would have their next save write an
  // already-encrypted box back out in the clear, silently, in the ordinary
  // course of adding an entry.
  //
  // The test is the box's own prior state rather than the platform, so it holds
  // wherever the backend can come and go.
  if (wasEncrypted && !record.encrypted) {
    return {
      success: false,
      error:
        "This box is encrypted and MosAIc could not reach the encryption key, so it was " +
        "not saved. Nothing has been changed on disk. Unlock your keychain and try again.",
    };
  }

  try {
    writeFileAtomic(boxContentPath(boxId), record.json);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Vault] Failed to save content for box:", boxId, msg);
    return { success: false, error: msg };
  }
}

/**
 * Last encryption status actually observed, and never `isEncryptionAvailable()`
 * called on demand.
 *
 * Asking safeStorage whether encryption is available can raise a modal OS
 * password prompt — verified on macOS 2026-08-25. So the UI must never trigger
 * that question by rendering. This records what was learned while doing work
 * the user asked for, and the status IPC serves the record.
 */
let observedStatus: EncryptionStatus | "unknown" = "unknown";

function noteEncryptionStatus(status: EncryptionStatus): void {
  observedStatus = status;
}

/** What was last observed. Never prompts; "unknown" until real work happens. */
export function lastObservedEncryptionStatus(): EncryptionStatus | "unknown" {
  return observedStatus;
}

/**
 * Forget what was observed, returning to "unknown".
 *
 * Session state, so in the app this only ever happens at launch — nothing calls
 * it. It exists because the alternative is leaving WP5's initial state and its
 * transitions untested, and a status the user reads should not be the one part
 * of this module nothing pins.
 */
export function resetObservedEncryptionStatus(): void {
  observedStatus = "unknown";
}

/**
 * Get all entries in a box, or why they could not be read — upgrading a legacy
 * plaintext box to encrypted on the way past.
 *
 * Upgrade-on-open, and only on open: there is no sweep, so a box the user never
 * opens stays as it is. Two conditions, both load-bearing:
 *
 * - **Only when the seal actually encrypted.** `sealEntries` falls back to
 *   plaintext rather than failing, so without this a machine with no keychain
 *   would rewrite every legacy box in plaintext on every single open, forever —
 *   the file stays legacy-shaped, so the condition never clears.
 * - **Never on a failed write.** A failure here is not the user's operation
 *   failing; they asked to read. So it is logged and swallowed, and the entries
 *   they asked for are returned regardless.
 *
 * `upgrade: false` opts out, and the agent tool path passes it. Sealing probes
 * the keychain, which on macOS can raise a modal password dialog — and an
 * agent's tool call is not a moment when the user is expecting to be asked for
 * their password, with nothing on screen to say what wants it. An autonomous
 * read should also not rewrite the file it read. A legacy box an agent touches
 * is simply left for the next time a person opens it.
 */
export function getBoxContent(
  boxId: string,
  opts?: { upgrade?: boolean },
): BoxContentResult {
  const loaded = loadBoxContent(boxId);
  if (loaded.state !== "ok" || loaded.encrypted) return loaded;
  // Callers that are not a person can opt out. See `upgrade` in the doc above.
  if (opts?.upgrade === false) return loaded;
  if (loaded.entries.length === 0 && !fs.existsSync(boxContentPath(boxId))) {
    // A box with no file yet. Nothing to upgrade, and writing one here would
    // create a file for a box the user has never put anything in.
    return loaded;
  }

  const sealed = sealEntries(boxId, loaded.entries);
  noteEncryptionStatus(sealed.status);
  if (!sealed.encrypted) return loaded;

  try {
    writeFileAtomic(boxContentPath(boxId), sealed.json);
    console.log("[Vault] Upgraded box content to encrypted at rest:", boxId);
    return { ...loaded, encrypted: true };
  } catch (error) {
    console.warn("[Vault] Could not upgrade box to encrypted; leaving it as it is:", boxId, error);
    return loaded;
  }
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
  const result = saveBoxContent(boxId, entries, loaded.encrypted);
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

  const result = saveBoxContent(boxId, entries, loaded.encrypted);
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
  return saveBoxContent(boxId, entries, loaded.encrypted);
}
