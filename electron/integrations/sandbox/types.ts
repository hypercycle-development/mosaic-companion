/**
 * Sandbox — Type Definitions
 *
 * Core types for MosAIc's tool sandbox subsystem.
 *
 * Key abstractions:
 * - ToolLauncher: abstract runtime interface (WASM now, Docker later)
 * - GatekeeperPolicy: abstract filtering logic (same rules for any runtime)
 * - ToolManifest: what a tool declares about itself
 */

// =============================================================================
// Tool Manifest (declared by tool developers)
// =============================================================================

/** A single tool function declared in the manifest */
export interface ManifestTool {
  /** What this function does (injected into agent system prompt) */
  description: string;
  /** JSON Schema for the function's input */
  inputSchema?: Record<string, unknown>;
}

/** Permissions a tool requests in its manifest */
export interface ToolPermissions {
  /** Whether the tool can make outbound HTTP requests */
  internet: boolean;
  /** Which domains are allowed (only if internet is true) */
  allowed_domains: string[];
  /** File paths/globs the tool can read (user-approved at install) */
  files: string[];
  /** Named services the tool can access: "elasticsearch", "postgresql", etc. */
  services: string[];
}

/** Resource limits declared in the manifest */
export interface ToolResources {
  /** Memory limit (e.g. "64m", "512m") */
  memory: string;
  /** Max execution time per function call (e.g. "30s", "5m") */
  timeout: string;
}

/** Runtime configuration in the manifest */
export interface ToolRuntime {
  /** Execution runtime: "wasm" (primary) or "docker" (future) */
  type: "wasm" | "docker";
  /** Entry point: .wasm file path or Docker image reference */
  entry: string;
}

/** UI panel declared in the manifest */
export interface ToolUIPanel {
  /** Panel identifier */
  id: string;
  /** Display name */
  title: string;
  /** What the panel shows */
  description?: string;
  /** Default panel height in pixels */
  defaultHeight?: number;
}

/** UI configuration in the manifest */
export interface ToolUI {
  /** UI panels this tool can render */
  panels: ToolUIPanel[];
}

/**
 * The tool manifest — the contract between tool developers and MosAIc.
 *
 * Tool developers create this. MosAIc reads it to:
 * - Show permissions to the user for approval
 * - Configure the sandbox at launch
 * - Register tool functions in the ToolRegistry
 * - Set up Gatekeeper rules
 * - Know what UI panels to render
 *
 * See: docs/architecture/manifest.md
 */
export interface ToolManifest {
  /** Manifest format version */
  manifestVersion: string;
  /** Globally unique tool identifier (kebab-case) */
  id: string;
  /** Tool version (semver) */
  version: string;
  /** Human-readable display name */
  displayName: string;
  /** What the tool does (shown to users + injected into agent system prompt) */
  description: string;
  /** Tool author or organization */
  author?: string;
  /** License identifier */
  license?: string;
  /** Path to icon file (relative to manifest) */
  icon?: string;
  /** Runtime configuration */
  runtime: ToolRuntime;
  /** Permissions the tool requests */
  permissions: ToolPermissions;
  /** Resource limits */
  resources: ToolResources;
  /** Functions this tool exposes to agents */
  tools: Record<string, ManifestTool>;
  /** UI rendering configuration */
  ui?: ToolUI;
}

// =============================================================================
// Runtime State
// =============================================================================

/** Lifecycle states for a sandbox tool */
export type ToolStatus = "loading" | "running" | "stopping" | "stopped" | "error";

/** A loaded and running tool (WASM module or Docker container) */
export interface RunningTool {
  /** The tool's manifest ID */
  toolId: string;
  /** Current status */
  status: ToolStatus;
  /** When the tool was loaded */
  startedAt: Date;
  /** The manifest used to load this tool */
  manifest: ToolManifest;
}

// =============================================================================
// Tool Launcher (Abstract Interface)
// =============================================================================

/**
 * Abstract interface for tool runtimes.
 *
 * This is THE key abstraction. WASM-specific code is behind WasmLauncher.
 * When Docker is needed, implement DockerLauncher — nothing else changes.
 */
export interface ToolLauncher {
  /** Load and start a tool from its manifest. */
  launch(manifest: ToolManifest): Promise<RunningTool>;

  /** Call an exported function on a running tool. */
  callFunction(
    toolId: string,
    functionName: string,
    args: Record<string, unknown>,
  ): Promise<ToolCallResult>;

  /** Stop and dispose a running tool. */
  stop(toolId: string): Promise<void>;

  /** List all currently running tools. */
  listRunning(): RunningTool[];

  /** Check if the runtime is available (e.g. WASM always true, Docker needs daemon). */
  isAvailable(): Promise<boolean>;
}

// =============================================================================
// Tool Call Result
// =============================================================================

/** UI block returned by a tool for rendering in MosAIc */
export interface ToolUIBlock {
  /** Block type: table, chart, markdown, image, form, card, code, alert */
  type: string;
  /** Block-specific data (columns, rows, chartType, content, etc.) */
  [key: string]: unknown;
}

/** Result of calling a tool function */
export interface ToolCallResult {
  success: boolean;
  data?: unknown;
  error?: string;
  /** Optional UI blocks for rendering in MosAIc */
  ui?: ToolUIBlock[];
}

// =============================================================================
// Gatekeeper Policy (Abstract Interface)
// =============================================================================

/** Audit log entry for Gatekeeper decisions */
export interface AuditEntry {
  /** When the decision was made */
  timestamp: string;
  /** Which tool triggered this */
  toolId: string;
  /** What was being accessed */
  resource: string;
  /** The decision */
  action: "ALLOW" | "DENY";
  /** Why it was denied (if applicable) */
  reason?: string;
  /** Resource type */
  type: "domain" | "file" | "service";
}

/**
 * Abstract interface for Gatekeeper filtering logic.
 *
 * Holds the DECISION rules — which domains/files/services are allowed.
 * Implementation is runtime-agnostic:
 * - WASM: called directly from host functions (inside Electron)
 * - Docker (future): called from proxy handler or forwarded to container API
 *
 * Same rules, different plumbing.
 */
export interface GatekeeperPolicy {
  /** Check if a domain is allowed for this tool. */
  checkDomain(toolId: string, domain: string): GatekeeperDecision;

  /** Check if a file path is allowed for this tool. */
  checkFilePath(toolId: string, filePath: string): GatekeeperDecision;

  /** Check if a service is allowed for this tool. */
  checkService(toolId: string, service: string): GatekeeperDecision;

  /** Log an audit decision (for Chronicle). */
  logDecision(entry: AuditEntry): void;
}

/** Result of a Gatekeeper check */
export interface GatekeeperDecision {
  allowed: boolean;
  reason?: string;
}

// =============================================================================
// Installed Tool (persisted to disk)
// =============================================================================

/** Represents an installed tool (manifest saved to disk) */
export interface InstalledTool {
  /** The full manifest */
  manifest: ToolManifest;
  /** When the tool was installed (ISO string) */
  installedAt: string;
  /** Whether the tool is currently enabled */
  enabled: boolean;
  /** Path to the .wasm file (for WASM tools) or image reference (for Docker) */
  entryPath: string;
}
