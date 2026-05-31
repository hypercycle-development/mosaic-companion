// mcpSkillResolver.ts — Hermes MCP skill resolver for Mosaic agents
// Data Source 3: MCP hermes-tools server (skill_view tool)
//
// This module fetches skill content from the running Hermes instance
// via the MCP protocol. Used as a fallback after Hermes dir (.
// and Vault (dir.) when a skill name is requested but neither
// local nor vault source has it.
//
// The MCP flow is:
//   _loadMcpSkill(skillName) → callTool("hermes-tools", "skill_view", {name})
//   or → callTool("hermes-tools", "skills_list") → discover name mapping

// ─── Dependencies ────────────────────────────────────────────────────
// – We are always in the Electron main process (called from skillInjector
//   via IPC), so we can import MCPClient directly.  If this file is ever
//   hoisted into the renderer, NODE_AVAILABLE guards every entry point.

let nodeAvailable = false;
let pathModule: typeof import("path") | null = null;
let fsModule: typeof import("fs") | null = null;

try {
  pathModule = require("path");
  fsModule = require("fs");
  if (pathModule && fsModule) {
    nodeAvailable = true;
  }
} catch {
  nodeAvailable = false;
}

// ─── Cache ───────────────────────────────────────────────────────────
interface McpSkillRecord {
  content: string;   // Markdown / skill text
  references: Map<string, string>;
  loadedAt: number;
}

// Map<skillName, McpSkillRecord>
const mcpSkillCache = new Map<string, McpSkillRecord>();

/** 5-minute default TTL (same as SkillInjector). */
const CACHE_MAX_AGE_MS = 5 * 60 * 1000;

// ─── Helpers ─────────────────────────────────────────────────────────

function isCacheValid(record: McpSkillRecord): boolean {
  return Date.now() - record.loadedAt < CACHE_MAX_AGE_MS;
}

/**
 * Call an MCP tool via the Electron BrowserWindow IPC proxy.
 * In the main process this is a direct require("electron").
 */
async function callMcpTool(
  serverName: string,
  toolName: string,
  args: Record<string, unknown> = {}
): Promise<{ success: boolean; result?: any; error?: string }> {
  if (!nodeAvailable) {
    return { success: false, error: "Node.js not available in renderer" };
  }

  try {
    const { ipcMain } = require("electron");

    // We are inside the main process handler; use the MCPClient directly.
    // Import it lazily to avoid circular deps at module load time.
    // Try multiple possible paths (source vs bundled build).
    let mcpIndex: any;
    const candidates = [
      "../integrations/mcp/index",
      "../../electron/integrations/mcp/index",
      "./integrations/mcp/index",
    ];
    for (const candidate of candidates) {
      try {
        mcpIndex = require(candidate);
        if (mcpIndex?.mcpClient) break;
      } catch { /* try next */ }
    }
    if (!mcpIndex?.mcpClient) {
      return { success: false, error: "MCP client not found in any expected path" };
    }
    const { mcpClient } = mcpIndex;

    const raw = await mcpClient.callTool(serverName, toolName, args);

    // Normalise to a simple shape (content → text)
    const first = raw?.content?.[0];
    if (first && typeof first.text === "string") {
      return {
        success: true,
        result: (() => {
          try { return JSON.parse(first.text); }
          catch { return first.text; }
        })(),
      };
    }

    return { success: true, result: raw };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Load a skill from the hermes-tools MCP server.
 *
 * Falls back to skills_list discovery if skill_view fails (e.g. name mismatch).
 *
 * @returns { skillMd: string, references: Map<string, string> } or null on miss.
 */
export async function loadMcpSkill(
  skillName: string
): Promise<{ skillMd: string; references: Map<string, string> } | null> {

  if (!nodeAvailable) return null;

  // ── 1. Check cache ──
  const cached = mcpSkillCache.get(skillName);
  if (cached && isCacheValid(cached)) {
    return { skillMd: cached.content, references: new Map(cached.references) };
  }

  let content = "";

  // ── 2. Try skill_view first ──
  try {
    const res = await callMcpTool("hermes-tools", "skill_view", {
      name: skillName,
    });

    if (res.success) {
      // Hermes skill_view returns the SKILL.md body as text, or a JSON wrapper.
      const raw = res.result;
      if (typeof raw === "string") {
        content = raw;
      } else if (raw && typeof raw.content === "string") {
        content = raw.content;
      } else if (raw && raw.body) {
        content = raw.body;
      } else {
        // Fallback: stringify anything else (e.g. JSON object with metadata)
        content = JSON.stringify(raw, null, 2);
      }
    }
  } catch (e) {
    // Swallow — proceed to discovery below.
  }

  // ── 3. If skill_view failed, discover via skills_list ──
  if (!content) {
    try {
      const listRes = await callMcpTool("hermes-tools", "skills_list", {});
      if (listRes.success && Array.isArray(listRes.result)) {
        // Search for a skill with matching name (case-insensitive)
        const found = listRes.result.find(
          (s: any) =>
            s?.name?.toLowerCase() === skillName.toLowerCase() ||
            s?.skillName?.toLowerCase() === skillName.toLowerCase()
        );
        if (found) {
          // Try skill_view with the canonical name returned by the list
          const canonical = found.name || found.skillName || skillName;
          const retry = await callMcpTool("hermes-tools", "skill_view", {
            name: canonical,
          });
          if (retry.success) {
            const raw = retry.result;
            if (typeof raw === "string") {
              content = raw;
            } else if (raw && typeof raw.content === "string") {
              content = raw.content;
            } else {
              content = JSON.stringify(raw, null, 2);
            }
          }
        }
      }
    } catch (e) {
      // Suppress: skill genuinely does not exist in Hermes either.
    }
  }

  if (!content) return null;

  // ── 4. Cache and return ──
  const record: McpSkillRecord = {
    content,
    references: new Map(), // Hermes skills delivered via MCP currently lack ref files
    loadedAt: Date.now(),
  };
  mcpSkillCache.set(skillName, record);

  return { skillMd: content, references: new Map() };
}

/**
 * List all skills available on the hermes-tools MCP server.
 * Useful for auto-discovery and UI “browse skills” features.
 */
export async function discoverMcpSkills(): Promise<
  Array<{ name: string; category?: string; description?: string }>
> {
  if (!nodeAvailable) return [];

  try {
    const res = await callMcpTool("hermes-tools", "skills_list", {});
    if (res.success && Array.isArray(res.result)) {
      return res.result.map((s: any) => ({
        name: s.name || s.skillName || "",
        category: s.category || "",
        description: s.description || "",
      }));
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Clear the MCP skill cache (e.g. when Hermes skills are updated).
 */
export function clearMcpSkillCache(): void {
  mcpSkillCache.clear();
}
