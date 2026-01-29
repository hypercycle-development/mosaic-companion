import React, { useState, useEffect } from "react";
import { Shield, AlertTriangle, RotateCw } from "lucide-react";
import { toast } from "react-toastify";

interface SandboxState {
  isLinux: boolean;
  isAppImage: boolean;
  isFallback: boolean;
  noSandboxFlag: boolean;
  mode: "auto" | "enabled" | "disabled";
}

/**
 * LinuxSandboxSettings
 * Settings section for configuring Linux AppImage sandbox behavior.
 * Only visible when running on Linux.
 */
export function LinuxSandboxSettings() {
  const [sandboxState, setSandboxState] = useState<SandboxState | null>(null);
  const [restartPending, setRestartPending] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    targetMode: "auto" | "enabled" | "disabled";
    type: "enable" | "disable" | null;
  }>({ show: false, targetMode: "auto", type: null });

  // Load sandbox state on mount
  useEffect(() => {
    const loadState = async () => {
      try {
        // @ts-expect-error sandbox API is added by preload
        const state = await window.electronAPI?.sandbox?.getState();
        if (state) setSandboxState(state);
      } catch (error) {
        console.error("Failed to load sandbox state:", error);
      }
    };
    loadState();
  }, []);

  // Don't render if not on Linux
  if (!sandboxState?.isLinux) return null;

  const handleModeChange = async (newMode: "auto" | "enabled" | "disabled") => {
    if (newMode === sandboxState.mode) return;

    if (newMode === "enabled") {
      setConfirmDialog({ show: true, targetMode: newMode, type: "enable" });
    } else if (newMode === "disabled") {
      setConfirmDialog({ show: true, targetMode: newMode, type: "disable" });
    } else {
      await applyMode(newMode);
    }
  };

  const applyMode = async (mode: "auto" | "enabled" | "disabled") => {
    try {
      // @ts-expect-error sandbox API is added by preload
      const result = await window.electronAPI?.sandbox?.setMode(mode);
      if (result?.success) {
        setSandboxState((prev) => (prev ? { ...prev, mode } : null));
        setRestartPending(true);
        toast.success("Sandbox mode updated. Restart required.");
      } else {
        toast.error(result?.error || "Failed to update sandbox mode");
      }
    } catch {
      toast.error("Failed to update sandbox mode");
    }
    setConfirmDialog({ show: false, targetMode: "auto", type: null });
  };

  const handleRestart = async (restartNow: boolean) => {
    if (restartNow) {
      // @ts-expect-error sandbox API is added by preload
      await window.electronAPI?.sandbox?.restartApp();
    } else {
      toast.info("Changes will apply on next restart");
      setRestartPending(false);
    }
  };

  const isSandboxDisabled =
    sandboxState.isFallback ||
    sandboxState.noSandboxFlag ||
    sandboxState.mode === "disabled";

  return (
    <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
      <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
        <Shield size={20} />
        Linux Sandbox Security
      </h2>

      <p className="text-sm text-gray-400 mb-4">
        The Chromium sandbox provides additional security isolation for web
        content. On some Linux distributions (like Ubuntu 24.04+), the sandbox
        may not work with AppImage.
      </p>

      {/* Status indicator */}
      {isSandboxDisabled && (
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg flex items-start gap-3">
          <AlertTriangle
            className="text-yellow-500 flex-shrink-0 mt-0.5"
            size={18}
          />
          <div>
            <p className="text-yellow-400 font-medium text-sm">
              Sandbox is currently disabled
            </p>
            <p className="text-yellow-600 text-xs mt-1">
              {sandboxState.isFallback
                ? "Auto-detected: Sandbox failed to initialize on your system."
                : sandboxState.mode === "disabled"
                  ? "You have disabled the sandbox in settings."
                  : "App was started with --no-sandbox flag."}
            </p>
          </div>
        </div>
      )}

      {/* Mode selection */}
      <div className="space-y-3">
        <span className="text-gray-200 font-medium block">Sandbox Mode</span>
        <div className="space-y-2">
          <ModeOption
            mode="auto"
            currentMode={sandboxState.mode}
            label="Auto-detect"
            badge="(Recommended)"
            badgeColor="text-indigo-400"
            description="Try sandbox first. If it fails, automatically fall back to no-sandbox mode and show a warning."
            onChange={handleModeChange}
          />
          <ModeOption
            mode="enabled"
            currentMode={sandboxState.mode}
            label="Force Enabled"
            description="Always try to use sandbox. May fail on Ubuntu 24.04+ with AppImage."
            onChange={handleModeChange}
          />
          <ModeOption
            mode="disabled"
            currentMode={sandboxState.mode}
            label="Force Disabled"
            badge="(Less Secure)"
            badgeColor="text-yellow-500"
            selectedColor="border-yellow-500/50 bg-yellow-900/20"
            description="Always run without sandbox. Reduces security isolation for web content."
            onChange={handleModeChange}
          />
        </div>
      </div>

      {/* Restart prompt */}
      {restartPending && (
        <div className="mt-4 p-4 bg-indigo-900/30 border border-indigo-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RotateCw className="text-indigo-400" size={18} />
              <span className="text-indigo-300 font-medium">
                Restart required to apply changes
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleRestart(false)}
                className="px-3 py-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors"
              >
                Later
              </button>
              <button
                onClick={() => handleRestart(true)}
                className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
              >
                Restart Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmDialog.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-md mx-4 shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle
                className={
                  confirmDialog.type === "disable"
                    ? "text-yellow-500"
                    : "text-orange-500"
                }
                size={24}
              />
              <div>
                <h3 className="text-lg font-semibold text-gray-100">
                  {confirmDialog.type === "disable"
                    ? "Disable Sandbox?"
                    : "Enable Sandbox?"}
                </h3>
                <p className="text-sm text-gray-400 mt-2">
                  {confirmDialog.type === "disable"
                    ? "Disabling the sandbox reduces browser security protections. Web content will have fewer isolation barriers. Only do this if you trust all content you browse."
                    : "Enabling sandbox on Ubuntu 24.04+ or similar systems may prevent the app from launching when running as an AppImage. You may need to switch back to Auto-detect if the app fails to start."}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() =>
                  setConfirmDialog({
                    show: false,
                    targetMode: "auto",
                    type: null,
                  })
                }
                className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => applyMode(confirmDialog.targetMode)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  confirmDialog.type === "disable"
                    ? "bg-yellow-600 hover:bg-yellow-500 text-white"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white"
                }`}
              >
                {confirmDialog.type === "disable"
                  ? "Disable Sandbox"
                  : "Enable Sandbox"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/** Radio option for sandbox mode */
function ModeOption({
  mode,
  currentMode,
  label,
  badge,
  badgeColor,
  selectedColor = "border-indigo-500/50 bg-indigo-900/20",
  description,
  onChange,
}: {
  mode: "auto" | "enabled" | "disabled";
  currentMode: string;
  label: string;
  badge?: string;
  badgeColor?: string;
  selectedColor?: string;
  description: string;
  onChange: (mode: "auto" | "enabled" | "disabled") => void;
}) {
  const isSelected = currentMode === mode;

  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        isSelected ? selectedColor : "border-gray-700 hover:border-gray-600"
      }`}
    >
      <input
        type="radio"
        name="sandboxMode"
        checked={isSelected}
        onChange={() => onChange(mode)}
        className="mt-1"
      />
      <div>
        <span className="text-gray-200 font-medium">{label}</span>
        {badge && <span className={`text-xs ${badgeColor} ml-2`}>{badge}</span>}
        <p className="text-xs text-gray-500 mt-1">{description}</p>
      </div>
    </label>
  );
}
