/**
 * `addonAPI.mcp` — `mcp:read` for listServers/listTools, `mcp:call`
 * for callTool. `callTool` is the *same* execution path core chat tool calls
 * use (`mcpClient.callTool`), so payment interception applies unchanged:
 * when the AIM endpoint responds with a `__payment_required` signal (the
 * same detection `src/services/ActionParser.ts` does for core chat), this
 * routes to `handlePaymentRequired` — the exact function
 * `aimnodes:handle-payment` calls, extracted so both paths share it rather
 * than re-deriving the approval-modal flow.
 */

import { mcpClient } from "../../integrations/mcp/index";
import type { MCPToolResult } from "../../integrations/mcp/MCPClient";
import { handlePaymentRequired } from "../../../plugins/aim-nodes/main/index.js";
import { assertString, type ApiNamespace } from "./types";

/** Same detection ActionParser.ts uses for core chat tool calls. */
function extractPaymentRequired(result: MCPToolResult | undefined): Record<string, unknown> | null {
  const firstContent = result?.content?.[0];
  const resultText = typeof firstContent?.text === "string" ? firstContent.text : "";
  if (!resultText.includes('"__payment_required"')) return null;
  try {
    const parsed = JSON.parse(resultText);
    return parsed?.__payment_required ? parsed : null;
  } catch {
    return null;
  }
}

export const methods: ApiNamespace = {
  listServers: {
    permission: "mcp:read",
    handler: () => mcpClient.getServers().map((s: { name: string; initialized: boolean }) => ({
      id: s.name,
      name: s.name,
      connected: s.initialized,
    })),
  },
  listTools: {
    permission: "mcp:read",
    handler: async (_ctx, serverId) => {
      const id = assertString(serverId, "serverId");
      return mcpClient.listTools(id);
    },
  },
  callTool: {
    permission: "mcp:call",
    handler: async (ctx, serverId, toolName, args) => {
      const sId = assertString(serverId, "serverId");
      const tName = assertString(toolName, "toolName");
      const callArgs = args && typeof args === "object" && !Array.isArray(args) ? (args as Record<string, unknown>) : {};

      const result: MCPToolResult = await mcpClient.callTool(sId, tName, callArgs);

      const paymentData = extractPaymentRequired(result);
      if (!paymentData) return result;

      // Same function the core aimnodes:handle-payment IPC channel calls —
      // shows the real TransactionApprovalModal in the main app window,
      // regardless of which webview (core chat or an addon) triggered it.
      //
      // `requestedBy` is the addon's verified id, resolved by the dispatcher
      // from the webContents map and never from anything the renderer
      // supplied. It does two things downstream: the modal names who is asking
      // (a user approving a transfer could not previously tell their own chat
      // session from a third-party addon), and it forces the modal to appear
      // even when the user has switched off "require confirmation" for their
      // own agent work. That setting is consent for the user's own actions,
      // not for a third party's.
      const paymentResult = await handlePaymentRequired({ ...paymentData, requestedBy: ctx.addonId });
      if (paymentResult?.result) return paymentResult.result;
      throw new Error(paymentResult?.error || "Payment required but failed");
    },
  },
};
