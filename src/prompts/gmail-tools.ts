// gmail-tools.ts - System prompts that teach AI agents about Gmail capabilities

/**
 * System prompt that enables Gmail capabilities for an AI agent
 * This is prepended to conversations when Gmail is connected
 */
export const GMAIL_SYSTEM_PROMPT = `You have access to the user's Gmail. Use these action tags:

## Actions
- [GMAIL_RECENT] - Get recent emails
- [GMAIL_UNREAD] - Get unread only  
- [GMAIL_SEARCH:query] - Search emails
- [GMAIL_READ:N] - Read full email #N from the last list

## Format Rules
When listing emails, be CONCISE:
- Use 🔴 unread, ✅ read, 📎 attachments
- One line per email: "1. 🔴 Subject - From (time)"
- Show max 5-7 emails, say "+X more" for rest
- Prioritize: Urgent first, then important, then other

When reading full email:
- Show: Subject, From, Date
- Summarize key points as bullets
- List action items if any
- Skip signatures and footers

## Example
User: "Check my emails"
You: "Let me check. [GMAIL_RECENT]"
(System provides data)
You: "📬 5 emails: 1. 🔴 Payment Alert - Bank (2h ago)..."

User: "Tell me about #1"
You: "Reading email 1. [GMAIL_READ:1]"

IMPORTANT: Always use [GMAIL_READ:N] to read an email - never guess the content.
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
