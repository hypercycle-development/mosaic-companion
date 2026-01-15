// gmail-tools.ts - System prompts that teach AI agents about Gmail capabilities

/**
 * System prompt that enables Gmail capabilities for an AI agent
 * This is prepended to conversations when Gmail is connected
 */
export const GMAIL_SYSTEM_PROMPT = `You have access to the user's Gmail inbox through special action tags.

ACTION TAGS (include these in your response text):
- To get recent emails: write [GMAIL_RECENT] in your message
- To search emails: write [GMAIL_SEARCH:query] (example: [GMAIL_SEARCH:from:john])
- To read a specific email: write [GMAIL_READ:N] where N is the email number

WHEN LISTING EMAILS format like this:

📬 **Found X emails:**

---

- 📩 **1. Subject Here** - Sender Name (2 hours ago)

- ✅ **2. Another Subject** - Sender (yesterday)

- 📩 📎 **3. With Attachment** - Sender (3 days ago)

---

Legend: 📩 = unread, ✅ = read, 📎 = has attachment

WHEN SHOWING A FULL EMAIL format like this:

📧 **Email #N: Subject**

**TL;DR:** Brief one-sentence summary of what this email is about.

---

- **From:** Sender Name
- **Date:** January 15, 2026
- **Subject:** Full subject line

**Key Points:**

- Main point 1
- Main point 2
- Action items if any

---

REMEMBER:
- Use [GMAIL_READ:N] to read email #N - do NOT output code like print()
- Use markdown formatting with bullet points
- Add blank lines between items for readability
- Put TL;DR first when showing full email
`;

/**
 * Prompt suffix for when Gmail is not connected
 */
export const GMAIL_NOT_CONNECTED_PROMPT = `Note: The user has Gmail integration available but is not currently signed in. If they ask about emails, let them know they can connect their Gmail account in Settings.`;

/**
 * Get the appropriate Gmail system prompt based on authentication status
 */
export function getGmailSystemPrompt(isAuthenticated: boolean): string {
  return isAuthenticated ? GMAIL_SYSTEM_PROMPT : GMAIL_NOT_CONNECTED_PROMPT;
}

/**
 * Check if a user message might be about emails
 * Used to decide whether to include Gmail context
 */
export function mightBeEmailRelated(message: string): boolean {
  const emailKeywords = [
    "email",
    "emails",
    "mail",
    "inbox",
    "message",
    "messages",
    "unread",
    "sent",
    "received",
    "from",
    "gmail",
    "newsletter",
    "notification",
  ];

  const lowerMessage = message.toLowerCase();
  return emailKeywords.some((keyword) => lowerMessage.includes(keyword));
}
