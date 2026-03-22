/**
 * Tool Bridge — WASM Tool → ToolModule Adapter
 *
 * Wraps a launched WASM tool as a ToolModule, making it transparent
 * to the ToolRegistry and agents. Agents use the same <use_tool> syntax
 * regardless of whether the tool is built-in (Gmail, Web3) or a WASM sandboxed tool.
 */

import type { ToolModule, ToolDefinition, ToolResult, ActionPattern } from "../tools/types";
import type { ToolManifest, ToolLauncher } from "./types";

// =============================================================================
// Tool Bridge
// =============================================================================

/**
 * Creates a ToolModule from a loaded tool's manifest and launcher.
 *
 * The resulting module appears identical to built-in modules:
 * - It registers in the ToolRegistry
 * - Agents see it via getSystemPrompt()
 * - It's called via <use_tool server="ext:csv-analyzer" tool="analyze">
 */
export function createToolBridge(
  manifest: ToolManifest,
  launcher: ToolLauncher,
): ToolModule {
  const moduleName = `ext:${manifest.id}`;

  // Build ToolDefinitions from manifest.tools
  const tools: ToolDefinition[] = Object.entries(manifest.tools).map(
    ([name, toolDef]) => ({
      name,
      description: toolDef.description,
      inputSchema: toolDef.inputSchema,
      handler: async (args: Record<string, unknown>): Promise<ToolResult> => {
        const result = await launcher.callFunction(manifest.id, name, args);
        return {
          success: result.success,
          data: result.data,
          error: result.error,
          ui: result.ui,
          // Per-call hint wins, then manifest default for this function
          displayHint: result.displayHint ?? toolDef.displayHint,
        };
      },
    }),
  );

  // Build the system prompt that teaches the AI about this tool
  const systemPrompt = buildSystemPrompt(manifest, moduleName);

  return {
    name: moduleName,
    displayName: manifest.displayName,
    tools,
    getSystemPrompt: () => systemPrompt,
    actionPatterns: [], // Sandbox tools use <use_tool>, not action patterns
    initialize: undefined, // Tool is already launched when the bridge is created
    cleanup: async () => {
      await launcher.stop(manifest.id);
    },
    isAvailable: async () => true,
  };
}

// =============================================================================
// System Prompt Builder
// =============================================================================

/**
 * Builds the system prompt fragment for a tool.
 *
 * This is injected into the agent's system prompt so the agent knows:
 * - What the tool does (description)
 * - What functions are available
 * - How to call each function
 */
function buildSystemPrompt(manifest: ToolManifest, moduleName: string): string {
  const toolEntries = Object.entries(manifest.tools);

  let prompt = `\n## ${manifest.displayName}\n`;
  prompt += `${manifest.description}\n\n`;
  prompt += `Server: "${moduleName}"\n`;
  prompt += `Available functions:\n\n`;

  for (const [name, def] of toolEntries) {
    prompt += `- **${name}**: ${def.description}\n`;

    if (def.inputSchema) {
      const schema = def.inputSchema;
      if (schema.properties && typeof schema.properties === "object") {
        prompt += `  Parameters:\n`;
        for (const [param, paramDef] of Object.entries(
          schema.properties as Record<string, { type?: string; description?: string }>,
        )) {
          const desc = paramDef.description ? ` — ${paramDef.description}` : "";
          const type = paramDef.type ? ` (${paramDef.type})` : "";
          prompt += `    - ${param}${type}${desc}\n`;
        }
      }
    }

    prompt += `  Usage: <use_tool server="${moduleName}" tool="${name}">{"param": "value"}</use_tool>\n\n`;
  }

  return prompt;
}
