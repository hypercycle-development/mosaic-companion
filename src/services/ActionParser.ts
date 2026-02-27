// ActionParser.ts - Parse AI responses for action tags and execute Gmail operations

export type GmailActionType =
  | "GMAIL_RECENT"
  | "GMAIL_SEARCH"
  | "GMAIL_UNREAD"
  | "GMAIL_LABEL"
  | "GMAIL_READ"
  | "GMAIL_MARK_READ"
  | "GMAIL_MARK_UNREAD"
  | "MCP_TOOL_CALL"
  | "NONE";

export interface ParsedAction {
  type: GmailActionType;
  params?: Record<string, any>;
  cleanResponse: string; // Response with action tags removed
  rawTag?: string; // The original tag found
}

export interface EmailData {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
  hasAttachments?: boolean;
  attachmentCount?: number;
}

// Store last fetched emails for context (to reference by index)
let lastFetchedEmails: EmailData[] = [];

export function getLastFetchedEmails(): EmailData[] {
  return lastFetchedEmails;
}

export function setLastFetchedEmails(emails: EmailData[]): void {
  lastFetchedEmails = emails;
}

/**
 * Strip HTML tags from email body and convert to plain text
 * Handles common HTML entities and formatting
 */
export function stripHtml(html: string): string {
  if (!html) return "";

  // Check if it looks like HTML (contains < and > tags)
  if (!/<[^>]+>/.test(html)) {
    return html; // Already plain text
  }

  let text = html;

  // Remove style and script tags completely
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");

  // Convert common block elements to line breaks
  text = text.replace(/<\/?(br|p|div|h[1-6]|li|tr)[^>]*>/gi, "\n");

  // Convert links to just their text or URL
  text = text.replace(
    /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi,
    "$2 ($1)",
  );

  // Remove all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text.replace(/&nbsp;/gi, " ");
  text = text.replace(/&amp;/gi, "&");
  text = text.replace(/&lt;/gi, "<");
  text = text.replace(/&gt;/gi, ">");
  text = text.replace(/&quot;/gi, '"');
  text = text.replace(/&#39;/gi, "'");
  text = text.replace(/&apos;/gi, "'");

  // Clean up whitespace
  text = text.replace(/\n\s*\n\s*\n/g, "\n\n"); // Max 2 consecutive newlines
  text = text.replace(/^\s+|\s+$/gm, ""); // Trim each line
  text = text.replace(/\n{3,}/g, "\n\n"); // Max 2 consecutive newlines again
  text = text.trim();

  return text;
}

/**
 * Format date to relative time (e.g., "2 hours ago", "Yesterday", "Jan 13")
 */
export function formatRelativeDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;

    // For older emails, show month and day
    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    return `${months[date.getMonth()]} ${date.getDate()}`;
  } catch {
    return dateString; // Fallback to original if parsing fails
  }
}

// Default email count
const DEFAULT_EMAIL_COUNT = 20;

// Regex patterns for action tags - capture entire content between brackets
const ACTION_PATTERNS = {
  GMAIL_RECENT: /\[GMAIL_RECENT(?::(\d+))?\]/gi,
  GMAIL_UNREAD: /\[GMAIL_UNREAD(?::(\d+))?\]/gi,
  GMAIL_SEARCH: /\[GMAIL_SEARCH:([^\]]+)\]/gi,
  GMAIL_LABEL: /\[GMAIL_LABEL:([^\]]+)\]/gi,
  GMAIL_READ: /\[GMAIL_READ:(\d+)\]/gi,
};

/**
 * Parse search query that may have an optional count suffix
 * e.g., "from:john" -> { query: "from:john", count: 20 }
 * e.g., "from:john:15" -> { query: "from:john", count: 15 }
 */
function parseQueryWithCount(fullQuery: string): {
  query: string;
  count: number;
} {
  // Check if the last segment after : is a number (the count)
  const lastColonIndex = fullQuery.lastIndexOf(":");
  if (lastColonIndex > 0) {
    const possibleCount = fullQuery.substring(lastColonIndex + 1);
    if (/^\d+$/.test(possibleCount)) {
      return {
        query: fullQuery.substring(0, lastColonIndex),
        count: parseInt(possibleCount),
      };
    }
  }
  return { query: fullQuery, count: DEFAULT_EMAIL_COUNT };
}

