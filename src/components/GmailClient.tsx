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

// Tailwind classes will be applied directly to elements — removed inline CSS string.

export default function GmailClient() {
  const [status, setStatus] = useState<GmailStatus>({ authenticated: false });
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [fetchingEmails, setFetchingEmails] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoMarkRead, setAutoMarkRead] = useState(false);

  // Check authentication status and load settings on mount
  useEffect(() => {
    checkStatus();
    loadAutoMarkSetting();
  }, []);

  const loadAutoMarkSetting = async () => {
    try {
      const result = await window.electronAPI.gmail.getAutoMarkRead();
      setAutoMarkRead(result.enabled);
    } catch {
      // Ignore errors, default to false
    }
  };

  const toggleAutoMarkRead = async () => {
    try {
      const newValue = !autoMarkRead;
      const result = await window.electronAPI.gmail.setAutoMarkRead(newValue);
      if (result.success) {
        setAutoMarkRead(result.enabled);
      }
    } catch {
      // Ignore errors
    }
  };

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
      <div
        className={
          "flex flex-col h-full text-slate-200 font-sans items-center justify-center gap-4"
        }
        style={{ background: "var(--background)", color: "var(--text)" }}
      >
        <div
          className={"w-8 h-8 rounded-full animate-spin"}
          style={{
            border: "4px solid rgba(255,255,255,0.08)",
            borderTopColor: "var(--primaryStrong)",
          }}
        />
        <p>Loading...</p>
      </div>
    );
  }

  if (!status.authenticated) {
    return (
      <div
        className={
          "flex flex-col h-full text-slate-200 font-sans items-center justify-center p-8"
        }
        style={{ background: "var(--background)", color: "var(--text)" }}
      >
        <div
          className={
            "backdrop-blur-md rounded-xl p-12 text-center max-w-md shadow-2xl"
          }
          style={{
            backgroundColor: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className={
              "w-20 h-20 rounded-lg flex items-center justify-center mx-auto mb-6 text-white"
            }
            style={{
              background:
                "linear-gradient(135deg,var(--danger),var(--warning),var(--success),var(--primary))",
            }}
          >
            <Mail size={48} />
          </div>
          <h2
            className={"text-xl font-semibold mb-2"}
            style={{ color: "var(--text)" }}
          >
            Connect to Gmail
          </h2>
          <p className={"text-sm mb-6"} style={{ color: "var(--textMuted)" }}>
            Sign in with your Google account to view your recent emails.
          </p>
          {error && (
            <div
              className={"p-3 m-4 rounded-md text-sm"}
              style={{
                backgroundColor: "var(--danger)",
                color: "var(--text)",
                opacity: 0.12,
              }}
            >
              {error}
            </div>
          )}
          <button
            className={
              "inline-flex items-center gap-2 px-6 py-3 rounded-md text-base font-medium transition-all hover:-translate-y-1 hover:shadow-xl disabled:opacity-70 disabled:cursor-not-allowed"
            }
            onClick={handleSignIn}
            disabled={signingIn}
            style={{
              background:
                "linear-gradient(135deg,var(--primaryStrong),var(--primary))",
              color: "var(--text)",
            }}
          >
            {signingIn ? (
              <>
                <RefreshCw className={"animate-spin"} size={18} />
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
    <div
      className={"flex flex-col h-full text-slate-200 font-sans"}
      style={{ background: "var(--background)", color: "var(--text)" }}
    >
      <div
        className={"flex items-center justify-between px-6 py-4"}
        style={{
          backgroundColor: "var(--overlay)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className={"flex items-center gap-2"}
          style={{ color: "var(--textMuted)" }}
        >
          <User size={20} />
          <span>{status.email}</span>
        </div>
        <div className={"flex gap-2"}>
          <button
            className={
              "inline-flex items-center p-2 rounded-md transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            }
            onClick={fetchEmails}
            disabled={fetchingEmails}
            title="Refresh"
            style={{
              backgroundColor: "var(--surfaceAlt)",
              color: "var(--textMuted)",
            }}
          >
            <RefreshCw
              className={fetchingEmails ? "animate-spin" : ""}
              size={18}
            />
          </button>
          <button
            className={
              "inline-flex items-center p-2 rounded-md transition-colors"
            }
            onClick={handleSignOut}
            title="Sign out"
            style={{
              backgroundColor: "var(--surfaceAlt)",
              color: "var(--textMuted)",
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {error && (
        <div
          className={"p-3 m-4 rounded-md text-sm"}
          style={{
            backgroundColor: "var(--danger)",
            color: "var(--text)",
            opacity: 0.12,
          }}
        >
          {error}
        </div>
      )}

      {/* Auto-mark setting */}
      <div
        className={"flex items-center justify-between px-6 py-3"}
        style={{
          backgroundColor: "var(--overlay)",
          borderBottom: "1px solid var(--borderMuted)",
        }}
      >
        <div className={"flex flex-col gap-0.5"}>
          <span
            style={{
              color: "var(--text)",
              fontSize: "0.875rem",
              fontWeight: 500,
            }}
          >
            Auto-mark as read
          </span>
          <span style={{ color: "var(--textMuted)", fontSize: "0.75rem" }}>
            Mark emails as read when viewed via AI
          </span>
        </div>
        <button
          onClick={toggleAutoMarkRead}
          className={
            "relative w-11 h-6 rounded-full cursor-pointer transition-colors"
          }
          style={{
            backgroundColor: autoMarkRead ? "var(--primary)" : "var(--muted)",
          }}
        >
          <span
            style={{
              transform: autoMarkRead ? "translateX(20px)" : "translateX(0)",
              position: "absolute",
              top: 2,
              left: 2,
              width: 20,
              height: 20,
              backgroundColor: "var(--surface)",
              borderRadius: "9999px",
              transition: "transform 0.2s",
            }}
          />
        </button>
      </div>

      <div className={"flex-1 overflow-y-auto"}>
        {emails.length === 0 ? (
          <div
            className={"flex flex-col items-center justify-center h-full gap-4"}
            style={{ color: "var(--textMuted)" }}
          >
            <Mail size={32} />
            <p>No emails found</p>
          </div>
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              className={"relative px-6 py-4 cursor-pointer transition-colors"}
              style={{ borderBottom: "1px solid var(--borderMuted)" }}
            >
              {email.isUnread && (
                <span
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 3,
                    background: "var(--primaryStrong)",
                  }}
                />
              )}
              <div className={"flex items-center justify-between mb-1"}>
                <span
                  style={{
                    color: email.isUnread ? "var(--primary)" : "var(--text)",
                    fontWeight: 600,
                  }}
                >
                  {parseSender(email.from)}
                </span>
                <span
                  style={{ color: "var(--textMuted)", fontSize: "0.75rem" }}
                >
                  {formatDate(email.date)}
                </span>
              </div>
              <div
                style={{
                  color: "var(--text)",
                  fontSize: "0.9rem",
                  marginBottom: "0.25rem",
                  paddingRight: "1.5rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {email.subject || "(no subject)"}
              </div>
              <div
                style={{
                  color: "var(--textMuted)",
                  fontSize: "0.8rem",
                  paddingRight: "1.5rem",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {email.snippet}
              </div>
              <ChevronRight
                style={{
                  position: "absolute",
                  right: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--muted)",
                }}
                size={16}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
