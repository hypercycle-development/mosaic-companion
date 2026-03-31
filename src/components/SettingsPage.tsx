import React, { useEffect, useState, useRef, useCallback } from "react";
import { toast } from "react-toastify";

import {
  Save,
  Layout,
  Bot,
  Plus,
  Trash2,
  TestTube,
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  Cpu,
  Key,
  Server,
  Thermometer,
  Zap,
  Info,
} from "lucide-react";
import {
  AIAgentConfig,
  AIProvider,
  DEFAULT_MODELS,
  HypercycleBackend,
  PROVIDER_INFO,
} from "../types/ai";
import { AIService } from "../services/AIService";
import {
  fetchHypercycleNodeInfo,
  getHypercycleAimIndex,
  getHypercycleAimPath,
  HYPERCYCLE_AIM_INDEX_DEFAULT_BASECHAIN,
  HYPERCYCLE_AIM_INDEX_DEFAULT_TODA,
  getHypercycleAppPort,
  getHypercycleServerPort,
  getHypercycleStreamPort,
  HYPERCYCLE_AIM_PORT,
  HYPERCYCLE_BASECHAIN_APP_PORT,
  HYPERCYCLE_BASECHAIN_SERVER_PORT,
  HYPERCYCLE_BASECHAIN_STREAM_PORT,
  HYPERCYCLE_NONCE_PORT,
  HYPERCYCLE_STREAM_PORT,
  HYPERCYCLE_TODA_TDN_TYPE_HASH,
  registerHypercycleBalance,
  resolveTodaBalanceTxIdFromHypercycleNode,
} from "../services/hypercycleAgent";
import GmailClient from "./GmailClient";
import { useTheme } from "../ThemeProvider";
import { ThemeKey } from "../themes";

/** Hypercycle: chain wallet / TODA Twin must be configured before activation. */
function hypercycleWalletReady(
  agent: AIAgentConfig,
  evmWallet: boolean,
  todaOk: boolean,
): boolean {
  if (agent.provider !== "hypercycle") return true;
  return agent.hypercycleBackend === "basechain" ? evmWallet : todaOk;
}

/** AIService.testConnection only needs an API key for cloud/custom providers. */
function providerRequiresApiKeyForConnectionTest(p: AIProvider): boolean {
  return p !== "ollama" && p !== "hypercycle";
}

function parseEvmTxHashFromToolData(data: unknown): string | null {
  if (typeof data !== "string") return null;
  const m = /Tx Hash:\s*(0x[a-fA-F0-9]+)/i.exec(data);
  return m?.[1] ?? null;
}

/** First `entryFiles` line from tool summary (Twin / binder). */
function parseEntryFileIdFromTodaToolData(data: unknown): string | null {
  const s = typeof data === "string" ? data : null;
  if (!s) return null;
  const m = /Entry file \(balance tx-id\):\s*([^\s\n]+)/i.exec(s);
  return m?.[1]?.trim() ?? null;
}

function parseTransferIdFromTodaSummary(s: string): string | null {
  const m = /Transfer ID:\s*([^\s\n]+)/i.exec(s);
  const id = m?.[1]?.trim();
  if (!id || id.toUpperCase() === "N/A") return null;
  return id;
}

/** USDC uses 6 decimals on Base; raw integer matches gateway tx-value / register. */
const USDC_SMALLEST_UNIT_DIVISOR = 1_000_000;

/** TDN uses 3 decimals; raw integer matches gateway tx-value / register. */
const TDN_SMALLEST_UNIT_DIVISOR = 1_000;