/**
 * Parse AI response for action tags
 * Returns the action type, parameters, and cleaned response
 * Supports dynamic count: [GMAIL_RECENT:30], [GMAIL_SEARCH:from:john:15]
 */
export function parseAction(response: string): ParsedAction {
  // Check for GMAIL_MARK_READ (with email index)
  const markReadMatch = response.match(/\[GMAIL_MARK_READ:(\d+)\]/i);
  if (markReadMatch) {
    return {
      type: "GMAIL_MARK_READ",
      params: { index: parseInt(markReadMatch[1]) },
      cleanResponse: response.replace(/\[GMAIL_MARK_READ:\d+\]/gi, "").trim(),
      rawTag: markReadMatch[0],
    };
  }

  // Check for GMAIL_MARK_UNREAD (with email index)
  const markUnreadMatch = response.match(/\[GMAIL_MARK_UNREAD:(\d+)\]/i);
  if (markUnreadMatch) {
    return {
      type: "GMAIL_MARK_UNREAD",
      params: { index: parseInt(markUnreadMatch[1]) },
      cleanResponse: response.replace(/\[GMAIL_MARK_UNREAD:\d+\]/gi, "").trim(),
      rawTag: markUnreadMatch[0],
    };
  }

  // Check for GMAIL_READ (with email index)
  const readMatch = response.match(/\[GMAIL_READ:(\d+)\]/i);
  if (readMatch) {
    return {
      type: "GMAIL_READ",
      params: { index: parseInt(readMatch[1]) },
      cleanResponse: response.replace(ACTION_PATTERNS.GMAIL_READ, "").trim(),
      rawTag: readMatch[0],
    };
  }

  // Check for GMAIL_SEARCH (with parameter and optional count at end)
  const searchMatch = response.match(/\[GMAIL_SEARCH:([^\]]+)\]/i);
  if (searchMatch) {
    const { query, count } = parseQueryWithCount(searchMatch[1]);
    return {
      type: "GMAIL_SEARCH",
      params: { query, count },
      cleanResponse: response.replace(ACTION_PATTERNS.GMAIL_SEARCH, "").trim(),
      rawTag: searchMatch[0],
    };
  }

  // Check for GMAIL_LABEL (with label name and optional count)
  const labelMatch = response.match(/\[GMAIL_LABEL:([^\]]+)\]/i);
  if (labelMatch) {
    const { query: label, count } = parseQueryWithCount(labelMatch[1]);
    return {
      type: "GMAIL_LABEL",
      params: { label: label.toUpperCase(), count },
      cleanResponse: response.replace(ACTION_PATTERNS.GMAIL_LABEL, "").trim(),
      rawTag: labelMatch[0],
    };
  }

  // Check for GMAIL_UNREAD (with optional count)
  const unreadMatch = response.match(/\[GMAIL_UNREAD(?::(\d+))?\]/i);
  if (unreadMatch) {
    return {
      type: "GMAIL_UNREAD",
      params: {
        count: unreadMatch[1] ? parseInt(unreadMatch[1]) : DEFAULT_EMAIL_COUNT,
      },
      cleanResponse: response.replace(ACTION_PATTERNS.GMAIL_UNREAD, "").trim(),
      rawTag: unreadMatch[0],
    };
  }

  // Check for GMAIL_RECENT (with optional count)
  const recentMatch = response.match(/\[GMAIL_RECENT(?::(\d+))?\]/i);
  if (recentMatch) {
    return {
      type: "GMAIL_RECENT",
      params: {
        count: recentMatch[1] ? parseInt(recentMatch[1]) : DEFAULT_EMAIL_COUNT,
      },
      cleanResponse: response.replace(ACTION_PATTERNS.GMAIL_RECENT, "").trim(),
      rawTag: recentMatch[0],
    };
  }

  // Check for MCP Tool Call (XML-style)
  // <use_tool server="name" tool="name">{"arg":"val"}</use_tool>
  const mcpMatch = response.match(/<use_tool\s+server="([^"]+)"\s+tool="([^"]+)">([\s\S]*?)<\/use_tool>/);
  if (mcpMatch) {
    const serverName = mcpMatch[1];
    const toolName = mcpMatch[2];
    const argsString = mcpMatch[3];
    let args = {};
    try {
      args = JSON.parse(argsString);
    } catch (e) {
      console.error("Failed to parse MCP tool args:", e);
    }

    return {
      type: "MCP_TOOL_CALL",
      params: { server: serverName, tool: toolName, args },
      cleanResponse: response.replace(/<use_tool[\s\S]*?<\/use_tool>/, "").trim(),
      rawTag: mcpMatch[0],
    };
  }

  // No action found
  return {
    type: "NONE",
    cleanResponse: response,
  };
}

