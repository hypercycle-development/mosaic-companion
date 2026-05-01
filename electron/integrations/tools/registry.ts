/**
 * Tool Registry
 *
 * Central manager for all tool modules (built-in and MCP-bridged).
 * Provides a unified API for:
 * - Registering/unregistering modules
 * - Executing tools by "moduleName:toolName"
 * - Aggregating system prompts and action patterns
 * - Auto-registering IPC handlers for the renderer
 */

import { ipcMain } from "electron";
import type {
  ToolModule,
  ToolResult,
  ActionPattern,
  ModuleInfo,
  SerializedActionPattern,
  ExecutionContext,
} from "./types";

export class ToolRegistry {
  private modules: Map<string, ToolModule> = new Map();

  // ===========================================================================
  // Module Registration
  // ===========================================================================

  /** Register a feature module */
  register(module: ToolModule): void {
    if (this.modules.has(module.name)) {
      console.warn(
        `[ToolRegistry] Module "${module.name}" already registered, overwriting`,
      );
    }
    this.modules.set(module.name, module);
    console.log(
      `[ToolRegistry] Registered: ${module.displayName} (${module.tools.length} tools)`,
    );
  }

  /** Unregister a module by name */
  unregister(name: string): boolean {
    const existed = this.modules.delete(name);
    if (existed) {
      console.log(`[ToolRegistry] Unregistered: ${name}`);
    }
    return existed;
  }

  /** Get a module by name */
  getModule(name: string): ToolModule | undefined {
    return this.modules.get(name);
  }

  // ===========================================================================
  // Lifecycle
  // ===========================================================================

  /** Initialize all registered modules and register IPC handlers */
  async initializeAll(): Promise<void> {
    for (const [name, mod] of this.modules) {
      try {
        await mod.initialize?.();
        console.log(`[ToolRegistry] Initialized: ${name}`);
      } catch (err) {
        console.error(`[ToolRegistry] Failed to initialize ${name}:`, err);
      }
    }
    this.registerIPCHandlers();
  }

  /** Cleanup all modules (call on app shutdown) */
  async cleanupAll(): Promise<void> {
    for (const [name, mod] of this.modules) {
      try {
        await mod.cleanup?.();
      } catch (err) {
        console.error(`[ToolRegistry] Cleanup error for ${name}:`, err);
      }
    }
  }

  // ===========================================================================
  // Tool Execution
  // ===========================================================================

  /**
   * Execute a tool by full name "moduleName:toolName".
   *
   * Example: registry.executeTool("gmail:getRecentEmails", { count: 5 })
   */
  async executeTool(
    fullName: string,
    args: Record<string, unknown>,
    context?: ExecutionContext,
  ): Promise<ToolResult> {
    // Split on the LAST colon to support namespaced modules like "ext:hello-world:greet"
    // → moduleName = "ext:hello-world", toolName = "greet"
    const colonIdx = fullName.lastIndexOf(":");
    if (colonIdx === -1) {
      return { success: false, error: `Invalid tool name "${fullName}". Expected "module:tool" format.` };
    }

    const moduleName = fullName.substring(0, colonIdx);
    const toolName = fullName.substring(colonIdx + 1);

    const mod = this.modules.get(moduleName);
    if (!mod) {
      console.log(`[ToolRegistry] Module "${moduleName}" not found. Available: [${Array.from(this.modules.keys()).join(", ")}]`);
      return { success: false, error: `Module "${moduleName}" not found` };
    }

    const tool = mod.tools.find((t) => t.name === toolName);
    if (!tool) {
      return {
        success: false,
        error: `Tool "${toolName}" not found in module "${moduleName}"`,
      };
    }

    try {
      return await tool.handler(args, context);
    } catch (err) {
      return {
        success: false,
        error: `Tool execution error: ${(err as Error).message}`,
      };
    }
  }

  // ===========================================================================
  // Aggregation (across all modules)
  // ===========================================================================

