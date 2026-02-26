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
import type { VaultBox, VaultConfig } from "./types";

// =============================================================================
// File Path & Defaults
// =============================================================================

const vaultPath = path.join(app.getPath("userData"), "vault.json");

const DEFAULT_VAULT: VaultConfig = {
  boxes: [],
};

// =============================================================================
// Persistence
// =============================================================================

/** Load vault config from disk, returning defaults if missing/corrupt. */
export function loadVault(): VaultConfig {
  try {
    if (fs.existsSync(vaultPath)) {
      const data = fs.readFileSync(vaultPath, "utf8");
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_VAULT,
        ...parsed,
        boxes: Array.isArray(parsed.boxes) ? parsed.boxes : [],
      };
    }
  } catch (error) {
    console.error("[Vault] Failed to load vault config:", error);
  }
  return { ...DEFAULT_VAULT };
}

/** Save vault config to disk. */
function saveVault(config: VaultConfig): { success: boolean; error?: string } {
  try {
    fs.writeFileSync(vaultPath, JSON.stringify(config, null, 2), "utf8");
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
export function deleteBox(id: string): { success: boolean; error?: string } {
  const vault = loadVault();
  const index = vault.boxes.findIndex((b) => b.id === id);

  if (index === -1) {
    return { success: false, error: "Box not found" };
  }

  vault.boxes.splice(index, 1);
  return saveVault(vault);
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
