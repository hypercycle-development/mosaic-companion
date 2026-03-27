// ActionParser.ts — Parse AI responses for <use_tool> invocations and route
// them to the ToolRegistry (built-in tools) or MCP servers (external tools).
//
// All tools — Gmail, Web3, Vault, MCP, WASM — use the same <use_tool> format.

import type { ToolUIBlock, BlockType } from "../components/tool-ui/types";
import { MAX_BLOCK_COUNT, MAX_BLOCK_DEPTH } from "../components/tool-ui/types";

// Global Window interface for Gmail API

export type ActionType = "TOOL_CALL" | "NONE" | "GMAIL_READ";

export interface ParsedAction {
  type: ActionType;
  params?: { server: string; tool: string; args: Record<string, unknown> } | { index?: boolean | number };
  cleanResponse: string;
  rawTag?: string;
}

/**
 * Parse an AI response for a <use_tool> invocation.
 * Returns the parsed tool call or NONE if no invocation found.
 */
export function parseAction(response: string): ParsedAction {
  const match = response.match(
    /<use_tool\s+server="([^"]+)"\s+tool="([^"]+)">([\s\S]*?)<\/use_tool>/,
  );

  if (match) {
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(match[3]);
    } catch {
      console.error("[ActionParser] Failed to parse tool args:", match[3]);
    }

    return {
      type: "TOOL_CALL",
      params: { server: match[1], tool: match[2], args },
      cleanResponse: response.replace(/<use_tool[\s\S]*?<\/use_tool>/, "").trim(),
      rawTag: match[0],
    };
  }

  return { type: "NONE", cleanResponse: response };
}

/** Structured result from executeToolCall — text for the agent + optional UI blocks */
export interface ToolCallOutput {
  text: string;
  uiBlocks?: import("../components/tool-ui/types").ToolUIBlock[];
  /** "display" = UI is the answer (skip agent recursion), "analyze" = agent comments (default) */
  displayHint?: "display" | "analyze";
  /**
   * mosaic-media:// URLs detected in the tool result text.
   * These are tool-generated media files (images, etc.) saved to disk.
   * The renderer loads them as data: URIs via IPC — never exposed directly.
   */
  mediaUrls?: string[];
}

/**
 * Extract all mosaic-media:// URLs from a tool result string.
 * Returns an array of URLs (e.g. ["mosaic-media://generated_image_123.png"]).
 */
