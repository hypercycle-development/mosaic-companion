/**
 * Addon manifest.json schema, validation, and the fixed vocabularies
 * referenced throughout the addon system (reserved IPC namespaces, the
 * permission list). See docs/admin/tab-plugin-architecture-design.md §2.
 *
 * Validation is hand-rolled (no schema library dependency) per the design
 * doc: "implemented in electron/addons/manifest.ts, hand-rolled — no new
 * schema dependency". `semver` is already a project dependency and is used
 * only for version-string validation, not schema validation itself.
 */

import semver from "semver";

// =============================================================================
// Types
// =============================================================================

/** v1 only supports "tab" — the loader dispatches through a mount-handler
 * registry (added in a later phase) so future values are additive. */
export type MountPoint = "tab";

export type UpdateCheckMode = "manual" | "automatic";

export interface ManifestTabConfig {
  label: string;
  icon: string;
  order: number;
  deepLink?: { param: string };
}

export interface ManifestMainConfig {
  entry: string;
}

export interface ManifestRendererConfig {
  entry: string;
}

export interface ManifestUpdatesConfig {
  checkMode: UpdateCheckMode;
}

/** A validated, defaults-applied manifest — never construct this directly;
 * only `validateManifest` produces one. */
export interface AddonManifest {
  manifestVersion: 1;
  id: string;
  version: string;
  name: string;
  description: string;
  author?: string;
  homepage?: string;
  minAppVersion?: string;
  ipcNamespace: string;
  mountPoint: MountPoint;
  tab: ManifestTabConfig;
  main?: ManifestMainConfig;
  renderer: ManifestRendererConfig;
  permissions: string[];
  updates: ManifestUpdatesConfig;
  linkVisibilityToActivation: boolean;
}

export type ManifestValidationResult =
  | { valid: true; manifest: AddonManifest; errors: [] }
  | { valid: false; manifest?: undefined; errors: string[] };

// =============================================================================
// Fixed vocabularies
// =============================================================================

/**
 * Reserved IPC namespaces — every prefix currently registered in
 * `electron/main.ts`, `preload.ts`, and the plugin integrations, plus the
 * addon system's own namespaces (§2). An addon's `ipcNamespace` must not
 * collide with any of these. This list shrinks as core migrates features to
 * addons (e.g. `hyperinsight` drops out once Phase 7 ships) — kept as a
 * flat, hand-maintained constant per the design doc, not derived dynamically.
 */
export const RESERVED_IPC_NAMESPACES: readonly string[] = [
  "nodes",
  "ai-agents",
  "ai-agents-history",
  "themes",
  "gmail",
  "web3",
  "vault",
  "media",
  "window",
  "dialog",
  "sandbox",
  "toolSandbox",
  "chronicle",
  "tools",
  "mcp",
  "chat",
  "ide",
  "hyperinsight",
  "aimnodes",
  "payments-jit",
  "addon",
  "addon-api",
  "addons",
  "tab-prefs",
];

/** Permissions grantable to addons in v1 (§5.2). */
export const PERMISSION_VOCABULARY: readonly string[] = [
  "wallet:read",
  "agents:read",
  "agents:write",
  "mcp:read",
  "mcp:call",
  "nodes:read",
  "shell:open-external",
];

/**
 * Named in the vocabulary so the strings are stable when they eventually
 * ship, but rejected at install time in v1 (§5.2).
 */
export const RESERVED_PERMISSIONS: readonly string[] = [
  "wallet:sign",
  "agents:delete",
  "vault:read",
  "vault:write",
  "notifications",
];

const ID_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;
const IPC_NAMESPACE_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;
const MAX_NAME_LENGTH = 40;
const MAX_DESCRIPTION_LENGTH = 200;
const MAX_TAB_LABEL_LENGTH = 24;
const DEFAULT_TAB_ORDER = 100;

// =============================================================================
// Validation
// =============================================================================

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Rejects any relative path with a ".." segment, escaping its own root. */
function hasPathTraversal(relPath: string): boolean {
  return relPath.split(/[\\/]/).some((segment) => segment === "..");
}

