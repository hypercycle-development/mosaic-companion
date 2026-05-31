import React, { useEffect, useState } from "react";
import { House } from "lucide-react";
import type { AIAgentConfig } from "../types/ai";

// Home Assistant configuration section (Configuration page): connection,
// auto-connect, agent-control, and which AI agent supports HA. Per-entity
// management (ignore / dashboard / labels / delete data) lives on the Home
// Assistant view's History tab.
export default function HomeAssistantClient() {
  const api = (window as any).electronAPI?.homeAssistant;

  const [status, setStatus] = useState<string>("disconnected");
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const [autoConnect, setAutoConnect] = useState(false);
  const [allowControl, setAllowControl] = useState(false);
  const [agents, setAgents] = useState<AIAgentConfig[]>([]);
  const [haAgentId, setHaAgentId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    api.getSettings().then((s: any) => {
      setBaseUrl(s.baseUrl || "");
      setHasToken(Boolean(s.hasToken));
      setAutoConnect(Boolean(s.autoConnect));
      setAllowControl(Boolean(s.allowControl));
      setHaAgentId(s.haAgentId || "");
    });
    api.status().then(({ status: s }: any) => setStatus(s));
    (window as any).electronAPI?.aiAgents?.get().then((list: AIAgentConfig[]) => setAgents(list || []));
    const off = api.onStatus(({ status: s }: any) => setStatus(s));
    return () => off?.();
  }, []);

  const handleConnect = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.saveSettings({ baseUrl: baseUrl.trim(), token: token.trim() });
      if (token.trim()) setHasToken(true);
      setToken("");
      const res = await api.connect();
      if (!res.success) setError(res.error || "Connection failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await api.disconnect();
    } finally {
      setBusy(false);
    }
  };

  const toggleAuto = async () => {
    const next = !autoConnect;
    setAutoConnect(next);
    await api.setAutoConnect(next);
  };
  const toggleControl = async () => {
    const next = !allowControl;
    setAllowControl(next);
    await api.setControlAllowed(next);
  };
  const changeAgent = async (id: string) => {
    setHaAgentId(id);
    await api.setHaAgent(id);
  };

  const statusColor =
    status === "connected" ? "bg-emerald-500" : status === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-gray-600";
  const statusLabel =
    status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected";
  const canConnect = baseUrl.trim().length > 0 && (hasToken || token.trim().length > 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-xl font-semibold text-indigo-400">
          <House size={20} />
          Home Assistant
        </h2>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${statusColor}`} />
          <span className="text-xs text-gray-400">{statusLabel}</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="max-w-xl space-y-4">
        {/* Connection */}
        <div>
          <label className="mb-1 block text-sm text-gray-400">Server URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://homeassistant.local:8123"
            disabled={status !== "disconnected"}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-gray-400">
            Long-Lived Access Token {hasToken && <span className="text-emerald-500">• saved</span>}
          </label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasToken ? "•••• (leave blank to keep saved token)" : "Paste token from HA → Profile → Security"}
            disabled={status !== "disconnected"}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-xs text-gray-200 placeholder-gray-600 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
          />
        </div>
        <div className="flex gap-2">
          {status === "disconnected" ? (
            <button
              onClick={handleConnect}
              disabled={!canConnect || busy}
              className="rounded-lg border border-indigo-500/30 bg-indigo-900/30 px-4 py-2 text-sm font-medium text-indigo-300 hover:bg-indigo-900/50 disabled:opacity-40"
            >
              {busy ? "Connecting…" : "Connect"}
            </button>
          ) : (
            <button
              onClick={handleDisconnect}
              disabled={busy}
              className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 hover:bg-gray-800 disabled:opacity-40"
            >
              Disconnect
            </button>
          )}
        </div>

        <ToggleRow
          label="Connect automatically on startup"
          desc="Reconnect to this server whenever Mosaic launches."
          checked={autoConnect}
          onChange={toggleAuto}
        />

        <ToggleRow
          label="Allow the AI agent to control my home"
          desc="When off (recommended), the agent can read state and draft automations, but cannot control devices or create automations."
          checked={allowControl}
          onChange={toggleControl}
        />

        {/* HA agent picker */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
          <label className="mb-1 block text-sm font-medium text-gray-200">Supporting AI agent</label>
          <p className="mb-2 text-xs text-gray-500">
            Which configured agent designs Home Assistant routines for you.
          </p>
          <select
            value={haAgentId}
            onChange={(e) => changeAgent(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-gray-200"
          >
            <option value="">Use the active agent</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.provider})
              </option>
            ))}
          </select>
        </div>

        {/* Pointer to entity management */}
        <p className="text-xs text-gray-500">
          Manage which entities are analyzed and shown on the dashboard, set custom labels, and delete
          captured data on the <span className="text-gray-300">Home Assistant → History</span> tab.
        </p>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
      <div className="pr-4">
        <span className="block text-sm font-medium text-gray-200">{label}</span>
        <span className="mt-0.5 block text-xs text-gray-500">{desc}</span>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-indigo-600" : "bg-gray-700"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
