import React, { useEffect, useState } from "react";
import { House, Activity, Database, Lightbulb, Sparkles, Settings, RefreshCw } from "lucide-react";
import type { HaConnectionStatus, HaStateChange, HaEventStats, HaSuggestion } from "./types";
import { AIService } from "../../../src/services/AIService";
import type { AIAgentConfig } from "../../../src/types/ai";
import { INTERNAL_SETTINGS_URL } from "../../../src/types/types";

const MAX_EVENTS = 25; // Live view shows only the most recent events

type Tab = "live" | "history" | "routines";

interface Props {
  onNavigate?: (url: string) => void;
}

interface DesignResult {
  loading: boolean;
  text?: string;
  config?: any;
  error?: string;
  created?: boolean;
}

// Best-effort extraction of an automation config from the agent's reply:
// prefer a ```json fenced block, else the first parseable object with a trigger.
function extractConfig(text: string): any | null {
  const fence = text.match(/```(?:json|yaml)?\s*([\s\S]*?)```/i);
  const candidates: string[] = [];
  if (fence) candidates.push(fence[1]);
  candidates.push(text);
  for (const c of candidates) {
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start === -1 || end <= start) continue;
    try {
      const obj = JSON.parse(c.slice(start, end + 1));
      if (obj && (obj.trigger || obj.action || obj.alias)) return obj;
    } catch {
      /* try next */
    }
  }
  return null;
}

