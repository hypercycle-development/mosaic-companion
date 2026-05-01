/**
 * Gmail ToolModule
 *
 * Wraps the existing Gmail integration (gmailClient.ts + gmail/index.ts)
 * as a ToolModule so it can be managed by the ToolRegistry.
 *
 * Business logic stays in gmailClient.ts — this just provides the
 * ToolModule interface on top.
 */

import type { ToolModule, ToolDefinition } from "../types";
import { authenticate, isAuthenticated, signOut } from "../../gmail/index";

// =============================================================================
// Renderer-Side Arg Types (exported for src/types/tools.ts)
// =============================================================================

/** Typed argument maps for each Gmail tool — used by the renderer for autocomplete */
export interface GmailToolArgs {
  "gmail:signIn": Record<string, never>;
  "gmail:signOut": Record<string, never>;
  "gmail:getStatus": Record<string, never>;
  "gmail:getRecentEmails": { count?: number };
  "gmail:getEmailDetails": { messageId: string };
  "gmail:searchEmails": { query: string; count?: number };
  "gmail:markAsRead": { messageId: string };
  "gmail:markAsUnread": { messageId: string };
}
import {
  getUserProfile,
  getRecentEmails,
  getEmailDetails,
  searchEmails,
  markAsRead,
  markAsUnread,
} from "../../gmail/gmailClient";
// Gmail system prompt — context only. The ToolRegistry auto-generates
// <use_tool> invocation instructions for each tool listed below.

const GMAIL_CONTEXT_PROMPT = `You have access to the user's Gmail inbox.

When listing emails, format them clearly with:
- Unread indicator (📩 = unread, ✅ = read)
- Email number, subject, sender, and relative date
- 📎 for attachments

When showing a full email, provide:
- TL;DR summary
- From, Date, Subject
- Key points and action items

IMPORTANT:
- Use the messageId from email data when calling getEmailDetails, markAsRead, or markAsUnread.
- Do NOT guess email content — always call the tool first and wait for the result.
- After receiving tool output, format it nicely for the user.
`;

const GMAIL_NOT_CONNECTED_PROMPT = `Note: The user has Gmail integration available but is not currently signed in. If they ask about emails, let them know they can connect their Gmail account in Settings.`;

// =============================================================================
// System Prompt
// =============================================================================

function getSystemPrompt(): string {
  try {
    return isAuthenticated() ? GMAIL_CONTEXT_PROMPT : GMAIL_NOT_CONNECTED_PROMPT;
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
// Module Export
// =============================================================================

export class GmailModule implements ToolModule {
  name = "gmail";
  displayName = "Gmail";
  tools = gmailTools;
  actionPatterns = [];

  getSystemPrompt = getSystemPrompt;

  async isAvailable(): Promise<boolean> {
    try {
      return isAuthenticated();
    } catch {
      return false;
    }
  }
}
