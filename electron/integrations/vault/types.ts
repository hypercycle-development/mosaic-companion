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

// =============================================================================
// Box Content (persisted per-box to disk)
// =============================================================================

/** A single piece of text content inside a box */
export interface VaultEntry {
  /** Unique identifier (e.g. "entry-1740528000000") */
  id: string;
  /** Optional short label / title for this entry */
  label?: string;
  /** The actual text content */
  content: string;
  /** Optional structured metadata (for Taste-Skill format, dials, triggers) */
  metadata?: TasteSkillMetadata;
  /** Unix timestamp — when the entry was created */
  createdAt: number;
  /** Unix timestamp — last modification */
  updatedAt: number;
}

/** Taste-Skill structured metadata for rich skill entries */
export interface TasteSkillMetadata {
  /** Install name used for reference (e.g. "design-taste-frontend") */
  installName: string;
  /** Skill category for grouping */
  category: string;
  /** Source repository URL */
  sourceRepo?: string;
  /** Whether this is a Taste-Skill formatted entry */
  isTasteSkill: boolean;
  /** Version string if available */
  version?: string;
  /** The three dials (1-10 scale) */
  dials?: {
    /** DESIGN_VARIANCE: 1=Perfect Symmetry, 10=Artsy Chaos */
    designVariance?: number;
    /** MOTION_INTENSITY: 1=Static, 10=Cinematic/Physics */
    motionIntensity?: number;
    /** VISUAL_DENSITY: 1=Art Gallery/Airy, 10=Cockpit/Packed */
    visualDensity?: number;
  };
  /** Signal-to-preset trigger mappings */
  triggers?: TasteSkillTrigger[];
  /** Named preset configurations */
  presets?: TasteSkillPreset[];
  /** Whether this skill produces code or just reference images */
  outputType?: "code" | "images" | "both";
}

/** A trigger maps a brief signal to dial values */
export interface TasteSkillTrigger {
  /** The signal to match (e.g. "minimalist / clean / calm") */
  signal: string;
  /** Dial values when this signal matches */
  variance: number;
  motion: number;
  density: number;
}

/** A named preset configuration */
export interface TasteSkillPreset {
  /** Preset name (e.g. "Landing (SaaS, mainstream)") */
  name: string;
  /** Dial values for this preset */
  variance: number;
  motion: number;
  density: number;
}

/**
 * The content file for a single box.
 * Stored at ~/.config/mosaic-companion/vault-content/<boxId>.json
 */
export interface BoxContent {
  boxId: string;
  entries: VaultEntry[];
}
