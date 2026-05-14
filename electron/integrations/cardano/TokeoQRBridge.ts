/**
 * Tokeo QR Session Manager
 * Manages QR-based pairing between Desktop Electron app and Tokeo mobile wallet
 * 
 * Architecture:
 * 1. Desktop generates QR code with session ID + callback URL
 * 2. Tokeo mobile scans QR, connects, signs proof
 * 3. Mobile sends callback POST to local HTTP server
 * 4. Desktop polls/receives connection status
 * 5. Desktop verifies NFT ownership via Koios
 */

import * as http from 'http';
import * as crypto from 'crypto';
import * as os from 'os';

function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Get the best network IP for callbacks from external devices
 * Prefers: LAN (192.168.x, 10.x) > Tailscale (100.x) > localhost fallback
 * 
 * Rationale: Mobile devices on the same WiFi can always reach LAN IPs.
 * Tailscale IPs only work if the mobile device is also on the Tailscale mesh.
 */
export function getCallbackHost(): string {
  const interfaces = os.networkInterfaces();
  let tailscaleIp: string | null = null;
  let lanIp: string | null = null;

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        // LAN private ranges (most common for mobile on same WiFi)
        if (
          addr.address.startsWith('192.168.') ||
          addr.address.startsWith('10.') ||
          addr.address.startsWith('172.16.')
        ) {
          lanIp = addr.address;
        }
        // Tailscale mesh IP (100.64.0.0/10) — only if mobile is on Tailscale
        else if (addr.address.startsWith('100.')) {
          tailscaleIp = addr.address;
        }
      }
    }
  }

  // Priority: LAN > Tailscale > localhost
  return lanIp || tailscaleIp || 'localhost';
}

export interface QRSession {
  sessionId: string;
  policyIds: string[];
  status: 'pending' | 'connected' | 'expired' | 'error';
  address?: string;
  signature?: string;
  network: 'mainnet' | 'preprod' | 'preview';
  createdAt: number;
  expiresAt: number;
  callbackUrl: string;
  qrData: string;
}

export interface QRPairingResult {
  sessionId: string;
  qrData: string;
  callbackUrl: string;
}

export interface QRStatusResult {
  status: 'pending' | 'connected' | 'expired' | 'error';
  address?: string;
  error?: string;
}

interface CallbackPayload {
  address: string;
  signature?: string;
  sessionId: string;
  network?: string;
}

export class TokeoQRSessionManager {
  private sessions = new Map<string, QRSession>();
  private server: http.Server | null = null;
  private serverPort: number = 0;
  private maxSessions = 5;

  /**
   * Create a new QR pairing session
   */
  createSession(policyIds: string[], network: 'mainnet' | 'preprod' | 'preview' = 'mainnet'): QRPairingResult {
    // Clean up expired sessions first
    this.cleanupExpiredSessions();

    // Rate limit: max 5 active sessions
    if (this.sessions.size >= this.maxSessions) {
      throw new Error('Maximum number of active QR sessions reached. Please wait or cancel an existing session.');
    }

    const sessionId = generateSessionId();
    const now = Date.now();
    const expiresAt = now + 5 * 60 * 1000; // 5 minutes expiration

    // Build callback URL (server must be running)
    const port = this.serverPort || 9876;
    const callbackHost = getCallbackHost();
    const callbackUrl = `http://${callbackHost}:${port}/callback`;

    // Build QR data payload
    const qrPayload = {
      type: 'cardano-sign',
      sessionId,
      callback: callbackUrl,
      policyIds,
      network,
      app: 'mosaic-companion',
      timestamp: now,
    };

    const qrData = JSON.stringify(qrPayload);

    const session: QRSession = {
      sessionId,
      policyIds: policyIds.map(p => p.toLowerCase().trim()),
      status: 'pending',
      network,
      createdAt: now,
      expiresAt,
      callbackUrl,
      qrData,
    };

    this.sessions.set(sessionId, session);
    console.log(`[TokeoQR] Created session ${sessionId.slice(0, 8)}... expires in 5min`);

    return { sessionId, qrData, callbackUrl };
  }

  /**
   * Get session status
   */
  getSessionStatus(sessionId: string): QRStatusResult {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { status: 'expired', error: 'Session not found' };
    }

    if (Date.now() > session.expiresAt && session.status === 'pending') {
      session.status = 'expired';
      return { status: 'expired', error: 'Session expired' };
    }

