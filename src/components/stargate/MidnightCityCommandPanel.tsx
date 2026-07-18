import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Pickaxe,
  Activity,
  Send,
  Play,
  Pause,
  RefreshCw,
  Terminal,
  Code,
  Cpu,
  Zap,
  Bot,
  Shield,
  ScrollText,
  Settings,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  FileCode,
  Box,
  Eye,
  EyeOff,
  Copy,
  Server,
  Rocket,
  StopCircle,
  Plus,
  Trash2,
  Lock,
  Unlock,
  Map,
} from "lucide-react";

// ── Error Boundary to catch runtime crashes ──────────────────────────────
class PanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[MidnightCityCommandPanel] Runtime error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded text-red-200 text-xs font-mono">
          <div className="font-bold mb-2 flex items-center gap-2">
            <AlertTriangle size={14} />
            Midnight City Panel crashed
          </div>
          <div className="mb-2">{this.state.error?.message}</div>
          <div className="text-gray-400">Check DevTools console for stack trace.</div>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 px-2 py-1 bg-red-700 hover:bg-red-600 rounded text-xs"
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface AgentState {
  id: string;
  name: string;
  profession: string;
  status: string;
  position: { spaceId: string; x: number; y: number };
  activeAction: any;
}

interface InventoryItem {
  name: string;
  quantity: number;
}

interface InventoryState {
  agent: AgentState;
  inventory: Record<string, number>;
  tick: number;
}

interface NearbyAgent {
  id: string;
  name: string;
  profession: string;
  status: string;
  distance: number;
  position: { spaceId: string; x: number; y: number };
  activeAction?: any;
}

interface DiscoveredArea {
  areaId: string;
  name: string;
  activities: string[];
  moveAreaAvailable: boolean;
}

interface LogEntry {
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  detail?: string;
}

interface ScriptEdit {
  path: string;
  content: string;
  dirty: boolean;
}

interface BGStatus {
  connected: boolean;
  agentId: string;
  leaseToken: string | null;
  sessionId: string | null;
  lastHeartbeat: number;
  lockActive: boolean;
  autoMine: boolean;
}

// ── Panel ────────────────────────────────────────────────────────────────────

export const MidnightCityCommandPanel: React.FC = () => {
  return (
    <PanelErrorBoundary>
      <MidnightCityCommandPanelInner />
    </PanelErrorBoundary>
  );
};

export default MidnightCityCommandPanel;

