import React, { useEffect, useState } from "react";
import { House, Activity, Database, Lightbulb, Sparkles, Settings, RefreshCw, LayoutDashboard, Search, Trash2 } from "lucide-react";
import type { HaConnectionStatus, HaStateChange, HaEventStats, HaSuggestion, HaState } from "./types";
import { AIService } from "../../../src/services/AIService";
import type { AIAgentConfig } from "../../../src/types/ai";
import { INTERNAL_SETTINGS_URL } from "../../../src/types/types";
import { Dashboard } from "./components/Dashboard";

const MAX_EVENTS = 25; // Live view shows only the most recent events

type Tab = "dashboard" | "live" | "history" | "routines";

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
  const [tab, setTab] = useState<Tab>("dashboard");
  const [status, setStatus] = useState<HaConnectionStatus>("disconnected");
  const [events, setEvents] = useState<HaStateChange[]>([]);
  const [statesMap, setStatesMap] = useState<Record<string, HaState>>({});
  const [stats, setStats] = useState<HaEventStats | null>(null);
  const [suggestions, setSuggestions] = useState<HaSuggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [agents, setAgents] = useState<AIAgentConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [allowControl, setAllowControl] = useState(false);
  const [dashSel, setDashSel] = useState<string[]>([]);
  const [entityLabels, setEntityLabels] = useState<Record<string, string>>({});
  const [ignored, setIgnored] = useState<string[]>([]);
  const [entityCounts, setEntityCounts] = useState<Record<string, number>>({});
  const [entitySearch, setEntitySearch] = useState("");
  const [sortKey, setSortKey] = useState<"events" | "ignore" | "dash" | "entity" | "label">("entity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
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
      setDashSel(s.dashboardEntities || []);
      setEntityLabels(s.entityLabels || {});
      setIgnored(s.ignoredEntities || []);
    });
  }, []);

  useEffect(() => {
    if (!api) return;
    const offStatus = api.onStatus(({ status: s }: any) => setStatus(s as HaConnectionStatus));
    const offEvent = api.onEvent((evt: HaStateChange) => {
      setEvents((prev) => [evt, ...prev].slice(0, MAX_EVENTS));
      // Keep the dashboard live by folding each change into the states map.
      setStatesMap((prev) => ({
        ...prev,
        [evt.entityId]: {
          entity_id: evt.entityId,
          state: evt.newState ?? "",
          attributes: (evt.attrs as Record<string, any>) || {},
        },
      }));
    });
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

  const loadEntityCounts = async () => {
    if (!api) return;
    const res = await api.getEntityCounts();
    if (res.success) setEntityCounts(res.data || {});
  };

  const loadStates = async () => {
    if (!api) return;
    const res = await api.getStates();
    if (res.success && Array.isArray(res.data)) {
      const map: Record<string, HaState> = {};
      for (const s of res.data) map[s.entity_id] = s;
      setStatesMap(map);
    }
  };

  // Populate the dashboard once connected, and whenever the Dashboard tab opens.
  useEffect(() => {
    if (status === "connected") loadStates();
  }, [status]);

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
    if (tab === "dashboard") {
      loadStates();
      // Pick up any selection/label changes made in Configuration.
      api?.getSettings().then((s: any) => {
        setDashSel(s.dashboardEntities || []);
        setEntityLabels(s.entityLabels || {});
      });
    }
    if (tab === "history") {
      loadStats();
      loadEntityCounts();
      loadStates(); // entity list for the manager
      api?.getSettings().then((s: any) => {
        setDashSel(s.dashboardEntities || []);
        setEntityLabels(s.entityLabels || {});
        setIgnored(s.ignoredEntities || []);
      });
    }
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

  // ── Entity manager (History tab) ───────────────────────────────────────────
  const entityList = Object.values(statesMap)
    .map((e) => ({ id: e.entity_id, name: (e.attributes?.friendly_name as string) || e.entity_id }))
    .sort((a, b) => a.id.localeCompare(b.id));
  const filteredEntities = entitySearch
    ? entityList.filter((e) => e.id.includes(entitySearch) || e.name.toLowerCase().includes(entitySearch))
    : entityList;

  const sortedEntities = [...filteredEntities].sort((a, b) => {
    let av: number | string;
    let bv: number | string;
    switch (sortKey) {
      case "events": av = entityCounts[a.id] || 0; bv = entityCounts[b.id] || 0; break;
      case "ignore": av = ignored.includes(a.id) ? 1 : 0; bv = ignored.includes(b.id) ? 1 : 0; break;
      case "dash": av = dashSel.includes(a.id) ? 1 : 0; bv = dashSel.includes(b.id) ? 1 : 0; break;
      case "label": av = (entityLabels[a.id] || "").toLowerCase(); bv = (entityLabels[b.id] || "").toLowerCase(); break;
      default: av = a.id; bv = b.id;
    }
    const cmp = typeof av === "number" ? (av as number) - (bv as number) : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const sortBy = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "events" ? "desc" : "asc"); // counts read best high→low
    }
  };
  const arrow = (key: typeof sortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");

  const toggleIgnore = async (id: string) => {
    const next = ignored.includes(id) ? ignored.filter((e) => e !== id) : [...ignored, id];
    setIgnored(next);
    await api.setIgnoredEntities(next);
  };
  const toggleDashboard = async (id: string) => {
    const next = dashSel.includes(id) ? dashSel.filter((e) => e !== id) : [...dashSel, id];
    setDashSel(next);
    await api.setDashboardEntities(next);
  };
  const setLabelLocal = (id: string, value: string) =>
    setEntityLabels((prev) => {
      const next = { ...prev };
      if (value.trim()) next[id] = value;
      else delete next[id];
      return next;
    });
  const saveLabels = async () => {
    await api.setEntityLabels(entityLabels);
  };
  const ignoreAll = async () => {
    const next = Array.from(new Set([...ignored, ...filteredEntities.map((e) => e.id)]));
    setIgnored(next);
    await api.setIgnoredEntities(next);
  };
  const clearIgnored = async () => {
    setIgnored([]);
    await api.setIgnoredEntities([]);
  };
  const unignoreFiltered = async () => {
    const set = new Set(filteredEntities.map((e) => e.id));
    const next = ignored.filter((id) => !set.has(id));
    setIgnored(next);
    await api.setIgnoredEntities(next);
  };
  const deleteEntityData = async (id: string) => {
    if (!window.confirm(`Delete all captured events for ${id}? This only clears local history, not Home Assistant.`)) return;
    const res = await api.deleteEntityEvents(id);
    if (res.success) {
      loadEntityCounts();
      loadStats();
    } else {
      setError(res.error || "Failed to delete data");
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
          { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
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

      {/* Dashboard tab */}
      {tab === "dashboard" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex items-center gap-3">
            <p className="text-xs text-gray-500">A live overview of your home.</p>
            <button
              onClick={loadStates}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-emerald-600 hover:text-emerald-400"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>
          {Object.keys(statesMap).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-40">
              <LayoutDashboard size={32} className="mb-2 text-gray-600" />
              <p className="text-sm text-gray-500">Connect to see your home dashboard.</p>
            </div>
          ) : (
            <Dashboard states={Object.values(statesMap)} selected={dashSel} labels={entityLabels} />
          )}
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

      {/* History tab — capture stats + entity manager */}
      {tab === "history" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4 flex items-center gap-3">
            <p className="text-xs text-gray-500">
              Captured locally for routine learning. Manage which entities are analyzed and shown.
            </p>
            <button
              onClick={() => {
                loadStats();
                loadEntityCounts();
                loadStates();
              }}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-300 hover:border-emerald-600 hover:text-emerald-400"
            >
              <RefreshCw size={12} /> Refresh
            </button>
          </div>

          {/* Capture stats */}
          {stats && stats.total > 0 && (
            <div className="mb-6 grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                <div className="text-2xl font-semibold text-white">{stats.total.toLocaleString()}</div>
                <div className="text-xs text-gray-500">events captured</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                <div className="text-2xl font-semibold text-white">{entityList.length}</div>
                <div className="text-xs text-gray-500">entities</div>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                <div className="text-sm font-medium text-white">
                  {stats.oldestTs ? new Date(stats.oldestTs).toLocaleDateString() : "—"}
                </div>
                <div className="text-xs text-gray-500">oldest event</div>
              </div>
            </div>
          )}

          {/* Entity manager */}
          {entityList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 opacity-40">
              <Database size={32} className="mb-2 text-gray-600" />
              <p className="text-sm text-gray-500">Connect to manage your entities.</p>
            </div>
          ) : (
            <>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
                <input
                  type="text"
                  value={entitySearch}
                  onChange={(e) => setEntitySearch(e.target.value.toLowerCase())}
                  placeholder="Search entities…"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 py-1.5 pl-8 pr-3 text-xs text-gray-200 placeholder-gray-600"
                />
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-gray-500">
                <span>
                  {filteredEntities.length} entities · {dashSel.length} on dashboard · {ignored.length} ignored
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={ignoreAll}
                    className="rounded-md border border-gray-700 px-2 py-1 text-gray-300 hover:border-red-600 hover:text-red-300"
                  >
                    {entitySearch ? "Ignore filtered" : "Ignore all"}
                  </button>
                  <button
                    onClick={unignoreFiltered}
                    className="rounded-md border border-gray-700 px-2 py-1 text-gray-300 hover:border-emerald-600 hover:text-emerald-300"
                  >
                    {entitySearch ? "Unignore filtered" : "Unignore all"}
                  </button>
                  <button
                    onClick={clearIgnored}
                    disabled={ignored.length === 0}
                    className="rounded-md border border-gray-700 px-2 py-1 text-gray-300 hover:border-emerald-600 hover:text-emerald-300 disabled:opacity-40"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-gray-800">
                <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-gray-800 bg-gray-900 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  <button onClick={() => sortBy("events")} className="w-14 flex-shrink-0 text-right hover:text-gray-300">
                    Events{arrow("events")}
                  </button>
                  <button onClick={() => sortBy("ignore")} className="w-12 flex-shrink-0 text-center hover:text-gray-300">
                    Ignore{arrow("ignore")}
                  </button>
                  <button onClick={() => sortBy("dash")} className="w-12 flex-shrink-0 text-center hover:text-gray-300">
                    Dash{arrow("dash")}
                  </button>
                  <button onClick={() => sortBy("entity")} className="flex-1 text-left hover:text-gray-300">
                    Entity{arrow("entity")}
                  </button>
                  <button onClick={() => sortBy("label")} className="w-36 flex-shrink-0 text-left hover:text-gray-300">
                    Label{arrow("label")}
                  </button>
                  <span className="w-8 flex-shrink-0" />
                </div>
                {sortedEntities.slice(0, 500).map((e) => (
                  <div key={e.id} className="flex items-center gap-2 border-b border-gray-800/50 px-3 py-1.5 hover:bg-gray-800/40">
                    <span className="w-14 flex-shrink-0 text-right font-mono text-xs text-gray-500">
                      {(entityCounts[e.id] || 0).toLocaleString()}
                    </span>
                    <input
                      type="checkbox"
                      checked={ignored.includes(e.id)}
                      onChange={() => toggleIgnore(e.id)}
                      title="Ignore (exclude from analysis)"
                      className="w-12 flex-shrink-0 accent-red-600"
                    />
                    <input
                      type="checkbox"
                      checked={dashSel.includes(e.id)}
                      onChange={() => toggleDashboard(e.id)}
                      title="Show on dashboard"
                      className="w-12 flex-shrink-0 accent-emerald-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-mono text-xs text-gray-300" title={e.id}>
                        {e.id}
                      </span>
                      {e.name !== e.id && <span className="block truncate text-[10px] text-gray-600">{e.name}</span>}
                    </span>
                    <input
                      type="text"
                      value={entityLabels[e.id] ?? ""}
                      onChange={(ev) => setLabelLocal(e.id, ev.target.value)}
                      onBlur={saveLabels}
                      placeholder="—"
                      className="w-36 flex-shrink-0 rounded border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-200 placeholder-gray-700"
                    />
                    <button
                      onClick={() => deleteEntityData(e.id)}
                      disabled={!entityCounts[e.id]}
                      title="Delete captured data for this entity"
                      className="w-8 flex-shrink-0 text-gray-600 hover:text-red-400 disabled:opacity-30"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
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
