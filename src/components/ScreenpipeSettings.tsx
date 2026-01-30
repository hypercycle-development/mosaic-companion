import React, { useState, useEffect } from "react";
import { Zap, Loader2, AlertCircle, Clock, CheckCircle2, Power } from "lucide-react";
import { toast } from "react-toastify";
import { useScreenpipe } from "../hooks/useScreenpipe";

type ScreenpipeLocalSettings = {
  enabled: boolean;
  url: string;
};

interface ScreenpipeData {
  app?: string;
  text?: string;
  timestamp?: string;
  content?: {
    type: string;
    data?: {
      app_name?: string;
      text?: string;
      window_name?: string;
    };
  };
}

interface ScreenpipeSettingsProps {
  screenpipe: ScreenpipeLocalSettings;
  setScreenpipe: React.Dispatch<React.SetStateAction<ScreenpipeLocalSettings>>;
}

export const ScreenpipeSettings: React.FC<ScreenpipeSettingsProps> = ({
  screenpipe,
  setScreenpipe,
}) => {
  const [recentData, setRecentData] = useState<ScreenpipeData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [installing, setInstalling] = useState(false);
  const [checkingInstall, setCheckingInstall] = useState(true);
  const [installed, setInstalled] = useState(false);
  const [running, setRunning] = useState(false);
  const [checkingRunning, setCheckingRunning] = useState(true);
  const [togglingRun, setTogglingRun] = useState(false);

  // Use the hook
  const { getContext } = useScreenpipe();

  const ensureScreenpipeEnabled = async () => {
    if (screenpipe.enabled) return true;
    try {
      const res = await (window as any).electronAPI?.screenpipe?.setSettings({ enabled: true });
      if (res?.success) {
        setScreenpipe((prev) => ({ ...prev, enabled: true }));
        toast.success("Screenpipe enabled");
        return true;
      }
      toast.error(res?.error || "Failed to enable Screenpipe");
      return false;
    } catch (err) {
      toast.error("Failed to enable Screenpipe");
      console.error(err);
      return false;
    }
  };

  const toggleScreenpipe = async () => {
    const next = !screenpipe.enabled;
    try {
      const res = await (window as any).electronAPI?.screenpipe?.setSettings({
        enabled: next,
      });
      if (res?.success) {
        setScreenpipe((prev) => ({ ...prev, enabled: next }));
        toast.success(next ? "Screenpipe enabled" : "Screenpipe disabled");
      } else {
        toast.error(res?.error || "Failed to update Screenpipe");
      }
    } catch (err) {
      toast.error("Failed to update Screenpipe");
      console.error(err);
    }
  };

  const saveScreenpipeUrl = async () => {
    try {
      const res = await (window as any).electronAPI?.screenpipe?.setSettings({
        url: screenpipe.url,
      });
      if (res?.success) {
        toast.success("Screenpipe URL saved");
      } else {
        toast.error(res?.error || "Failed to save URL");
      }
    } catch (err) {
      toast.error("Failed to save URL");
      console.error(err);
    }
  };

  const fetchRecentData = async () => {
    if (!screenpipe.enabled || !screenpipe.url) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getContext(8, { excludeApp: "Electron" });
      
      if (data && data.length > 0) {
        setRecentData(data);
        setLastUpdate(new Date());
      } else {
        setRecentData([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch Screenpipe data";
      setError(errorMessage);
      console.error("Screenpipe query error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-fetch when enabled
  useEffect(() => {
    if (screenpipe.enabled) {
      fetchRecentData();
      // Optional: Set up polling interval
      const interval = setInterval(fetchRecentData, 30000); // Every 30 seconds
      return () => clearInterval(interval);
    }
  }, [screenpipe.enabled]);

  useEffect(() => {
    let active = true;
    const checkInstallAndStatus = async () => {
      try {
        const installRes = await (window as any).electronAPI?.screenpipe?.checkInstalled?.();
        if (active) {
          setInstalled(!!installRes?.installed);
        }
      } catch {
        if (active) setInstalled(false);
      } finally {
        if (active) setCheckingInstall(false);
      }

      try {
        const runningRes = await (window as any).electronAPI?.screenpipe?.isRunning?.();
        if (active) {
          setRunning(!!runningRes?.running);
        }
      } catch {
        if (active) setRunning(false);
      } finally {
        if (active) setCheckingRunning(false);
      }
    };

    checkInstallAndStatus();
    return () => {
      active = false;
    };
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      const result = await (window as any).electronAPI?.screenpipe?.install?.();
      
      if (result?.success) {
        setInstalled(true);
        toast.success("Screenpipe installed successfully!");
      } else {
        toast.error("Installation failed. Opening website for manual installation...");
        // Abrir website si la instalación automática falla
        setTimeout(async () => {
          const url = "https://screenpi.pe/";
          if ((window as any).electronAPI?.openExternal) {
            await (window as any).electronAPI.openExternal(url);
          } else {
            window.open(url, "_blank");
          }
        }, 1500);
      }
    } catch (err) {
      toast.error("Installation failed. Opening website for manual installation...");
      console.error(err);
      // Abrir website si hay error
      setTimeout(async () => {
        const url = "https://screenpi.pe/";
        if ((window as any).electronAPI?.openExternal) {
          await (window as any).electronAPI.openExternal(url);
        } else {
          window.open(url, "_blank");
        }
      }, 1500);
    } finally {
      setInstalling(false);
    }
  };

  const handleToggleRun = async () => {
    setTogglingRun(true);
    try {
      if (running) {
        const res = await (window as any).electronAPI?.screenpipe?.stop?.();
        const ok = !!res?.success;
        if (ok) {
          setRunning(false);
          toast.info("Screenpipe stopped");
        } else {
          toast.error(res?.error || "Failed to stop Screenpipe");
        }
      } else {
        const enabled = await ensureScreenpipeEnabled();
        if (!enabled) {
          setTogglingRun(false);
          return;
        }
        const res = await (window as any).electronAPI?.screenpipe?.start?.();
        const ok = !!res?.success;
        if (ok) {
          setRunning(true);
          toast.success("Screenpipe started");
        } else {
          toast.error(res?.error || "Failed to start Screenpipe");
        }
      }
    } catch (err) {
      toast.error("Operation failed");
      console.error(err);
    } finally {
      setTogglingRun(false);
    }
  };

  const formatSummary = (data: ScreenpipeData[]) => {
    if (!data || data.length === 0) return "No recent data available";

    const latest = data[0];
    return `
User is working in ${latest.app || "unknown app"}
Recent screen text: ${latest.text?.slice(0, 200) || "No text captured"}...
    `.trim();
  };

  return (
    <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
      <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
        <Zap size={20} />
        Screenpipe
      </h2>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleInstall}
            disabled={checkingInstall || installing || installed}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-indigo-500/40 bg-indigo-900/30 text-indigo-200 hover:bg-indigo-900/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {checkingInstall ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Checking installation...
              </>
            ) : installed ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-400" />
                Screenpipe installed
              </>
            ) : (
              <>
                <Zap size={16} />
                Open screenpi.pe
              </>
            )}
          </button>

          <button
            onClick={handleToggleRun}
            disabled={checkingRunning || togglingRun || !installed}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition ${
              running
                ? "border-emerald-500/50 bg-emerald-900/30 text-emerald-100 hover:bg-emerald-900/50"
                : "border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700"
            } disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {checkingRunning || togglingRun ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                {running ? "Stopping..." : "Starting..."}
              </>
            ) : (
              <>
                <Power size={16} />
                {running ? "Stop Screenpipe" : "Use Screenpipe"}
              </>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <span className="text-gray-200 font-medium block">
              Enable Screenpipe
            </span>
            <p className="text-sm text-gray-500">
              Toggle the Neuronal Bridge integration.
            </p>
          </div>
          <button
            onClick={toggleScreenpipe}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900
              ${screenpipe.enabled ? "bg-emerald-600" : "bg-gray-500"}
            `}
          >
            <span
              className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
              ${screenpipe.enabled ? "translate-x-6" : "translate-x-1"}
            `}
            />
          </button>
        </div>

        <label className="block">
          <span className="text-gray-200 font-medium">Screenpipe API URL</span>
          <p className="text-sm text-gray-500 mb-2">
            Base URL of the Screenpipe API.
          </p>
          <input
            type="text"
            value={screenpipe.url}
            onChange={(e) =>
              setScreenpipe((prev) => ({ ...prev, url: e.target.value }))
            }
            onBlur={saveScreenpipeUrl}
            className="w-full max-w-lg px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 placeholder-gray-600"
            placeholder="http://localhost:3030"
          />
        </label>

        {screenpipe.enabled && (
          <div className="border-t border-gray-800 pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <Clock size={16} />
                Recent Activity
              </h3>
              <button
                onClick={fetchRecentData}
                disabled={loading}
                className="text-xs px-3 py-1 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-500/30 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {loading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Refresh"
                )}
              </button>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 flex items-start gap-2 mb-3">
                <AlertCircle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-300">{error}</div>
              </div>
            )}

            {loading && !recentData.length ? (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 size={20} className="animate-spin mr-2" />
                Fetching data...
              </div>
            ) : recentData.length > 0 ? (
              <div className="space-y-3">
                <div className="bg-gray-950/50 border border-gray-700 rounded-lg p-4">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase mb-2">
                    Context Summary
                  </h4>
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                    {formatSummary(recentData)}
                  </pre>
                </div>

                {lastUpdate && (
                  <p className="text-xs text-gray-500 text-right">
                    Last updated: {lastUpdate.toLocaleTimeString()}
                  </p>
                )}

                <details className="bg-gray-950/30 border border-gray-700 rounded-lg">
                  <summary className="px-4 py-2 cursor-pointer text-sm text-gray-400 hover:text-gray-300">
                    View raw data ({recentData.length} items)
                  </summary>
                  <div className="px-4 pb-4 space-y-2 max-h-64 overflow-y-auto">
                    {recentData.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-900/50 border border-gray-700 rounded p-3"
                      >
                        {item.app && (
                          <p className="text-xs text-indigo-400 mb-1">
                            App: {item.app}
                          </p>
                        )}
                        {item.text && (
                          <p className="text-xs text-gray-400 font-mono">
                            {item.text.slice(0, 150)}
                            {item.text.length > 150 ? "..." : ""}
                          </p>
                        )}
                        {item.timestamp && (
                          <p className="text-xs text-gray-600 mt-1">
                            {new Date(item.timestamp).toLocaleString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 text-sm">
                No recent data available. Make sure Screenpipe is running.
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};