function HypercycleBalancePanel({ agent }: { agent: AIAgentConfig }) {
  const [amountRaw, setAmountRaw] = useState("");
  const [txId, setTxId] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [tmPreview, setTmPreview] = useState<string | null>(null);
  const [tmHostAddr, setTmHostAddr] = useState<string | null>(null);
  const [tmEvm, setTmEvm] = useState<string | null>(null);
  const [baseRecipient, setBaseRecipient] = useState("");
  const [busy, setBusy] = useState<
    "idle" | "info" | "register" | "binder" | "transfer"
  >("idle");
  const [msg, setMsg] = useState<string | null>(null);

  const runLoadInfo = async () => {
    setMsg(null);
    setBusy("info");
    try {
      const r = await fetchHypercycleNodeInfo(agent);
      if (!r.ok) {
        setTmPreview(null);
        setTmHostAddr(null);
        setTmEvm(null);
        setMsg(`GET /info failed (${r.status})`);
        return;
      }
      setTmPreview(r.tm ?? null);
      setTmHostAddr(r.tmHostAddress ?? null);
      setTmEvm(r.tmEvmRecipient ?? null);
      setBaseRecipient((prev) => (r.tmEvmRecipient?.trim() ? r.tmEvmRecipient.trim() : prev));
      if (r.tm?.trim()) {
        setMsg(null);
      } else {
        setMsg(
          "Could not read tx-sender from `tm` (expected string or object with `address`).",
        );
      }
    } catch (e) {
      setTmPreview(null);
      setTmHostAddr(null);
      setTmEvm(null);
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("idle");
    }
  };

  const runSendFromMosaic = async () => {
    const exec = window.electronAPI?.tools?.execute;
    if (!exec) {
      toast.error("Web3 tools are not available.");
      return;
    }
    const raw = amountRaw.trim();
    if (!/^\d+$/.test(raw) || raw === "0") {
      setMsg("Enter a positive integer amount (smallest units, same as tx-value).");
      return;
    }
    setMsg(null);
    setBusy("transfer");
    try {
      if (agent.hypercycleBackend === "basechain") {
        const to = (baseRecipient.trim() || tmEvm?.trim() || "").trim();
        if (!/^0x[a-fA-F0-9]{40}$/i.test(to)) {
          setMsg("Set a valid 0x USDC recipient (from Load Address or paste manually).");
          setBusy("idle");
          return;
        }
        const rawNum = parseInt(raw, 10);
        const humanUsdc = (rawNum / USDC_SMALLEST_UNIT_DIVISOR).toFixed(6).replace(/\.?0+$/, "") || "0";
        const r = await exec("web3:transfer_token", {
          to,
          amount: humanUsdc,
          token: "USDC",
          confirmed: true,
        });
        if (!r.success) {
          setMsg(r.error ?? "USDC transfer failed.");
          toast.error(r.error ?? "Transfer failed");
          return;
        }
        const hash = parseEvmTxHashFromToolData(r.data);
        if (hash) setTxId(hash);
        toast.success("USDC transfer submitted.");
        setMsg(
          hash
            ? "USDC sent. tx-id filled for registration."
            : String(r.data ?? "USDC sent — copy the tx hash into tx-id if needed."),
        );
      } else {
        const to = tmHostAddr?.trim();
        if (!to) {
          setMsg(
            "Load Address first — the node must return tm.host_address to send TDN from Mosaic.",
          );
          toast.error("Missing Twin URL (tm.host_address)");
          return;
        }
        const rawNum = parseInt(raw, 10);
        const humanTdn = (rawNum / TDN_SMALLEST_UNIT_DIVISOR).toFixed(3).replace(/\.?0+$/, "") || "0";
        const r = await exec("web3:transfer_toda", {
          to,
          amount: humanTdn,
          typeHash: HYPERCYCLE_TODA_TDN_TYPE_HASH,
          confirmed: true,
        });
        if (!r.success) {
          setMsg(r.error ?? "TDN transfer failed.");
          toast.error(r.error ?? "Transfer failed");
          return;
        }
        const payload = r.data;
        let txIdToSet: string | null = null;
        const tryResolveBinder = async (ref: string) => {
          try {
            return await resolveTodaBalanceTxIdFromHypercycleNode(agent, ref);
          } catch {
            return null;
          }
        };
        const fillFromSummary = async (summary: string) => {
          const fromFile = parseEntryFileIdFromTodaToolData(summary);
          if (fromFile) return fromFile;
          const tid = parseTransferIdFromTodaSummary(summary);
          if (tid) return tryResolveBinder(tid);
          return null;
        };
        if (payload && typeof payload === "object" && !Array.isArray(payload)) {
          const o = payload as Record<string, unknown>;
          if (typeof o.entryFileId === "string" && o.entryFileId.trim()) {
            txIdToSet = o.entryFileId.trim();
          } else if (
            typeof o.transferId === "string" &&
            o.transferId.trim() &&
            o.transferId.toUpperCase() !== "N/A"
          ) {
            txIdToSet = await tryResolveBinder(o.transferId.trim());
          }
          if (!txIdToSet && typeof o.summary === "string") {
            txIdToSet = await fillFromSummary(o.summary);
          }
        } else if (typeof payload === "string") {
          txIdToSet = await fillFromSummary(payload);
        }
        if (txIdToSet) setTxId(txIdToSet);
        toast.success("TDN transfer submitted.");
        setMsg(
          txIdToSet
            ? "TDN sent — tx-id filled (entryFiles / binder)."
            : "TDN sent — paste tx-id from the binder or use Resolve with a transfer reference.",
        );
      }
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      setMsg(err);
      toast.error(err);
    } finally {
      setBusy("idle");
    }
  };

  const runRegister = async () => {
    setMsg(null);
    setBusy("register");
    try {
      const r = await registerHypercycleBalance(agent, {
        txValue: amountRaw.trim(),
        txId: txId.trim(),
      });
      if (r.ok) {
        setMsg("Balance registered.");
        toast.success("Balance registered.");
      } else {
        setMsg(`POST /balance failed (${r.status}): ${r.rawText.slice(0, 400)}`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("idle");
    }
  };

  const runResolveBinder = async () => {
    if (agent.hypercycleBackend === "basechain") {
      setMsg("Binder resolve is for TODA only.");
      return;
    }
    setMsg(null);
    setBusy("binder");
    try {
      const r = await resolveTodaBalanceTxIdFromHypercycleNode(
        agent,
        transferRef.trim(),
      );
      setTxId(r);
      setMsg("Filled tx-id from node binder.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy("idle");
    }
  };

  const isBusy = busy !== "idle";

  return (
    <div className="border border-gray-800 rounded-lg p-3 space-y-3 bg-gray-950/50">
      <div className="text-sm text-gray-300 font-medium">Fund and register balance</div>
      {tmPreview && (
        <p className="text-xs text-gray-500 font-mono break-all">
          <span className="text-gray-600">Address (tx-sender): </span>
          {tmPreview}
        </p>
      )}
      {tmHostAddr && agent.hypercycleBackend !== "basechain" && (
        <p className="text-xs text-gray-500 font-mono break-all">
          <span className="text-gray-600">Twin URL (send TDN): </span>
          {tmHostAddr}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={runLoadInfo}
          disabled={isBusy}
          className="px-3 py-1.5 text-xs rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50"
        >
          {busy === "info" ? "Loading…" : "Load Address"}
        </button>
      </div>

      <div className="border-t border-gray-800 pt-3 space-y-2">
        <label className="block">
          <span className="text-xs text-gray-500">Amount (smallest units)</span>
          <input
            type="text"
            inputMode="numeric"
            value={amountRaw}
            onChange={(e) => setAmountRaw(e.target.value.replace(/\D/g, ""))}
            className="w-full mt-0.5 px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm"
            placeholder="e.g. 500000"
          />
          {amountRaw.trim() && /^\d+$/.test(amountRaw.trim()) && amountRaw.trim() !== "0" && (
            <p className="text-xs text-gray-600 mt-1">
              {agent.hypercycleBackend === "basechain" ? (
                <>
                  Equivalence:{" "}
                  <span className="font-mono text-gray-500">{amountRaw}</span> →{" "}
                  <span className="font-mono text-gray-500">
                    {(Number(amountRaw) / USDC_SMALLEST_UNIT_DIVISOR).toFixed(6).replace(/\.?0+$/, "") || "0"}
                  </span>{" "}
                  USDC (6 decimals). Same integer as tx-value for register.
                </>
              ) : (
                <>
                  Equivalence:{" "}
                  <span className="font-mono text-gray-500">{amountRaw}</span> →{" "}
                  <span className="font-mono text-gray-500">
                    {(Number(amountRaw) / TDN_SMALLEST_UNIT_DIVISOR).toFixed(3).replace(/\.?0+$/, "") || "0"}
                  </span>{" "}
                  TDN (3 decimals). Same integer as tx-value for register.
                </>
              )}
            </p>
          )}
        </label>

        <div className="text-xs text-gray-500 font-medium">Send from Mosaic</div>
        {agent.hypercycleBackend === "basechain" && (
          <label className="block">
            <span className="text-xs text-gray-500">USDC recipient (0x)</span>
            <input
              type="text"
              value={baseRecipient}
              onChange={(e) => setBaseRecipient(e.target.value)}
              className="w-full mt-0.5 px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm"
              placeholder={
                tmEvm
                  ? tmEvm
                  : "Paste node deposit address if not filled from /info"
              }
            />
          </label>
        )}
        <button
          type="button"
          onClick={runSendFromMosaic}
          disabled={isBusy || !amountRaw.trim() || amountRaw.trim() === "0"}
          className="px-3 py-2 text-sm rounded-lg bg-emerald-800/80 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy === "transfer"
            ? "Sending…"
            : agent.hypercycleBackend === "basechain"
              ? "Send USDC"
              : "Send TDN"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 border-t border-gray-800 pt-3">
        <label className="block col-span-2">
          <span className="text-xs text-gray-500">tx-id (register)</span>
          <input
            type="text"
            value={txId}
            onChange={(e) => setTxId(e.target.value)}
            className="w-full mt-0.5 px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm"
            placeholder={
              agent.hypercycleBackend === "basechain"
                ? "0x… transaction hash"
                : "Entry file id or transfer id"
            }
          />
        </label>
        {agent.hypercycleBackend !== "basechain" && (
          <label className="block col-span-2">
            <span className="text-xs text-gray-500">TODA: optional binder resolve</span>
            <div className="flex gap-2 mt-0.5">
              <input
                type="text"
                value={transferRef}
                onChange={(e) => setTransferRef(e.target.value)}
                className="flex-1 px-2 py-1.5 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 font-mono text-sm"
                placeholder="transfer or reference id"
              />
              <button
                type="button"
                onClick={runResolveBinder}
                disabled={isBusy || !transferRef.trim()}
                className="px-3 py-1.5 text-xs rounded-md bg-gray-800 hover:bg-gray-700 text-gray-200 disabled:opacity-50 whitespace-nowrap"
              >
                {busy === "binder" ? "…" : "Resolve tx-id"}
              </button>
            </div>
          </label>
        )}
      </div>
      <button
        type="button"
        onClick={runRegister}
        disabled={isBusy || !amountRaw.trim() || amountRaw.trim() === "0" || !txId.trim()}
        className="px-3 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy === "register" ? "Registering…" : "Register balance"}
      </button>
      {msg && (
        <p className="text-xs text-gray-400 whitespace-pre-wrap">{msg}</p>
      )}
    </div>
  );
}

interface SettingsPageProps {
  homeUrl: string;
  setHomeUrl: (url: string) => void;
  customGreeting: string;
  setCustomGreeting: (text: string) => void;
  showUrlBar?: boolean;
  setShowUrlBar?: (show: boolean) => void;
  aiAgents?: AIAgentConfig[];
  setAiAgents?: (agents: AIAgentConfig[]) => void;
  scrollSection?: string;
  onReopenOnboarding?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  homeUrl,
  setHomeUrl,
  customGreeting,
  setCustomGreeting,
  showUrlBar,
  setShowUrlBar,
  aiAgents: externalAgents,
  setAiAgents: externalSetAiAgents,
  scrollSection,
  onReopenOnboarding,
}) => {
  // Ref for scrolling to sections
  const agentsSectionRef = useRef<HTMLElement>(null);
  const nodesSectionRef = useRef<HTMLElement>(null);

  // Scroll to section when scrollSection prop is set
  useEffect(() => {
    const sectionMap: Record<string, React.RefObject<HTMLElement | null>> = {
      agents: agentsSectionRef,
      nodes: nodesSectionRef,
    };

    const targetSection = scrollSection ? sectionMap[scrollSection] : undefined;

    if (targetSection?.current) {
      targetSection.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [scrollSection]);

  // Internal state for when external state isn't provided
  const [internalAgents, setInternalAgents] = useState<AIAgentConfig[]>([]);

  // Use external state if provided, otherwise use internal state
  const aiAgents = externalAgents ?? internalAgents;
  const setAiAgents = externalSetAiAgents ?? setInternalAgents;
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<
    Record<
      string,
      { status: "idle" | "testing" | "success" | "error"; message?: string }
    >
  >({});
  const [nameErrors, setNameErrors] = useState<Record<string, string>>({});

  const [web3EvmWallet, setWeb3EvmWallet] = useState(false);
  const [web3TodaOk, setWeb3TodaOk] = useState(false);

  const refreshWeb3WalletGate = useCallback(async () => {
    try {
      const w = await window.electronAPI.trading.walletExists();
      const data = w as { success?: boolean; data?: { exists?: boolean }; exists?: boolean };
      const exists =
        typeof data.exists === "boolean"
          ? data.exists
          : !!(data.success && data.data?.exists);
      setWeb3EvmWallet(exists);
    } catch {
      setWeb3EvmWallet(false);
    }
    try {
      const t = await window.electronAPI.web3.todaHasConfig();
      setWeb3TodaOk(!!t?.configured);
    } catch {
      setWeb3TodaOk(false);
    }
  }, []);

  useEffect(() => {
    void refreshWeb3WalletGate();
    const unsub = window.electronAPI.web3.onWalletImported(() => {
      void refreshWeb3WalletGate();
    });
    return () => unsub();
  }, [refreshWeb3WalletGate]);

  const { themes, themeKey, setThemeKey } = useTheme();

  // Update settings state for auto-updater
  const [updateSettings, setUpdateSettingsState] = useState<{
    autoDownload: boolean;
    titleBarStyle?: string;
  }>({
    autoDownload: false,
    titleBarStyle: "hidden",
  });

  // Media auto-display setting
  const [autoDisplayMedia, setAutoDisplayMediaState] = useState(false);

  // Toast feedback for settings changes
  const [settingsToast, setSettingsToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Hypercycle Nodes state
  const [nodes, setNodes] = useState<HypercycleNode[]>([]);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const MAX_NODES = 3;

  // Live status tracking for nodes
  const [nodeStatuses, setNodeStatuses] = useState<
    Record<
      string,
      { isLive: boolean; checking: boolean; lastChecked: Date | null }
    >
  >({});

  // Check if a node is reachable
  const checkNodeConnection = useCallback(async (node: HypercycleNode) => {
    if (!node.apiHost || !node.isActive) return;

    setNodeStatuses((prev) => ({
      ...prev,
      [node.id]: { ...prev[node.id], checking: true },
    }));

    try {
      const url = `http://${node.apiHost}:${node.apiPort || "8000"}/info`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(url, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const isLive = response.ok || response.status < 500;

      setNodeStatuses((prev) => ({
        ...prev,
        [node.id]: { isLive, checking: false, lastChecked: new Date() },
      }));
    } catch {
      setNodeStatuses((prev) => ({
        ...prev,
        [node.id]: { isLive: false, checking: false, lastChecked: new Date() },
      }));
    }
  }, []);

  // Load update settings on mount
  useEffect(() => {
    const loadUpdateSettings = async () => {
      if (window.electronAPI?.getUpdateSettings) {
        const settings = await window.electronAPI.getUpdateSettings();
        setUpdateSettingsState(settings);
      }
    };
    loadUpdateSettings();
  }, []);

  // Load auto-display-media setting on mount
  useEffect(() => {
    const loadMediaSetting = async () => {
      try {
        const result = await (window as any).electronAPI?.media?.getAutoDisplay?.();
        if (result?.enabled !== undefined) {
          setAutoDisplayMediaState(result.enabled);
        }
      } catch (e) {
        console.warn("[Settings] Failed to load autoDisplayMedia setting:", e);
      }
    };
    loadMediaSetting();
  }, []);

  // Load nodes on mount
  useEffect(() => {
    const loadNodes = async () => {
      if (window.electronAPI?.nodes?.get) {
        const loadedNodes = await window.electronAPI.nodes.get();
        setNodes(loadedNodes);
      }
    };
    loadNodes();

    // Subscribe to node changes
    let cleanup: (() => void) | undefined;
    if (window.electronAPI?.nodes?.onChanged) {
      cleanup = window.electronAPI.nodes.onChanged((updatedNodes) => {
        setNodes(updatedNodes);
      });
    }
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Check all active nodes when they change
  useEffect(() => {
    nodes.filter((n) => n.isActive && n.apiHost).forEach(checkNodeConnection);
  }, [nodes, checkNodeConnection]);

  // Helper to update a single setting with feedback
  const handleUpdateSettingChange = async (
    key: keyof typeof updateSettings,
    value: boolean | string,
  ) => {
    if (window.electronAPI?.setUpdateSettings) {
      const result = await window.electronAPI.setUpdateSettings({
        [key]: value,
      });

      if (result.success) {
        setUpdateSettingsState(result.settings);
        toast.success("Settings saved");
      } else {
        toast.error(result.error || "Failed to save settings");
      }
    }
  };

  // Node handlers
  const addNewNode = async () => {
    if (nodes.length >= MAX_NODES) return;

    if (window.electronAPI?.nodes?.add) {
      const result = await window.electronAPI.nodes.add({
        name: `Node ${nodes.length + 1}`,
        apiHost: "",
        apiPort: "8000",
        hasAdminPanel: false,
        adminHost: "",
        adminPort: "8006",
        isActive: true,
      });

      if (result.success && result.nodes) {
        setNodes(result.nodes);
        // Expand the newly added node
        const newNode = result.nodes[result.nodes.length - 1];
        setExpandedNode(newNode.id);
        setSettingsToast({ type: "success", message: "Node added" });
      } else {
        setSettingsToast({
          type: "error",
          message: result.error || "Failed to add node",
        });
      }
      setTimeout(() => setSettingsToast(null), 3000);
    }
  };

  const updateNodeHandler = async (
    id: string,
    updates: Partial<HypercycleNode>,
  ) => {
    if (window.electronAPI?.nodes?.update) {
      const result = await window.electronAPI.nodes.update(id, updates);
      if (result.success && result.nodes) {
        setNodes(result.nodes);
      }
    }
  };

  const deleteNodeHandler = async (id: string) => {
    if (window.electronAPI?.nodes?.delete) {
      const result = await window.electronAPI.nodes.delete(id);
      if (result.success && result.nodes) {
        setNodes(result.nodes);
        if (expandedNode === id) setExpandedNode(null);
        setSettingsToast({ type: "success", message: "Node deleted" });
      } else {
        setSettingsToast({
          type: "error",
          message: result.error || "Failed to delete node",
        });
      }
      setTimeout(() => setSettingsToast(null), 3000);
    }
  };

  const addAgent = async () => {
    // Generate a unique name for the new agent
    let baseName = "New AI Agent";
    let uniqueName = baseName;
    let counter = 2;

    // Check if the name already exists and increment until we find a unique one
    while (
      aiAgents.some(
        (agent) => agent.name.toLowerCase() === uniqueName.toLowerCase(),
      )
    ) {
      uniqueName = `${baseName} ${counter}`;
      counter++;
    }

    const newAgent: AIAgentConfig = {
      id: `agent-${Date.now()}`,
      name: uniqueName,
      provider: "claude",
      apiKey: "",
      model: DEFAULT_MODELS.claude[0],
      maxTokens: 4096,
      temperature: 0.7,
      isActive: false,
      createdAt: Date.now(),
    };

    // Add to database first
    try {
      const result = await window.electronAPI.aiAgents.add(newAgent);
      if (result.success) {
        // Reload agents from database
        const updatedAgents = await window.electronAPI.aiAgents.get();
        if (updatedAgents) {
          setAiAgents(updatedAgents);
          setExpandedAgent(newAgent.id);
          toast.success("Agent created");
        }
      } else {
        toast.error(result.error || "Failed to create agent");
      }
    } catch (error) {
      console.error("Error creating agent:", error);
      toast.error("Failed to create agent");
    }
  };

  const updateAgent = async (id: string, updates: Partial<AIAgentConfig>) => {
    // Check for duplicate names if name is being updated
    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();

      // Check for empty name
      if (trimmedName === "") {
        setNameErrors((prev) => ({
          ...prev,
          [id]: "Agent name is required",
        }));
        return; // Don't update if name is empty
      }

      // Check for duplicate names
      const isDuplicate = aiAgents.some(
        (agent) =>
          agent.id !== id &&
          agent.name.trim().toLowerCase() === trimmedName.toLowerCase(),
      );

      if (isDuplicate) {
        setNameErrors((prev) => ({
          ...prev,
          [id]: "An agent with this name already exists",
        }));
        return; // Don't update if name is duplicate
      } else {
        // Clear error if name is valid
        setNameErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[id];
          return newErrors;
        });
      }
    }

    // Update local state first for immediate UI feedback
    setAiAgents(
      aiAgents.map((agent) =>
        agent.id === id ? { ...agent, ...updates } : agent,
      ),
    );

    // Persist to database
    try {
      const result = await window.electronAPI.aiAgents.update(id, updates);
      if (!result.success) {
        console.error("Failed to update agent:", result.error);
        toast.error(result.error || "Failed to update agent");
        // Reload agents from database to revert
        const updatedAgents = await window.electronAPI.aiAgents.get();
        if (updatedAgents) {
          setAiAgents(updatedAgents);
        }
      }
    } catch (error) {
      console.error("Error updating agent:", error);
      toast.error("Failed to update agent");
    }
  };

  const deleteAgent = async (id: string) => {
    try {
      const result = await window.electronAPI.aiAgents.delete(id);
      if (result.success) {
        // Reload agents from database
        const updatedAgents = await window.electronAPI.aiAgents.get();
        if (updatedAgents) {
          setAiAgents(updatedAgents);
        }
        if (expandedAgent === id) setExpandedAgent(null);
        toast.success("Agent deleted");
      } else {
        toast.error(result.error || "Failed to delete agent");
      }
    } catch (error) {
      console.error("Error deleting agent:", error);
      toast.error("Failed to delete agent");
    }
  };

  const toggleApiKeyVisibility = (id: string) => {
    setShowApiKeys((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const testConnection = async (agent: AIAgentConfig) => {
    setTestResults((prev) => ({ ...prev, [agent.id]: { status: "testing" } }));

    try {
      const result = await AIService.testConnection(agent);
      setTestResults((prev) => ({
        ...prev,
        [agent.id]: {
          status: result.success ? "success" : "error",
          message: result.message,
        },
      }));
    } catch (e) {
      setTestResults((prev) => ({
        ...prev,
        [agent.id]: {
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        },
      }));
    }

    // Clear result after 15 seconds
    setTimeout(() => {
      setTestResults((prev) => ({ ...prev, [agent.id]: { status: "idle" } }));
    }, 15000);
  };

  const handleProviderChange = (agentId: string, provider: AIProvider) => {
    const defaultModel = DEFAULT_MODELS[provider][0] || "";
    const info = PROVIDER_INFO[provider];
    const patch: Partial<AIAgentConfig> = {
      provider,
      model: provider === "hypercycle" ? "" : defaultModel,
      baseUrl: provider === "custom" ? "" : info.baseUrl,
    };
    if (provider === "hypercycle") {
      patch.hypercycleBackend = "toda";
    }
    updateAgent(agentId, patch);
  };
  useEffect(() => {
    // Set initial array of agents
    const getAgents = async () => {
      const result = await window.electronAPI.aiAgents.get();
      if (result) {
        setAiAgents(result);
      } else {
        console.log("No ai agents found");
      }
    };
    getAgents();
  }, []);
  return (
    <div className="max-w-4xl mx-auto p-8 md:p-12 animate-in slide-in-from-bottom-4 duration-300 text-gray-100 font-sans">
      <h1 className="text-3xl font-bold text-white mb-8 border-b border-gray-800 pb-4 tracking-tight">
        System Configuration
      </h1>

      <div className="space-y-8">

        {/* AI Agents Section */}
        <section
          className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm"
          id="agents"
          ref={agentsSectionRef}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-indigo-400 flex items-center gap-2">
              <Bot size={20} />
              AI Agents
            </h2>
            <button
              onClick={addAgent}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-500/30 rounded-lg transition-all hover:scale-[1.02]"
            >
              <Plus size={16} />
              <span className="text-xs font-bold tracking-wider uppercase">
                Add Agent
              </span>
            </button>
          </div>

          {aiAgents.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-700 rounded-xl">
              <Cpu className="mx-auto size-12 text-gray-600 mb-4" />
              <p className="text-gray-500 mb-2">No AI agents configured</p>
              <p className="text-sm text-gray-600">
                Add an agent to start chatting with AI models
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {aiAgents.map((agent) => {
                const isExpanded = expandedAgent === agent.id;
                const testResult = testResults[agent.id] || { status: "idle" };
                const providerColor = PROVIDER_INFO[agent.provider].color;

                return (
                  <div
                    key={agent.id}
                    className={`
                      border rounded-xl transition-all duration-300 overflow-hidden
                      ${
                        isExpanded
                          ? "border-indigo-500/50 bg-gray-950/50 glow-primary"
                          : "border-gray-800 bg-gray-900/30 hover:border-gray-700"
                      }
                    `}
                  >
                    {/* Agent Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer"
                      onClick={() =>
                        setExpandedAgent(isExpanded ? null : agent.id)
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{
                            backgroundColor: agent.isActive
                              ? providerColor
                              : "#4B5563",
                            boxShadow: agent.isActive
                              ? `0 0 10px ${providerColor}`
                              : "none",
                          }}
                        />
                        <div>
                          <h3 className="font-medium text-gray-200">
                            {agent.name}
                          </h3>
                          <p className="text-xs text-gray-500 font-mono">
                            {PROVIDER_INFO[agent.provider].name} • {agent.model}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {testResult.status === "success" && (
                          <CheckCircle className="size-5 text-emerald-500" />
                        )}
                        {testResult.status === "error" && (
                          <XCircle className="size-5 text-red-500" />
                        )}
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            deleteAgent(agent.id);
                            await window.electronAPI.aiAgents.delete(agent.id);
                          }}
                          className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* Expanded Configuration */}
                    {isExpanded && (
                      <div className="px-4 pb-4 space-y-5 border-t border-gray-800 pt-4 animate-in slide-in-from-top-2 duration-200">
                        {/* Agent Name */}
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                              <Sparkles size={12} />
                              Agent Name
                            </span>
                            <input
                              type="text"
                              value={agent.name}
                              onChange={(e) =>
                                updateAgent(agent.id, { name: e.target.value })
                              }
                              className={`w-full px-3 py-2 bg-gray-950 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-gray-100 ${
                                nameErrors[agent.id]
                                  ? "border-red-500 focus:border-red-500"
                                  : "border-gray-700 focus:border-indigo-500"
                              }`}
                            />
                            {nameErrors[agent.id] && (
                              <p className="mt-1 text-xs text-red-400 flex items-center gap-1">
                                <XCircle size={12} />
                                {nameErrors[agent.id]}
                              </p>
                            )}
                          </label>

                          {/* Provider Selection */}
                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                              <Server size={12} />
                              Provider
                            </span>
                            <select
                              value={agent.provider}
                              onChange={(e) =>
                                handleProviderChange(
                                  agent.id,
                                  e.target.value as AIProvider,
                                )
                              }
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100"
                            >
                              {Object.entries(PROVIDER_INFO).map(
                                ([key, info]) => (
                                  <option key={key} value={key}>
                                    {info.name}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                        </div>

                        {/* API Key (not used for Hypercycle node nonce flow) */}
                        {agent.provider !== "hypercycle" && (
                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                              <Key size={12} />
                              API Key
                            </span>
                            <div className="relative">
                              <input
                                type={showApiKeys[agent.id] ? "text" : "password"}
                                value={agent.apiKey}
                                onChange={(e) =>
                                  updateAgent(agent.id, {
                                    apiKey: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 pr-10 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                                placeholder="sk-... or API key"
                              />
                              <button
                                type="button"
                                onClick={() => toggleApiKeyVisibility(agent.id)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-300"
                              >
                                {showApiKeys[agent.id] ? (
                                  <EyeOff size={16} />
                                ) : (
                                  <Eye size={16} />
                                )}
                              </button>
                            </div>
                          </label>
                        )}

                        {/* Model & Base URL */}
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                              <Cpu size={12} />
                              Model
                            </span>
                            {agent.provider === "custom" ||
                            agent.provider === "hypercycle" ? (
                              <>
                                <input
                                  type="text"
                                  value={agent.model}
                                  onChange={(e) =>
                                    updateAgent(agent.id, {
                                      model: e.target.value,
                                    })
                                  }
                                  className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                                  placeholder={
                                    agent.provider === "hypercycle"
                                      ? "Model id for AIM request body"
                                      : "model-name"
                                  }
                                />
                                {agent.provider === "hypercycle" && (
                                  <p className="text-xs text-gray-600 mt-1">
                                    Sent as{" "}
                                    <code className="text-gray-500">model</code>{" "}
                                    in{" "}
                                    <code className="text-gray-500">
                                      POST …/api/aim/…/request
                                    </code>{" "}
                                    JSON.
                                  </p>
                                )}
                              </>
                            ) : (
                              <select
                                value={agent.model}
                                onChange={(e) =>
                                  updateAgent(agent.id, {
                                    model: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                              >
                                {DEFAULT_MODELS[agent.provider].map((model) => (
                                  <option key={model} value={model}>
                                    {model}
                                  </option>
                                ))}
                              </select>
                            )}
                          </label>

                          {(agent.provider === "custom" ||
                            agent.provider === "ollama" ||
                            agent.provider === "hypercycle") && (
                            <label className="block">
                              <span className="text-sm text-gray-400 mb-1 block">
                                {agent.provider === "hypercycle"
                                  ? "Node base URL"
                                  : "Base URL"}
                              </span>
                              {agent.provider === "hypercycle" &&
                                agent.hypercycleBackend !== "basechain" && (
                                  <p className="text-xs text-gray-600 mb-1.5">
                                    Scheme and host only (no port here). TODA default ports: 8000 / 8006 /
                                    4001; Basechain: 8010 / 8016 / 4102.
                                  </p>
                                )}
                              <input
                                type="text"
                                value={agent.baseUrl || ""}
                                onChange={(e) =>
                                  updateAgent(agent.id, {
                                    baseUrl: e.target.value,
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 font-mono text-sm"
                                placeholder={
                                  agent.provider === "hypercycle"
                                    ? "http://207.53.252.108"
                                    : "http://localhost:11434"
                                }
                              />
                            </label>
                          )}
                        </div>

                        {agent.provider === "hypercycle" && (
                          <div className="grid grid-cols-2 gap-4">
                            <label className="block col-span-2">
                              <span className="text-sm text-gray-400 mb-1 block">Chain</span>
                              <select
                                value={agent.hypercycleBackend || "toda"}
                                onChange={(e) =>
                                  updateAgent(agent.id, {
                                    hypercycleBackend: e.target.value as HypercycleBackend,
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 text-sm"
                              >
                                <option value="toda">TODA</option>
                                <option value="basechain">Basechain</option>
                              </select>
                            </label>
                            <label className="block">
                              <span className="text-sm text-gray-400 mb-1 block">
                                Server port
                              </span>
                              <input
                                type="number"
                                min={1}
                                max={65535}
                                value={getHypercycleServerPort(agent)}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  const fb =
                                    agent.hypercycleBackend === "basechain"
                                      ? HYPERCYCLE_BASECHAIN_SERVER_PORT
                                      : HYPERCYCLE_NONCE_PORT;
                                  updateAgent(agent.id, {
                                    hypercycleServerPort: Number.isFinite(v)
                                      ? v
                                      : fb,
                                  });
                                }}
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                              />
                            </label>
                            <label className="block">
                              <span className="text-sm text-gray-400 mb-1 block">App port</span>
                              <input
                                type="number"
                                min={1}
                                max={65535}
                                value={getHypercycleAppPort(agent)}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  const fb =
                                    agent.hypercycleBackend === "basechain"
                                      ? HYPERCYCLE_BASECHAIN_APP_PORT
                                      : HYPERCYCLE_AIM_PORT;
                                  updateAgent(agent.id, {
                                    hypercycleAppPort: Number.isFinite(v)
                                      ? v
                                      : fb,
                                  });
                                }}
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                              />
                            </label>
                            <label className="block col-span-2">
                              <span className="text-sm text-gray-400 mb-1 block">AIM index</span>
                              <p className="text-xs text-gray-600 mb-1">
                                Second connection step calls{" "}
                                <code className="text-gray-500">POST {getHypercycleAimPath(agent)}</code>{" "}
                                on the app port (defaults: TODA{" "}
                                <code className="text-gray-500">0</code>, Basechain{" "}
                                <code className="text-gray-500">2</code>).
                              </p>
                              <input
                                type="number"
                                min={0}
                                max={999}
                                value={getHypercycleAimIndex(agent)}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  const fb =
                                    agent.hypercycleBackend === "basechain"
                                      ? HYPERCYCLE_AIM_INDEX_DEFAULT_BASECHAIN
                                      : HYPERCYCLE_AIM_INDEX_DEFAULT_TODA;
                                  updateAgent(agent.id, {
                                    hypercycleAimIndex: Number.isFinite(v)
                                      ? Math.max(0, Math.min(999, v))
                                      : fb,
                                  });
                                }}
                                className="w-full max-w-[12rem] px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                              />
                            </label>
                            <label className="block col-span-2">
                              <span className="text-sm text-gray-400 mb-1 block">Stream port</span>
                              <p className="text-xs text-gray-600 mb-1">
                                <code className="text-gray-500">POST /stream</code>
                              </p>
                              <input
                                type="number"
                                min={1}
                                max={65535}
                                value={getHypercycleStreamPort(agent)}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  const fb =
                                    agent.hypercycleBackend === "basechain"
                                      ? HYPERCYCLE_BASECHAIN_STREAM_PORT
                                      : HYPERCYCLE_STREAM_PORT;
                                  updateAgent(agent.id, {
                                    hypercycleStreamPort: Number.isFinite(v)
                                      ? v
                                      : fb,
                                  });
                                }}
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                              />
                            </label>
                            <div className="col-span-2">
                              <HypercycleBalancePanel key={agent.id} agent={agent} />
                            </div>
                            <label className="block col-span-2">
                              <span className="text-sm text-gray-400 mb-1 block">
                                Stream tx-sender override (optional)
                              </span>
                              <p className="text-xs text-gray-600 mb-1">
                                If POST /stream must use a different{" "}
                                <code className="text-gray-500">tx-sender</code> than nonce/AIM (e.g.{" "}
                                <code className="text-gray-500">*.hypercycle.biz.todaq.net</code>
                                ), set it here. Leave empty to reuse the TODA address above.
                              </p>
                              <input
                                type="text"
                                value={agent.hypercycleStreamTxSender || ""}
                                onChange={(e) =>
                                  updateAgent(agent.id, {
                                    hypercycleStreamTxSender: e.target.value.trim(),
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                                placeholder="Leave empty — same as nonce/AIM sender"
                              />
                            </label>
                            <label className="block col-span-2">
                              <span className="text-sm text-gray-400 mb-1 block">
                                tx-signature (optional)
                              </span>
                              {agent.hypercycleBackend === "basechain" ? (
                                <p className="text-xs text-gray-600 mb-1">
                                  Default: EIP-191 signature of the nonce with your Mosaic wallet
                                  private key. Set this field only to override (e.g. debugging).
                                </p>
                              ) : (
                                <p className="text-xs text-gray-600 mb-1">
                                  TODA micropay: placeholder until gateway requires real signing;
                                  default is a stub value.
                                </p>
                              )}
                              <input
                                type="text"
                                value={agent.hypercycleTxSignature || ""}
                                onChange={(e) =>
                                  updateAgent(agent.id, {
                                    hypercycleTxSignature: e.target.value.trim(),
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                                placeholder={
                                  agent.hypercycleBackend === "basechain"
                                    ? "Leave empty — wallet signs nonce"
                                    : "Leave empty for built-in placeholder"
                                }
                              />
                            </label>
                            <label className="block col-span-2">
                              <span className="text-sm text-gray-400 mb-1 block">
                                tx-driver (optional)
                              </span>
                              <p className="text-xs text-gray-600 mb-1">
                                Default: <code className="text-gray-500">toda_micropay</code> (TODA) or{" "}
                                <code className="text-gray-500">basechain</code> (Basechain). Override
                                if your gateway expects a different value.
                              </p>
                              <input
                                type="text"
                                value={agent.hypercycleTxDriver || ""}
                                onChange={(e) =>
                                  updateAgent(agent.id, {
                                    hypercycleTxDriver: e.target.value.trim(),
                                  })
                                }
                                className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-gray-100 font-mono text-sm"
                                placeholder="Leave empty for default"
                              />
                            </label>
                          </div>
                        )}

                        {/* Advanced Settings */}
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                              <Zap size={12} />
                              Max Tokens
                            </span>
                            <input
                              type="number"
                              value={agent.maxTokens || 4096}
                              onChange={(e) =>
                                updateAgent(agent.id, {
                                  maxTokens: parseInt(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100"
                              min={1}
                              max={128000}
                            />
                          </label>

                          <label className="block">
                            <span className="text-sm text-gray-400 mb-1 block flex items-center gap-1">
                              <Thermometer size={12} />
                              Temperature
                            </span>
                            <input
                              type="number"
                              value={agent.temperature || 0.7}
                              onChange={(e) =>
                                updateAgent(agent.id, {
                                  temperature: parseFloat(e.target.value),
                                })
                              }
                              className="w-full px-3 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100"
                              min={0}
                              max={2}
                              step={0.1}
                            />
                          </label>
                        </div>

                        {/* Rich UI Toggle */}
                        <div className="flex items-center justify-between py-3 px-1">
                          <div>
                            <span className="text-sm text-gray-300 flex items-center gap-1.5">
                              Rich Visual Responses
                              <span className="relative group">
                                <Info size={13} className="text-gray-500 cursor-help" />
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 w-64 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50 shadow-lg">
                                  Enables the agent to display data using visual elements like charts, tables, and cards instead of plain text. This may increase token usage per response. Enable on models where richer output is worth the cost.
                                </span>
                              </span>
                            </span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Render charts, tables, and cards inline in chat
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              updateAgent(agent.id, {
                                richUI: !agent.richUI,
                              })
                            }
                            className={`
                              relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0
                              ${agent.richUI ? "bg-indigo-600" : "bg-gray-700"}
                            `}
                          >
                            <span
                              className={`
                                inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                                ${agent.richUI ? "translate-x-6" : "translate-x-1"}
                              `}
                            />
                          </button>
                        </div>

                        {/* Actions Row */}
                        <div className="flex flex-col gap-2 pt-4 border-t border-gray-800">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-400">
                                Active
                              </span>
                              <button
                                type="button"
                                disabled={
                                  !agent.isActive &&
                                  agent.provider === "hypercycle" &&
                                  !hypercycleWalletReady(
                                    agent,
                                    web3EvmWallet,
                                    web3TodaOk,
                                  )
                                }
                                title={
                                  !agent.isActive &&
                                  agent.provider === "hypercycle" &&
                                  !hypercycleWalletReady(
                                    agent,
                                    web3EvmWallet,
                                    web3TodaOk,
                                  )
                                    ? agent.hypercycleBackend === "basechain"
                                      ? "Import an EVM wallet in Web3 (Base) first."
                                      : "Configure TODA Twin (hostname + API key) in Web3 first."
                                    : undefined
                                }
                                onClick={() => {
                                  if (
                                    !agent.isActive &&
                                    agent.provider === "hypercycle" &&
                                    !hypercycleWalletReady(
                                      agent,
                                      web3EvmWallet,
                                      web3TodaOk,
                                    )
                                  ) {
                                    toast.warning(
                                      agent.hypercycleBackend === "basechain"
                                        ? "Import an EVM wallet in Web3 (Base) before activating this agent."
                                        : "Configure TODA Twin in Web3 before activating this agent.",
                                    );
                                    return;
                                  }
                                  updateAgent(agent.id, {
                                    isActive: !agent.isActive,
                                  });
                                }}
                                className={`
                                relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                                disabled:opacity-40 disabled:cursor-not-allowed
                                ${
                                  agent.isActive
                                    ? "bg-emerald-600"
                                    : "bg-gray-700"
                                }
                              `}
                              >
                                <span
                                  className={`
                                inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                                ${
                                  agent.isActive
                                    ? "translate-x-6"
                                    : "translate-x-1"
                                }
                              `}
                                />
                              </button>
                            </div>

                          <button
                            onClick={() => testConnection(agent)}
                            disabled={
                              testResult.status === "testing" ||
                              (providerRequiresApiKeyForConnectionTest(
                                agent.provider,
                              ) &&
                                !agent.apiKey?.trim())
                            }
                            className={`
                              flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-medium
                              ${
                                testResult.status === "testing"
                                  ? "bg-gray-800 text-gray-400 cursor-not-allowed"
                                  : testResult.status === "success"
                                    ? "bg-emerald-900/30 text-emerald-400 border border-emerald-500/30"
                                    : testResult.status === "error"
                                      ? "bg-red-900/30 text-red-400 border border-red-500/30"
                                      : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                              }
                            `}
                          >
                            {testResult.status === "testing" ? (
                              <>
                                <Loader2 size={14} className="animate-spin" />
                                Testing...
                              </>
                            ) : (
                              <>
                                <TestTube size={14} />
                                Test Connection
                              </>
                            )}
                          </button>
                          </div>
                          {agent.provider === "hypercycle" &&
                            !agent.isActive &&
                            !hypercycleWalletReady(
                              agent,
                              web3EvmWallet,
                              web3TodaOk,
                            ) && (
                              <p className="text-xs text-amber-600/90">
                                {agent.hypercycleBackend === "basechain"
                                  ? "Import an EVM wallet in Web3 (Base) to activate this agent."
                                  : "Configure TODA Twin (hostname + API key) in Web3 to activate this agent."}
                              </p>
                            )}
                        </div>

                        {/* Test Result Message */}
                        {testResult.message && (
                          <p
                            className={`text-sm ${
                              testResult.status === "success"
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {testResult.message}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Hypercycle Nodes Section */}
        <section
          id="nodes"
          ref={nodesSectionRef}
          className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-indigo-400 flex items-center gap-2">
              <Server size={20} />
              Hypercycle Nodes
            </h2>
            <button
              onClick={addNewNode}
              disabled={nodes.length >= MAX_NODES}
              className={`flex items-center gap-2 px-4 py-2 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 border border-indigo-500/30 rounded-lg transition-all hover:scale-[1.02] ${
                nodes.length >= MAX_NODES ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <Plus size={16} />
              <span className="text-xs font-bold tracking-wider uppercase">
                Add Node
              </span>
            </button>
          </div>

          {nodes.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-gray-700 rounded-xl">
              <Server className="mx-auto size-12 text-gray-600 mb-4" />
              <p className="text-gray-500 mb-2">No nodes configured</p>
              <p className="text-sm text-gray-600">
                Add a Hypercycle Node to manage your network
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {nodes.map((node) => {
                const status = nodeStatuses[node.id];
                const isLive = status?.isLive ?? false;

                // Determine status color (same as sidebar)
                let statusColor = "bg-gray-500"; // Inactive/default
                if (node.isActive) {
                  if (!node.apiHost) {
                    statusColor = "bg-yellow-500"; // Not configured
                  } else if (isLive) {
                    statusColor = "bg-emerald-500"; // Live
                  } else if (status?.lastChecked) {
                    statusColor = "bg-red-500"; // Offline
                  } else {
                    statusColor = "bg-yellow-500"; // Pending check
                  }
                }

                return (
                  <div
                    key={node.id}
                    className={`bg-gray-900/30 border rounded-xl overflow-hidden 
                      ${
                        expandedNode === node.id
                          ? "border-indigo-500/50 bg-gray-950/50 glow-primary"
                          : "border-gray-800 bg-gray-900/30 hover:border-gray-700 hover:border-gray-700 "
                      }`}
                  >
                    {/* Node Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:border-gray-700 transition-colors"
                      onClick={() =>
                        setExpandedNode(
                          expandedNode === node.id ? null : node.id,
                        )
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${statusColor}`}
                        />
                        <span className="text-gray-200 font-medium">
                          {node.name}
                        </span>
                        <span className="text-xs text-gray-500">
                          {node.apiHost
                            ? `${node.apiHost}:${node.apiPort || "8000"}`
                            : "Not configured"}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNodeHandler(node.id);
                        }}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {/* Expanded Node Form */}
                    {expandedNode === node.id && (
                      <div className="p-4 border-t border-gray-700 space-y-4">
                        {/* Node Name */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">
                            Node Name
                          </label>
                          <input
                            type="text"
                            value={node.name}
                            onChange={(e) =>
                              updateNodeHandler(node.id, {
                                name: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100"
                            placeholder="My Node"
                          />
                        </div>

                        {/* Main API */}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1">
                            Main API (Port 8000)
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={node.apiHost}
                              onChange={(e) =>
                                updateNodeHandler(node.id, {
                                  apiHost: e.target.value,
                                })
                              }
                              className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100"
                              placeholder="192.168.1.100 or localhost"
                            />
                            <input
                              type="text"
                              value={node.apiPort || ""}
                              onChange={(e) =>
                                updateNodeHandler(node.id, {
                                  apiPort: e.target.value,
                                })
                              }
                              className="w-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100"
                              placeholder="8000"
                            />
                          </div>
                        </div>

                        {/* Admin Panel Toggle */}
                        <div className="flex items-center justify-between py-2">
                          <div>
                            <span className="text-gray-200 font-medium block">
                              Enable Admin Panel
                            </span>
                            <p className="text-sm text-gray-500">
                              Configure admin panel access (Port 8006)
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              updateNodeHandler(node.id, {
                                hasAdminPanel: !node.hasAdminPanel,
                              })
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              node.hasAdminPanel
                                ? "bg-indigo-600"
                                : "bg-gray-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                                node.hasAdminPanel
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>

                        {/* Admin Panel URL (if enabled) */}
                        {node.hasAdminPanel && (
                          <div>
                            <label className="block text-sm text-gray-400 mb-1">
                              Admin Panel (Port 8006)
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={node.adminHost || ""}
                                onChange={(e) =>
                                  updateNodeHandler(node.id, {
                                    adminHost: e.target.value,
                                  })
                                }
                                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100"
                                placeholder="192.168.1.100 or localhost"
                              />
                              <input
                                type="text"
                                value={node.adminPort || ""}
                                onChange={(e) =>
                                  updateNodeHandler(node.id, {
                                    adminPort: e.target.value,
                                  })
                                }
                                className="w-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-100"
                                placeholder="8006"
                              />
                            </div>
                          </div>
                        )}

                        {/* Active Toggle */}
                        <div className="flex items-center justify-between py-2 border-t border-gray-700 pt-4">
                          <div>
                            <span className="text-gray-200 font-medium block">
                              Node Active
                            </span>
                            <p className="text-sm text-gray-500">
                              Enable or disable this node
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              updateNodeHandler(node.id, {
                                isActive: !node.isActive,
                              })
                            }
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              node.isActive ? "bg-emerald-600" : "bg-gray-700"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out ${
                                node.isActive
                                  ? "translate-x-6"
                                  : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Interface Section */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400 flex items-center gap-2">
            <Layout size={20} />
            Interface Settings
          </h2>
          <div className="space-y-4">
            <div>
              <span className="text-gray-200 font-medium block">Theme</span>
              <p className="text-sm text-gray-500 mb-3">
                Choose a color theme. Changes apply instantly and persist across
                restarts.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {themes.map((theme) => (
                  <button
                    key={theme.key}
                    onClick={() => setThemeKey(theme.key as ThemeKey)}
                    className={`w-full text-left rounded-lg p-4 border transition-all backdrop-blur-sm hover:scale-[1.01]
                      ${
                        themeKey === theme.key
                          ? "border-indigo-500/50 ring-2 ring-indigo-500/30"
                          : "border-gray-800"
                      }
                    `}
                    style={{
                      backgroundColor: "var(--surface)",
                      color: "var(--text)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="text-lg font-semibold">
                          {theme.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {theme.description}
                        </div>
                      </div>
                      {themeKey === theme.key && (
                        <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(
                        [
                          "background",
                          "surface",
                          "accent",
                          "primary",
                          "warning",
                          "success",
                        ] as const
                      ).map((token) => (
                        <span
                          key={token}
                          className="h-8 w-8 rounded-lg border border-white/10"
                          style={{ backgroundColor: theme.colors[token] }}
                          title={token}
                        />
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-200 font-medium block">
                  Classic Navigation Bar
                </span>
                <p className="text-sm text-gray-500">
                  Show the traditional top address bar. Disabled by default for
                  immersion.
                </p>
              </div>
              <button
                onClick={() => setShowUrlBar && setShowUrlBar(!showUrlBar)}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900
                  ${showUrlBar ? "bg-indigo-600" : "bg-gray-700"}
                `}
              >
                <span
                  className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                  ${showUrlBar ? "translate-x-6" : "translate-x-1"}
                `}
                />
              </button>
            </div>

            {/* Title Bar Style Setting */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <div>
                <span className="text-gray-200 font-medium block">
                  Window Title Bar
                </span>
                <p className="text-sm text-gray-500">
                  Hidden shows styled controls. Default uses native OS title
                  bar.
                </p>
              </div>
              <div className="flex bg-gray-950 rounded-lg p-1 border border-gray-700">
                <button
                  onClick={async () => {
                    if (updateSettings.titleBarStyle === "hidden") return;

                    const result =
                      await window.electronAPI?.showTitleBarConfirm?.();
                    if (!result || result.buttonIndex === 2) return;

                    await handleUpdateSettingChange("titleBarStyle", "hidden");

                    if (result.buttonIndex === 0) {
                      window.electronAPI?.restartWindow?.();
                    } else {
                      toast.info("Change will apply on next restart");
                    }
                  }}
                  className={`
                    px-3 py-1.5 rounded-md text-sm font-medium transition-all
                    ${
                      updateSettings.titleBarStyle !== "default"
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-200"
                    }
                  `}
                >
                  Hidden
                </button>
                <button
                  onClick={async () => {
                    if (updateSettings.titleBarStyle === "default") return;

                    const result =
                      await window.electronAPI?.showTitleBarConfirm?.();
                    if (!result || result.buttonIndex === 2) return;

                    await handleUpdateSettingChange("titleBarStyle", "default");

                    if (result.buttonIndex === 0) {
                      window.electronAPI?.restartWindow?.();
                    } else {
                      toast.info("Change will apply on next restart");
                    }
                  }}
                  className={`
                    px-3 py-1.5 rounded-md text-sm font-medium transition-all
                    ${
                      updateSettings.titleBarStyle === "default"
                        ? "bg-gray-800 text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-200"
                    }
                  `}
                >
                  Default
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Startup Section */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400">
            On Startup
          </h2>
          <div className="space-y-4">
            <label className="block">
              <span className="text-gray-200 font-medium">
                Default Landing URL
              </span>
              <p className="text-sm text-gray-500 mb-2">
                The page that opens when you click Home or open a new tab.
              </p>
              <input
                type="text"
                value={homeUrl}
                onChange={(e) => setHomeUrl(e.target.value)}
                className="w-full max-w-lg px-4 py-2 bg-gray-950 border border-gray-700 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-gray-100 placeholder-gray-600"
                placeholder="browser://home"
              />
            </label>

            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <div>
                <span className="text-gray-200 font-medium block">
                  Replay Onboarding
                </span>
                <p className="text-sm text-gray-500">
                  Open the welcome flow again to review features and setup.
                </p>
              </div>
              <button
                onClick={() => onReopenOnboarding?.()}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Open Onboarding
              </button>
            </div>
          </div>
        </section>

        {/* Updates Section */}
        <section className="bg-gray-900/50 p-6 rounded-xl border border-gray-800 backdrop-blur-sm">
          <h2 className="text-xl font-semibold mb-4 text-indigo-400">
            Updates
          </h2>
          <div className="space-y-4">
            {/* Check for Updates Button */}
            <div className="flex items-center justify-between">
              <div>
                <span className="text-gray-200 font-medium block">
                  Software Updates
                </span>
                <p className="text-sm text-gray-500">
                  Check if a new version of Mosaic Companion is available.
                </p>
              </div>
              <button
                onClick={() => {
                  if (window.electronAPI?.checkForUpdates) {
                    window.electronAPI.checkForUpdates();
                  }
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900"
              >
                Check for Updates
              </button>
            </div>

            {/* Auto-download Toggle */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <div>
                <span className="text-gray-200 font-medium block">
                  Download updates automatically
                </span>
                <p className="text-sm text-gray-500">
                  Download new versions in the background without asking.
                </p>
              </div>
              <button
                onClick={() =>
                  handleUpdateSettingChange(
                    "autoDownload",
                    !updateSettings.autoDownload,
                  )
                }
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900
                  ${
                    updateSettings.autoDownload
                      ? "bg-indigo-600"
                      : "bg-gray-700"
                  }
                `}
              >
                <span
                  className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                  ${
                    updateSettings.autoDownload
                      ? "translate-x-6"
                      : "translate-x-1"
                  }
                `}
                />
              </button>
            </div>

            {/* Auto-display media Toggle */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-800">
              <div>
                <span className="text-gray-200 font-medium block">
                  Auto-display tool media
                </span>
                <p className="text-sm text-gray-500">
                  When enabled, images generated by AI tools (e.g. HyperInsight, AIM nodes) are shown
                  inline immediately. When disabled (default), a confirmation prompt appears first.
                </p>
              </div>
              <button
                onClick={async () => {
                  const next = !autoDisplayMedia;
                  try {
                    const result = await (window as any).electronAPI?.media?.setAutoDisplay?.(next);
                    if (result?.success !== false) {
                      setAutoDisplayMediaState(next);
                      toast.success("Settings saved");
                    } else {
                      toast.error(result?.error || "Failed to save media setting");
                    }
                  } catch (e) {
                    toast.error("Failed to save media setting");
                  }
                }}
                className={`
                  relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900 shrink-0
                  ${autoDisplayMedia ? "bg-indigo-600" : "bg-gray-700"}
                `}
              >
                <span
                  className={`
                  inline-block h-4 w-4 transform rounded-full bg-white transition duration-200 ease-in-out
                  ${autoDisplayMedia ? "translate-x-6" : "translate-x-1"}
                `}
                />
              </button>
            </div>
          </div>
        </section>


        <section>
          <GmailClient />
        </section>

        {/* Save Button */}
        <div className="flex justify-end pt-8">
          <button className="flex items-center gap-2 px-6 py-2 bg-green-600/10 text-green-400 border border-green-600/30 rounded-lg font-mono text-xs tracking-widest hover:bg-green-600/20 transition-colors">
            <Save size={14} />
            CONFIGURATION_SYNCED
          </button>
        </div>
      </div>
    </div>
  );
};
