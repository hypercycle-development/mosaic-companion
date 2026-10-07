/**
 * Addon manifest.json schema, validation, and the fixed vocabularies
 * referenced throughout the addon system (reserved IPC namespaces, the
 * permission list).
 *
 * Validation is hand-rolled (no schema library dependency).
 * `semver` is already a project dependency and is used
 * only for version-string validation, not schema validation itself.
 */

import semver from "semver";

// =============================================================================
// Types
// =============================================================================

/** v1 only supports "tab" — kept as a one-member union so future mount
 * points are additive schema changes. */
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
/**
 * A bucket's history policy: what a reader sees of what was written before
 * the grant. "all" is the only value in v1.
 *
 * It is a *per-bucket property* rather than a global rule on purpose. Changing
 * a global rule later would either break every existing subscriber (they stop
 * seeing items they can see today) or expose data that was hidden — so instead
 * a future "since-grant" is a value a writer opts a *new* bucket into, and
 * nothing existing ever flips.
 */
export type BucketHistory = "all";

export interface ManifestBucketSpec {
  id: string;
  kind: string;
  history: BucketHistory;
  /** Shown in the connection prompt and in Settings. Defaults to `id`. */
  label: string;
}

export interface ManifestBucketsConfig {
  /** Buckets this addon owns and is the sole writer of. */
  publishes: ManifestBucketSpec[];
  /** Kinds this addon is willing to read. A *kind*, never an addon id — so a
   * reader need not know its publisher exists when it is written. */
  reads: string[];
}

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
  /** Always present; `{ publishes: [], reads: [] }` when the manifest omits it. */
  buckets: ManifestBucketsConfig;
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
 * addon system's own namespaces. An addon's `ipcNamespace` must not
 * collide with any of these. This list shrinks as core migrates features to
 * addons (`hyperinsight` dropped out — see the addon's own
 * manifest.json in mosaic-open-platform) — kept as a flat, hand-maintained
 * constant, not derived dynamically.
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
  // "hyperinsight" removed — that's now the HyperInsight
  // addon's own ipcNamespace (mosaic-open-platform/addons/hyperinsight), not a
  // core plugin's IPC prefix anymore.
  "aimnodes",
  "payments-jit",
  "addon",
  "addon-api",
  "addons",
  "tab-prefs",
];

/**
 * Addons permitted to ship a `main.entry`.
 *
 * An addon's `main/index.js` is imported straight into the **main process**
 * (`loader.ts` → `await import(pathToFileURL(...))`), with full Node and
 * Electron access. Nothing about it is sandboxed, and — this is the part that
 * matters — **the manifest permission model does not apply to it**. An addon
 * declaring zero permissions but shipping a main entry can still read the
 * vault off disk, read decrypted agent API keys, spawn processes and open
 * sockets. The permissions a user consents to describe the renderer only.
 *
 * Until addon main code is genuinely contained (utilityProcess or equivalent),
 * shipping one is a trust decision, not a permission grant. So it's restricted
 * to addons we author and review ourselves.
 *
 * This is an INTERIM control keyed on addon id, which is weak on its own — id
 * is self-declared, and only the id/directory-name match constrains it. It
 * must become signature-based (the publisher key that signed the tarball) once
 * real signing exists; see `signing.ts`'s PRODUCTION_PUBLISHER_KEYS. It is not
 * a substitute for real isolation.
 */
export const MAIN_ENTRY_ALLOWLIST: readonly string[] = ["hyperinsight"];

/** Permissions grantable to addons in v1. */
export const PERMISSION_VOCABULARY: readonly string[] = [
  "wallet:read",
  "agents:read",
  "agents:write",
  "mcp:read",
  "mcp:call",
  "nodes:read",
  "shell:open-external",
  "buckets:publish",
];