/**
 * Execute an MCP or built-in tool action.
 *
 * Routes to the built-in tool registry first (via tools:execute).
 * If that fails because the module isn't found, falls back to MCP servers.
 * This means both built-in tools (Web3, etc.) and MCP-connected servers
 * use the same <use_tool> invocation format from the AI.
 *
 * @param agentId - Optional agent ID for access control enforcement (passed as ExecutionContext)
 */
export async function executeMCPAction(action: ParsedAction, agentId?: string): Promise<string> {
   if (action.type !== "MCP_TOOL_CALL" || !action.params) {
       return "Invalid MCP action";
   }
   
   const { server, tool, args } = action.params as { server: string; tool: string; args: any };
   const context = agentId ? { agentId } : undefined;
   
   // 1. Try built-in tool registry first (handles web3, gmail-module, vault, future modules)
   try {
       const fullToolName = `${server}:${tool}`;
       const registryResult = await (window as any).electronAPI?.tools?.execute?.(fullToolName, args || {}, context);
       if (registryResult && registryResult.success !== undefined) {
           // If the tool was found and executed (even if it returned an error), use this result
           if (registryResult.success) {
               const data = registryResult.data;
               return typeof data === "string" ? data : JSON.stringify(data, null, 2);
           }
           // Check if the error is "module not found" — that means we should try MCP
           if (registryResult.error?.includes("not found")) {
               // Fall through to MCP
           } else {
               // Tool was found but returned an error (e.g. "no wallet configured")
               return `Error: ${registryResult.error}`;
           }
       }
   } catch (e) {
       console.warn(`[ActionParser] Built-in tool ${server}:${tool} failed, trying MCP:`, e);
   }

   // 2. Fall back to MCP server
   try {
       const result = await window.electronAPI.mcpAPI.callTool(server, tool, args);
       if (result.success) {
           return JSON.stringify(result.result, null, 2);
       } else {
           return `Error calling tool ${tool}: ${result.error}`;
       }
   } catch (e) {
       return `Error calling tool ${tool}: ${(e as Error).message}`;
   }
}

/**
 * Generate system prompt for MCP tools
 */
export function getMCPSystemPrompt(servers: any[]): string {
    if (!servers || servers.length === 0) return "";
    
    let prompt = "You have access to the following tools. To use a tool, output its XML tag.\n\n";
    prompt += "CRITICAL RULES:\n";
    prompt += "1. When you want to use a tool, output ONLY a short intro sentence, then the <use_tool> XML tag.\n";
    prompt += "2. You MUST stop writing IMMEDIATELY after the closing </use_tool> tag. Do NOT continue with any text, answers, or guesses.\n";
    prompt += "3. NEVER guess or hallucinate tool results. Wait for the actual tool output before responding.\n";
    prompt += "4. After you receive the [Tool Output], use that data to write your final response to the user.\n\n";
    
    servers.forEach(server => {
        if (!server.tools || server.tools.length === 0) return;
        
        prompt += `Server: ${server.name}\n`;
        server.tools.forEach((tool: any) => {
            prompt += `- Tool: ${tool.name}\n  Description: ${tool.description || "No description"}\n  Input Schema: ${JSON.stringify(tool.inputSchema)}\n`;
            prompt += `  Usage: <use_tool server="${server.name}" tool="${tool.name}">JSON_ARGS</use_tool>\n\n`;
        });
    });
    
    return prompt;
}

/**
 * Format email data for AI consumption
 * Creates a structured string that's easy for the AI to parse
 */
