import React, { useState, useEffect } from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";

interface SandboxState {
  isFallback: boolean;
  isLinux: boolean;
  isAppImage: boolean;
  noSandboxFlag: boolean;
  mode: "auto" | "enabled" | "disabled";
}

/**
 * SandboxWarningBanner
 * Shows a dismissable warning when running without Chromium sandbox protection.
 * Only appears on Linux when sandbox was disabled (either via fallback or user setting).
 */
export function SandboxWarningBanner() {
  const [sandboxState, setSandboxState] = useState<SandboxState | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSandboxState = async () => {
      try {
        // @ts-expect-error sandbox API is added by preload
        const state = await window.electronAPI?.sandbox?.getState();
        if (state) {
          setSandboxState(state);
        }

        // Check if user has dismissed this session
        const dismissed = sessionStorage.getItem("sandbox-warning-dismissed");
        if (dismissed === "true") {
          setIsDismissed(true);
        }
      } catch (error) {
        console.error("Failed to get sandbox state:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSandboxState();
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("sandbox-warning-dismissed", "true");
  };

  // Don't show while loading
  if (isLoading) return null;

  // Don't show if dismissed
  if (isDismissed) return null;

  // Only show on Linux
  if (!sandboxState?.isLinux) return null;

  // Only show if sandbox is actually disabled
  const isSandboxDisabled =
    sandboxState.isFallback ||
    sandboxState.noSandboxFlag ||
    sandboxState.mode === "disabled";

  if (!isSandboxDisabled) return null;

  // Determine the reason for disabled sandbox
  let reasonText = "";
  if (sandboxState.isFallback) {
    reasonText =
      "Sandbox was automatically disabled due to system restrictions (Ubuntu 24.04+).";
  } else if (sandboxState.mode === "disabled") {
    reasonText = "Sandbox is disabled in your settings.";
  } else if (sandboxState.noSandboxFlag) {
    reasonText = "App was launched with --no-sandbox flag.";
  }

  return (
    <div className="sandbox-warning-banner">
      <div className="sandbox-warning-content">
        <AlertTriangle className="sandbox-warning-icon" size={18} />
        <div className="sandbox-warning-text">
          <strong>Reduced Security Mode</strong>
          <span>{reasonText} Browser security protections are limited.</span>
          <a
            href="https://github.com/hypercycle-development/mosaic-browser/blob/main/docs/linux-sandbox.md"
            target="_blank"
            rel="noopener noreferrer"
            className="sandbox-warning-link"
          >
            Learn more <ExternalLink size={12} />
          </a>
        </div>
      </div>
      <button
        className="sandbox-warning-dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss warning"
      >
        <X size={16} />
      </button>

      <style>{`
        .sandbox-warning-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: linear-gradient(135deg, #fef3cd 0%, #fff3cd 100%);
          border-bottom: 1px solid #ffc107;
          padding: 8px 16px;
          font-size: 13px;
          color: #856404;
        }

        .sandbox-warning-content {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }

        .sandbox-warning-icon {
          color: #d39e00;
          flex-shrink: 0;
        }

        .sandbox-warning-text {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }

        .sandbox-warning-text strong {
          color: #664d03;
        }

        .sandbox-warning-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #0d6efd;
          text-decoration: none;
        }

        .sandbox-warning-link:hover {
          text-decoration: underline;
        }

        .sandbox-warning-dismiss {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          color: #856404;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sandbox-warning-dismiss:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .sandbox-warning-banner {
            background: linear-gradient(135deg, #332701 0%, #3d2e02 100%);
            border-bottom-color: #664d03;
            color: #ffc107;
          }

          .sandbox-warning-text strong {
            color: #ffda6a;
          }

          .sandbox-warning-dismiss {
            color: #ffc107;
          }
        }
      `}</style>
    </div>
  );
}

export default SandboxWarningBanner;