function extractMosaicMediaUrls(text: string): string[] {
  const matches = text.match(/mosaic-media:\/\/[^\s\]"')]+/g);
  return matches ?? [];
}

/**
 * Execute a tool call.
 *
 * Routes to the built-in ToolRegistry first (Gmail, Web3, Vault, WASM tools).
 * Falls back to MCP servers if the module isn't found in the registry.
 */
export async function executeToolCall(action: ParsedAction, agentId?: string): Promise<ToolCallOutput> {
  if (action.type !== "TOOL_CALL" || !action.params) {
    return { text: "Invalid tool action" };
  }

  // Check if params has the TOOL_CALL shape (server, tool, args)
  if (!('server' in action.params) || !('tool' in action.params)) {
    return { text: "Invalid tool action: missing server or tool" };
  }

  const { server, tool, args } = action.params as { server: string; tool: string; args: Record<string, unknown> };
  const context = agentId ? { agentId } : undefined;

  // 1. Try built-in ToolRegistry first
  try {
    const fullToolName = `${server}:${tool}`;
    const registryResult = await (window as any).electronAPI?.tools?.execute?.(fullToolName, args || {}, context);
    if (registryResult && registryResult.success !== undefined) {
      if (registryResult.success) {
        const data = registryResult.data;
        // If data is an object with ui blocks, extract them
        let uiBlocks: import("../components/tool-ui/types").ToolUIBlock[] | undefined;
        let textData = data;
        if (data && typeof data === "object" && !Array.isArray(data) && "ui" in (data as Record<string, unknown>)) {
          const obj = data as Record<string, unknown>;
          uiBlocks = obj.ui as import("../components/tool-ui/types").ToolUIBlock[];
          // Remove ui from the data sent to the agent (it's for rendering, not for LLM)
          const { ui: _, ...rest } = obj;
          textData = Object.keys(rest).length > 0 ? rest : data;
        }
        // Also check top-level ui field on registryResult
        if (!uiBlocks && registryResult.ui) {
          uiBlocks = registryResult.ui;
        }
        const text = typeof textData === "string" ? textData : JSON.stringify(textData);
        return { text, uiBlocks, displayHint: registryResult.displayHint };
      }
      // "not found" means the module doesn't exist in the registry — try MCP
      if (registryResult.error?.includes("not found")) {
        // Fall through to MCP
      } else {
        return { text: `Error: ${registryResult.error}` };
      }
    }
  } catch (e) {
    console.warn(`[ActionParser] Built-in tool ${server}:${tool} failed, trying MCP:`, e);
  }

  // 2. Fall back to MCP server
  try {
    const result = await window.electronAPI.mcpAPI.callTool(server, tool, args);
    if (result.success) {
      // TODO: The __payment_required interception below could be extracted into a
      // shared helper (e.g. handlePaymentRequired()) and unified with executeMCPAction
      // once the two call-paths are fully consolidated. See plugins/payments-jit.

      // Intercept __payment_required signal from AIM endpoints (HTTP 402).
      // The mcp-server.js wraps the 402 response as JSON; we route it to the
      // JIT payment handler in the main process, which handles top-up + retry.
      const firstContent = result.result?.content?.[0];
      const resultText = typeof firstContent?.text === "string" ? firstContent.text : "";

      if (resultText.includes('"__payment_required"')) {
        try {
          const paymentData = JSON.parse(resultText);
          if (paymentData.__payment_required) {
            console.log("[ActionParser] Intercepted __payment_required signal. Routing to payment handler...");
            const paymentResult = await (window as any).electronAPI.hyperinsight.handlePayment(paymentData);
            if (paymentResult.success && paymentResult.result) {
              const finalText = paymentResult.result.content?.[0]?.text ?? JSON.stringify(paymentResult.result, null, 2);
              const mediaUrls = extractMosaicMediaUrls(finalText);
              return { text: finalText, ...(mediaUrls.length > 0 ? { mediaUrls, displayHint: "display" as const } : {}) };
            }
            if (paymentResult.result?.content?.[0]?.text) {
              const finalText = paymentResult.result.content[0].text as string;
              const mediaUrls = extractMosaicMediaUrls(finalText);
              return { text: finalText, ...(mediaUrls.length > 0 ? { mediaUrls, displayHint: "display" as const } : {}) };
            }
            return { text: `Payment required but failed: ${paymentResult.error || "Unknown error"}` };
          }
        } catch (parseErr) {
          console.warn("[ActionParser] Result contained __payment_required text but failed to parse:", parseErr);
        }
      }

      // Extract direct text content if available (cleaner for LLM) and scan for media URLs
      const directContent = result.result?.content?.[0];
      const directText = typeof directContent?.text === "string"
        ? directContent.text
        : JSON.stringify(result.result);
      const directMediaUrls = extractMosaicMediaUrls(directText);
      return {
        text: directText,
        ...(directMediaUrls.length > 0 ? { mediaUrls: directMediaUrls, displayHint: "display" as const } : {}),
      };
    } else {
      return { text: `Error calling tool ${tool}: ${result.error}` };
    }
  } catch (e) {
    return { text: `Error calling tool ${tool}: ${(e as Error).message}` };
  }
}

/**
 * Generate system prompt for MCP tools (external servers).
 * Built-in tools get their prompts from ToolRegistry.getSystemPrompt().
 */
export function getMCPSystemPrompt(servers: any[]): string {
  if (!servers || servers.length === 0) return "";

  let prompt = "You have access to the following tools. To use a tool, output its XML tag.\n\n";
  prompt += "CRITICAL RULES:\n";
  prompt += "1. When you want to use a tool, output ONLY a short intro sentence, then the <use_tool> XML tag.\n";
  prompt += "2. You MUST stop writing IMMEDIATELY after the closing </use_tool> tag. Do NOT continue with any text, answers, or guesses.\n";
  prompt += "3. NEVER guess or hallucinate tool results. Wait for the actual tool output before responding.\n";
  prompt += "4. After you receive the [Tool Output], use that data to write your final response to the user.\n";
  prompt += "5. ABSOLUTELY NEVER state prices, balances, numbers, or ANY live data before receiving [Tool Output]. Your training data is outdated. ANY number you write before a tool call is a hallucination and WILL be wrong.\n";
  prompt += "6. For ANY question about current prices, balances, exchange rates, or real-time data: call the tool FIRST, speak AFTER.\n\n";

  servers.forEach((server) => {
    if (!server.tools || server.tools.length === 0) return;
    prompt += `Server: ${server.name}\n`;
    server.tools.forEach((tool: any) => {
      prompt += `- Tool: ${tool.name}\n  Description: ${tool.description || "No description"}\n  Input Schema: ${JSON.stringify(tool.inputSchema)}\n`;
      prompt += `  Usage: <use_tool server="${server.name}" tool="${tool.name}">JSON_ARGS</use_tool>\n\n`;
    });
  });

  return prompt;
}

// =============================================================================
// Agent Rich UI — <mosaic_ui> tag parsing
// =============================================================================

/** Block types the agent is allowed to emit (display-only — no interactive blocks) */
const AGENT_ALLOWED_BLOCKS: ReadonlySet<BlockType> = new Set([
  // Display
  "text", "markdown", "code", "alert", "image", "divider",
  // Data
  "table", "card", "list", "chart",
  // Layout (needed to compose the above)
  "tabs", "row", "column", "section",
]);

/** Result of parsing <mosaic_ui> tags from an agent response */
export interface MosaicUIParseResult {
  /** Response content with <mosaic_ui> tags removed */
  cleanContent: string;
  /** Validated UI blocks extracted from the tags (empty if none found) */
  blocks: ToolUIBlock[];
  /** Number of blocks that failed validation and were dropped */
  failedBlockCount: number;
  /** Raw JSON snippets of blocks that failed validation (for debug display) */
  failedRawSnippets: string[];
}

/**
 * Recursively count all blocks including nested children.
 */
function countBlocks(blocks: unknown[]): number {
  let count = 0;
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    count++;
    const b = block as Record<string, unknown>;
    if (Array.isArray(b.blocks)) count += countBlocks(b.blocks);
    if (Array.isArray(b.tabs)) {
      for (const tab of b.tabs) {
        if (tab && typeof tab === "object" && Array.isArray((tab as Record<string, unknown>).blocks)) {
          count += countBlocks((tab as Record<string, unknown>).blocks as unknown[]);
        }
      }
    }
  }
  return count;
}

