/**
 * Atomic Mail ToolModule
 *
 * Wraps the Atomic Mail MCP server as a native MosAIc ToolModule.
 * Provides stable, agent-friendly tool names for autonomous @atomicmail.ai
 * inboxes: register an inbox, read the inbox, send emails, search, get help.
 *
 * The underlying server uses JMAP under the hood; this module exposes the
 * operations agents commonly need without requiring every agent to speak raw
 * JMAP or remember the MCP tool names.
 */

import type { ToolModule, ToolDefinition } from "../types";

// =============================================================================
// Renderer-side arg types (exported for src/types/tools.ts if desired)
// =============================================================================

export interface AtomicMailToolArgs {
  "atomicmail:registerInbox": { username: string; display_name?: string };
  "atomicmail:sendEmail": {
    to: string | string[];
    subject: string;
    body: string;
    from?: string;
    cc?: string | string[];
    bcc?: string | string[];
    attachments?: string[];
  };
  "atomicmail:readInbox": { count?: number; since?: string };
  "atomicmail:searchEmails": { query: string; count?: number };
  "atomicmail:emailHelp": { topic?: string };
  "atomicmail:getStatus": Record<string, never>;
}

// =============================================================================
// JMAP helper — build a standard Email/set + EmailSubmission/create batch
// =============================================================================

function buildSendOps(args: AtomicMailToolArgs["atomicmail:sendEmail"]): string {
  const toList = Array.isArray(args.to) ? args.to : [args.to];
  const ccList = args.cc ? (Array.isArray(args.cc) ? args.cc : [args.cc]) : [];
  const bccList = args.bcc ? (Array.isArray(args.bcc) ? args.bcc : [args.bcc]) : [];
  const allRecipients = [...toList, ...(ccList || []), ...(bccList || [])];

  const makeMailbox = (addrs: string[]) =>
    addrs.map((a) => ({ name: a.split("@")[0] || a, email: a }));

  const bodyKey = "b";
  const newEmail: Record<string, unknown> = {
    mailboxIds: { "$INBOX_MAILBOX_ID": true },
    from: args.from ? makeMailbox([args.from]) : [{ email: "$INBOX" }],
    to: makeMailbox(toList),
    cc: ccList.length ? makeMailbox(ccList) : undefined,
    bcc: bccList.length ? makeMailbox(bccList) : undefined,
    subject: args.subject,
    bodyValues: { [bodyKey]: { value: args.body, charset: "utf-8" } },
    textBody: [{ partId: bodyKey, type: "text/plain" }],
    keywords: { "$draft": true },
  };

  // Atomic Mail requires a full envelope with the submission capability.
  return JSON.stringify({
    using: [
      "urn:ietf:params:jmap:core",
      "urn:ietf:params:jmap:mail",
      "urn:ietf:params:jmap:submission",
    ],
    methodCalls: [
      ["Email/set", { accountId: "$ACCOUNT_ID", create: { d1: newEmail } }, "c0"],
      [
        "EmailSubmission/set",
        {
          accountId: "$ACCOUNT_ID",
          create: {
            s1: {
              emailId: "#d1",
              envelope: {
                mailFrom: { email: "$INBOX" },
                rcptTo: makeMailbox(allRecipients),
              },
            },
          },
        },
        "c1",
      ],
    ],
  });
}

function buildReadOps(count = 10): string {
  const query: Record<string, unknown> = {
    accountId: "$ACCOUNT_ID",
    filter: { inMailbox: "$INBOX_MAILBOX_ID" },
    sort: [{ property: "receivedAt", isAscending: false }],
    limit: count,
  };
  const get: Record<string, unknown> = {
    accountId: "$ACCOUNT_ID",
    properties: ["id", "threadId", "from", "to", "subject", "receivedAt", "preview"],
    "#ids": {
      resultOf: "0",
      name: "Email/query",
      path: "/ids",
    },
  };
  return JSON.stringify({
    using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
    methodCalls: [
      ["Email/query", query, "0"],
      ["Email/get", get, "1"],
    ],
  });
}

