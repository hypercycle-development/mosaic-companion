/**
 * Home Assistant ToolModule
 *
 * Gives the AI agent read access to the home (live states + captured history)
 * and the ability to DRAFT automations. Home-mutating tools (callService,
 * createAutomation) are gated behind the user's "Allow agent control" setting
 * (off by default) — the suggest-and-preview policy from the design.
 *
 * Connection/storage live in the plugin's main process (plugins/home-assistant/
 * main/index.js); this module reuses those via exported helpers rather than
 * opening its own connection.
 */

import type { ToolModule, ToolDefinition, ToolResult } from "../types";
import {
  haGetConnectionInfo,
  haIsControlAllowed,
  haGetStatesData,
  haGetHistoryData,
  haGetEventStatsData,
  haGetSuggestionsData,
  haCallServiceData,
  haCreateAutomationData,
} from "../../../../plugins/home-assistant/main/index.js";

// =============================================================================
// Renderer-Side Arg Types (exported for src/types/tools.ts)
// =============================================================================

export interface HomeAssistantToolArgs {
  "homeassistant:getStatus": Record<string, never>;
  "homeassistant:listEntities": { domain?: string; limit?: number };
  "homeassistant:getHistory": { entityId?: string; hours?: number; limit?: number };
  "homeassistant:getSuggestions": Record<string, never>;
  "homeassistant:proposeAutomation": {
    alias: string;
    trigger: unknown;
    condition?: unknown;
    action: unknown;
    mode?: string;
  };
  "homeassistant:callService": { domain: string; service: string; data?: Record<string, unknown> };
  "homeassistant:createAutomation": {
    alias: string;
    trigger: unknown;
    condition?: unknown;
    action: unknown;
    mode?: string;
    id?: string;
  };
}

// =============================================================================
// System prompt
// =============================================================================

const HA_CONTEXT_PROMPT = `You can help the user understand and automate their Home Assistant smart home.

Capabilities:
- Read the live state of entities (listEntities) and what has happened over time (getHistory).
- Draft Home Assistant automations and preview them (proposeAutomation).

Policy (important):
- ALWAYS ground suggestions in real data: call getHistory / listEntities before proposing routines.
- ALWAYS use proposeAutomation to show a preview and ask the user to confirm BEFORE creating anything.
- callService and createAutomation change the user's real home. They only work if the user has
  enabled "Allow agent control" in the Home Assistant settings. If a control call is refused,
  explain that the user must enable that setting (or make the change themselves) — do not retry.

Home Assistant automation config shape: { alias, trigger, condition?, action, mode? } where trigger
and action are the standard HA trigger/action objects (or arrays of them).`;

const HA_NOT_CONFIGURED_PROMPT = `The user has the Home Assistant integration available but has not connected a server yet. If they ask about their home, tell them they can connect Home Assistant from the sidebar (enter the server URL and a Long-Lived Access Token).`;

function getSystemPrompt(): string {
  try {
    return haGetConnectionInfo().configured ? HA_CONTEXT_PROMPT : HA_NOT_CONFIGURED_PROMPT;
  } catch {
    return HA_NOT_CONFIGURED_PROMPT;
  }
}

// =============================================================================
// Helpers
// =============================================================================

function buildAutomationConfig(args: Record<string, unknown>) {
  const config: Record<string, unknown> = {
    alias: args.alias,
    mode: (args.mode as string) || "single",
    trigger: args.trigger,
    action: args.action,
  };
  if (args.condition !== undefined && args.condition !== null) config.condition = args.condition;
  return config;
}

const CONTROL_DISABLED_MSG =
  "Home Assistant control is disabled. The user must enable 'Allow the AI agent to control my home' " +
  "in the Home Assistant settings before this action can run. Present the proposal and ask them to " +
  "approve it instead.";

// =============================================================================
// Tool definitions
// =============================================================================

