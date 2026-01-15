import React, { useState, useEffect, useCallback } from "react";
import {
  Mail,
  LogIn,
  LogOut,
  RefreshCw,
  User,
  ChevronRight,
} from "lucide-react";

interface Email {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: string;
  date: string;
  isUnread: boolean;
}

interface GmailStatus {
  authenticated: boolean;
  email?: string;
  error?: string;
}

export default function GmailClient() {
  const [status, setStatus] = useState<GmailStatus>({ authenticated: false });
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [fetchingEmails, setFetchingEmails] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check authentication status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.gmail.getStatus();
      setStatus(result);
      if (result.authenticated) {
        await fetchEmails();
      }
    } catch (err) {
      setError("Failed to check authentication status");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setSigningIn(true);
      setError(null);
      const result = await window.electronAPI.gmail.signIn();
      if (result.success) {
        setStatus({ authenticated: true, email: result.email });
        await fetchEmails();
      } else {
        setError(result.error || "Sign in failed");
      }
    } catch (err) {
      setError("Failed to sign in with Google");
    } finally {
      setSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await window.electronAPI.gmail.signOut();
      setStatus({ authenticated: false });
      setEmails([]);
    } catch (err) {
      setError("Failed to sign out");
    }
  };

  const fetchEmails = useCallback(async () => {
    try {
      setFetchingEmails(true);
      setError(null);
      const result = await window.electronAPI.gmail.getEmails(15);
      if (result.success) {
        setEmails(result.emails);
      } else {
        setError(result.error || "Failed to fetch emails");
      }
    } catch (err) {
      setError("Failed to fetch emails");
    } finally {
      setFetchingEmails(false);
    }
  }, []);

  // Parse sender name from "Name <email>" format
  const parseSender = (from: string) => {
    const match = from.match(/^(.+?)\s*<.*>$/);
    return match ? match[1].replace(/"/g, "") : from;
  };

  // Format date to relative time
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="gmail-container gmail-loading">
        <div className="gmail-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!status.authenticated) {
    return (
      <div className="gmail-container gmail-login">
        <div className="gmail-login-card">
          <div className="gmail-logo">
            <Mail size={48} />
          </div>
          <h2>Connect to Gmail</h2>
          <p>Sign in with your Google account to view your recent emails.</p>
          {error && <div className="gmail-error">{error}</div>}
          <button
            className="gmail-btn gmail-btn-primary"
            onClick={handleSignIn}
            disabled={signingIn}
          >
            {signingIn ? (
              <>
                <RefreshCw className="gmail-spin" size={18} />
                Signing in...
              </>
            ) : (
              <>
                <LogIn size={18} />
                Sign in with Google
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="gmail-container">
      <div className="gmail-header">
        <div className="gmail-user">
          <User size={20} />
          <span>{status.email}</span>
        </div>
        <div className="gmail-actions">
          <button
            className="gmail-btn gmail-btn-icon"
            onClick={fetchEmails}
            disabled={fetchingEmails}
            title="Refresh"
          >
            <RefreshCw
              className={fetchingEmails ? "gmail-spin" : ""}
              size={18}
            />
          </button>
          <button
            className="gmail-btn gmail-btn-icon"
            onClick={handleSignOut}
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {error && <div className="gmail-error">{error}</div>}

      <div className="gmail-email-list">
        {emails.length === 0 ? (
          <div className="gmail-empty">
            <Mail size={32} />
            <p>No emails found</p>
          </div>
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              className={`gmail-email-item ${
                email.isUnread ? "gmail-unread" : ""
              }`}
            >
              <div className="gmail-email-header">
                <span className="gmail-sender">{parseSender(email.from)}</span>
                <span className="gmail-date">{formatDate(email.date)}</span>
              </div>
              <div className="gmail-subject">
                {email.subject || "(no subject)"}
              </div>
              <div className="gmail-snippet">{email.snippet}</div>
              <ChevronRight className="gmail-chevron" size={16} />
            </div>
          ))
        )}
      </div>

      <style>{`
        .gmail-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          color: #e2e8f0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .gmail-loading {
          align-items: center;
          justify-content: center;
          gap: 1rem;
        }

        .gmail-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top-color: #3b82f6;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .gmail-spin {
          animation: spin 1s linear infinite;
        }

        .gmail-login {
          align-items: center;
          justify-content: center;
          padding: 2rem;
        }

        .gmail-login-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 3rem;
          text-align: center;
          max-width: 400px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .gmail-logo {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #ea4335, #fbbc04, #34a853, #4285f4);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
          color: white;
        }

        .gmail-login-card h2 {
          margin: 0 0 0.5rem;
          font-size: 1.5rem;
          font-weight: 600;
        }

        .gmail-login-card p {
          margin: 0 0 1.5rem;
          color: #94a3b8;
        }

        .gmail-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .gmail-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .gmail-btn-primary {
          background: linear-gradient(135deg, #4285f4, #3b82f6);
          color: white;
        }

        .gmail-btn-primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(66, 133, 244, 0.4);
        }

        .gmail-btn-icon {
          padding: 0.5rem;
          background: rgba(255, 255, 255, 0.1);
          color: #94a3b8;
        }

        .gmail-btn-icon:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.15);
          color: #e2e8f0;
        }

        .gmail-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.5rem;
          background: rgba(0, 0, 0, 0.2);
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .gmail-user {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #94a3b8;
        }

        .gmail-actions {
          display: flex;
          gap: 0.5rem;
        }

        .gmail-error {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          margin: 1rem;
          border-radius: 8px;
          font-size: 0.875rem;
        }

        .gmail-email-list {
          flex: 1;
          overflow-y: auto;
        }

        .gmail-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          gap: 1rem;
          color: #64748b;
        }

        .gmail-email-item {
          position: relative;
          padding: 1rem 1.5rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          cursor: pointer;
          transition: background 0.2s;
        }

        .gmail-email-item:hover {
          background: rgba(255, 255, 255, 0.05);
        }

        .gmail-email-item.gmail-unread {
          background: rgba(59, 130, 246, 0.1);
        }

        .gmail-email-item.gmail-unread::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: #3b82f6;
        }

        .gmail-email-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.25rem;
        }

        .gmail-sender {
          font-weight: 600;
          color: #f1f5f9;
        }

        .gmail-unread .gmail-sender {
          color: #60a5fa;
        }

        .gmail-date {
          font-size: 0.75rem;
          color: #64748b;
        }

        .gmail-subject {
          font-size: 0.9rem;
          color: #cbd5e1;
          margin-bottom: 0.25rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding-right: 1.5rem;
        }

        .gmail-snippet {
          font-size: 0.8rem;
          color: #64748b;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          padding-right: 1.5rem;
        }

        .gmail-chevron {
          position: absolute;
          right: 1rem;
          top: 50%;
          transform: translateY(-50%);
          color: #475569;
        }
      `}</style>
    </div>
  );
}