function buildSearchOps(query: string, count = 10): string {
  const emailQuery: Record<string, unknown> = {
    accountId: "$ACCOUNT_ID",
    filter: {
      inMailbox: "$INBOX_MAILBOX_ID",
      text: query,
    },
    sort: [{ property: "receivedAt", isAscending: false }],
    limit: count,
  };
  const get: Record<string, unknown> = {
    accountId: "$ACCOUNT_ID",
    properties: ["id", "threadId", "from", "to", "subject", "receivedAt", "preview"],
    "#ids": {
      resultOf: "0",
      name: "Email/query",
      path: "/ids",
    },
  };
  return JSON.stringify({
    using: ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
    methodCalls: [
      ["Email/query", emailQuery, "0"],
      ["Email/get", get, "1"],
    ],
  });
}

// =============================================================================
// System Prompt
// =============================================================================

const ATOMICMAIL_CONTEXT_PROMPT = `You have access to Atomic Mail — autonomous @atomicmail.ai email inboxes for AI agents.

What you can do:
- registerInbox: create a new @atomicmail.ai inbox for yourself or another agent. Usernames are 5–21 characters. This performs proof-of-work signup and writes credentials to disk.
- sendEmail: send an outbound email to one or more recipients (to/cc/bcc, subject, plain text body).
- readInbox: fetch recent inbound emails (count, default 10).
- searchEmails: search the inbox with a text query.
- emailHelp: get Atomic Mail help topics or preset JMAP operations.
- getStatus: check whether the Atomic Mail server is connected.

IMPORTANT:
- Each agent should use a unique inbox username. For example, an agent named "Ruby" should register "ruby" or "ruby-outreach".
- The first time you use email, register an inbox. After that, use readInbox/sendEmail.
- readInbox returns previews. If a reply looks like a lead or needs action, report it to the user concisely.
- Do NOT claim an email was sent until the tool result confirms it.
- For advanced operations (drafts, attachments, labels, forwarding), use emailHelp to discover the right JMAP preset, then call jmap_request via the MCP server directly.
`;

// =============================================================================
// MCP proxy helper
// =============================================================================

// Resolve the MCP client singleton from the same process. The tool registry is
// initialized after MCP init, so the singleton must already exist.
let _mcpClient: any = null;
function getMcpClient(): any {
  if (_mcpClient) return _mcpClient;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { mcpClient } = require("../../mcp");
    _mcpClient = mcpClient;
    return _mcpClient;
  } catch (e) {
    console.error("[AtomicMailModule] Could not resolve MCP client:", e);
    return null;
  }
}

async function callAtomicMail(toolName: string, args: Record<string, unknown>): Promise<any> {
  const client = getMcpClient();
  if (!client) {
    throw new Error("Atomic Mail MCP client is not available");
  }
  if (!client.isConnected("atomicmail")) {
    throw new Error('Atomic Mail MCP server is not connected. Check the MCP Servers panel or logs.');
  }
  return client.callTool("atomicmail", toolName, args);
}

// =============================================================================
// Tool Definitions
// =============================================================================