/**
 * Validate a parsed manifest.json against the full v1 schema (§2).
 * `dirName` is the addon's directory name — the manifest's `id` must equal it.
 */
export function validateManifest(json: unknown, dirName: string): ManifestValidationResult {
  const errors: string[] = [];

  if (!isPlainObject(json)) {
    return { valid: false, errors: ["manifest.json must be a JSON object"] };
  }
  const m = json;

  // ── Identity ────────────────────────────────────────────────────────────
  if (m.manifestVersion !== 1) {
    errors.push(`Unsupported manifestVersion: ${JSON.stringify(m.manifestVersion)} (only 1 is accepted)`);
  }

  if (typeof m.id !== "string" || !ID_PATTERN.test(m.id)) {
    errors.push(`Invalid id: ${JSON.stringify(m.id)} (must match ${ID_PATTERN})`);
  } else if (m.id !== dirName) {
    errors.push(`Manifest id "${m.id}" must equal the addon directory name "${dirName}"`);
  }

  if (typeof m.version !== "string" || !semver.valid(m.version)) {
    errors.push(`Invalid version: ${JSON.stringify(m.version)} (must be valid semver)`);
  }

  if (typeof m.name !== "string" || m.name.length === 0 || m.name.length > MAX_NAME_LENGTH) {
    errors.push(`Invalid name (must be 1-${MAX_NAME_LENGTH} chars)`);
  }

  if (
    typeof m.description !== "string" ||
    m.description.length === 0 ||
    m.description.length > MAX_DESCRIPTION_LENGTH
  ) {
    errors.push(`Invalid description (must be 1-${MAX_DESCRIPTION_LENGTH} chars)`);
  }

  // ── Optional identity ──────────────────────────────────────────────────
  if (m.author !== undefined && typeof m.author !== "string") {
    errors.push("author must be a string if present");
  }
  if (m.homepage !== undefined && typeof m.homepage !== "string") {
    errors.push("homepage must be a string if present");
  }
  if (m.minAppVersion !== undefined && (typeof m.minAppVersion !== "string" || !semver.valid(m.minAppVersion))) {
    errors.push(`Invalid minAppVersion: ${JSON.stringify(m.minAppVersion)} (must be valid semver)`);
  }

  // ── Wiring ─────────────────────────────────────────────────────────────
  if (typeof m.ipcNamespace !== "string" || !IPC_NAMESPACE_PATTERN.test(m.ipcNamespace)) {
    errors.push(`Invalid ipcNamespace: ${JSON.stringify(m.ipcNamespace)} (must match ${IPC_NAMESPACE_PATTERN})`);
  } else if (RESERVED_IPC_NAMESPACES.includes(m.ipcNamespace)) {
    errors.push(`ipcNamespace "${m.ipcNamespace}" is reserved`);
  }

  if (m.mountPoint !== "tab") {
    errors.push(`Unsupported mountPoint: ${JSON.stringify(m.mountPoint)} (v1 only supports "tab")`);
  }

  // ── Mount-point config block ──────────────────────────────────────────
  let tabConfig: ManifestTabConfig | undefined;
  if (m.mountPoint === "tab") {
    const tab = m.tab;
    if (!isPlainObject(tab)) {
      errors.push('Missing "tab" config block (required for mountPoint "tab")');
    } else {
      let tabValid = true;
      if (typeof tab.label !== "string" || tab.label.length === 0 || tab.label.length > MAX_TAB_LABEL_LENGTH) {
        errors.push(`Invalid tab.label (must be 1-${MAX_TAB_LABEL_LENGTH} chars)`);
        tabValid = false;
      }
      if (typeof tab.icon !== "string" || tab.icon.length === 0) {
        errors.push("Invalid tab.icon (must be a non-empty string)");
        tabValid = false;
      }
      if (tab.order !== undefined && (typeof tab.order !== "number" || !Number.isInteger(tab.order))) {
        errors.push("tab.order must be an integer if present");
        tabValid = false;
      }
      let deepLink: { param: string } | undefined;
      if (tab.deepLink !== undefined) {
        if (
          !isPlainObject(tab.deepLink) ||
          typeof tab.deepLink.param !== "string" ||
          tab.deepLink.param.length === 0
        ) {
          errors.push("tab.deepLink must be an object with a non-empty string 'param' if present");
          tabValid = false;
        } else {
          deepLink = { param: tab.deepLink.param };
        }
      }
      if (tabValid) {
        tabConfig = {
          label: tab.label as string,
          icon: tab.icon as string,
          order: (tab.order as number | undefined) ?? DEFAULT_TAB_ORDER,
          deepLink,
        };
      }
    }
  }

  // ── Entry points ───────────────────────────────────────────────────────
  let mainConfig: ManifestMainConfig | undefined;
  if (m.main !== undefined) {
    if (!isPlainObject(m.main) || typeof m.main.entry !== "string" || m.main.entry.length === 0) {
      errors.push('Invalid "main" block (must be { entry: string } if present)');
    } else if (hasPathTraversal(m.main.entry)) {
      errors.push('main.entry must not escape the addon directory ("..")');
    } else {
      mainConfig = { entry: m.main.entry };
    }
  }

  let rendererConfig: ManifestRendererConfig | undefined;
  if (m.mountPoint === "tab") {
    const renderer = m.renderer;
    if (!isPlainObject(renderer) || typeof renderer.entry !== "string" || renderer.entry.length === 0) {
      errors.push('Missing or invalid "renderer.entry" (required for mountPoint "tab")');
    } else if (hasPathTraversal(renderer.entry)) {
      errors.push('renderer.entry must not escape the addon directory ("..")');
    } else {
      rendererConfig = { entry: renderer.entry };
    }
  }

  // ── Security ───────────────────────────────────────────────────────────
  let permissions: string[] = [];
  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions) || m.permissions.some((p) => typeof p !== "string")) {
      errors.push("permissions must be an array of strings");
    } else {
      permissions = m.permissions as string[];
      for (const p of permissions) {
        if (RESERVED_PERMISSIONS.includes(p)) {
          errors.push(`Permission "${p}" is reserved and cannot be requested in v1`);
        } else if (!PERMISSION_VOCABULARY.includes(p)) {
          errors.push(`Unknown permission: "${p}"`);
        }
      }
    }
  }

  // ── Update policy ──────────────────────────────────────────────────────
  let updateCheckMode: UpdateCheckMode = "manual";
  if (m.updates !== undefined) {
    if (!isPlainObject(m.updates)) {
      errors.push('"updates" must be an object if present');
    } else if (
      m.updates.checkMode !== undefined &&
      m.updates.checkMode !== "manual" &&
      m.updates.checkMode !== "automatic"
    ) {
      errors.push(`Unknown updates.checkMode: ${JSON.stringify(m.updates.checkMode)} (must be "manual" or "automatic")`);
    } else if (typeof m.updates.checkMode === "string") {
      updateCheckMode = m.updates.checkMode as UpdateCheckMode;
    }
  }

  // ── Visibility/activation linkage default ─────────────────────────────
  let linkVisibilityToActivation = true;
  if (m.linkVisibilityToActivation !== undefined) {
    if (typeof m.linkVisibilityToActivation !== "boolean") {
      errors.push("linkVisibilityToActivation must be a boolean if present");
    } else {
      linkVisibilityToActivation = m.linkVisibilityToActivation;
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // All required blocks are guaranteed present when there are no errors.
  const manifest: AddonManifest = {
    manifestVersion: 1,
    id: m.id as string,
    version: m.version as string,
    name: m.name as string,
    description: m.description as string,
    author: m.author as string | undefined,
    homepage: m.homepage as string | undefined,
    minAppVersion: m.minAppVersion as string | undefined,
    ipcNamespace: m.ipcNamespace as string,
    mountPoint: "tab",
    tab: tabConfig as ManifestTabConfig,
    main: mainConfig,
    renderer: rendererConfig as ManifestRendererConfig,
    permissions,
    updates: { checkMode: updateCheckMode },
    linkVisibilityToActivation,
  };

  return { valid: true, manifest, errors: [] };
}
