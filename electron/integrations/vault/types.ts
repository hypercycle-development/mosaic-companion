/**
 * Vault Types
 *
 * The Vault is MosAIc's structured data storage layer.
 * Users put data into named "boxes" inside the vault.
 * Each AI agent's config specifies which boxes it can access.
 */

// =============================================================================
// Box Source Types
// =============================================================================

/**
 * How data gets into a box.
 * - "manual"    → User manually added content
 * - "import"    → One-time bulk import (e.g. import all emails)
 * - "connector" → Ongoing input (e.g. IMAP polling)
 */
export type BoxSourceType = "manual" | "import" | "connector";

// =============================================================================
// Vault Box
// =============================================================================

/** A named container for user data inside the Vault */
export interface VaultBox {
  /** Unique identifier (e.g. "box-1740528000000") */
  id: string;
  /** Human-readable name (e.g. "Alice's Emails") */
  name: string;
  /** Optional description of what this box contains */
  description?: string;
  /** How data enters this box */
  sourceType: BoxSourceType;
  /** Unix timestamp — when the box was created */
  createdAt: number;
  /** Unix timestamp — last modification */
  updatedAt: number;
}

// =============================================================================
// Vault Config (persisted to disk)
// =============================================================================

/** The full vault configuration stored at ~/.config/mosaic-companion/vault.json */
export interface VaultConfig {
  boxes: VaultBox[];
}