/**
 * Recursively check max nesting depth of layout blocks.
 */
function maxDepth(blocks: unknown[], current: number = 0): number {
  if (current > MAX_BLOCK_DEPTH) return current;
  let deepest = current;
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    if (Array.isArray(b.blocks)) {
      deepest = Math.max(deepest, maxDepth(b.blocks, current + 1));
    }
    if (Array.isArray(b.tabs)) {
      for (const tab of b.tabs) {
        if (tab && typeof tab === "object" && Array.isArray((tab as Record<string, unknown>).blocks)) {
          deepest = Math.max(deepest, maxDepth((tab as Record<string, unknown>).blocks as unknown[], current + 1));
        }
      }
    }
  }
  return deepest;
}

/**
 * Recursively filter blocks to only allowed types.
 * Removes form, button, and any unknown types.
 */
function filterAllowedBlocks(blocks: unknown[]): ToolUIBlock[] {
  const result: ToolUIBlock[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as Record<string, unknown>;
    const type = b.type as string;
    if (!type || !AGENT_ALLOWED_BLOCKS.has(type as BlockType)) continue;

    // Recursively filter children for layout blocks
    if (type === "row" || type === "column" || type === "section") {
      if (Array.isArray(b.blocks)) {
        result.push({ ...b, blocks: filterAllowedBlocks(b.blocks) } as ToolUIBlock);
      }
    } else if (type === "tabs" && Array.isArray(b.tabs)) {
      const filteredTabs = (b.tabs as Array<Record<string, unknown>>)
        .filter(tab => tab && typeof tab === "object" && typeof tab.id === "string" && typeof tab.label === "string")
        .map(tab => ({
          ...tab,
          blocks: Array.isArray(tab.blocks) ? filterAllowedBlocks(tab.blocks) : [],
        }));
      result.push({ ...b, tabs: filteredTabs } as ToolUIBlock);
    } else if (type === "image") {
      // Only allow data: URIs — no external URLs
      const src = b.src as string;
      if (typeof src === "string" && src.startsWith("data:")) {
        result.push(b as unknown as ToolUIBlock);
      }
    } else if (type === "chart") {
      // Validate chart has series data
      // Agents sometimes use "data" (flat array for pie) instead of "series" — normalize it
      if (Array.isArray(b.series) && b.series.length > 0 &&
          b.series.every((s: any) => s && typeof s === "object" && typeof s.name === "string" && Array.isArray(s.data))) {
        result.push(b as unknown as ToolUIBlock);
      } else if (Array.isArray(b.data) && b.data.length > 0) {
        // Flat data array (common for pie/donut): [{name, value}, ...] → wrap as series
        const flatData = b.data as Array<Record<string, unknown>>;
        if (flatData.every(d => d && typeof d === "object" && "name" in d && "value" in d)) {
          const converted = {
            ...b,
            series: [{ name: "data", data: flatData.map(d => ({ x: d.name as string, y: d.value as number })) }],
          };
          delete (converted as Record<string, unknown>).data;
          result.push(converted as unknown as ToolUIBlock);
        }
      }
    } else if (type === "table") {
      // Validate table has columns and rows arrays
      if (Array.isArray(b.columns) && Array.isArray(b.rows)) {
        result.push(b as unknown as ToolUIBlock);
      }
    } else {
      result.push(b as unknown as ToolUIBlock);
    }
  }
  return result;
}