  /**
   * Get combined system prompt for all available modules.
   * Includes both the module's own context AND structured tool invocation
   * instructions using the same <use_tool> format as MCP servers.
   * This ensures the AI can call built-in tools the same way it calls MCP tools.
   */
  async getSystemPrompt(): Promise<string> {
    const sections: string[] = [];

    for (const mod of this.modules.values()) {
      try {
        const available = (await mod.isAvailable?.()) ?? true;
        if (!available) continue;

        // Module context (descriptions, saved contacts, wallet status, etc.)
        const contextPrompt = mod.getSystemPrompt();

        // Structured tool listing with invocation syntax
        const toolLines = mod.tools.map((t) => {
          const schemaStr = t.inputSchema
            ? `\n  Input Schema: ${JSON.stringify(t.inputSchema)}`
            : "";
          return (
            `- Tool: ${t.name}\n` +
            `  Description: ${t.description}${schemaStr}\n` +
            `  Usage: <use_tool server="${mod.name}" tool="${t.name}">${t.inputSchema ? "JSON_ARGS" : "{}"}</use_tool>`
          );
        });

        sections.push(
          `${contextPrompt}\n\n` +
            `Available tools for ${mod.displayName} (server: "${mod.name}"):\n` +
            toolLines.join("\n\n"),
        );
      } catch {
        // Skip modules that error on availability check
      }
    }

    if (sections.length === 0) return "";

    return (
      `You have access to the following built-in tools. To use a tool, output its XML tag exactly as shown.\n\n` +
      `RULES (STRICT — violations make the experience worse for users):\n` +
      `1. BEFORE a tool call: Write ONLY a single short sentence like "Let me check that." then the <use_tool> tag. NOTHING ELSE. No explanations, no caveats, no disclaimers, no multi-sentence preambles. ONE sentence, then the tag.\n` +
      `2. STOP after </use_tool>. Do not write anything after the closing tag. Not one word.\n` +
      `3. ABSOLUTELY NEVER state prices, balances, numbers, or ANY data before receiving [Tool Output]. You do NOT know current prices, balances, or live data. Your training data is outdated. ANY number you write before a tool call is a hallucination and WILL be wrong. If you need data, call the tool FIRST, speak AFTER.\n` +
      `4. AFTER receiving [Tool Output]: Respond in 1-2 sentences using ONLY the data from the tool output. A lookup = 1 sentence. Do not add paragraphs.\n` +
      `5. Do NOT call a tool if its description says it cannot do what the user asked. Say in 1 sentence what you CAN do, then either call the tool for the partial result or stop.\n` +
      `6. Do NOT suggest external services, websites, or alternatives unless the user asks.\n` +
      `7. Do NOT repeat tool data in prose. The user already sees the tool output.\n` +
      `8. NEVER explain a tool's limitations twice. Say it once, before or after — not both.\n\n` +
      `BAD (HALLUCINATED DATA — worst possible violation):\n` +
      `"Bitcoin is currently at $97,336.86, up 1.12%..." ← WRONG. You do NOT know the price. This number is from training data and is INCORRECT. The tool returned $70,366. You gave the user false information.\n\n` +
      `BAD (too verbose):\n` +
      `"I can only get the current BTC price, not historical data. Bitcoin is currently at $97,000..." [calls tool] "Bitcoin is at $70,078. However, I can only provide the current price..."\n\n` +
      `GOOD (concise, no hallucination, no repetition):\n` +
      `"Let me check the current BTC price." [calls tool] "Bitcoin: $70,366 (+0.64% 24h). I can only get the current price — historical data isn't available."\n\n` +
      sections.join("\n\n---\n\n")
    );
  }

  /** Get all action patterns from all modules (for the ActionParser) */
  getAllActionPatterns(): Array<ActionPattern & { moduleName: string }> {
    const patterns: Array<ActionPattern & { moduleName: string }> = [];
    for (const [name, mod] of this.modules) {
      for (const pattern of mod.actionPatterns) {
        patterns.push({ ...pattern, moduleName: name });
      }
    }
    return patterns;
  }

  /** List all modules and their tools (for the UI) */
  listModules(): ModuleInfo[] {
    return Array.from(this.modules.values()).map((mod) => ({
      name: mod.name,
      displayName: mod.displayName,
      toolCount: mod.tools.length,
      tools: mod.tools.map((t) => ({
        name: t.name,
        description: t.description,
      })),
    }));
  }

  // ===========================================================================
  // IPC Handlers (auto-registered)
  // ===========================================================================

  private registerIPCHandlers(): void {
    ipcMain.handle(
      "tools:execute",
      async (_e, fullName: string, args: Record<string, unknown>, context?: ExecutionContext) => {
        return this.executeTool(fullName, args, context);
      },
    );

    ipcMain.handle("tools:list-modules", () => {
      return this.listModules();
    });

    ipcMain.handle("tools:get-system-prompt", async () => {
      return this.getSystemPrompt();
    });

    ipcMain.handle("tools:get-action-patterns", () => {
      // Serialize RegExp patterns to strings for IPC transfer
      return this.getAllActionPatterns().map(
        (p): SerializedActionPattern => ({
          moduleName: p.moduleName,
          toolName: p.toolName,
          pattern: p.pattern.source,
          flags: p.pattern.flags,
        }),
      );
    });

    console.log("[ToolRegistry] IPC handlers registered (tools:*)");
  }
}
