// ActionParser.ts - Parse AI responses for action tags and execute Gmail operations

export type GmailActionType =
  | "GMAIL_RECENT"
  | "GMAIL_SEARCH"
  | "GMAIL_UNREAD"
  | "NONE";

export interface ParsedAction {
  type: GmailActionType;
  params?: Record<string, string>;
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
}

// Regex patterns for action tags
const ACTION_PATTERNS = {
  GMAIL_RECENT: /\[GMAIL_RECENT\]/gi,
  GMAIL_UNREAD: /\[GMAIL_UNREAD\]/gi,
  GMAIL_SEARCH: /\[GMAIL_SEARCH:([^\]]+)\]/gi,
};

/**
 * Parse AI response for action tags
 * Returns the action type, parameters, and cleaned response
 */
export function parseAction(response: string): ParsedAction {
  // Check for GMAIL_SEARCH (with parameter)
  const searchMatch = response.match(/\[GMAIL_SEARCH:([^\]]+)\]/i);
  if (searchMatch) {
    return {
      type: "GMAIL_SEARCH",
      params: { query: searchMatch[1] },
      cleanResponse: response.replace(ACTION_PATTERNS.GMAIL_SEARCH, "").trim(),
      rawTag: searchMatch[0],
    };
  }

  // Check for GMAIL_UNREAD
  if (ACTION_PATTERNS.GMAIL_UNREAD.test(response)) {
    return {
      type: "GMAIL_UNREAD",
      cleanResponse: response.replace(ACTION_PATTERNS.GMAIL_UNREAD, "").trim(),
      rawTag: "[GMAIL_UNREAD]",
    };
  }

  // Check for GMAIL_RECENT
  if (ACTION_PATTERNS.GMAIL_RECENT.test(response)) {
    return {
      type: "GMAIL_RECENT",
      cleanResponse: response.replace(ACTION_PATTERNS.GMAIL_RECENT, "").trim(),
      rawTag: "[GMAIL_RECENT]",
    };
  }

  // No action found
  return {
    type: "NONE",
    cleanResponse: response,
  };
}

/**
 * Format email data for AI consumption
 * Creates a structured string that's easy for the AI to parse
 */
export function formatEmailsForAI(emails: EmailData[]): string {
  if (emails.length === 0) {
    return "No emails found matching the criteria.";
  }

  const formatted = emails.map((email, index) => {
    const unreadMarker = email.isUnread ? "[UNREAD]" : "[READ]";
    return `
Email ${index + 1} ${unreadMarker}:
- From: ${email.from}
- Subject: ${email.subject}
- Date: ${email.date}
- Preview: ${email.snippet}
`.trim();
  });

  return `Found ${emails.length} email(s):\n\n${formatted.join("\n\n")}`;
}

/**
 * Build the follow-up prompt to send email data back to AI
 */
export function buildEmailAnalysisPrompt(
  originalQuery: string,
  emailData: string
): string {
  return `Based on the user's request: "${originalQuery}"

Here are the relevant emails from their inbox:

${emailData}

Please analyze these emails and provide a helpful summary responding to the user's original question. Be concise and highlight the most important information.`;
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
  action: ParsedAction
): Promise<string> {
  // Check authentication first
  const isAuthenticated = await isGmailAuthenticated();
  if (!isAuthenticated) {
    return "Gmail is not connected. Please sign in to Gmail in Settings to use email features.";
  }

  try {
    let result;

    switch (action.type) {
      case "GMAIL_RECENT":
        result = await window.electronAPI.gmail.getEmails(10);
        break;

      case "GMAIL_UNREAD":
        // For now, get recent and filter - can optimize with labelIds later
        result = await window.electronAPI.gmail.getEmails(20);
        if (result.success && result.emails) {
          result.emails = result.emails.filter((e) => e.isUnread);
        }
        break;

      case "GMAIL_SEARCH":
        if (action.params?.query) {
          result = await window.electronAPI.gmail.searchEmails(
            action.params.query,
            10
          );
        } else {
          return "Search query is missing.";
        }
        break;

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
