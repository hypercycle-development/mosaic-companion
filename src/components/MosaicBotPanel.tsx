import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  Brain,
  Search,
  Zap,
  Clock,
  FileText,
  RefreshCw,
  MessageSquare,
  Database,
  Activity,
  Send,
  Server,
  Boxes,
  Cpu,
  AlertTriangle,
  CheckCircle,
  Download,
  Trash2,
  Shield,
  Users,
} from "lucide-react";
import { AxiCatalogPanel } from "./axi/AxiCatalogPanel";
import { MosaicTeamPanel } from "./MosaicTeamPanel";


// ── Local types ───────────────────────────────────────────────────────────────

type MemoryStatus = NonNullable<Awaited<ReturnType<NonNullable<Window["memory"]>["status"]>>>;
type MemoryResult = Awaited<ReturnType<NonNullable<Window["memory"]>["search"]>>[number];
type Skill = { name: string; description: string };
type AgentProfile = { agentId: string; intervalMin: number; activeHours: { start: string; end: string }; description: string };
type InfraHealth = Record<string, { healthy: boolean; checkedAt: number }>;
type ImportRecord = { hermesPath: string; mosaicPath: string; importedAt: number; version: string; status: string };
type PendingImport = { hermesPath: string; version: string; importedAt: number };

type AgentMessage = {
  id: string;
  to: string;
  text: string;
  channel: string;
  receivedAt: Date;
};

// ── Panel ─────────────────────────────────────────────────────────────────────

interface MosaicBotPanelProps {
  onNavigate?: (url: string) => void;
}