    return {
      status: session.status,
      address: session.address,
      error: session.status === 'error' ? 'Connection error occurred' : undefined,
    };
  }

  /**
   * Get full session data (for internal use)
   */
  getSession(sessionId: string): QRSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Mark a session as connected with the wallet address
   */
  completeSession(sessionId: string, address: string, signature?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      console.warn(`[TokeoQR] Cannot complete unknown session: ${sessionId}`);
      return;
    }

    session.status = 'connected';
    session.address = address;
    session.signature = signature;
    console.log(`[TokeoQR] Session ${sessionId.slice(0, 8)}... connected with address ${address.slice(0, 16)}...`);
  }

  /**
   * Mark a session as errored
   */
  setSessionError(sessionId: string, error: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.status = 'error';
      console.error(`[TokeoQR] Session ${sessionId.slice(0, 8)}... error: ${error}`);
    }
  }

  /**
   * Cancel and remove a session
   */
  cancelSession(sessionId: string): boolean {
    const deleted = this.sessions.delete(sessionId);
    if (deleted) {
      console.log(`[TokeoQR] Session ${sessionId.slice(0, 8)}... cancelled`);
    }
    return deleted;
  }

  /**
   * Start the HTTP callback server
   * Returns the actual port used
   */
  async startServer(preferredPort: number = 9876): Promise<number> {
    if (this.server) {
      console.log(`[TokeoQR] Server already running on port ${this.serverPort}`);
      return this.serverPort;
    }

    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        // Enable CORS for mobile app callbacks
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.writeHead(200);
          res.end();
          return;
        }

        if (req.method === 'POST' && req.url === '/callback') {
          let body = '';
          req.on('data', chunk => body += chunk);
          req.on('end', () => {
            try {
              const payload: CallbackPayload = JSON.parse(body);
              console.log(`[TokeoQR] Callback received for session ${payload.sessionId?.slice(0, 8)}...`);

              if (payload.sessionId && payload.address) {
                this.completeSession(payload.sessionId, payload.address, payload.signature);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, message: 'Session connected' }));
              } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Missing sessionId or address' }));
              }
            } catch (err) {
              console.error('[TokeoQR] Invalid callback payload:', err);
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
          });
          return;
        }

        // Health check endpoint
        if (req.method === 'GET' && req.url === '/health') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', activeSessions: this.sessions.size }));
          return;
        }

        // Debug: list active sessions
        if (req.method === 'GET' && req.url === '/debug') {
          const sessions = Array.from(this.sessions.values()).map(s => ({
            sessionId: s.sessionId.slice(0, 8) + '...',
            status: s.status,
            address: s.address ? s.address.slice(0, 16) + '...' : null,
            policyCount: s.policyIds.length,
            network: s.network,
            expiresIn: Math.max(0, Math.round((s.expiresAt - Date.now()) / 1000)),
          }));
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ status: 'ok', sessions }));
          return;
        }

        res.writeHead(404);
        res.end('Not found');
      });

      server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.log(`[TokeoQR] Port ${preferredPort} in use, trying ${preferredPort + 1}`);
          server.listen(preferredPort + 1);
        } else {
          reject(err);
        }
      });

      server.listen(preferredPort, '0.0.0.0', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          this.serverPort = addr.port;
          this.server = server;
          const host = getCallbackHost();
          console.log(`[TokeoQR] Callback server running on http://${host}:${this.serverPort}/callback (bind: 0.0.0.0)`);
          resolve(this.serverPort);
        } else {
          reject(new Error('Could not determine server port'));
        }
      });
    });
  }

  /**
   * Stop the HTTP callback server
   */
  stopServer(): void {
    if (this.server) {
      this.server.close();
      this.server = null;
      this.serverPort = 0;
      console.log('[TokeoQR] Callback server stopped');
    }
  }

  /**
   * Clean up expired sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [id, session] of Array.from(this.sessions.entries())) {
      if (now > session.expiresAt && session.status === 'pending') {
        session.status = 'expired';
        console.log(`[TokeoQR] Session ${id.slice(0, 8)}... expired`);
      }
    }

    // Remove expired/error sessions older than 10 minutes
    const cutoff = now - 10 * 60 * 1000;
    for (const [id, session] of Array.from(this.sessions.entries())) {
      if ((session.status === 'expired' || session.status === 'error') && session.createdAt < cutoff) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Get all active sessions (for debugging)
   */
  getActiveSessions(): QRSession[] {
    this.cleanupExpiredSessions();
    return Array.from(this.sessions.values()).filter(s => s.status === 'pending' || s.status === 'connected');
  }

  /**
   * Shutdown: stop server and clear all sessions
   */
  shutdown(): void {
    this.stopServer();
    this.sessions.clear();
    console.log('[TokeoQR] Session manager shutdown');
  }
}

// Export singleton instance
export const qrSessionManager = new TokeoQRSessionManager();
