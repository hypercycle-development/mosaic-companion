/**
 * Gmail ToolModule
 *
 * Wraps the existing Gmail integration (gmailClient.ts + gmail/index.ts)
 * as a ToolModule so it can be managed by the ToolRegistry.
 *
 * Business logic stays in gmailClient.ts — this just provides the
 * ToolModule interface on top.
 */

import type { ToolModule, ToolDefinition, ActionPattern } from "../types";
import { authenticate, isAuthenticated, signOut } from "../../gmail/index";
import {
  getUserProfile,
  getRecentEmails,
  getEmailDetails,
  searchEmails,
  markAsRead,
  markAsUnread,
} from "../../gmail/gmailClient";
import {
  GMAIL_SYSTEM_PROMPT,
  GMAIL_NOT_CONNECTED_PROMPT,
} from "../../../../src/prompts/gmail-tools";

// =============================================================================
// System Prompt
// =============================================================================

function getSystemPrompt(): string {
  try {
    return isAuthenticated() ? GMAIL_SYSTEM_PROMPT : GMAIL_NOT_CONNECTED_PROMPT;
  } catch {
    return GMAIL_NOT_CONNECTED_PROMPT;
  }
}

// =============================================================================
// Tool Definitions
// =============================================================================

const gmailTools: ToolDefinition[] = [
  {
    name: "signIn",
    description: "Authenticate with Gmail via OAuth2",
    handler: async () => {
      try {
        await authenticate();
        return { success: true, data: { authenticated: true } };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "signOut",
    description: "Sign out of Gmail",
    handler: async () => {
      try {
        signOut();
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "getStatus",
    description: "Check Gmail authentication status",
    handler: async () => {
      try {
        const authenticated = isAuthenticated();
        const profile = authenticated ? await getUserProfile() : null;
        return {
          success: true,
          data: {
            isAuthenticated: authenticated,
            email: profile?.emailAddress || null,
          },
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "getRecentEmails",
    description: "Fetch recent emails from inbox",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "Number of emails to fetch (default: 10)" },
      },
    },
    handler: async (args) => {
      try {
        const emails = await getRecentEmails((args.count as number) ?? 10);
        return { success: true, data: emails };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "getEmailDetails",
    description: "Get full details of a specific email by message ID",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "The Gmail message ID" },
      },
      required: ["messageId"],
    },
    handler: async (args) => {
      try {
        const email = await getEmailDetails(args.messageId as string);
        return { success: true, data: email };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "searchEmails",
    description: "Search emails with a Gmail query string",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Gmail search query (e.g. 'from:john')" },
        count: { type: "number", description: "Max results (default: 10)" },
      },
      required: ["query"],
    },
    handler: async (args) => {
      try {
        const emails = await searchEmails(
          args.query as string,
          (args.count as number) ?? 10,
        );
        return { success: true, data: emails };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "markAsRead",
    description: "Mark an email as read",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "The Gmail message ID" },
      },
      required: ["messageId"],
    },
    handler: async (args) => {
      try {
        await markAsRead(args.messageId as string);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "markAsUnread",
    description: "Mark an email as unread",
    inputSchema: {
      type: "object",
      properties: {
        messageId: { type: "string", description: "The Gmail message ID" },
      },
      required: ["messageId"],
    },
    handler: async (args) => {
      try {
        await markAsUnread(args.messageId as string);
        return { success: true };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
];

// =============================================================================
// Action Patterns (for parsing LLM text responses)
// =============================================================================

const gmailActionPatterns: ActionPattern[] = [
  {
    pattern: /\[GMAIL_RECENT(?::(\d+))?\]/gi,
    toolName: "getRecentEmails",
    extractArgs: (m) => ({ count: m[1] ? parseInt(m[1]) : 10 }),
  },
  {
    pattern: /\[GMAIL_SEARCH:([^\]]+)\]/gi,
    toolName: "searchEmails",
    extractArgs: (m) => {
      // Support optional count at end: [GMAIL_SEARCH:from:john:15]
      const parts = m[1].split(":");
      const lastPart = parts[parts.length - 1];
      const hasCount = /^\d+$/.test(lastPart) && parts.length > 1;
      return {
        query: hasCount ? parts.slice(0, -1).join(":") : m[1],
        count: hasCount ? parseInt(lastPart) : 10,
      };
    },
  },
  {
    pattern: /\[GMAIL_READ:(\d+)\]/gi,
    toolName: "getEmailDetails",
    extractArgs: (m) => ({ emailIndex: parseInt(m[1]) }),
  },
  {
    pattern: /\[GMAIL_MARK_READ:(\d+)\]/gi,
    toolName: "markAsRead",
    extractArgs: (m) => ({ emailIndex: parseInt(m[1]) }),
  },
  {
    pattern: /\[GMAIL_MARK_UNREAD:(\d+)\]/gi,
    toolName: "markAsUnread",
    extractArgs: (m) => ({ emailIndex: parseInt(m[1]) }),
  },
  {
    pattern: /\[GMAIL_UNREAD(?::(\d+))?\]/gi,
    toolName: "getRecentEmails",
    extractArgs: (m) => ({ count: m[1] ? parseInt(m[1]) : 10 }),
  },
];

// =============================================================================
// Module Export
// =============================================================================

export class GmailModule implements ToolModule {
  name = "gmail";
  displayName = "Gmail";
  tools = gmailTools;
  actionPatterns = gmailActionPatterns;

  getSystemPrompt = getSystemPrompt;

  async isAvailable(): Promise<boolean> {
    try {
      return isAuthenticated();
    } catch {
      return false;
    }
  }
}