export const MosaicBotPanel: React.FC<MosaicBotPanelProps> = ({ onNavigate }) => {
  // ── Status ──
  const [memStatus, setMemStatus] = useState<MemoryStatus | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);

  // ── Orchestrator ──
  const [orchestratorStatus, setOrchestratorStatus] = useState<{
    vaultBoxes: number; mcpServers: number; agents: number;
    lastCheck: number; infraHealth: InfraHealth;
  } | null>(null);
  const [agentProfiles, setAgentProfiles] = useState<AgentProfile[]>([]);
  const [orchLoading, setOrchLoading] = useState(true);

  // ── Skill Importer ──
  const [importLog, setImportLog] = useState<ImportRecord[]>([]);
  const [pendingImports, setPendingImports] = useState<PendingImport[]>([]);
  const [importerLoading, setImporterLoading] = useState(true);

  // ── Message feed ──
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [triggeringHB, setTriggeringHB] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // ── Session Context (from codebase-memory MCP) ──
  const [sessionContext, setSessionContext] = useState<{
    recentSkills: string[];
    recentProjects: string[];
    patterns: string[];
  } | null>(null);
  const [contextLoading, setContextLoading] = useState(true);

  // ── Stargate Registry ──
  const [stargateSummary, setStargateSummary] = useState<string | null>(null);
  const [stargateDown, setStargateDown] = useState<Array<{ id: string; name: string; status: string }>>([]);
  const [stargateLoading, setStargateLoading] = useState(true);

  // ── Send input ──
  const [sendText, setSendText] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<string | null>(null);

  // ── Memory search ──
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // ── Active tab ──
  const [activeTab, setActiveTab] = useState<"overview" | "skills" | "importer" | "infrastructure" | "axi" | "team">("overview");

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  const loadAll = useCallback(async () => {
    try {
      const [status, skillList, orchStatus, profiles, log, pending, sessionCtx, stgSummary, stgDown] = await Promise.all([
        window.memory?.status(),
        window.agent?.listSkills(),
        window.agent?.getOrchestratorStatus(),
        window.agent?.getAgentProfiles(),
        window.agent?.getImportLog(),
        window.agent?.getPendingImports(),
        window.agent?.getSessionContext().catch(() => null),
        window.agent?.getStargateSummary().catch(() => null),
        window.agent?.getStargateDown().catch(() => []),
      ]);
      if (status) setMemStatus(status);
      if (skillList) setSkills(skillList);
      if (orchStatus) setOrchestratorStatus(orchStatus);
      if (profiles) setAgentProfiles(profiles);
      if (log) setImportLog(log);
      if (pending) setPendingImports(pending);
      if (sessionCtx) setSessionContext(sessionCtx);
      if (stgSummary) setStargateSummary(stgSummary);
      if (stgDown) setStargateDown(stgDown);
    } catch (e) {
      console.error("[MosaicBot] Failed to load status:", e);
    } finally {
      setStatusLoading(false);
      setOrchLoading(false);
      setImporterLoading(false);
      setContextLoading(false);
      setStargateLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const interval = setInterval(loadAll, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [loadAll]);

  // Subscribe to agent messages
  useEffect(() => {
    window.agent?.onMessage((msg) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          to: msg.to,
          text: msg.text,
          channel: msg.channel,
          receivedAt: new Date(),
        },
      ]);
    });
  }, []);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const triggerHeartbeat = async () => {
    setTriggeringHB(true);
    try {
      await window.agent?.triggerHeartbeat();
    } finally {
      setTimeout(() => setTriggeringHB(false), 1200);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sendText.trim()) return;
    const userText = sendText.trim();
    setSending(true);
    setLastSendResult(null);
    setSendText("");
    try {
      const result = await window.agent?.send(userText);
      if (result) {
        if (result.type === "skill") {
          setLastSendResult(`Matched skill: /${result.skill}${result.args ? ` (${result.args})` : ""}`);
        } else if (result.type === "reply") {
          setMessages((prev) => [
            ...prev,
            {
              id: `${Date.now()}-${Math.random()}`,
              to: "renderer",
              text: result.text ?? "",
              channel: "ipc",
              receivedAt: new Date(),
            },
          ]);
        } else if (result.type === "error") {
          setLastSendResult(result.text ?? "Error");
        }
      }
    } catch (e) {
      setLastSendResult("Error sending message");
    } finally {
      setSending(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const results = await window.memory?.search(searchQuery.trim(), { maxResults: 8 });
      setSearchResults(results ?? []);
    } catch (e) {
      console.error("[MosaicBot] Search failed:", e);
    } finally {
      setSearching(false);
    }
  };

  const syncMemory = async () => {
    try {
      const status = await window.memory?.sync();
      if (status) setMemStatus(status);
    } catch (e) {
      console.error("[MosaicBot] Sync failed:", e);
    }
  };

  const handleApproveSkill = async (name: string) => {
    const ok = await window.agent?.approveSkill(name);
    if (ok) {
      setPendingImports((prev) => prev.filter((p) => !p.hermesPath.includes(name)));
      loadAll();
    }
  };

  const handleForceScan = async () => {
    setImporterLoading(true);
    try {
      const result = await window.agent?.forceScan();
      console.log("[SkillImporter] Scan result:", result);
      loadAll();
    } finally {
      setImporterLoading(false);
    }
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const formatTime = (ts: number) => {
    if (!ts) return "never";
    const d = new Date(ts);
    return d.toLocaleTimeString();
  };

  const getInfraStatus = (name: string) => {
    const check = orchestratorStatus?.infraHealth?.[name];
    if (!check) return { icon: <AlertTriangle size={10} className="text-gray-600" />, text: "unknown", color: "gray" };
    if (check.healthy) return { icon: <CheckCircle size={10} className="text-emerald-400" />, text: "healthy", color: "emerald" };
    return { icon: <AlertTriangle size={10} className="text-amber-400" />, text: "unhealthy", color: "amber" };
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)" }}
          >
            <Bot size={16} style={{ color: "var(--primary)" }} />
          </div>
          <div>
            <h1 className="text-sm font-bold text-gray-100 tracking-wide">MOSAIC BOT</h1>
            <p className="text-[10px] text-gray-500 font-mono">Orchestrator · {agentProfiles.length} agents · {skills.length} skills</p>
          </div>
        </div>
        <button
          onClick={triggerHeartbeat}
          disabled={triggeringHB}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all disabled:opacity-50"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 30%, transparent)",
            color: triggeringHB ? "var(--textMuted)" : "var(--primary)",
            backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
          }}
        >
          <Zap size={12} className={triggeringHB ? "animate-pulse" : ""} />
          {triggeringHB ? "Pulsing..." : "Heartbeat"}
        </button>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-gray-800 shrink-0">
        {(["overview", "skills", "importer", "infrastructure", "axi", "team"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex-1 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors border-b-2"
            style={{
              color: activeTab === tab ? "var(--primary)" : "var(--textMuted)",
              borderColor: activeTab === tab ? "var(--primary)" : "transparent",
              backgroundColor: activeTab === tab ? "color-mix(in srgb, var(--primary) 5%, transparent)" : "transparent",
            }}
          >
            {tab === "overview" && <span>Overview</span>}
            {tab === "skills" && <span>Skills ({skills.length})</span>}
            {tab === "importer" && <span>Importer ({pendingImports.length})</span>}
            {tab === "infrastructure" && <span>Infrastructure</span>}
            {tab === "axi" && <span>AXI Tools</span>}
            {tab === "team" && <span>Team</span>}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ═══ OVERVIEW ═══ */}
        {activeTab === "overview" && (
          <>
            {/* Status cards */}
            <section className="p-4 border-b border-gray-800">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Activity size={10} />
                <span>System Status</span>
              </div>

              {statusLoading ? (
                <div className="flex items-center gap-2 text-gray-600 text-xs py-2">
                  <RefreshCw size={12} className="animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {/* Memory card */}
                  <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Database size={11} style={{ color: "var(--primary)" }} />
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Memory</span>
                    </div>
                    {memStatus ? (
                      <>
                        <div className="text-2xl font-bold text-gray-100 leading-none mb-1">
                          {memStatus.files}
                        </div>
                        <div className="text-[10px] text-gray-500 mb-1.5">
                          {memStatus.chunks} chunks · {memStatus.provider}
                        </div>
                        <div className="flex items-center gap-1">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: memStatus.dirty ? "var(--warning)" : "var(--success)",
                              boxShadow: `0 0 6px ${memStatus.dirty ? "var(--warning)" : "var(--success)"}`,
                            }}
                          />
                          <span className="text-[10px] text-gray-600 font-mono">
                            {memStatus.dirty ? "pending sync" : "synced"}
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-gray-600 pt-1">unavailable</div>
                    )}
                  </div>

                  {/* Skills card */}
                  <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain size={11} style={{ color: "var(--accent)" }} />
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Skills</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-100 leading-none mb-1">
                      {skills.length}
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1.5 truncate">
                      {skills.length === 0
                        ? "none loaded"
                        : skills.slice(0, 2).map((s) => `/${s.name}`).join(" ") +
                          (skills.length > 2 ? ` +${skills.length - 2}` : "")}
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: "var(--success)",
                          boxShadow: "0 0 6px var(--success)",
                        }}
                      />
                      <span className="text-[10px] text-gray-600 font-mono">active</span>
                    </div>
                  </div>

                  {/* Orchestrator card */}
                  <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Boxes size={11} style={{ color: "var(--accent)" }} />
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Orchestrator</span>
                    </div>
                    {orchestratorStatus ? (
                      <>
                        <div className="text-2xl font-bold text-gray-100 leading-none mb-1">
                          {orchestratorStatus.vaultBoxes}
                        </div>
                        <div className="text-[10px] text-gray-500 mb-1.5">
                          {orchestratorStatus.mcpServers} MCPs · {orchestratorStatus.agents} agents
                        </div>
                        <div className="flex items-center gap-1">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: "var(--success)",
                              boxShadow: "0 0 6px var(--success)",
                            }}
                          />
                          <span className="text-[10px] text-gray-600 font-mono">{formatTime(orchestratorStatus.lastCheck)}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-[10px] text-gray-600 pt-1">unavailable</div>
                    )}
                  </div>

                  {/* Importer card */}
                  <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Download size={11} style={{ color: "var(--primary)" }} />
                      <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Importer</span>
                    </div>
                    <div className="text-2xl font-bold text-gray-100 leading-none mb-1">
                      {importLog.length}
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1.5">
                      {pendingImports.length} pending
                    </div>
                    <div className="flex items-center gap-1">
                      <div
                        className="w-1.5 h-1.5 rounded-full"
                        style={{
                          backgroundColor: pendingImports.length > 0 ? "var(--warning)" : "var(--success)",
                          boxShadow: `0 0 6px ${pendingImports.length > 0 ? "var(--warning)" : "var(--success)"}`,
                        }}
                      />
                      <span className="text-[10px] text-gray-600 font-mono">
                        {pendingImports.length > 0 ? "needs approval" : "up to date"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Agent Profiles */}
            <section className="p-4 border-b border-gray-800">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Cpu size={10} />
                <span>Agent Profiles</span>
              </div>
              {agentProfiles.length === 0 ? (
                <p className="text-[10px] text-gray-600">No agent profiles found</p>
              ) : (
                <div className="space-y-2">
                  {agentProfiles.map((profile) => (
                    <div key={profile.agentId} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Bot size={12} style={{ color: "var(--primary)" }} />
                          <span className="text-xs font-bold text-gray-200">{profile.agentId}</span>
                        </div>
                        <span className="text-[9px] font-mono text-gray-500">
                          {profile.intervalMin} min
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-500 mb-1">{profile.description}</p>
                      <div className="flex items-center gap-1 text-[9px] font-mono text-gray-600">
                        <Clock size={8} />
                        {profile.activeHours.start} → {profile.activeHours.end}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Session Context from Codebase Memory MCP */}
            <section className="p-4 border-b border-gray-800">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Database size={10} />
                <span>Knowledge Graph Context</span>
                {sessionContext && (
                  <span className="ml-auto text-[9px] font-mono text-gray-500">{sessionContext.recentSkills.length} skills</span
>
                )}
              </div>
              {contextLoading ? (
                <div className="flex items-center gap-2 text-gray-600 text-xs py-2">
                  <RefreshCw size={12} className="animate-spin" />
                  Querying 194k nodes...
                </div
>
              ) : !sessionContext ? (
                <div className="text-center py-4 text-gray-700">
                  <Database size={20} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Codebase Memory MCP not connected</p
>
                  <p className="text-[10px] mt-1 text-gray-800">Install codebase-memory MCP for full context</p
>
                </div
>
              ) : (
                <div className="space-y-2">
                  {sessionContext.recentSkills.length > 0 && (
                    <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                      <div className="text-[10px] font-mono text-gray-500 mb-1 uppercase tracking-wider">Recently Touched Skills</div
>
                      <div className="flex flex-wrap gap-1">
                        {sessionContext.recentSkills.slice(0, 10).map((skill, i) => (
                          <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-indigo-400">{skill}</span
>
                        ))}
                      </div
>
                    </div
>
                  )}
                  {sessionContext.recentProjects.length > 0 && (
                    <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                      <div className="text-[10px] font-mono text-gray-500 mb-1 uppercase tracking-wider">Active Projects</div
>
                      <div className="flex flex-wrap gap-1">
                        {sessionContext.recentProjects.slice(0, 5).map((proj, i) => (
                          <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-800 text-emerald-400">{proj}</span
>
                        ))}
                      </div
>
                    </div
>
                  )}
                  {sessionContext.patterns.length > 0 && (
                    <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                      <div className="text-[10px] font-mono text-gray-500 mb-1 uppercase tracking-wider">Detected Patterns</div
>
                      <div className="space-y-1">
                        {sessionContext.patterns.slice(-3).map((pattern, i) => (
                          <div key={i} className="text-[10px] text-amber-400 font-mono">• {pattern}</div
>
                        ))}
                      </div
>
                    </div
>
                  )}
                </div
>
              )}
            </section
>

            {/* Stargate Ecosystem */}
            <section className="p-4 border-b border-gray-800">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Server size={10} />
                <span>Stargate Ecosystem</span
>
                {stargateDown.length > 0 && (
                  <span
                    className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--danger) 20%, transparent)",
                      color: "var(--danger)",
                    }}
                  >
                    {stargateDown.length} down
                  </span
>
                )}
              </div
