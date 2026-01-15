// gmail-tools.ts - System prompts that teach AI agents about Gmail capabilities

/**
 * System prompt that enables Gmail capabilities for an AI agent
 * This is prepended to conversations when Gmail is connected
 */
export const GMAIL_SYSTEM_PROMPT = `You have access to the user's Gmail inbox. When they ask about emails, you can use special action tags to fetch email data.

## Available Actions

Use these tags in your response when the user asks about emails. All actions return 20 emails by default. Add a count suffix to change: \`[ACTION:count]\`

- \`[GMAIL_RECENT]\` - Recent inbox emails (default 20)
- \`[GMAIL_RECENT:30]\` - Recent 30 emails
- \`[GMAIL_UNREAD]\` - Only unread emails
- \`[GMAIL_UNREAD:10]\` - Last 10 unread emails
- \`[GMAIL_LABEL:promotions]\` - Emails from Promotions tab
- \`[GMAIL_LABEL:social]\` - Emails from Social tab
- \`[GMAIL_SEARCH:query]\` - Search emails. Examples:
  - \`[GMAIL_SEARCH:from:john]\` - From John
  - \`[GMAIL_SEARCH:from:john:15]\` - From John (15 results)
  - \`[GMAIL_SEARCH:subject:invoice]\` - Subject contains "invoice"
  - \`[GMAIL_SEARCH:is:unread from:amazon]\` - Unread from Amazon
  - \`[GMAIL_SEARCH:newer_than:7d]\` - Last 7 days

## How to Use

1. Include the action tag in your response when user asks about emails
2. System fetches emails and provides them to you
3. Analyze and respond naturally

## Example

User: "Show me the last 30 emails"
You: "I'll fetch your 30 most recent emails. [GMAIL_RECENT:30]"

User: "Check my promotions"
You: "Looking at your Promotions folder. [GMAIL_LABEL:promotions]"

## Notes

- Only use action tags for email-related questions
- Highlight unread messages and urgent subjects
- Be concise and helpful
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
