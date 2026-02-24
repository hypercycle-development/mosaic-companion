import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";

// ── Local types ───────────────────────────────────────────────────────────────

type MemoryStatus = NonNullable<Awaited<ReturnType<NonNullable<Window["memory"]>["status"]>>>;
type MemoryResult = Awaited<ReturnType<NonNullable<Window["memory"]>["search"]>>[number];
type Skill = { name: string; description: string };

type AgentMessage = {
  id: string;
  to: string;
  text: string;
  channel: string;
  receivedAt: Date;
};

// ── Panel ─────────────────────────────────────────────────────────────────────

export const MosaicBotPanel: React.FC = () => {
  // Status
  const [memStatus, setMemStatus] = useState<MemoryStatus | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);

  // Message feed
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [triggeringHB, setTriggeringHB] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // Send input
  const [sendText, setSendText] = useState("");
  const [sending, setSending] = useState(false);
  const [lastSendResult, setLastSendResult] = useState<string | null>(null);

  // Memory search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MemoryResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      try {
        const [status, skillList] = await Promise.all([
          window.memory?.status(),
          window.agent?.listSkills(),
        ]);
        if (status) setMemStatus(status);
        if (skillList) setSkills(skillList);
      } catch (e) {
        console.error("[MosaicBot] Failed to load status:", e);
      } finally {
        setStatusLoading(false);
      }
    };
    load();
  }, []);

  // Subscribe to agent messages (runs once; listener accumulates messages)
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

  // Auto-scroll feed when new messages arrive
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
    setSending(true);
    setLastSendResult(null);
    try {
      const result = await window.agent?.send(sendText.trim());
      if (result) {
        const label =
          result.type === "skill"
            ? `Matched skill: /${result.skill}${result.args ? ` (${result.args})` : ""}`
            : "Message routed to agent";
        setLastSendResult(label);
      }
      setSendText("");
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
            <p className="text-[10px] text-gray-500 font-mono">Agent · Memory · Skills</p>
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

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Status ── */}
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
            <>
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
              </div>

              {memStatus && (
                <button
                  onClick={syncMemory}
                  className="mt-2 w-full text-[10px] text-gray-700 hover:text-gray-400 flex items-center justify-center gap-1 py-1.5 rounded-lg transition-colors hover:bg-gray-900"
                >
                  <RefreshCw size={9} />
                  Force re-index
                </button>
              )}
            </>
          )}
        </section>

        {/* ── Send message ── */}
        <section className="p-4 border-b border-gray-800">
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
          {skills.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {skills.map((s) => (
                <button
                  key={s.name}
                  onClick={() => setSendText(`/${s.name}`)}
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded border transition-colors hover:text-gray-200"
                  style={{
                    borderColor: "color-mix(in srgb, var(--accent) 30%, transparent)",
                    color: "var(--textMuted)",
                    backgroundColor: "color-mix(in srgb, var(--accent) 8%, transparent)",
                  }}
                  title={s.description}
                >
                  /{s.name}
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ── Message feed ── */}
        <section className="p-4 border-b border-gray-800">
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
                <div
                  key={msg.id}
                  className="bg-gray-900 rounded-xl p-3 border border-gray-800"
                >
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
                  <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {msg.text}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ── Memory search ── */}
        <section className="p-4">
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
            <div className="space-y-2">
              {searchResults.length === 0 ? (
                <div className="text-center py-8 text-gray-700">
                  <FileText size={20} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">No results found</p>
                  <p className="text-[10px] mt-1 text-gray-800">
                    Add MEMORY.md or a memory/ dir to your workspace to index files
                  </p>
                </div>
              ) : (
                searchResults.map((r, i) => (
                  <div
                    key={i}
                    className="bg-gray-900 rounded-xl p-3 border border-gray-800"
                  >
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
                    <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
                      {r.snippet}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