export function formatEmailsForAI(emails: EmailData[]): string {
  if (emails.length === 0) {
    return "No emails found matching the criteria.";
  }

  // Store for later reference by index
  setLastFetchedEmails(emails);

  const formatted = emails.map((email, index) => {
    const unreadMarker = email.isUnread ? "[UNREAD]" : "[READ]";
    const attachmentMarker = email.hasAttachments
      ? ` 📎${email.attachmentCount ? ` ${email.attachmentCount}` : ""}`
      : "";
    const relativeDate = formatRelativeDate(email.date);
    return `
Email ${index + 1} ${unreadMarker}${attachmentMarker}:
- From: ${email.from}
- Subject: ${email.subject}
- Date: ${relativeDate}
- Preview: ${email.snippet}
`.trim();
  });

  return `Found ${emails.length} email(s):\n\n${formatted.join("\n\n")}`;
}

/**
 * Build the follow-up prompt to send email data back to AI
 * Includes formatting instructions so AI follows our style
 */
export function buildEmailAnalysisPrompt(
  originalQuery: string,
  emailData: string,
): string {
  return `Based on the user's request: "${originalQuery}"

Here are the relevant emails from their inbox:

${emailData}

FORMAT YOUR RESPONSE LIKE THIS:

📬 **Found X emails:**

---

- 📩 **1. Subject** - Sender (time ago)

- ✅ **2. Subject** - Sender (time ago)

---

Legend: 📩 = unread, ✅ = read, 📎 = attachment

CRITICAL RULES:
- Use the EXACT index number from the email data (Email 1, Email 2, etc.)
- The index number MUST match the "Email N" from the data - do NOT renumber
- You may add ⭐ to highlight important emails, but keep their original index
- Example: "⭐ 📩 **5. Important Email** - Sender" (keeps index 5 from data)
- These index numbers are used for mark read/unread actions

Provide the formatted list using the indexes from the data.`;
}

/**
 * Build a prompt for analyzing/summarizing a single email
 * Used when reading a specific email to get TL;DR and key points
 */
export function buildSingleEmailAnalysisPrompt(
  originalQuery: string,
  emailData: string,
): string {
  return `Based on the user's request: "${originalQuery}"

Here is the full email content:

${emailData}

SUMMARIZE THIS EMAIL using this EXACT format:

📧 **Email: [Subject]**

**TL;DR:** [One concise sentence summarizing what this email is about]

---

- **From:** [Sender name/email]
- **Date:** [Date in readable format]

**Key Points:**
- [Main point 1]
- [Main point 2]
- [Action items or important details, if any]

---

RULES:
- DO NOT include any raw HTML, CSS, or code
- DO NOT include long URLs - just mention "click here to..." or describe the action
- DO NOT repeat the entire email body
- Keep it SHORT and SCANNABLE
- Focus on the ESSENTIAL information only
- If it's a notification/alert email, summarize the key action/status`;
}

/**
 * Check if Gmail is authenticated
 * Returns true if user is logged into Gmail
 */
export async function isGmailAuthenticated(): Promise<boolean> {
  try {
    const status = await window.electronAPI.gmail.getStatus();
    return status.authenticated;
  } catch {
    return false;
  }
}

/**
 * Execute a Gmail action and return formatted results
 */
