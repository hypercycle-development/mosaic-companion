// gmail-tools.ts - System prompts that teach AI agents about Gmail capabilities

/**
 * System prompt that enables Gmail capabilities for an AI agent
 * This is prepended to conversations when Gmail is connected
 */
export const GMAIL_SYSTEM_PROMPT = `You have access to the user's Gmail inbox. When they ask about emails, you can use special action tags to fetch email data.

## Available Actions

Use these tags in your response when the user asks about emails:

- \`[GMAIL_RECENT]\` - Fetch the 10 most recent emails from their inbox
- \`[GMAIL_UNREAD]\` - Fetch only unread emails
- \`[GMAIL_SEARCH:query]\` - Search emails with a query. Examples:
  - \`[GMAIL_SEARCH:from:john]\` - Emails from John
  - \`[GMAIL_SEARCH:subject:invoice]\` - Emails with "invoice" in subject
  - \`[GMAIL_SEARCH:is:unread from:amazon]\` - Unread emails from Amazon
  - \`[GMAIL_SEARCH:newer_than:7d]\` - Emails from the last 7 days

## How to Use

1. When the user asks about emails, include the appropriate action tag in your response
2. After you include an action tag, the system will fetch the emails and provide them to you
3. Then analyze the emails and respond naturally to the user's question

## Example Interaction

User: "Do I have any emails from David?"
You: "I'll check your inbox for emails from David. [GMAIL_SEARCH:from:david]"

[System provides email data]

You: "Yes! I found 3 emails from David. The most recent one is about..."

## Important Notes

- Only use action tags when the user is asking about emails
- For general questions unrelated to email, respond normally without action tags
- Be helpful and summarize emails concisely
- Highlight unread messages and urgent-sounding subjects
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