// ── Actual panel implementation ──────────────────────────────────────────────
const MidnightCityCommandPanelInner: React.FC = () => {
  // ── Core state (mirrors background service) ──────────────────────────────
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [locked, setLocked] = useState(false);
  const [agentState, setAgentState] = useState<AgentState | null>(null);
  const [inventory, setInventory] = useState<InventoryState | null>(null);
  const [nearbyAgents, setNearbyAgents] = useState<NearbyAgent[]>([]);
  const [discoveredAreas, setDiscoveredAreas] = useState<DiscoveredArea[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"status" | "actions" | "script" | "factory" | "logs">("status");
  const [lastError, setLastError] = useState<string | null>(null);
  const [isMining, setIsMining] = useState(false);
  const [autoMine, setAutoMine] = useState(false);
  const autoMineRef = useRef<NodeJS.Timeout | null>(null);
  const autoMiningInFlightRef = useRef(false);  // prevents overlapping engage calls
  const logEndRef = useRef<HTMLDivElement | null>(null);
  const discoveredAreasRef = useRef<DiscoveredArea[]>([]);

  // ── Script editor state ──────────────────────────────────────────────────
  const [scriptContent, setScriptContent] = useState<string>("");
  const [scriptDirty, setScriptDirty] = useState(false);
  const [scriptSaving, setScriptSaving] = useState(false);
  const [scriptPath] = useState("/home/mauricio/.hermes/scripts/sonofanton_miner.py");

  // ── Factory state ────────────────────────────────────────────────────────
  const [factoryName, setFactoryName] = useState("");
  const [factoryProfession, setFactoryProfession] = useState<"miner" | "lumberjack" | "fisher" | "gatherer">("miner");
  const [factoryDeploying, setFactoryDeploying] = useState(false);
  const [factoryResult, setFactoryResult] = useState<string | null>(null);

  // ── Son of Anton config ─────────────────────────────────────────────────
  const [agentId, setAgentId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiBase, setApiBase] = useState("https://midnight.city/observer");
  const [profession, setProfession] = useState<"miner" | "lumberjack" | "hacker" | "fisher" | "gatherer">("miner");
  const [configMode, setConfigMode] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  // ── Agent needs / threads / social state ──────────────────────────────────
  const [needs, setNeeds] = useState<any>(null);
  const [threads, setThreads] = useState<any[]>([]);
  const [messageText, setMessageText] = useState("");
  const [selectedNearbyAgentId, setSelectedNearbyAgentId] = useState<string>("");
  const [tradeQty, setTradeQty] = useState(1000);

  // ── Ref guards ───────────────────────────────────────────────────────────
  const connectedRef = useRef(false);
  const lockedRef = useRef(false);
  useEffect(() => { connectedRef.current = connected; }, [connected]);
  useEffect(() => { lockedRef.current = locked; }, [locked]);
  useEffect(() => { discoveredAreasRef.current = discoveredAreas; }, [discoveredAreas]);

  // ── Helper: add log ──────────────────────────────────────────────────────
  const addLog = useCallback((level: LogEntry["level"], message: string, detail?: string) => {
    const entry: LogEntry = {
      timestamp: new Date().toLocaleTimeString(),
      level,
      message,
      detail,
    };
    setLogs((prev) => [...prev.slice(-199), entry]);
  }, []);

  // ── Load config on mount (moved after addLog) ────────────────────────────
  useEffect(() => {
    window.electronAPI.midnightCity.getConfig()
      .then((cfg: any) => {
        if (cfg.configured) {
          setAgentId(cfg.agentId || "");
          setProfession(cfg.profession || "miner");
          setApiBase(cfg.apiBase || "https://midnight.city/observer");
        }
      })
      .catch(() => {
        // No config yet — show config UI
      });
  }, []);

  // ── Save config ─────────────────────────────────────────────────────────
  const saveConfig = useCallback(async () => {
    setConfigSaving(true);
    try {
      const result = await window.electronAPI.midnightCity.setConfig({
        agentId,
        apiKey,
        profession,
        apiBase,
      });
      if (result.success) {
        addLog("success", "Credentials saved securely");
        setConfigMode(false);
      } else {
        throw new Error(result.error);
      }
    } catch (err: any) {
      addLog("error", "Failed to save credentials", err.message);
    } finally {
      setConfigSaving(false);
    }
  }, [agentId, apiKey, profession, apiBase, addLog]);

  // ── Clear config ────────────────────────────────────────────────────────
  const clearConfig = useCallback(async () => {
    try {
      await window.electronAPI.midnightCity.clearConfig();
      setAgentId("");
      setApiKey("");
      setConnected(false);
      addLog("info", "Credentials cleared");
    } catch (err: any) {
      addLog("error", "Failed to clear credentials", err.message);
    }
  }, [addLog]);

  // ── Sync state from background service ───────────────────────────────────
  const syncFromBackground = useCallback(async () => {
    try {
      const status: BGStatus = await window.electronAPI.midnightCity.getStatus();
      setConnected(status.connected);
      setLocked(status.lockActive);
      // NOTE: autoMine is owned by renderer only — background service autoMine is unused
    } catch (e: any) {
      // Background service may not be initialized yet
    }
  }, []);

  // ── Connect ────────────────────────────────────────────────────────────────
  const doConnect = useCallback(async () => {
    setConnecting(true);
    setLastError(null);
    try {
      addLog("info", "Connecting to Son of Anton...");
      const result = await window.electronAPI.midnightCity.connect({ agentId });
      if (result.success) {
        setConnected(true);
        connectedRef.current = true; // Immediate — refreshState checks this
        addLog("success", "Connected", result.token ? `Token ${result.token.slice(0, 8)}...` : "");
        await refreshAll();
      } else {
        throw new Error(result.error || "Connect failed");
      }
    } catch (err: any) {
      setLastError(err.message);
      addLog("error", "Connect failed", err.message);
    } finally {
      setConnecting(false);
    }
  }, [agentId, addLog]);

  // ── Disconnect ───────────────────────────────────────────────────────────
  const doDisconnect = useCallback(async () => {
    try {
      addLog("info", "Disconnecting...");
      const result = await window.electronAPI.midnightCity.disconnect();
      if (result.success) {
        setConnected(false);
        setAgentState(null);
        addLog("success", "Disconnected");
      } else {
        addLog("warn", "Disconnect blocked", result.error || "Agent is locked");
      }
    } catch (err: any) {
      addLog("error", "Disconnect failed", err.message);
    }
  }, [addLog]);

  // ── Lock / Unlock ────────────────────────────────────────────────────────
  const toggleLock = useCallback(async () => {
    const newLock = !lockedRef.current;
    try {
      await window.electronAPI.midnightCity.setLock(newLock);
      setLocked(newLock);
      addLog("info", newLock ? "🔒 Agent locked — survives tab switches" : "🔓 Agent unlocked — normal disconnect");
    } catch (err: any) {
      addLog("error", "Lock toggle failed", err.message);
    }
  }, [addLog]);

  // ── Generic API call (no token needed — background service handles it) ───
  const apiCall = useCallback(
    async (endpoint: string, method: "GET" | "POST" = "GET", body?: any): Promise<any> => {
      try {
        const result = await window.electronAPI.midnightCity.call({ endpoint, method, body });
        if (result.error) {
          throw new Error(result.error);
        }
        return result.data;
      } catch (err: any) {
        const msg = err.message || String(err);
        addLog("error", `API ${method} ${endpoint} failed`, msg);
        throw err;
      }
    },
    [addLog]
  );

  // ── Refresh full state ───────────────────────────────────────────────────
  const refreshState = useCallback(async () => {
    if (!connectedRef.current) return;
    try {
      const [ctx, inv, ags, areas] = await Promise.all([
        apiCall(`/api/skill/agents/${encodeURIComponent(agentId)}/context`),
        apiCall(`/api/skill/agents/${encodeURIComponent(agentId)}/inventory`),
        apiCall(`/api/skill/agents/${encodeURIComponent(agentId)}/agents`),
        apiCall(`/api/skill/agents/${encodeURIComponent(agentId)}/areas`),
      ]);
      setAgentState(ctx?.agent || null);
      setInventory(inv || null);
      setNearbyAgents(ags?.agents || []);
      if (Array.isArray(areas?.areas)) {
        setDiscoveredAreas(areas.areas);
      }
    } catch (err: any) {
      // Don't swallow — let the UI know the API is unavailable
      addLog("error", "State refresh failed — API may be unavailable", err.message);
    }
  }, [agentId, addLog, apiCall]);

  // ── Fetch needs ──────────────────────────────────────────────────────────
  const fetchNeeds = useCallback(async () => {
    if (!connectedRef.current) return;
    try {
      const data = await apiCall(`/api/skill/agents/${encodeURIComponent(agentId)}/needs`);
      setNeeds(data);
    } catch (err: any) {
      addLog("warn", "Needs fetch failed", err.message);
    }
  }, [agentId, addLog, apiCall]);

  // ── Fetch threads ──────────────────────────────────────────────────────
  const fetchThreads = useCallback(async () => {
    if (!connectedRef.current) return;
    try {
      const data = await apiCall(`/api/agents/${encodeURIComponent(agentId)}/threads?limit=50`);
      setThreads(data?.threads || []);
    } catch (err: any) {
      addLog("warn", "Threads fetch failed", err.message);
    }
  }, [agentId, addLog, apiCall]);

  // ── Fetch merchants ─────────────────────────────────────────────────────
  const [merchants, setMerchants] = useState<any[]>([]);
  const fetchMerchants = useCallback(async () => {
    if (!connectedRef.current) return;
    try {
      const data = await apiCall("/api/skill/merchants");
      setMerchants(data?.merchants || []);
    } catch (err: any) {
      addLog("warn", "Merchants fetch failed", err.message);
    }
  }, [addLog, apiCall]);

  // ── Auto-refresh extended data ───────────────────────────────────────────
  const refreshAll = useCallback(async () => {
    await refreshState();
    await fetchNeeds();
    await fetchThreads();
    await fetchMerchants();
  }, [refreshState, fetchNeeds, fetchThreads, fetchMerchants]);

  // ── Discover harvestable area ──────────────────────────────────────────────

  // ── Discover harvestable area ──────────────────────────────────────────────
  const findHarvestArea = useCallback((activityName: string): string | null => {
    const areas = discoveredAreasRef.current;
    const area = areas.find(
      (a) => a.moveAreaAvailable && (a.activities || []).some((act) => act.toLowerCase().includes(activityName.toLowerCase()))
    );
    if (area) return area.areaId;
    const fallback = areas.find((a) => a.moveAreaAvailable);
    return fallback?.areaId || null;
  }, []);

  // ── Submit action ────────────────────────────────────────────────────────
  const submitAction = useCallback(
    async (action: { kind: string; activity?: string; destination?: any; location?: any; targetAgentId?: string; message?: string; itemId?: string; text?: string; durationMs?: number; merchantName?: string; quantity?: number }) => {
      if (!connectedRef.current) {
        addLog("warn", "Not connected — action queued", action.kind);
        return;
      }
      setIsMining(true);
      try {
        const payload = { ...action, agentId };
        addLog("info", `Submitting: ${action.kind}`, JSON.stringify(payload));
        await apiCall("/api/actions", "POST", payload);
        addLog("success", `${action.kind} submitted`);
        setTimeout(() => refreshState(), 1500);
      } catch (err: any) {
        addLog("error", `${action.kind} failed`, err.message);
      } finally {
        setIsMining(false);
      }
    },
    [agentId, apiCall, addLog, refreshState]
  );

  // ── Auto-mine loop (1 Hz with in-flight + position guards) ─────────────
  const agentStateRef = useRef(agentState);
  useEffect(() => { agentStateRef.current = agentState; }, [agentState]);

  useEffect(() => {
    if (autoMine && connected) {
      autoMineRef.current = setInterval(() => {
        if (autoMiningInFlightRef.current) return;

        const state = agentStateRef.current;
        const activeKind = state?.activeAction?.kind;
        const spaceId = (state?.position?.spaceId || "").toLowerCase();
        const isAtMines = spaceId.includes("mines");

        // Already engaged in mining — let it continue, don't re-issue
        if (activeKind === "engage") {
          return;
        }

        autoMiningInFlightRef.current = true;

        if (!isAtMines) {
          // Not at mine yet — move there first
          submitAction({ kind: "move_to", destination: { areaId: "mines-worksite" } })
            .finally(() => { autoMiningInFlightRef.current = false; });
        } else {
          // At mine — engage WITHOUT location so agent stays put and mines
          submitAction({ kind: "engage", activity: "mine ore", durationMs: 600000 })
            .finally(() => { autoMiningInFlightRef.current = false; });
        }
      }, 1000);
      addLog("info", "Auto-work enabled — stay-put mining");
    }
    return () => {
      if (autoMineRef.current) {
        clearInterval(autoMineRef.current);
        autoMineRef.current = null;
        autoMiningInFlightRef.current = false;
        addLog("info", "Auto-work disabled");
      }
    };
  }, [autoMine, connected, submitAction, addLog]);

  // ── Load script ──────────────────────────────────────────────────────────
  const loadScript = useCallback(async () => {
    try {
      addLog("info", "Loading script...", scriptPath);
      const result = await window.electronAPI.midnightCity.readScript(scriptPath);
      if (result.success && result.content !== undefined) {
        setScriptContent(result.content);
        setScriptDirty(false);
        addLog("success", "Script loaded", `${result.content.length} chars`);
      } else {
        throw new Error(result.error || "Failed to load script");
      }
    } catch (err: any) {
      addLog("error", "Script load failed", err.message);
      setScriptContent("# Son of Anton Miner Script\n# File could not be loaded. Check path.");
    }
  }, [scriptPath, addLog]);

  // ── Save script ──────────────────────────────────────────────────────────
  const saveScript = useCallback(async () => {
    setScriptSaving(true);
    try {
      addLog("info", "Saving script...", scriptPath);
      const result = await window.electronAPI.midnightCity.writeScript({
        path: scriptPath,
        content: scriptContent,
      });
      if (result.success) {
        setScriptDirty(false);
        addLog("success", "Script saved");
      } else {
        throw new Error(result.error || "Save failed");
      }
    } catch (err: any) {
      addLog("error", "Script save failed", err.message);
    } finally {
      setScriptSaving(false);
    }
  }, [scriptPath, scriptContent, addLog]);

  // ── Restart Son of Anton ─────────────────────────────────────────────────
  const restartMiner = useCallback(async () => {
    try {
      addLog("info", "Restarting Son of Anton daemon...");
      const result = await window.electronAPI.midnightCity.restartMiner();
      if (result.success) {
        addLog("success", "Daemon restarted", result.pid ? `PID ${result.pid}` : "");
      } else {
        throw new Error(result.error || "Restart failed");
      }
    } catch (err: any) {
      addLog("error", "Restart failed", err.message);
    }
  }, [addLog]);

  // ── Deploy new agent ───────────────────────────────────────────────────────
  const deployNewAgent = useCallback(async () => {
    if (!factoryName.trim()) {
      addLog("warn", "Factory: name required");
      return;
    }
    setFactoryDeploying(true);
    setFactoryResult(null);
    try {
      addLog("info", "Deploying new agent...", `${factoryName} (${factoryProfession})`);
      const result = await window.electronAPI.midnightCity.deployAgent({
        name: factoryName.trim(),
        profession: factoryProfession,
        baseImage: "midnight-miner-donbenito:2.0.3",
      });
      if (result.success) {
        addLog("success", "Agent deployed", `Slot ${result.slot}, Port ${result.port}`);
        setFactoryResult(`Deployed to slot ${result.slot} on port ${result.port}`);
      } else {
        throw new Error(result.error || "Deploy failed");
      }
    } catch (err: any) {
      addLog("error", "Factory deploy failed", err.message);
      setFactoryResult(`Error: ${err.message}`);
    } finally {
      setFactoryDeploying(false);
    }
  }, [factoryName, factoryProfession, addLog]);

  // ── Heartbeat auto-refresh (polls background service status) ──────────────
  useEffect(() => {
    const id = setInterval(async () => {
      await syncFromBackground();
      if (connectedRef.current) refreshAll();
    }, 5000);
    return () => clearInterval(id);
  }, [syncFromBackground, refreshAll]);

  // ── Auto-scroll logs ─────────────────────────────────────────────────────
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  // ── Initial load ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadScript();
    syncFromBackground();
    addLog("info", "Midnight City Command Panel initialized (v2 — Background Service)");
  }, [loadScript, syncFromBackground, addLog]);

  // ── Render helpers ───────────────────────────────────────────────────────
  const statusColor = (s?: string) => {
    if (!s) return "text-gray-400";
    if (s === "idle") return "text-green-400";
    if (s === "busy") return "text-amber-400";
    if (s === "offline") return "text-red-400";
    return "text-blue-400";
  };

  const logColor = (level: LogEntry["level"]) => {
    switch (level) {
      case "error": return "text-red-400";
      case "warn": return "text-amber-400";
      case "success": return "text-green-400";
      default: return "text-gray-300";
    }
  };

  const tabs = [
    { id: "status" as const, label: "Status", icon: Activity },
    { id: "actions" as const, label: "Actions", icon: Zap },
    { id: "script" as const, label: "Script", icon: FileCode },
    { id: "factory" as const, label: "Factory", icon: Box },
    { id: "logs" as const, label: "Logs", icon: Terminal },
  ];
  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 font-mono text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <Pickaxe size={18} className="text-cyan-400" />
          <span className="font-bold text-cyan-400">MIDNIGHT CITY COMMAND</span>
          <span className="text-gray-500">|</span>
          <span className="text-gray-400">Son of Anton</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Lock toggle */}
          <button
            onClick={toggleLock}
            className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-bold transition-colors ${
              locked
                ? "bg-amber-900/30 text-amber-400 border border-amber-700 hover:bg-amber-900/50"
                : "bg-gray-700/50 text-gray-400 border border-gray-600 hover:bg-gray-700 hover:text-gray-200"
            }`}
            title={locked ? "Agent is locked — survives tab switches" : "Click to lock agent session"}
          >
            {locked ? <Lock size={12} /> : <Unlock size={12} />}
            {locked ? "LOCKED" : "UNLOCKED"}
          </button>

          {/* Connection status */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${connected ? "bg-green-900/30 text-green-400 border border-green-800" : "bg-red-900/30 text-red-400 border border-red-800"}`}>
            {connected ? <CheckCircle size={12} /> : <XCircle size={12} />}
            {connected ? "LIVE" : "OFFLINE"}
          </div>

          {/* Config button */}
          <button
            onClick={() => setConfigMode(!configMode)}
            className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
            title="Configure Midnight City credentials"
          >
            <Settings size={12} />
            {configMode ? "CLOSE" : "CONFIG"}
          </button>

          {/* Connect / Disconnect button */}
          {!connected ? (
            <button
              onClick={doConnect}
              disabled={connecting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 rounded text-xs font-bold transition-colors"
            >
              {connecting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              {connecting ? "Connecting..." : "CONNECT"}
            </button>
          ) : (
            <button
              onClick={doDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-700 hover:bg-red-600 rounded text-xs font-bold transition-colors"
            >
              <StopCircle size={12} />
              DISCONNECT
            </button>
          )}
        </div>
      </div>

      {/* Lock banner (shown when locked) */}
      {locked && (
        <div className="px-4 py-1.5 bg-amber-900/20 border-b border-amber-800/50 flex items-center gap-2">
          <Lock size={12} className="text-amber-400" />
          <span className="text-amber-300 text-xs">
            🔒 Agent session is <strong>locked</strong>. It will survive tab switches, AI Chat, Settings, and any other navigation.
            {!connected && " The session is currently offline but will auto-reconnect when possible."}
          </span>
        </div>
      )}

      {/* Configuration panel */}
      {configMode && (
        <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
          <div className="text-xs font-bold text-cyan-400 mb-2 flex items-center gap-2">
            <Settings size={14} />
            Midnight City Configuration
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Agent ID</label>
              <input
                type="text"
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                placeholder="user-agent-..."
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-xs text-gray-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">API Key</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-xs text-gray-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Profession</label>
              <select
                value={profession}
                onChange={(e) => setProfession(e.target.value as any)}
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-xs text-gray-200 focus:border-cyan-500 focus:outline-none"
              >
                <option value="miner">⛏️ Miner</option>
                <option value="lumberjack">🪓 Lumberjack</option>
                <option value="hacker">💻 Hacker</option>
                <option value="fisher">🎣 Fisher</option>
                <option value="gatherer">🌿 Gatherer</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">API Base URL</label>
              <input
                type="text"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                placeholder="https://midnight.city/observer"
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-600 rounded text-xs text-gray-200 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={saveConfig}
              disabled={configSaving || !agentId}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-600 rounded text-xs font-bold transition-colors"
            >
              {configSaving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
              {configSaving ? "Saving..." : "SAVE CREDENTIALS"}
            </button>
            <button
              onClick={clearConfig}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-900/50 hover:bg-red-800/50 text-red-400 rounded text-xs transition-colors"
            >
              <Trash2 size={12} />
              CLEAR
            </button>
            <span className="text-xs text-gray-500 ml-2">API Key is encrypted with OS safeStorage</span>
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex border-b border-gray-700 bg-gray-800/50">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold border-b-2 transition-colors ${
                activeTab === t.id
                  ? "text-cyan-400 border-cyan-400 bg-gray-800"
                  : "text-gray-400 border-transparent hover:text-gray-200 hover:bg-gray-800/50"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-4">
        {lastError && (
          <div className="mb-3 px-3 py-2 bg-red-900/20 border border-red-800 rounded text-xs text-red-300 flex items-center gap-2">
            <AlertTriangle size={14} />
            {lastError}
            <button onClick={() => setLastError(null)} className="ml-auto text-red-400 hover:text-red-200">
              <XCircle size={14} />
            </button>
          </div>
        )}

        {/* ── STATUS TAB ────────────────────────────────────────────────────── */}
        {activeTab === "status" && (
          <div className="space-y-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-cyan-400 flex items-center gap-2">
                  <Bot size={16} />
                  Agent Status
                </h3>
                <span className={`text-xs font-mono ${statusColor(agentState?.status)}`}>
                  {agentState?.status?.toUpperCase() || "UNKNOWN"}
                </span>
              </div>
              {agentState ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">ID</span><span className="text-gray-200">{agentState.id}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="text-gray-200">{agentState.name}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Profession</span><span className="text-gray-200">{agentState.profession}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Position</span><span className="text-gray-200">{agentState.position?.spaceId} ({agentState.position?.x}, {agentState.position?.y})</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Action</span><span className="text-gray-200">{agentState.activeAction ? JSON.stringify(agentState.activeAction).slice(0, 60) : "None"}</span></div>
                </div>
              ) : (
                <div className="text-gray-500 text-xs italic">{connected ? "API unavailable (404) — no data" : "Connect to load state"}</div>
              )}
            </div>

            {/* Inventory */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="font-bold text-cyan-400 mb-3 flex items-center gap-2"><ScrollText size={16} /> Inventory</h3>
              {inventory ? (
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(inventory.inventory || {}).map(([name, qty]) => (
                    <div key={name} className="flex justify-between text-xs bg-gray-900/50 rounded px-2 py-1">
                      <span className="text-gray-400">{name}</span>
                      <span className="text-cyan-400 font-mono">{qty}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-xs italic">{connected ? "No inventory data" : "Connect to load inventory"}</div>
              )}
            </div>

            {/* Nearby agents — with speak button */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="font-bold text-cyan-400 mb-3 flex items-center gap-2"><Cpu size={16} /> Nearby Agents</h3>
              {nearbyAgents.length > 0 ? (
                <div className="space-y-2">
                  {nearbyAgents.map((a) => (
                    <div key={a.id} className="flex items-center justify-between text-xs bg-gray-900/50 rounded px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <Bot size={12} className={statusColor(a.status)} />
                        <span className="text-gray-200">{a.name}</span>
                        <span className="text-gray-500">({a.profession})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{(a.distance ?? 0).toFixed(1)}m</span>
                        <button
                          onClick={() => {
                            setSelectedNearbyAgentId(a.id);
                            setMessageText("");
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] border transition-colors ${
                            selectedNearbyAgentId === a.id
                              ? "bg-cyan-700/40 text-cyan-300 border-cyan-600"
                              : "bg-gray-700/30 text-gray-400 border-gray-600 hover:bg-cyan-700/30 hover:text-cyan-300"
                          }`}
                        >
                          💬
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-xs italic">{connected ? "No agents nearby" : "Connect to discover agents"}</div>
              )}

              {/* Speak to selected agent */}
              {selectedNearbyAgentId && nearbyAgents.some((a) => a.id === selectedNearbyAgentId) && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="text"
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && messageText.trim()) {
                        submitAction({ kind: "speak", targetAgentId: selectedNearbyAgentId, message: messageText.trim() });
                        setMessageText("");
                      }
                    }}
                    placeholder={`Message ${nearbyAgents.find((a) => a.id === selectedNearbyAgentId)?.name}...`}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-cyan-600"
                  />
                  <button
                    onClick={() => {
                      if (!messageText.trim()) return;
                      submitAction({ kind: "speak", targetAgentId: selectedNearbyAgentId, message: messageText.trim() });
                      setMessageText("");
                    }}
                    disabled={!messageText.trim() || !connected}
                    className="px-2 py-1 bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-600 rounded text-xs font-bold transition-colors"
                  >
                    Send
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ACTIONS TAB ───────────────────────────────────────────────────── */}
        {activeTab === "actions" && (
          <div className="space-y-4">
            {/* Quick actions */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="font-bold text-cyan-400 mb-3 flex items-center gap-2"><Zap size={16} /> Quick Actions</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={restartMiner}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-700/30 hover:bg-amber-700/50 border border-amber-600/30 rounded text-xs transition-colors"
                >
                  <Play size={14} /> Restart V6 Miner
                </button>
                <button
                  onClick={() => {
                    // Stay-put: move first if not at mine, then engage without location
                    const sid = (agentState?.position?.spaceId || "").toLowerCase();
                    if (sid.includes("mines")) {
                      submitAction({ kind: "engage", activity: "mine ore", durationMs: 600000 });
                    } else {
                      submitAction({ kind: "move_to", destination: { areaId: "mines-worksite" } });
                    }
                  }}
                  disabled={!connected || isMining}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-cyan-700/30 hover:bg-cyan-700/50 border border-cyan-600/30 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Pickaxe size={14} /> {isMining ? <Loader2 size={14} className="animate-spin" /> : "Mine Ore"}
                </button>
                <button onClick={() => {
                  const spaceId = agentState?.position?.spaceId || "central";
                  submitAction({ kind: "move_to", destination: { spaceId, x: 0, y: 0 } });
                }} disabled={!connected || isMining} className="flex items-center justify-center gap-2 px-3 py-2 bg-purple-700/30 hover:bg-purple-700/50 border border-purple-600/30 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <Server size={14} /> Move to Town
                </button>
                <button onClick={() => {
                  const areaId = discoveredAreas[0]?.areaId;
                  if (areaId) {
                    submitAction({ kind: "sleep", location: { areaId }, durationMs: 28800000 });
                  } else {
                    addLog("warn", "Cannot rest: no area discovered");
                  }
                }} disabled={!connected || isMining} className="flex items-center justify-center gap-2 px-3 py-2 bg-green-700/30 hover:bg-green-700/50 border border-green-600/30 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <Pause size={14} /> Rest
                </button>
                <button onClick={() => refreshState()} disabled={!connected || isMining} className="flex items-center justify-center gap-2 px-3 py-2 bg-amber-700/30 hover:bg-amber-700/50 border border-amber-600/30 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <Eye size={14} /> Refresh State
                </button>
              </div>
            </div>

            {/* Auto-mine */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-cyan-400 flex items-center gap-2"><Settings size={16} /> Auto-Work</h3>
                <button
                  onClick={() => setAutoMine((prev) => !prev)}
                  className={`px-3 py-1 rounded text-xs font-bold transition-colors ${autoMine ? "bg-green-600 hover:bg-green-500" : "bg-gray-600 hover:bg-gray-500"}`}
                >
                  {autoMine ? "ON" : "OFF"}
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-2">Moves to mines-worksite if not there, then engages in mining WITHOUT re-issuing move commands. Skips ticks while already mining to prevent walking loops.</p>
            </div>

            {/* Discovered areas */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="font-bold text-cyan-400 mb-3 flex items-center gap-2"><Map size={16} /> Discovered Areas</h3>
              {discoveredAreas.length > 0 ? (
                <div className="space-y-2">
                  {discoveredAreas.map((area) => (
                    <div key={area.areaId} className="flex items-center justify-between text-xs bg-gray-900/50 rounded px-2 py-1.5">
                      <div>
                        <span className="text-gray-200 font-bold">{area.name}</span>
                        <span className="text-gray-500 ml-2">{area.activities?.join(", ") || ""}</span>
                      </div>
                      {area.moveAreaAvailable && (
                        <button
                          onClick={() => submitAction({ kind: "move_to", destination: { areaId: area.areaId } })}
                          disabled={!connected || isMining}
                          className="px-2 py-0.5 bg-cyan-700/30 hover:bg-cyan-700/50 border border-cyan-600/30 rounded text-xs disabled:opacity-50"
                        >
                          Move
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-xs italic">{connected ? "No areas discovered yet" : "Connect to discover areas"}</div>
              )}
            </div>

            {/* Agent Needs (eat) */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="font-bold text-cyan-400 mb-3 flex items-center gap-2"><Pause size={16} /> Needs</h3>
              {needs ? (
                <div className="space-y-2 text-xs">
                  {["hunger","energy","social","health"].map((needKey) => {
                    const raw = needs[needKey];
                    const val = typeof raw === "number" ? raw : typeof raw?.value === "number" ? raw.value : "?";
                    const label = needKey.charAt(0).toUpperCase() + needKey.slice(1);
                    const isWarning = (needKey === "hunger" && val > 50) || (needKey === "energy" && val < 30) || (needKey === "health" && val < 30);
                    return (
                      <div key={needKey} className="flex justify-between">
                        <span className="text-gray-500">{label}</span>
                        <span className={isWarning ? "text-red-400 font-bold" : "text-gray-200"}>{val}</span>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => submitAction({ kind: "eat" })}
                    disabled={!connected || isMining}
                    className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-700/30 hover:bg-green-700/50 border border-green-600/30 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    🍽️ Eat
                  </button>
                </div>
              ) : (
                <div className="text-gray-500 text-xs italic">{connected ? "Loading needs..." : "Connect to load needs"}</div>
              )}
            </div>

            {/* Shout (global message) */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="font-bold text-cyan-400 mb-3 flex items-center gap-2"><Send size={16} /> Shout</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && messageText.trim()) {
                      submitAction({ kind: "shout", text: messageText.trim() });
                      setMessageText("");
                    }
                  }}
                  placeholder="Shout to nearby agents..."
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-cyan-600"
                />
                <button
                  onClick={() => {
                    if (!messageText.trim()) return;
                    submitAction({ kind: "shout", text: messageText.trim() });
                    setMessageText("");
                  }}
                  disabled={!messageText.trim() || !connected}
                  className="px-3 py-1 bg-purple-700 hover:bg-purple-600 disabled:bg-gray-600 rounded text-xs font-bold transition-colors"
                >
                  Shout
                </button>
              </div>
            </div>

            {/* Sell Ore */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="font-bold text-cyan-400 mb-3 flex items-center gap-2"><ScrollText size={16} /> Sell Ore</h3>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={tradeQty}
                  onChange={(e) => setTradeQty(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-24 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-cyan-600"
                />
                <button
                  onClick={() => {
                    submitAction({ kind: "trade", merchantName: "Central Merchant East", itemId: "ore", quantity: tradeQty });
                  }}
                  disabled={!connected || isMining}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-amber-700/30 hover:bg-amber-700/50 border border-amber-600/30 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  💰 Sell to Merchant
                </button>
              </div>
              <p className="text-gray-500 text-xs mt-2">Sells ore to Central Merchant East.</p>
            </div>

            {/* Threads / Messages */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="font-bold text-cyan-400 mb-3 flex items-center gap-2"><Terminal size={16} /> Conversations</h3>
              {threads.length > 0 ? (
                <div className="space-y-1 max-h-40 overflow-auto">
                  {threads.slice(0, 10).map((t) => (
                    <div key={t.threadId} className="text-xs bg-gray-900/50 rounded px-2 py-1 flex justify-between">
                      <span className="text-gray-300">{t.title || t.threadId}</span>
                      <span className="text-gray-500">{t.unreadCount > 0 ? `🔴 ${t.unreadCount}` : ""}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-gray-500 text-xs italic">{connected ? "No threads" : "Connect to load conversations"}</div>
              )}
            </div>
          </div>
        )}

        {/* ── SCRIPT TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "script" && (
          <div className="space-y-4 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-cyan-400 flex items-center gap-2"><FileCode size={16} /> Script Editor</h3>
              <div className="flex items-center gap-2">
                <button onClick={loadScript} className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs">Reload</button>
                <button onClick={saveScript} disabled={!scriptDirty || scriptSaving} className="px-2 py-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-600 rounded text-xs">
                  {scriptSaving ? <Loader2 size={12} className="animate-spin inline" /> : "Save"}
                </button>
                <button onClick={restartMiner} className="px-2 py-1 bg-amber-700 hover:bg-amber-600 rounded text-xs">Restart Daemon</button>
              </div>
            </div>
            <div className="flex-1 relative">
              <textarea
                value={scriptContent}
                onChange={(e) => { setScriptContent(e.target.value); setScriptDirty(true); }}
                className="w-full h-full bg-gray-900 border border-gray-700 rounded p-3 text-xs font-mono text-gray-300 resize-none focus:outline-none focus:border-cyan-600"
                spellCheck={false}
              />
              {scriptDirty && (
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-900/50 border border-amber-700 rounded text-amber-300 text-xs">
                  Unsaved changes
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── FACTORY TAB ─────────────────────────────────────────────────────── */}
        {activeTab === "factory" && (
          <div className="space-y-4">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
              <h3 className="font-bold text-cyan-400 mb-3 flex items-center gap-2"><Box size={16} /> Node Factory</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Agent Name</label>
                  <input
                    type="text"
                    value={factoryName}
                    onChange={(e) => setFactoryName(e.target.value)}
                    placeholder="e.g., miner-01"
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-cyan-600"
                  />
                </div>
                <div>
                  <label className="text-gray-500 text-xs block mb-1">Profession</label>
                  <select
                    value={factoryProfession}
                    onChange={(e) => setFactoryProfession(e.target.value as any)}
                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-cyan-600"
                  >
                    <option value="miner">Miner</option>
                    <option value="lumberjack">Lumberjack</option>
                    <option value="fisher">Fisher</option>
                    <option value="gatherer">Gatherer</option>
                  </select>
                </div>
                <button
                  onClick={deployNewAgent}
                  disabled={factoryDeploying || !factoryName.trim()}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:bg-gray-600 rounded text-xs font-bold transition-colors"
                >
                  {factoryDeploying ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
                  {factoryDeploying ? "Deploying..." : "Deploy Agent"}
                </button>
                {factoryResult && (
                  <div className={`text-xs p-2 rounded ${factoryResult.startsWith("Error") ? "bg-red-900/20 text-red-300" : "bg-green-900/20 text-green-300"}`}>
                    {factoryResult}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LOGS TAB ────────────────────────────────────────────────────────── */}
        {activeTab === "logs" && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-cyan-400 flex items-center gap-2"><Terminal size={16} /> Logs</h3>
              <button onClick={() => setLogs([])} className="px-2 py-0.5 bg-gray-700 hover:bg-gray-600 rounded text-xs text-gray-400">Clear</button>
            </div>
            <div className="flex-1 bg-gray-900 border border-gray-700 rounded p-2 overflow-auto font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-gray-500 italic">No logs yet...</div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`mb-1 ${logColor(log.level)}`}>
                    <span className="text-gray-600">[{log.timestamp}]</span>{" "}
                    <span className="font-bold">{log.level.toUpperCase()}</span>{" "}
                    {log.message}
                    {log.detail && <span className="text-gray-500"> — {log.detail}</span>}
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