>
              {stargateLoading ? (
                <div className="flex items-center gap-2 text-gray-600 text-xs py-2">
                  <RefreshCw size={12} className="animate-spin" />
                  Loading...
                </div
>
              ) : stargateDown.length > 0 ? (
                <div className="space-y-2">
                  {stargateDown.map((comp) => (
                    <div key={comp.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle size={10} className="text-red-400" />
                        <span className="text-xs font-mono text-gray-200">{comp.name}</span
>
                      </div
>
                      <span className="text-[9px] font-mono text-red-400 uppercase">{comp.status}</span
>
                    </div
>
                  ))}
                </div
>
              ) : (
                <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono">
                  <CheckCircle size={10} />
                  All Stargate components operational
                </div
>
              )}
            </section
>

            {/* Message feed */}
            <section className="p-4">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <MessageSquare size={10} />
                <span>Message Feed</span>
                {messages.length > 0 && (
                  <span
                    className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
                      color: "var(--primary)",
                    }}
                  >
                    {messages.length}
                  </span>
                )}
              </div>

              <div ref={feedRef} className="space-y-2 max-h-64 overflow-y-auto">
                {messages.length === 0 ? (
                  <div className="text-center py-8 text-gray-700">
                    <MessageSquare size={24} className="mx-auto mb-2 opacity-30" />
                    <p className="text-xs">Waiting for bot messages...</p>
                    <p className="text-[10px] mt-1 text-gray-800">Trigger a heartbeat to test</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div key={msg.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Bot size={10} style={{ color: "var(--primary)" }} />
                          <span className="text-[10px] font-mono text-gray-500">
                            {msg.channel} → {msg.to}
                          </span>
                        </div>
                        <span className="text-[9px] text-gray-700 font-mono flex items-center gap-1">
                          <Clock size={8} />
                          {msg.receivedAt.toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Send message */}
            <section className="p-4 border-t border-gray-800">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Send size={10} />
                <span>Send to Agent</span>
              </div>
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={sendText}
                  onChange={(e) => setSendText(e.target.value)}
                  placeholder="/skill or free text..."
                  className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-700 focus:outline-none focus:border-indigo-500/50 transition-colors font-mono"
                />
                <button
                  type="submit"
                  disabled={sending || !sendText.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
                    color: "var(--primary)",
                    border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
                  }}
                >
                  {sending ? <RefreshCw size={12} className="animate-spin" /> : <Send size={12} />}
                </button>
              </form>
              {lastSendResult && (
                <p className="mt-2 text-[10px] font-mono text-gray-500">{lastSendResult}</p>
              )}
            </section>
          </>
        )}

        {/* ═══ SKILLS ═══ */}
        {activeTab === "skills" && (
          <section className="p-4">
            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Brain size={10} />
              <span>Loaded Skills</span>
              <span className="ml-auto text-[9px] font-mono text-gray-500">{skills.length} total</span>
            </div>
            {skills.length === 0 ? (
              <div className="text-center py-8 text-gray-700">
                <Brain size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No skills loaded</p>
                <p className="text-[10px] mt-1 text-gray-800">Skills are loaded from bundled-skills/ directory</p>
              </div>
            ) : (
              <div className="space-y-2">
                {skills.map((s) => (
                  <div key={s.name} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-indigo-400">/{s.name}</span>
                    </div>
                    <p className="text-[10px] text-gray-500">{s.description || "No description"}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══ IMPORTER ═══ */}
        {activeTab === "importer" && (
          <>
            <section className="p-4 border-b border-gray-800">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
                  <Shield size={10} />
                  <span>Pending Approval</span>
                </div>
                <button
                  onClick={handleForceScan}
                  disabled={importerLoading}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[9px] font-mono transition-all disabled:opacity-40"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--primary) 10%, transparent)",
                    color: "var(--primary)",
                    border: "1px solid color-mix(in srgb, var(--primary) 20%, transparent)",
                  }}
                >
                  <RefreshCw size={8} className={importerLoading ? "animate-spin" : ""} />
                  Force Scan
                </button>
              </div>

              {pendingImports.length === 0 ? (
                <p className="text-[10px] text-gray-600 py-2">No pending skills. All caught up!</p>
              ) : (
                <div className="space-y-2">
                  {pendingImports.map((p, i) => {
                    const name = p.hermesPath.split("/").slice(-2)[0] || `skill-${i}`;
                    return (
                      <div key={i} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between">
                        <div>
                          <div className="text-xs font-mono text-gray-200">{name}</div>
                          <div className="text-[9px] text-gray-500">v{p.version} · {new Date(p.importedAt).toLocaleDateString()}</div>
                        </div>
                        <button
                          onClick={() => handleApproveSkill(name)}
                          className="px-2 py-1 rounded text-[9px] font-mono transition-colors"
                          style={{
                            backgroundColor: "color-mix(in srgb, var(--success) 15%, transparent)",
                            color: "var(--success)",
                            border: "1px solid color-mix(in srgb, var(--success) 30%, transparent)",
                          }}
                        >
                          Approve
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="p-4">
              <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                <Download size={10} />
                <span>Import Log</span>
              </div>
              {importLog.length === 0 ? (
                <p className="text-[10px] text-gray-600 py-2">No imports yet</p>
              ) : (
                <div className="space-y-2">
                  {importLog.slice(-20).reverse().map((record, i) => {
                    const name = record.mosaicPath.split("/").slice(-2)[0] || `skill-${i}`;
                    return (
                      <div key={i} className="bg-gray-900 rounded-xl p-3 border border-gray-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{
                              backgroundColor: record.status === "active" ? "var(--success)" : "var(--warning)",
                              boxShadow: `0 0 4px ${record.status === "active" ? "var(--success)" : "var(--warning)"}`,
                            }}
                          />
                          <div>
                            <div className="text-[10px] font-mono text-gray-200">{name}</div>
                            <div className="text-[9px] text-gray-500">
                              {record.status} · v{record.version}
                            </div>
                          </div>
                        </div>
                        <span className="text-[9px] text-gray-600">
                          {new Date(record.importedAt).toLocaleDateString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* ═══ INFRASTRUCTURE ═══ */}
        {activeTab === "infrastructure" && (
          <section className="p-4">
            <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Server size={10} />
              <span>HyperAIBox Fleet</span>
            </div>

            {orchLoading ? (
              <div className="flex items-center gap-2 text-gray-600 text-xs py-2">
                <RefreshCw size={12} className="animate-spin" />
                Loading...
              </div>
            ) : !orchestratorStatus ? (
              <div className="text-center py-8 text-gray-700">
                <Server size={24} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">Orchestrator not available</p>
                <p className="text-[10px] mt-1 text-gray-800">Restart Mosaic Companion to initialize</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* SPO */}
                <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Server size={12} style={{ color: "var(--primary)" }} />
                      <span className="text-xs font-bold text-gray-200">SPO Host</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getInfraStatus("SPO").icon}
                      <span className="text-[9px] font-mono text-gray-500">{getInfraStatus("SPO").text}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">192.168.0.112:9100</div>
                </div>

                {/* C-3PO */}
                <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cpu size={12} style={{ color: "var(--accent)" }} />
                      <span className="text-xs font-bold text-gray-200">C-3PO</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getInfraStatus("C-3PO HBA").icon}
                      <span className="text-[9px] font-mono text-gray-500">{getInfraStatus("C-3PO HBA").text}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">192.168.0.151:8100 · 128 AIM slots · arm64</div>
                </div>

                {/* R2D2 */}
                <div className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Cpu size={12} style={{ color: "var(--accent)" }} />
                      <span className="text-xs font-bold text-gray-200">R2D2</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {getInfraStatus("R2D2 HBA").icon}
                      <span className="text-[9px] font-mono text-gray-500">{getInfraStatus("R2D2 HBA").text}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono">192.168.0.38:8100 · 8 AIM slots · arm64</div>
                </div>

                {/* Last check */}
                <div className="text-[9px] text-gray-600 font-mono text-center pt-2">
                  Last checked: {formatTime(orchestratorStatus.lastCheck)}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ═══ AXI TOOLS ═══ */}
        {activeTab === "axi" && (
          <section className="p-4">
            <AxiCatalogPanel />
          </section>
        )}

        {/* ═══ TEAM ═══ */}
        {activeTab === "team" && (
          <MosaicTeamPanel onNavigate={onNavigate} />
        )}
      </div>

      {/* ── Memory Search (footer, always visible) ── */}
      <div className="border-t border-gray-800 p-4 shrink-0">
        <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest mb-3 flex items-center gap-2">
          <Search size={10} />
          <span>Memory Search</span>
        </div>
        <form onSubmit={handleSearch} className="flex gap-2 mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search indexed memory files..."
            className="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder-gray-700 focus:outline-none focus:border-indigo-500/50 transition-colors"
          />
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="px-3 py-2 rounded-lg text-xs font-mono transition-all disabled:opacity-40"
            style={{
              backgroundColor: "color-mix(in srgb, var(--primary) 20%, transparent)",
              color: "var(--primary)",
              border: "1px solid color-mix(in srgb, var(--primary) 30%, transparent)",
            }}
          >
            {searching ? <RefreshCw size={12} className="animate-spin" /> : <Search size={12} />}
          </button>
        </form>

        {searched && (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {searchResults.length === 0 ? (
              <div className="text-center py-4 text-gray-700">
                <FileText size={20} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs">No results found</p>
              </div>
            ) : (
              searchResults.map((r, i) => (
                <div key={i} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText size={10} className="text-gray-500 shrink-0" />
                      <span className="text-[10px] font-mono text-gray-400 truncate">
                        {r.path}:{r.startLine}
                      </span>
                    </div>
                    <span
                      className="ml-2 shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor:
                          r.score > 0.7
                            ? "color-mix(in srgb, var(--success) 15%, transparent)"
                            : r.score > 0.4
                            ? "color-mix(in srgb, var(--warning) 15%, transparent)"
                            : "color-mix(in srgb, var(--textMuted) 15%, transparent)",
                        color:
                          r.score > 0.7
                            ? "var(--success)"
                            : r.score > 0.4
                            ? "var(--warning)"
                            : "var(--textMuted)",
                      }}
                    >
                      {(r.score * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{r.snippet}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
