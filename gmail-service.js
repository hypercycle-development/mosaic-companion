// gmail-service.js - Gmail API service for fetching emails
import { google } from 'googleapis';
import { getOAuth2Client, isAuthenticated } from './gmail-auth.js';

/**
 * Get authenticated Gmail API client
 */
function getGmailClient() {
  if (!isAuthenticated()) {
    throw new Error('Not authenticated. Please sign in first.');
  }
  
  const auth = getOAuth2Client();
  return google.gmail({ version: 'v1', auth });
}

/**
 * Get user profile info
 */
async function getUserProfile() {
  const gmail = getGmailClient();
  const response = await gmail.users.getProfile({ userId: 'me' });
  return response.data;
}

/**
 * Fetch recent emails
 * @param {number} maxResults - Maximum number of emails to fetch (default: 10)
 * @returns {Promise<Array>} Array of email objects with id, snippet, subject, from, date
 */
async function getRecentEmails(maxResults = 10) {
  const gmail = getGmailClient();

  // First, get list of message IDs
  const listResponse = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    labelIds: ['INBOX'],
  });

  const messages = listResponse.data.messages || [];
  
  if (messages.length === 0) {
    return [];
  }

  // Fetch details for each message
  const emailPromises = messages.map(async (message) => {
    const msgResponse = await gmail.users.messages.get({
      userId: 'me',
      id: message.id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });

    const msg = msgResponse.data;
    const headers = msg.payload?.headers || [];

    // Extract header values
    const getHeader = (name) => {
      const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    return {
      id: msg.id,
      threadId: msg.threadId,
      snippet: msg.snippet || '',
      subject: getHeader('Subject'),
      from: getHeader('From'),
      date: getHeader('Date'),
      labelIds: msg.labelIds || [],
      isUnread: msg.labelIds?.includes('UNREAD') || false,
    };
  });

  return Promise.all(emailPromises);
}

/**
 * Get full email details
 * @param {string} messageId - The message ID
 * @returns {Promise<Object>} Full email object with body content
 */
async function getEmailDetails(messageId) {
  const gmail = getGmailClient();

  const response = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full',
  });

  const msg = response.data;
  const headers = msg.payload?.headers || [];

  const getHeader = (name) => {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header?.value || '';
  };

  // Extract body content
  let body = '';
  const extractBody = (part) => {
    if (part.body?.data) {
      // Decode base64url encoded content
      const decoded = Buffer.from(part.body.data, 'base64url').toString('utf8');
      if (part.mimeType === 'text/plain') {
        body = decoded;
      } else if (part.mimeType === 'text/html' && !body) {
        body = decoded;
      }
    }
    if (part.parts) {
      part.parts.forEach(extractBody);
    }
  };

  if (msg.payload) {
    extractBody(msg.payload);
  }

  return {
    id: msg.id,
    threadId: msg.threadId,
    snippet: msg.snippet || '',
    subject: getHeader('Subject'),
    from: getHeader('From'),
    to: getHeader('To'),
    date: getHeader('Date'),
    body,
    labelIds: msg.labelIds || [],
    isUnread: msg.labelIds?.includes('UNREAD') || false,
  };
}

export {
  getUserProfile,
  getRecentEmails,
  getEmailDetails,
};