const tools: ToolDefinition[] = [
  {
    name: "getStatus",
    description: "Check the Home Assistant connection and how many events have been captured.",
    handler: async (): Promise<ToolResult> => {
      try {
        const info = haGetConnectionInfo();
        let captured = 0;
        try {
          captured = haGetEventStatsData().total;
        } catch {
          /* store may be empty */
        }
        return {
          success: true,
          data: { ...info, eventsCaptured: captured },
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "listEntities",
    description:
      "List current entities and their state. Optionally filter by domain (e.g. 'light', 'switch', 'climate', 'binary_sensor').",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Only return entities in this domain" },
        limit: { type: "number", description: "Max entities to return (default 400)" },
      },
    },
    handler: async (args): Promise<ToolResult> => {
      try {
        const states = (await haGetStatesData()) as Array<{
          entity_id: string;
          state: string;
          attributes?: Record<string, any>;
        }>;
        const domain = args.domain as string | undefined;
        const limit = Math.min(Math.max(1, (args.limit as number) ?? 400), 1000);
        let list = states.map((s) => ({
          entityId: s.entity_id,
          state: s.state,
          name: s.attributes?.friendly_name ?? null,
        }));
        if (domain) list = list.filter((e) => e.entityId.startsWith(`${domain}.`));
        const truncated = list.length > limit;
        return {
          success: true,
          data: { count: list.length, truncated, entities: list.slice(0, limit) },
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "getHistory",
    description:
      "Query captured state-change history from the local event store. Use to find patterns (when devices change, what follows what).",
    inputSchema: {
      type: "object",
      properties: {
        entityId: { type: "string", description: "Filter to one entity, e.g. 'light.hallway'" },
        hours: { type: "number", description: "Only events from the last N hours" },
        limit: { type: "number", description: "Max rows (default 200, max 2000)" },
      },
    },
    handler: async (args): Promise<ToolResult> => {
      try {
        const hours = args.hours as number | undefined;
        const sinceMs = hours ? Date.now() - hours * 60 * 60 * 1000 : undefined;
        const data = haGetHistoryData({
          entityId: args.entityId as string | undefined,
          sinceMs,
          limit: (args.limit as number) ?? 200,
        });
        return { success: true, data };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "getSuggestions",
    description:
      "Get candidate automation routines mined from the captured event history (correlations and time-of-day habits), each with a confidence and a rough draft. Use these as starting points, then refine into a real automation.",
    handler: async (): Promise<ToolResult> => {
      try {
        return { success: true, data: haGetSuggestionsData({}) };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "proposeAutomation",
    description:
      "Validate and PREVIEW a Home Assistant automation without creating it. Returns the config for the user to review. Always use this before createAutomation.",
    inputSchema: {
      type: "object",
      properties: {
        alias: { type: "string", description: "Human-readable name for the automation" },
        trigger: { description: "HA trigger object or array of triggers" },
        condition: { description: "Optional HA condition object or array" },
        action: { description: "HA action object or array of actions" },
        mode: { type: "string", description: "single | restart | queued | parallel (default single)" },
      },
      required: ["alias", "trigger", "action"],
    },
    handler: async (args): Promise<ToolResult> => {
      try {
        if (!args.alias || !args.trigger || !args.action) {
          return { success: false, error: "alias, trigger, and action are required" };
        }
        const config = buildAutomationConfig(args);
        return {
          success: true,
          data: {
            preview: true,
            note: "This is a preview only — nothing was created. Ask the user to confirm, then call createAutomation with the same fields.",
            config,
            json: JSON.stringify(config, null, 2),
          },
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "callService",
    description:
      "Call a Home Assistant service to control a device (e.g. domain 'light', service 'turn_on', data {entity_id}). Requires the user to have enabled agent control.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { type: "string", description: "Service domain, e.g. 'light'" },
        service: { type: "string", description: "Service name, e.g. 'turn_on'" },
        data: { type: "object", description: "Service data, including entity_id" },
      },
      required: ["domain", "service"],
    },
    handler: async (args): Promise<ToolResult> => {
      try {
        if (!haIsControlAllowed()) return { success: false, error: CONTROL_DISABLED_MSG };
        if (!args.domain || !args.service) {
          return { success: false, error: "domain and service are required" };
        }
        const result = await haCallServiceData(
          args.domain as string,
          args.service as string,
          (args.data as Record<string, unknown>) || {},
        );
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "createAutomation",
    description:
      "Create a Home Assistant automation (writes to HA and reloads). Only call after the user has reviewed a proposeAutomation preview and approved it. Requires the user to have enabled agent control.",
    inputSchema: {
      type: "object",
      properties: {
        alias: { type: "string" },
        trigger: {},
        condition: {},
        action: {},
        mode: { type: "string" },
        id: { type: "string", description: "Optional automation id; generated if omitted" },
      },
      required: ["alias", "trigger", "action"],
    },
    handler: async (args): Promise<ToolResult> => {
      try {
        if (!haIsControlAllowed()) return { success: false, error: CONTROL_DISABLED_MSG };
        if (!args.alias || !args.trigger || !args.action) {
          return { success: false, error: "alias, trigger, and action are required" };
        }
        const config = buildAutomationConfig(args);
        const id = await haCreateAutomationData((args.id as string) || null, config);
        return { success: true, data: { created: true, id, config } };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
];

// =============================================================================
// Module export
// =============================================================================

export class HomeAssistantModule implements ToolModule {
  name = "homeassistant";
  displayName = "Home Assistant";
  tools = tools;
  actionPatterns = [];

  getSystemPrompt = getSystemPrompt;

  async isAvailable(): Promise<boolean> {
    try {
      return haGetConnectionInfo().configured;
    } catch {
      return false;
    }
  }
}