export const HomeAssistantView: React.FC<Props> = ({ onNavigate }) => {
  const [tab, setTab] = useState<Tab>("live");
  const [status, setStatus] = useState<HaConnectionStatus>("disconnected");
  const [events, setEvents] = useState<HaStateChange[]>([]);
  const [stats, setStats] = useState<HaEventStats | null>(null);
  const [suggestions, setSuggestions] = useState<HaSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [agents, setAgents] = useState<AIAgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [allowControl, setAllowControl] = useState(false);
  const [designs, setDesigns] = useState<Record<string, DesignResult>>({});
  const [error, setError] = useState<string | null>(null);

  const api = (window as any).electronAPI?.homeAssistant;

  useEffect(() => {
    if (!api) {
      setError("Home Assistant API not available. Please restart the application.");
      return;
    }
    api.status().then(({ status: s }: any) => setStatus(s as HaConnectionStatus));
    api.getSettings().then((s: any) => {
      setAllowControl(Boolean(s.allowControl));
      if (s.haAgentId) setSelectedAgentId(s.haAgentId);
    });
  }, []);

  useEffect(() => {
    if (!api) return;
    const offStatus = api.onStatus(({ status: s }: any) => setStatus(s as HaConnectionStatus));
    const offEvent = api.onEvent((evt: HaStateChange) =>
      setEvents((prev) => [evt, ...prev].slice(0, MAX_EVENTS)),
    );
    const offError = api.onError(({ message }: any) => setError(message));
    return () => {
      offStatus?.();
      offEvent?.();
      offError?.();
    };
  }, []);

  const loadStats = async () => {
    if (!api) return;
    const res = await api.getEventStats();
    if (res.success) setStats(res.data);
  };

  const loadSuggestions = async () => {
    if (!api) return;
    setLoadingSuggestions(true);
    try {
      const res = await api.getSuggestions();
      if (res.success) setSuggestions(res.data || []);
      else setError(res.error || "Failed to load suggestions");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (tab === "history") loadStats();
    if (tab === "routines") {
      loadSuggestions();
      (window as any).electronAPI?.aiAgents?.get().then((list: AIAgentConfig[]) => {
        setAgents(list || []);
        if (!selectedAgentId) {
          const active = (list || []).find((a) => a.isActive) || (list || [])[0];
          if (active) setSelectedAgentId(active.id);
        }
      });
    }
  }, [tab]);

  const handleDesign = async (s: HaSuggestion) => {
    const agent = agents.find((a) => a.id === selectedAgentId);
    if (!agent) {
      setError("No AI agent selected. Configure one in Configuration → AI Agents.");
      return;
    }
    setDesigns((d) => ({ ...d, [s.id]: { loading: true } }));
    const system =
      "You are a Home Assistant automation expert. Given an observed pattern and a rough draft, " +
      "produce ONE clean, safe automation. Reply with a short explanation, then a single ```json " +
      "code block containing a valid HA automation config object with keys: alias, trigger, " +
      "condition (optional), action, mode. Keep entity_ids exactly as given.";
    const prompt =
      `Observed pattern: ${s.description}\n` +
      `Confidence: ${s.confidence}\n` +
      `Evidence: ${JSON.stringify(s.evidence)}\n` +
      `Rough draft automation: ${JSON.stringify(s.draft, null, 2)}\n\n` +
      `Design the automation. Add a sensible condition if appropriate (e.g. only after sunset, ` +
      `only when someone is home). Explain your choices briefly.`;
    try {
      const text = await AIService.sendMessage(agent, [
        { id: `sys-${s.id}`, role: "system", content: system, timestamp: Date.now(), agentId: agent.id },
        { id: `ha-${s.id}`, role: "user", content: prompt, timestamp: Date.now(), agentId: agent.id },
      ]);
      const config = extractConfig(text) || s.draft;
      setDesigns((d) => ({ ...d, [s.id]: { loading: false, text, config } }));
    } catch (e: any) {
      setDesigns((d) => ({ ...d, [s.id]: { loading: false, error: e?.message || "AI request failed" } }));
    }
  };

  const handleCreate = async (s: HaSuggestion) => {
    const design = designs[s.id];
    const config = design?.config || s.draft;
    const res = await api.createAutomation({ config });
    if (res.success) {
      setDesigns((d) => ({ ...d, [s.id]: { ...(d[s.id] || { loading: false }), created: true } }));
    } else {
      setError(res.error || "Failed to create automation");
    }
  };

  const statusColor =
    status === "connected" ? "bg-emerald-500" : status === "connecting" ? "bg-yellow-500 animate-pulse" : "bg-gray-600";
  const statusLabel =
    status === "connected" ? "Connected" : status === "connecting" ? "Connecting…" : "Disconnected";

  const goConfigure = () => onNavigate?.(INTERNAL_SETTINGS_URL + "#home-assistant");

  return (
    <div className="flex h-full flex-col bg-gray-950 text-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-6 py-4">
        <div className="flex items-center gap-2">
          <House size={20} className="text-emerald-400" />
          <h1 className="text-base font-semibold text-white">Home Assistant</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${statusColor}`} />
            <span className="text-xs text-gray-400">{statusLabel}</span>
          </div>
          <button
            onClick={goConfigure}
            title="Home Assistant settings"
            className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-2.5 py-1.5 text-xs text-gray-400 hover:border-emerald-600 hover:text-emerald-400"
          >
            <Settings size={13} /> Configure
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-800 px-4">
        {([
          { id: "live", label: "Live", icon: Activity },
          { id: "history", label: "History", icon: Database },
          { id: "routines", label: "Suggested Routines", icon: Lightbulb },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors ${
              tab === id
                ? "border-b-2 border-emerald-500 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mx-6 mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* Not-connected hint */}
      {status === "disconnected" && (
        <div className="mx-6 mt-4 flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/40 px-4 py-3">
          <span className="text-sm text-gray-400">
            Not connected. Set your server URL and token in Configuration.
          </span>
          <button
            onClick={goConfigure}
            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            Open Configuration
          </button>
        </div>
      )}

      {/* Live tab */}
      {tab === "live" && (
        <div className="flex-1 overflow-hidden p-6">
          {status !== "connected" ? (
            <div className="flex h-full flex-col items-center justify-center opacity-40">
              <Activity size={32} className="mb-2 text-gray-600" />
              <p className="text-sm text-gray-500">Connect to see live home events.</p>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <p className="mb-3 text-xs text-gray-500">Live state changes ({events.length}) — newest first.</p>
              <div className="flex-1 overflow-y-auto rounded-lg border border-gray-800 bg-gray-900/50">
                {events.length === 0 ? (
                  <p className="p-6 text-center text-sm text-gray-600">
                    Waiting for events… try toggling something in your home.
                  </p>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-900 text-xs text-gray-500">
                      <tr>
                        <th className="px-4 py-2 font-normal">Time</th>
                        <th className="px-4 py-2 font-normal">Entity</th>
                        <th className="px-4 py-2 font-normal">Change</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {events.map((e, i) => (
                        <tr key={`${e.entityId}-${e.ts}-${i}`} className="hover:bg-gray-800/40">
                          <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-gray-500">
                            {new Date(e.ts).toLocaleTimeString()}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-emerald-400">{e.entityId}</td>
                          <td className="px-4 py-2 text-xs text-gray-300">
                            <span className="text-gray-500">{e.oldState ?? "—"}</span>
                            {" → "}
                            <span className="text-gray-100">{e.newState ?? "—"}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === "history" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex items-center gap-3">
            <p className="text-xs text-gray-500">Captured locally for routine learning.</p>
            <button
              onClick={loadStats}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-emerald-600 hover:text-emerald-400"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {!stats || stats.total === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-40">
              <Database size={32} className="mb-2 text-gray-600" />
              <p className="text-sm text-gray-500">
                No events captured yet. Connect and let the home run for a while.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6 grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                  <div className="text-2xl font-semibold text-white">{stats.total.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">events captured</div>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                  <div className="text-2xl font-semibold text-white">{stats.topEntities.length}</div>
                  <div className="text-xs text-gray-500">active entities (top 25)</div>
                </div>
                <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                  <div className="text-sm font-medium text-white">
                    {stats.oldestTs ? new Date(stats.oldestTs).toLocaleDateString() : "—"}
                  </div>
                  <div className="text-xs text-gray-500">oldest event</div>
                </div>
              </div>

              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Most active entities
              </p>
              <div className="overflow-hidden rounded-lg border border-gray-800 bg-gray-900/50">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-900 text-xs text-gray-500">
                    <tr>
                      <th className="px-4 py-2 font-normal">Entity</th>
                      <th className="px-4 py-2 text-right font-normal">Events</th>
                      <th className="px-4 py-2 text-right font-normal">Last seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {stats.topEntities.map((e) => (
                      <tr key={e.entityId} className="hover:bg-gray-800/40">
                        <td className="px-4 py-2 font-mono text-xs text-emerald-400">{e.entityId}</td>
                        <td className="px-4 py-2 text-right text-gray-300">{e.count.toLocaleString()}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs text-gray-500">
                          {new Date(e.lastTs).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Suggested Routines tab */}
      {tab === "routines" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <p className="text-xs text-gray-500">
              Candidate routines mined from your captured events. Pick an agent to design one.
            </p>
            <div className="ml-auto flex items-center gap-2">
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="rounded-lg border border-gray-700 bg-gray-900 px-2 py-1.5 text-xs text-gray-200"
              >
                {agents.length === 0 && <option value="">No agents configured</option>}
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.provider})
                  </option>
                ))}
              </select>
              <button
                onClick={loadSuggestions}
                className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-emerald-600 hover:text-emerald-400"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>

          {loadingSuggestions ? (
            <p className="py-10 text-center text-sm text-gray-500">Analyzing event history…</p>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-40">
              <Lightbulb size={32} className="mb-2 text-gray-600" />
              <p className="text-sm text-gray-500">
                No routine candidates yet. Capture a few days of events, then check back.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {suggestions.map((s) => {
                const d = designs[s.id];
                return (
                  <div key={s.id} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-200">{s.description}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {Math.round(s.confidence * 100)}% confidence · {s.type} · {JSON.stringify(s.evidence)}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDesign(s)}
                        disabled={d?.loading || !selectedAgentId}
                        className="flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                      >
                        <Sparkles size={12} /> {d?.loading ? "Designing…" : "Design with AI"}
                      </button>
                    </div>

                    {d?.error && <p className="mt-2 text-xs text-red-400">{d.error}</p>}

                    {d?.text && (
                      <div className="mt-3 border-t border-gray-800 pt-3">
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs text-gray-300">
                          {d.text}
                        </pre>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            onClick={() => handleCreate(s)}
                            disabled={!allowControl || d.created}
                            title={
                              allowControl
                                ? "Create this automation in Home Assistant"
                                : "Enable 'Allow agent control' in Configuration to create automations"
                            }
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            {d.created ? "✓ Created in HA" : "Create in HA"}
                          </button>
                          {!allowControl && (
                            <span className="text-xs text-gray-600">Requires agent control (Configuration)</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