const atomicMailTools: ToolDefinition[] = [
  {
    name: "registerInbox",
    description: "Create a new @atomicmail.ai inbox (PoW signup). Usernames 5–21 chars. Optionally set display name.",
    inputSchema: {
      type: "object",
      properties: {
        username: {
          type: "string",
          description: "Desired username (5–21 chars). Final email = username@atomicmail.ai",
        },
        display_name: {
          type: "string",
          description: "Friendly display name shown to recipients",
        },
      },
      required: ["username"],
    },
    handler: async (args) => {
      try {
        const forced = args.forced === true || args.forced === "true";
        const result = await callAtomicMail("register", {
          username: String(args.username),
          display_name: args.display_name ? String(args.display_name) : undefined,
          forced,
        });
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "sendEmail",
    description: "Send an outbound email from the active @atomicmail.ai inbox.",
    inputSchema: {
      type: "object",
      properties: {
        to: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description: "Primary recipient(s)",
        },
        subject: { type: "string" },
        body: { type: "string", description: "Plain text body" },
        from: { type: "string", description: "Override sender display email (optional)" },
        cc: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description: "CC recipient(s)",
        },
        bcc: {
          oneOf: [
            { type: "string" },
            { type: "array", items: { type: "string" } },
          ],
          description: "BCC recipient(s)",
        },
        attachments: {
          type: "array",
          items: { type: "string" },
          description: "Local file paths to attach (optional; requires blob upload)",
        },
      },
      required: ["to", "subject", "body"],
    },
    handler: async (args) => {
      try {
        const typedArgs = args as unknown as AtomicMailToolArgs["atomicmail:sendEmail"];
        // If attachments are requested, delegate to the bundled preset which performs
        // inline blob upload in one JMAP batch. The preset expects vars as strings.
        if (typedArgs.attachments && typedArgs.attachments.length > 0) {
          const toAddrs = Array.isArray(typedArgs.to) ? typedArgs.to.join(",") : typedArgs.to;
          const result = await callAtomicMail("jmap_request", {
            ops_file: "send_mail_blob_attachment.json",
            vars: {
              TO: toAddrs,
              SUBJECT: typedArgs.subject,
              BODY: typedArgs.body,
            },
            attachments: typedArgs.attachments.map((p) => ({ path: p })),
          });
          return { success: true, data: result };
        }

        const ops = buildSendOps(typedArgs);
        const result = await callAtomicMail("jmap_request", { ops });
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "readInbox",
    description: "Fetch recent emails from the active @atomicmail.ai inbox.",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "Number of emails to fetch (default: 10)" },
        since: { type: "string", description: "ISO timestamp to filter by receivedAt (optional)" },
      },
    },
    handler: async (args) => {
      try {
        const count = (args.count as number) ?? 10;
        const ops = buildReadOps(count);
        const result = await callAtomicMail("jmap_request", { ops });
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "searchEmails",
    description: "Search the active @atomicmail.ai inbox by text query.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text (subject/body/from)" },
        count: { type: "number", description: "Max results (default: 10)" },
      },
      required: ["query"],
    },
    handler: async (args) => {
      try {
        const query = String(args.query);
        const count = (args.count as number) ?? 10;
        const ops = buildSearchOps(query, count);
        const result = await callAtomicMail("jmap_request", { ops });
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "emailHelp",
    description: "Get Atomic Mail help topics and JMAP operation presets.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string", description: "Help topic (e.g. presets, jmap_cheatsheet, cron, troubleshooting)" },
      },
    },
    handler: async (args) => {
      try {
        const topic = args.topic ? String(args.topic) : undefined;
        const result = await callAtomicMail("help", topic ? { topic } : {});
        return { success: true, data: result };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
  {
    name: "getStatus",
    description: "Check whether the Atomic Mail MCP server is connected and ready.",
    handler: async () => {
      try {
        const client = getMcpClient();
        if (!client) return { success: false, error: "MCP client not available" };
        const connected = client.isConnected("atomicmail");
        const servers = client.getServers ? client.getServers() : [];
        const server = servers.find((s: any) => s.name === "atomicmail");
        return {
          success: true,
          data: {
            connected,
            tools: server?.tools?.map((t: any) => t.name) ?? [],
          },
        };
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    },
  },
];

// =============================================================================
// Module Export
// =============================================================================

export class AtomicMailModule implements ToolModule {
  name = "atomicmail";
  displayName = "Atomic Mail";
  tools = atomicMailTools;
  actionPatterns = [];

  getSystemPrompt = () => ATOMICMAIL_CONTEXT_PROMPT;

  async isAvailable(): Promise<boolean> {
    try {
      const client = getMcpClient();
      return client ? client.isConnected("atomicmail") : false;
    } catch {
      return false;
    }
  }
}
