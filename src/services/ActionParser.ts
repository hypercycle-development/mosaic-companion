// ActionParser.ts - Parse AI responses for action tags and execute Gmail operations

export type GmailActionType =
  | "GMAIL_RECENT"
  | "GMAIL_SEARCH"
  | "GMAIL_UNREAD"
  | "GMAIL_LABEL"
  | "GMAIL_READ"
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
  emailData: string
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

RULES:
- Use bullet points with dashes (-)
- Use --- separators between sections
- Add blank line between each email for readability
- Use markdown **bold** for subjects
- Be concise - no walls of text
- Highlight most important emails first

Provide a helpful summary with the format above.`;
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
          email.id
        );

        if (!detailResult.success || !detailResult.email) {
          return `Error reading email: ${
            detailResult.error || "Unknown error"
          }`;
        }

        const fullEmail = detailResult.email;
        const relativeDate = formatRelativeDate(fullEmail.date);

        return `Full email content for Email ${index}:

From: ${fullEmail.from}
To: ${fullEmail.to}
Subject: ${fullEmail.subject}
Date: ${relativeDate}

--- Email Body ---
${fullEmail.body}
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