/**
 * Named in the vocabulary so the strings are stable when they eventually
 * ship, but rejected at install time in v1.
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

// Bucket ids share the addon id's character set today. Kept as its own
// constant so the two can diverge without one silently dragging the other.
const BUCKET_ID_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;
const BUCKET_KIND_PATTERN = /^[a-z][a-z0-9-]{1,40}$/;
const MAX_BUCKETS_PUBLISHED = 8;
const MAX_BUCKET_KINDS_READ = 8;
const MAX_BUCKET_LABEL_LENGTH = 40;
const BUCKET_HISTORY_VALUES: readonly BucketHistory[] = ["all"];

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
 * Validate a parsed manifest.json against the full v1 schema.
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
    } else if (typeof m.id === "string" && !MAIN_ENTRY_ALLOWLIST.includes(m.id)) {
      errors.push(
        `Addon "${m.id}" declares main.entry, which is restricted. Main-process code runs ` +
          `with full Node access and is not covered by the permission model — see ` +
          `MAIN_ENTRY_ALLOWLIST in electron/addons/manifest.ts.`,
      );
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

  // ── Buckets ────────────────────────────────────────────────────────────
  // Single-writer channels between addons: an addon owns the buckets it
  // publishes, and a reader reaches one only through a grant the user made.
  // Both halves are declared here so what an addon can publish, and what it
  // wants to read, are visible in a submission's diff and reviewable the same
  // way permissions are. Runs after Security because rules 14/15 need the
  // parsed `permissions`.
  let bucketsConfig: ManifestBucketsConfig = { publishes: [], reads: [] };
  if (m.buckets !== undefined) {
    if (!isPlainObject(m.buckets)) {
      errors.push('"buckets" must be an object if present');
    } else {
      const raw = m.buckets;

      // publishes
      const publishes: ManifestBucketSpec[] = [];
      if (raw.publishes !== undefined) {
        if (!Array.isArray(raw.publishes)) {
          errors.push("buckets.publishes must be an array");
        } else if (raw.publishes.length > MAX_BUCKETS_PUBLISHED) {
          errors.push(`buckets.publishes may declare at most ${MAX_BUCKETS_PUBLISHED} buckets`);
        } else {
          const seenIds = new Set<string>();
          raw.publishes.forEach((entry, i) => {
            if (!isPlainObject(entry)) {
              errors.push(`buckets.publishes[${i}] must be an object`);
              return;
            }
            const id = entry.id;
            if (typeof id !== "string" || !BUCKET_ID_PATTERN.test(id)) {
              errors.push(`Invalid buckets.publishes[${i}].id: ${JSON.stringify(id)} (must match ${BUCKET_ID_PATTERN})`);
              return;
            }
            // Rejected rather than de-duplicated: two declarations of one id
            // with different kinds have no defensible winner.
            if (seenIds.has(id)) {
              errors.push(`Duplicate bucket id ${JSON.stringify(id)}`);
              return;
            }
            seenIds.add(id);

            const kind = entry.kind;
            if (typeof kind !== "string" || !BUCKET_KIND_PATTERN.test(kind)) {
              errors.push(`Invalid buckets.publishes[${i}].kind: ${JSON.stringify(kind)} (must match ${BUCKET_KIND_PATTERN})`);
              return;
            }

            // An unknown history value must FAIL, never quietly become "all".
            // A manifest asking for "since-grant" is asking for a narrower
            // exposure than we implement; granting it the wider one silently
            // would be the exact opposite of what it asked for.
            let history: BucketHistory = "all";
            if (entry.history !== undefined) {
              if (!BUCKET_HISTORY_VALUES.includes(entry.history as BucketHistory)) {
                errors.push(
                  `Unknown buckets.publishes[${i}].history: ${JSON.stringify(entry.history)} ` +
                  `(only ${BUCKET_HISTORY_VALUES.map((v) => JSON.stringify(v)).join(", ")} is accepted)`,
                );
                return;
              }
              history = entry.history as BucketHistory;
            }

            let label = id;
            if (entry.label !== undefined) {
              if (typeof entry.label !== "string" || entry.label.length < 1 || entry.label.length > MAX_BUCKET_LABEL_LENGTH) {
                errors.push(`Invalid buckets.publishes[${i}].label (must be 1-${MAX_BUCKET_LABEL_LENGTH} chars)`);
                return;
              }
              label = entry.label;
            }

            publishes.push({ id, kind, history, label });
          });
        }
      }

      // reads
      const reads: string[] = [];
      if (raw.reads !== undefined) {
        if (!Array.isArray(raw.reads) || raw.reads.some((k) => typeof k !== "string")) {
          errors.push("buckets.reads must be an array of strings");
        } else if (raw.reads.length > MAX_BUCKET_KINDS_READ) {
          errors.push(`buckets.reads may declare at most ${MAX_BUCKET_KINDS_READ} kinds`);
        } else {
          const seenKinds = new Set<string>();
          (raw.reads as string[]).forEach((kind, i) => {
            if (!BUCKET_KIND_PATTERN.test(kind)) {
              errors.push(`Invalid buckets.reads[${i}]: ${JSON.stringify(kind)} (must match ${BUCKET_KIND_PATTERN})`);
              return;
            }
            if (seenKinds.has(kind)) {
              errors.push(`Duplicate bucket kind ${JSON.stringify(kind)} in buckets.reads`);
              return;
            }
            seenKinds.add(kind);
            reads.push(kind);
          });
        }
      }

      bucketsConfig = { publishes, reads };
    }
  }

  // The permission and the declaration must agree in both directions, so a
  // reviewer reads one coherent statement of intent rather than two that can
  // disagree with each other.
  if (bucketsConfig.publishes.length > 0 && !permissions.includes("buckets:publish")) {
    errors.push('buckets.publishes requires the "buckets:publish" permission');
  }
  if (permissions.includes("buckets:publish") && bucketsConfig.publishes.length === 0) {
    errors.push('"buckets:publish" is declared but buckets.publishes is empty');
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
    buckets: bucketsConfig,
  };

  return { valid: true, manifest, errors: [] };
}
