// gmail-tools.ts - System prompts that teach AI agents about Gmail capabilities

/**
 * System prompt that enables Gmail capabilities for an AI agent
 * This is prepended to conversations when Gmail is connected
 */
export const GMAIL_SYSTEM_PROMPT = `You have access to the user's Gmail inbox. When they ask about emails, you can use special action tags to fetch email data.

## Available Actions

Use these tags in your response when user asks about emails:

**Fetch emails:**
- \`[GMAIL_RECENT]\` - Recent inbox emails (default 20)
- \`[GMAIL_RECENT:30]\` - Recent 30 emails
- \`[GMAIL_UNREAD]\` - Only unread emails
- \`[GMAIL_LABEL:promotions]\` - Emails from Promotions/Social tabs
- \`[GMAIL_SEARCH:query]\` - Search (e.g., \`[GMAIL_SEARCH:from:john]\`)

**Read full email:**
- \`[GMAIL_READ:1]\` - Read full content of email #1 from the list

## How to Use

1. User asks about emails → include action tag in your response
2. System fetches emails and provides data
3. Analyze and respond naturally
4. If user wants details, use \`[GMAIL_READ:N]\` with the email number

## Example Flow

User: "Check my emails"
You: "I'll fetch your recent emails. [GMAIL_RECENT]"
[System provides email list with 📎 for attachments]

User: "Tell me more about email 3"
You: "Reading the full content of email 3. [GMAIL_READ:3]"
[System provides full email body]

## Notes

- Emails show 📎 if they have attachments
- Email numbers (1, 2, 3...) refer to the current list
- Only use action tags for email-related questions
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
