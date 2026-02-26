/**
 * Vault ToolModule
 *
 * Read-only access to vault boxes for AI agents.
 * Enforces boxAccess via ExecutionContext.agentId — an agent can only
 * see and read boxes listed in its AIAgentConfig.boxAccess[].
 */

import type { ToolModule, ToolDefinition, ExecutionContext } from "../types";
import { getAgentBoxes, canAgentAccessBox, getBoxContent } from "../../vault";

// =============================================================================
// Tool Handlers
// =============================================================================

/**
 * List boxes the calling agent has access to.
 * Returns an empty list if no agentId is provided or agent has no access.
 */
async function listBoxes(
  _args: Record<string, unknown>,
  context?: ExecutionContext,
) {
  if (!context?.agentId) {
    return { success: false, error: "No agent context — access denied" };
  }

  const boxes = getAgentBoxes(context.agentId);
  return {
    success: true,
    data: boxes.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      sourceType: b.sourceType,
    })),
  };
}

/**
 * Read entries from a specific box.
 * Enforces access check before returning any data.
 */
async function readBox(
  args: Record<string, unknown>,
  context?: ExecutionContext,
) {
  if (!context?.agentId) {
    return { success: false, error: "No agent context — access denied" };
  }

  const boxId = args.boxId as string;
  if (!boxId) {
    return { success: false, error: "boxId is required" };
  }

  if (!canAgentAccessBox(context.agentId, boxId)) {
    return { success: false, error: "Access denied — you do not have access to this box" };
  }

  const entries = getBoxContent(boxId);
  return {
    success: true,
    data: entries.map((e) => ({
      id: e.id,
      label: e.label,
      content: e.content,
      createdAt: e.createdAt,
    })),
  };
}

// =============================================================================
// Module Definition
// =============================================================================

const tools: ToolDefinition[] = [
  {
    name: "list_boxes",
    description:
      "List vault boxes you have access to. Returns the names and IDs of boxes assigned to you.",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: listBoxes,
  },
  {
    name: "read_box",
    description:
      "Read the contents of a vault box. Returns all entries stored in the box. You must have access to the box.",
    inputSchema: {
      type: "object",
      properties: {
        boxId: {
          type: "string",
          description: "The ID of the box to read (from list_boxes)",
        },
      },
      required: ["boxId"],
    },
    handler: readBox,
  },
];

export class VaultToolModule implements ToolModule {
  name = "vault";
  displayName = "Vault";
  tools = tools;
  actionPatterns = [];

  getSystemPrompt(): string {
    return (
      "You have access to the user's Vault — a secure data storage system. " +
      "Use the vault tools to list and read boxes you have been granted access to. " +
      "If you need information that might be stored in the vault, use list_boxes first to discover what's available, " +
      "then read_box to access the contents."
    );
  }
}