export async function executeGmailAction(
  action: ParsedAction,
): Promise<string> {
  // Check authentication first
  const isAuthenticated = await isGmailAuthenticated();
  if (!isAuthenticated) {
    return "Gmail is not connected. Please sign in to Gmail in Settings to use email features.";
  }

  try {
    let result;
    const count = (action.params?.count as number) || DEFAULT_EMAIL_COUNT;

    switch (action.type) {
      case "GMAIL_RECENT":
        result = await window.electronAPI.gmail.getEmails(count);
        break;

      case "GMAIL_UNREAD":
        // Get more emails and filter to unread
        result = await window.electronAPI.gmail.getEmails(count * 2);
        if (result.success && result.emails) {
          result.emails = result.emails
            .filter((e) => e.isUnread)
            .slice(0, count);
        }
        break;

      case "GMAIL_SEARCH":
        if (action.params?.query) {
          result = await window.electronAPI.gmail.searchEmails(
            action.params.query as string,
            count,
          );
        } else {
          return "Search query is missing.";
        }
        break;

      case "GMAIL_LABEL":
        if (action.params?.label) {
          // Search by Gmail label using category: prefix
          const label = action.params.label as string;
          result = await window.electronAPI.gmail.searchEmails(
            `category:${label.toLowerCase()}`,
            count,
          );
        } else {
          return "Label name is missing.";
        }
        break;

      case "GMAIL_MARK_READ": {
        const markReadIndex = action.params?.index as number;
        const markReadEmails = getLastFetchedEmails();

        if (markReadEmails.length === 0) {
          return "No emails in context. Please fetch emails first.";
        }

        if (markReadIndex < 1 || markReadIndex > markReadEmails.length) {
          return `Invalid email index. Please choose between 1 and ${markReadEmails.length}.`;
        }

        const emailToMarkRead = markReadEmails[markReadIndex - 1];
        const markReadResult = await window.electronAPI.gmail.markRead(
          emailToMarkRead.id,
        );

        if (!markReadResult.success) {
          return `Error marking email as read: ${
            markReadResult.error || "Unknown error"
          }`;
        }

        // Update local cache
        emailToMarkRead.isUnread = false;
        return `✅ Email #${markReadIndex} marked as read: "${emailToMarkRead.subject}"`;
      }

      case "GMAIL_MARK_UNREAD": {
        const markUnreadIndex = action.params?.index as number;
        const markUnreadEmails = getLastFetchedEmails();

        if (markUnreadEmails.length === 0) {
          return "No emails in context. Please fetch emails first.";
        }

        if (markUnreadIndex < 1 || markUnreadIndex > markUnreadEmails.length) {
          return `Invalid email index. Please choose between 1 and ${markUnreadEmails.length}.`;
        }

        const emailToMarkUnread = markUnreadEmails[markUnreadIndex - 1];
        const markUnreadResult = await window.electronAPI.gmail.markUnread(
          emailToMarkUnread.id,
        );

        if (!markUnreadResult.success) {
          return `Error marking email as unread: ${
            markUnreadResult.error || "Unknown error"
          }`;
        }

        // Update local cache
        emailToMarkUnread.isUnread = true;
        return `📩 Email #${markUnreadIndex} marked as unread: "${emailToMarkUnread.subject}"`;
      }

      case "GMAIL_READ": {
        // Read full email by index from last fetched emails
        const index = action.params?.index as number;
        const emails = getLastFetchedEmails();

        if (emails.length === 0) {
          return "No emails in context. Please fetch emails first using [GMAIL_RECENT] or [GMAIL_SEARCH:query].";
        }

        if (index < 1 || index > emails.length) {
          return `Invalid email index. Please choose between 1 and ${emails.length}.`;
        }

        const email = emails[index - 1]; // Convert 1-based to 0-based
        const detailResult = await window.electronAPI.gmail.getEmailDetails(
          email.id,
        );

        if (!detailResult.success || !detailResult.email) {
          return `Error reading email: ${
            detailResult.error || "Unknown error"
          }`;
        }

        const fullEmail = detailResult.email;
        const relativeDate = formatRelativeDate(fullEmail.date);

        // Check if auto-mark-as-read is enabled
        let autoMarkMessage = "";
        try {
          const autoMarkSetting =
            await window.electronAPI.gmail.getAutoMarkRead();
          if (autoMarkSetting.enabled && email.isUnread) {
            await window.electronAPI.gmail.markRead(email.id);
            email.isUnread = false; // Update local cache
            autoMarkMessage = "\n\n✅ (Auto-marked as read)";
          }
        } catch {
          // Ignore auto-mark errors, don't block email display
        }

        return `Full email content for Email ${index}:

From: ${fullEmail.from}
To: ${fullEmail.to}
Subject: ${fullEmail.subject}
Date: ${relativeDate}

--- Email Body ---
${stripHtml(fullEmail.body)}${autoMarkMessage}
`.trim();
      }

      default:
        return "Unknown Gmail action.";
    }

    if (!result.success) {
      return `Error fetching emails: ${result.error || "Unknown error"}`;
    }

    return formatEmailsForAI(result.emails || []);
  } catch (error) {
    return `Error executing Gmail action: ${(error as Error).message}`;
  }
}
