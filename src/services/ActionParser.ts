// ActionParser.ts - Parse AI responses for action tags and execute Gmail operations

export type GmailActionType =
  | "GMAIL_RECENT"
  | "GMAIL_SEARCH"
  | "GMAIL_UNREAD"
  | "GMAIL_LABEL"
  | "NONE";

export interface ParsedAction {
  type: GmailActionType;
  params?: Record<string, string | number>;
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

// Default email count
const DEFAULT_EMAIL_COUNT = 20;

// Regex patterns for action tags - capture entire content between brackets
const ACTION_PATTERNS = {
  GMAIL_RECENT: /\[GMAIL_RECENT(?::(\d+))?\]/gi,
  GMAIL_UNREAD: /\[GMAIL_UNREAD(?::(\d+))?\]/gi,
  GMAIL_SEARCH: /\[GMAIL_SEARCH:([^\]]+)\]/gi,
  GMAIL_LABEL: /\[GMAIL_LABEL:([^\]]+)\]/gi,
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
            count
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
            count
          );
        } else {
          return "Label name is missing.";
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
