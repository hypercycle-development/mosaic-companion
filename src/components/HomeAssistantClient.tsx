import React, { useEffect, useState } from "react";
import { House, Search } from "lucide-react";
import type { AIAgentConfig } from "../types/ai";

// Home Assistant configuration section (lives in the Configuration page).
// Owns connection settings (URL/token), auto-connect, agent-control, which
// AI agent supports HA, and which entities are ignored by the analysis.
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
  const [ignored, setIgnored] = useState<string[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [entitySearch, setEntitySearch] = useState("");
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
      setIgnored(s.ignoredEntities || []);
    });
    api.status().then(({ status: s }: any) => setStatus(s));
    (window as any).electronAPI?.aiAgents?.get().then((list: AIAgentConfig[]) => setAgents(list || []));
    const off = api.onStatus(({ status: s }: any) => setStatus(s));
    return () => off?.();
  }, []);

  // Load entities for the ignore-list once connected.
  useEffect(() => {
    if (status === "connected" && api) {
      api.getStates().then((res: any) => {
        if (res.success && Array.isArray(res.data)) {
          setEntities(res.data.map((e: any) => e.entity_id).sort());
        }
      });
    }
  }, [status]);

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
  const toggleIgnore = async (entityId: string) => {
    const next = ignored.includes(entityId)
      ? ignored.filter((e) => e !== entityId)
      : [...ignored, entityId];
    setIgnored(next);
    await api.setIgnoredEntities(next);
  };

  const statusColor =
    status === "connected" ? "bg-emerald-500" : status === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-gray-600";
  const statusLabel =
    status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected";
  const canConnect = baseUrl.trim().length > 0 && (hasToken || token.trim().length > 0);

  const filteredEntities = entitySearch
    ? entities.filter((e) => e.includes(entitySearch.toLowerCase()))
    : entities;

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
              className="rounded-lg bg-indigo-900/30 px-4 py-2 text-sm font-medium text-indigo-300 border border-indigo-500/30 hover:bg-indigo-900/50 disabled:opacity-40"
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

        {/* Auto-connect */}
        <ToggleRow
          label="Connect automatically on startup"
          desc="Reconnect to this server whenever Mosaic launches."
          checked={autoConnect}
          onChange={toggleAuto}
        />

        {/* Agent control */}
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

        {/* Ignore-list */}
        <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4">
          <label className="mb-1 block text-sm font-medium text-gray-200">
            Ignored devices ({ignored.length})
          </label>
          <p className="mb-2 text-xs text-gray-500">
            Entities excluded from the routine-analysis algorithm (e.g. noisy sensors).
          </p>

          {ignored.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {ignored.map((e) => (
                <button
                  key={e}
                  onClick={() => toggleIgnore(e)}
                  className="flex items-center gap-1 rounded-full bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-300 hover:bg-red-900/40 hover:text-red-300"
                  title="Click to stop ignoring"
                >
                  {e} ✕
                </button>
              ))}
            </div>
          )}

          {status !== "connected" ? (
            <p className="text-xs text-gray-600">Connect to browse and select entities to ignore.</p>
          ) : (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                <input
                  type="text"
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value.toLowerCase())}
                  placeholder="Search entities…"
                  className="w-full rounded-lg border border-gray-700 bg-gray-950 py-1.5 pl-8 pr-3 text-xs text-gray-200 placeholder-gray-600"
                />
              </div>
              <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-800">
                {filteredEntities.slice(0, 300).map((e) => (
                  <label
                    key={e}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-800/50"
                  >
                    <input
                      type="checkbox"
                      checked={ignored.includes(e)}
                      onChange={() => toggleIgnore(e)}
                      className="h-3.5 w-3.5 accent-indigo-600"
                    />
                    <span className="font-mono text-gray-300">{e}</span>
                  </label>
                ))}
                {filteredEntities.length === 0 && (
                  <p className="px-3 py-3 text-xs text-gray-600">No entities match.</p>
                )}
              </div>
            </>
          )}
        </div>
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