/**
 * Parse <mosaic_ui> tags from an agent response.
 *
 * Extracts JSON UI block arrays, validates them, and strips the
 * tags from the response content. Only display/data/layout blocks
 * are allowed — interactive blocks (form, button) are silently removed.
 *
 * Returns the clean content + validated blocks (empty array if none found or all invalid).
 */
export function parseMosaicUI(response: string): MosaicUIParseResult {
  const tagPattern = /<mosaic_ui>([\s\S]*?)<\/mosaic_ui>/g;

  const allBlocks: ToolUIBlock[] = [];
  let rawBlockCount = 0;
  let hasMatch = false;
  const failedRawSnippets: string[] = [];

  // Extract all <mosaic_ui> tags (there could be multiple in one response)
  let match;
  while ((match = tagPattern.exec(response)) !== null) {
    hasMatch = true;
    const jsonStr = match[1].trim();
    try {
      const parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) {
        console.warn("[parseMosaicUI] Tag content is not an array, skipping");
        rawBlockCount++;
        failedRawSnippets.push(jsonStr.slice(0, 200));
        continue;
      }
      rawBlockCount += parsed.length;
      const filtered = filterAllowedBlocks(parsed);
      // Track dropped blocks — collect raw snippets for debug view
      const droppedCount = parsed.length - filtered.length;
      if (droppedCount > 0) {
        for (const raw of parsed) {
          failedRawSnippets.push(JSON.stringify(raw).slice(0, 200));
        }
      }
      allBlocks.push(...filtered);
    } catch (e) {
      console.warn("[parseMosaicUI] Failed to parse JSON in <mosaic_ui> tag:", e);
      rawBlockCount++;
      failedRawSnippets.push(jsonStr.slice(0, 200));
    }
  }

  if (!hasMatch) {
    return { cleanContent: response, blocks: [], failedBlockCount: 0, failedRawSnippets: [] };
  }

  // Enforce limits
  if (maxDepth(allBlocks) > MAX_BLOCK_DEPTH) {
    console.warn("[parseMosaicUI] Blocks exceed max depth, discarding");
    const clean = response.replace(tagPattern, "").trim();
    return { cleanContent: clean, blocks: [], failedBlockCount: rawBlockCount, failedRawSnippets };
  }

  const totalCount = countBlocks(allBlocks);
  const cappedBlocks = totalCount > MAX_BLOCK_COUNT
    ? allBlocks.slice(0, MAX_BLOCK_COUNT)
    : allBlocks;

  // Remove tags from content
  const cleanContent = response.replace(tagPattern, "").trim();
  const failedBlockCount = rawBlockCount - allBlocks.length;

  return { cleanContent, blocks: cappedBlocks, failedBlockCount, failedRawSnippets };
}

