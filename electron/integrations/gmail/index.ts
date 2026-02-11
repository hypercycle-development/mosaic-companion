
// gmail-auth.js - OAuth2 authentication for Gmail using loopback flow
import { google } from 'googleapis';
import http from 'http';
import { URL } from 'url';
import open from 'open';
import destroyer from 'server-destroy';
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';


// Gmail scopes we need - gmail.modify allows read/write (mark read/unread)
const SCOPES = ['https://www.googleapis.com/auth/gmail.modify'];
const REDIRECT_URI = 'http://127.0.0.1:3000/oauth2callback';
const TOKEN_FILE = 'gmail-tokens.json';
const CREDENTIALS_FILE = path.join(__dirname, 'config', 'gmail-credentials.json');

let oauth2Client = null;

/**
 * Load credentials from config file
 */
function loadCredentials() {
  try {
    if (fs.existsSync(CREDENTIALS_FILE)) {
      const data = fs.readFileSync(CREDENTIALS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load Gmail credentials:', error);
  }
  return null;
}

/**
 * Get the path to the token file in user data directory
 */
function getTokenPath() {
  return path.join(app.getPath('userData'), TOKEN_FILE);
}

/**
 * Load saved tokens from disk
 */
function loadTokens() {
  try {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      const data = fs.readFileSync(tokenPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Failed to load Gmail tokens:', error);
  }
  return null;
}

/**
 * Save tokens to disk
 */
function saveTokens(tokens) {
  try {
    const tokenPath = getTokenPath();
    fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2), 'utf8');
    return true;
  } catch (error) {
    console.error('Failed to save Gmail tokens:', error);
    return false;
  }
}

/**
 * Clear saved tokens
 */
function clearTokens() {
  try {
    const tokenPath = getTokenPath();
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
    }
    oauth2Client = null;
    return true;
  } catch (error) {
    console.error('Failed to clear Gmail tokens:', error);
    return false;
  }
}

/**
 * Initialize the OAuth2 client
 */
function getOAuth2Client() {
  if (oauth2Client) {
    return oauth2Client;
  }

  const credentials = loadCredentials();
  if (!credentials) {
    throw new Error('Gmail credentials not found. Please create config/gmail-credentials.json');
  }

  oauth2Client = new google.auth.OAuth2(
    credentials.client_id,
    credentials.client_secret,
    REDIRECT_URI
  );

  // Try to load existing tokens
  const tokens = loadTokens();
  if (tokens) {
    oauth2Client.setCredentials(tokens);
  }

  // Listen for token refresh events
  oauth2Client.on('tokens', (tokens) => {
    console.log('Gmail tokens refreshed');
    // Merge with existing tokens (to keep refresh_token)
    const existingTokens = loadTokens() || {};
    const newTokens = { ...existingTokens, ...tokens };
    saveTokens(newTokens);
    oauth2Client.setCredentials(newTokens);
  });

  return oauth2Client;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  try {
    const client = getOAuth2Client();
    const credentials = client.credentials;
    return !!(credentials && (credentials.access_token || credentials.refresh_token));
  } catch {
    return false;
  }
}

/**
 * Authenticate user via OAuth2 loopback flow
 * Opens system browser for login, captures callback on localhost
 */
async function authenticate() {
  return new Promise((resolve, reject) => {
    const client = getOAuth2Client();

    // Create a local server to catch the callback
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url.startsWith('/oauth2callback')) {
          const qs = new URL(req.url, 'http://127.0.0.1:3000').searchParams;
          const code = qs.get('code');
          const error = qs.get('error');

          if (error) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(`
              <html>
                <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e;">
                  <div style="text-align: center; color: #ff6b6b;">
                    <h1>Authentication Failed</h1>
                    <p>Error: ${error}</p>
                    <p>You can close this tab.</p>
                  </div>
                </body>
              </html>
            `);
            server.destroy();
            reject(new Error(`Authentication failed: ${error}`));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e;">
                <div style="text-align: center; color: #4ade80;">
                  <h1>Authentication Successful!</h1>
                  <p>You can close this tab and return to the app.</p>
                </div>
              </body>
            </html>
          `);
          server.destroy();

          // Exchange code for tokens
          const { tokens } = await client.getToken(code);
          client.setCredentials(tokens);
          saveTokens(tokens);

          resolve(tokens);
        }
      } catch (e) {
        reject(e);
      }
    }).listen(3000, () => {
      // Generate auth URL and open in system browser
      const authUrl = client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // Force consent to get refresh token
      });
      open(authUrl);
    });

    // Enable server.destroy()
    destroyer(server);

    // Timeout after 5 minutes
    setTimeout(() => {
      server.destroy();
      reject(new Error('Authentication timeout'));
    }, 5 * 60 * 1000);
  });
}

/**
 * Sign out - clear tokens
 */
function signOut() {
  return clearTokens();
}

export {
  getOAuth2Client,
  isAuthenticated,
  authenticate,
  signOut,
  SCOPES
};
