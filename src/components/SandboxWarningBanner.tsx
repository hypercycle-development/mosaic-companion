import React, { useState, useEffect } from "react";
import { AlertTriangle, X, ExternalLink } from "lucide-react";

interface SandboxState {
  isFallback: boolean;
  isLinux: boolean;
  isAppImage: boolean;
  noSandboxFlag: boolean;
}

/**
 * SandboxWarningBanner
 * Shows a dismissable warning when running without Chromium sandbox protection.
 * Only appears on Linux AppImage when sandbox is disabled due to kernel restrictions.
 */
export function SandboxWarningBanner() {
  const [sandboxState, setSandboxState] = useState<SandboxState | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSandboxState = async () => {
      try {
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

  // Don't show while loading, dismissed, or on non-Linux
  if (isLoading || isDismissed || !sandboxState?.isLinux) return null;

  // Only show if sandbox is disabled (via auto-detect fallback or --no-sandbox)
  if (!sandboxState.isFallback && !sandboxState.noSandboxFlag) return null;

  return (
    <div
      className="flex items-center justify-between px-4 py-2 text-sm border-b"
      style={{
        background:
          "linear-gradient(135deg, rgba(234, 179, 8, 0.15) 0%, rgba(234, 179, 8, 0.08) 100%)",
        borderColor: "rgba(234, 179, 8, 0.3)",
        color: "var(--text)",
      }}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <AlertTriangle
          className="flex-shrink-0"
          size={16}
          style={{ color: "#eab308" }}
        />
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <strong style={{ color: "#eab308" }}>Reduced Security Mode</strong>
          <span className="opacity-80">
            Sandbox disabled due to system restrictions (Ubuntu 24.04+).
          </span>
          <a
            href="https://github.com/electron/electron/issues/42510"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:underline"
            style={{ color: "#60a5fa" }}
          >
            Learn more <ExternalLink size={10} />
          </a>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss warning"
        className="flex items-center justify-center p-1 rounded opacity-60 hover:opacity-100 hover:bg-yellow-500/20 transition-all flex-shrink-0 ml-2"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export default SandboxWarningBanner;