/**
 * Generate the system prompt section that teaches the agent about <mosaic_ui>.
 * Only included when the agent has richUI enabled.
 */
export function getRichUISystemPrompt(): string {
  return [
    "## Rich Visual Display",
    "",
    "You can optionally render a SINGLE table or chart when the data truly benefits from it.",
    "Use <mosaic_ui> tags with a JSON array of block objects. MosAIc renders them natively.",
    "",
    "Block types: \"table\", \"chart\" (bar/line/pie/scatter/area/donut), \"card\", \"code\", \"alert\", \"list\".",
    "Layout: \"row\", \"column\" to arrange blocks side-by-side.",
    "",
    "Example:",
    "<mosaic_ui>",
    '[{"type":"table","title":"Comparison","columns":[{"key":"name","label":"Name"},{"key":"type","label":"Type"},{"key":"stars","label":"Stars","align":"right"}],"rows":[{"name":"React","type":"Library","stars":"220k"},{"name":"Vue","type":"Framework","stars":"207k"}]}]',
    "</mosaic_ui>",
    "",
    "STRICT RULES:",
    "1. DEFAULT IS TEXT. Most answers should be normal markdown. Only use <mosaic_ui> when you have structured data with 3+ columns or numeric trends.",
    "2. KEEP IT MINIMAL. One table OR one chart per response. Never combine tables + cards + rows unless the user explicitly asked for a dashboard or detailed comparison.",
    "3. NEVER use <mosaic_ui> for: opinions, explanations, recommendations, short answers, simple lists, or anything with fewer than 4 data rows.",
    "4. If you can answer well in 1-2 paragraphs of text, DO THAT. Do not add visual blocks just because you can.",
    "5. The JSON must be a valid array. For images, src must be a data: URI.",
    "6. Text before/after the tag is fine — explain what the visual shows.",
  ].join("\n");
}

/**
 * Check if Gmail is authenticated.
 */

/**
 * Check if Gmail is authenticated.
 */
export async function isGmailAuthenticated(): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && window.electronAPI?.gmail) {
      const status = await window.electronAPI.gmail.getStatus();
      return status.authenticated;
    }
    return false;
  } catch {
    return false;
  }
}

// Gmail functions - wired to electron Gmail integration
export function mightBeEmailRelated(message: string): boolean {
  const emailKeywords = ['email', 'mail', 'inbox', 'unread', 'send', 'draft'];
  return emailKeywords.some(keyword => message.toLowerCase().includes(keyword));
}

export function detectEmailReadRequest(message: string): boolean {
  const readKeywords = ['read my email', 'check my email', 'show my email', 'any new email', 'unread email'];
  return readKeywords.some(keyword => message.toLowerCase().includes(keyword));
}

export function getGmailSystemPrompt(): string {
  return `You have access to the user's Gmail account. You can:
- Check for new emails
- Read email details
- Search emails
- Mark emails as read/unread

When the user asks about emails, use the available Gmail tools.`;
}

export async function executeGmailAction(action: ParsedAction): Promise<ToolCallOutput> {
  try {
    if (typeof window === 'undefined' || !window.electronAPI?.gmail) {
      return { text: 'Gmail integration not available. Please run in the Electron app.' };
    }

    const gmail = window.electronAPI.gmail;
    
    const status = await gmail.getStatus();
    if (!status.authenticated) {
      return { text: 'Gmail is not authenticated. Please sign in first.' };
    }

    if (action.type === 'GMAIL_READ' && action.params) {
      const result = await gmail.getEmails(10);
      const emails = Array.isArray(result) ? result : (result as any).emails || [];
      return { text: `Found ${emails.length} recent emails.`, uiBlocks: [] };
    }

    return { text: 'Gmail action completed.' };
  } catch (error) {
    return { text: `Gmail action failed: ${error instanceof Error ? error.message : 'Unknown error'}` };
  }
}

export function buildEmailAnalysisPrompt(content: string, emails: any): string {
  return `Analyze the following emails and provide a summary:

${JSON.stringify(emails, null, 2)}

User query: ${content}`;
}

export function buildSingleEmailAnalysisPrompt(content: string, email: any): string {
  return `Analyze the following email and provide a summary:

${JSON.stringify(email, null, 2)}

User query: ${content}`;
}

