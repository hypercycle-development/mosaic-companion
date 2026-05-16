import React, { useCallback, useState, useRef, useEffect } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import {
  Rocket,
  Play,
  Send,
  ChevronRight,
  X,
  Save,
  RotateCcw,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
} from "lucide-react";
import { ideAgentForge } from "../../services/stargate/integrations";
import { fleetChronicleLogger } from "../../services/stargate/integrations";
import type {
  AgentForgeSession,
  AgentTemplate,
  ForgeDeployConfig,
  ForgeStatus,
} from "./types";

interface AgentForgePanelProps {
  session: AgentForgeSession;
  onClose: () => void;
  onUpdateSession: (session: AgentForgeSession) => void;
  onOpenFile: (path: string) => void;
}

const statusColor: Record<ForgeStatus, string> = {
  draft: "text-gray-400",
  compiling: "text-yellow-400",
  testing: "text-yellow-400",
  ready: "text-green-400",
  deployed: "text-cyan-400",
  failed: "text-red-400",
};

const statusLabel: Record<ForgeStatus, string> = {
  draft: "Draft",
  compiling: "Compiling...",
  testing: "Testing...",
  ready: "Ready",
  deployed: "Deployed",
  failed: "Failed",
};

export default function AgentForgePanel({
  session,
  onClose,
  onUpdateSession,
  onOpenFile,
}: AgentForgePanelProps) {
  const editorRef = useRef<any>(null);
  const [code, setCode] = useState(session.code);
  const [testOutput, setTestOutput] = useState(session.testOutput ?? "");
  const [status, setStatus] = useState<ForgeStatus>(session.status);
  const [isTesting, setIsTesting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployConfig, setDeployConfig] = useState<ForgeDeployConfig>({
    autoStart: true,
    enableWallet: false,
    tier: "standard",
  });
  const [deployResult, setDeployResult] = useState<{
    success: boolean;
    nodeId?: string;
    taskId?: string;
    error?: string;
  } | null>(null);
  const [showDeployForm, setShowDeployForm] = useState(false);
  const [logs, setLogs] = useState(session.chronicleEvents ?? []);

  const template = ideAgentForge.getTemplate(session.templateId);

  // Sync when session prop changes
  useEffect(() => {
    setCode(session.code);
    setStatus(session.status);
    setTestOutput(session.testOutput ?? "");
    setLogs(session.chronicleEvents ?? []);
  }, [session.id, session.status]);

  const logEvent = useCallback(
    (event: string, s: ForgeStatus, detail?: string) => {
      const entry = {
        id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        event,
        status: s === "ready" || s === "deployed" ? ("success" as const) : s === "failed" ? ("failed" as const) : ("info" as const),
        detail,
      };
      setLogs((prev) => [...prev, entry]);
      // Push to chronicle
      fleetChronicleLogger.logIDE(session.id, event, entry.status, detail);
    },
    [session.id],
  );

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor;
    editor.focus();
  }, []);

  const handleChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
      setStatus("draft");
    }
  }, []);

  const handleSave = useCallback(() => {
    ideAgentForge.updateCode(session.id, code);
    logEvent("Code saved", "draft", `Updated ${template?.fileName}`);
    // Write to file
    window.electronAPI.ide.fs
      .writeFile(session.filePath, code)
      .then((result) => {
        if (result.success) {
          logEvent("File written", "draft", session.filePath);
        }
      });
  }, [session.id, code, session.filePath, template, logEvent]);

  const handleTest = useCallback(async () => {
    setIsTesting(true);
    setStatus("testing");
    logEvent("Test started", "testing");

    try {
      // Persist code first
      ideAgentForge.updateCode(session.id, code);

      // Run test through the service
      const result = await ideAgentForge.runTest(session.id);

      setTestOutput(result.output);
      setStatus(result.success ? "ready" : "failed");
      logEvent(
        result.success ? "Test passed" : "Test failed",
        result.success ? "ready" : "failed",
        result.output,
      );

      // Sync back
      const updated = ideAgentForge.getSession(session.id);
      if (updated) onUpdateSession(updated);
    } catch (e: any) {
      setStatus("failed");
      setTestOutput(`Test error: ${e.message}`);
      logEvent("Test error", "failed", e.message);
    } finally {
      setIsTesting(false);
    }
  }, [session.id, code, logEvent, onUpdateSession]);

  const handleDeploy = useCallback(async () => {
    setIsDeploying(true);
    logEvent("Deploy started", "testing");

    try {
      // Update code before deploy
      ideAgentForge.updateCode(session.id, code);

      const result = await ideAgentForge.deployToFleet(session.id, deployConfig);
      setDeployResult(result);

      if (result.success) {
        setStatus("deployed");
        logEvent(
          "Deploy success",
          "deployed",
          `Node: ${result.nodeId || "local"} | Task: ${result.taskId}`,
        );
      } else {
        setStatus("failed");
        logEvent("Deploy failed", "failed", result.error);
      }

      const updated = ideAgentForge.getSession(session.id);
      if (updated) onUpdateSession(updated);
    } catch (e: any) {
      setStatus("failed");
      setDeployResult({ success: false, error: e.message });
      logEvent("Deploy error", "failed", e.message);
    } finally {
      setIsDeploying(false);
    }
  }, [session.id, code, deployConfig, logEvent, onUpdateSession]);

  const handleReset = useCallback(() => {
    if (!template) return;
    setCode(template.defaultCode);
    setStatus("draft");
    setTestOutput("");
    setDeployResult(null);
    ideAgentForge.updateCode(session.id, template.defaultCode);
    logEvent("Reset to template", "draft");
  }, [session.id, template, logEvent]);

  const handleOpenInEditor = useCallback(() => {
    // Save to disk first
    window.electronAPI.ide.fs
      .writeFile(session.filePath, code)
      .then((result) => {
        if (result.success) {
          onOpenFile(session.filePath);
        }
      });
  }, [session.filePath, code, onOpenFile]);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100 border-l border-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Rocket size={14} className="text-cyan-400" />
          <span className="text-sm font-semibold text-gray-200">Agent Forge</span>
          <span className="text-xs text-gray-500">|</span>
          <span className="text-xs text-gray-400 truncate max-w-[120px]">
            {template?.name ?? session.templateId}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200"
        >
          <X size={14} />
        </button>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 border-b border-gray-800 text-xs">
        <span className={statusColor[status]}>
          {status === "testing" && <Loader2 size={12} className="inline animate-spin mr-1" />}
          {status === "deployed" && <CheckCircle2 size={12} className="inline mr-1" />}
          {status === "failed" && <AlertCircle size={12} className="inline mr-1" />}
          {statusLabel[status]}
        </span>
        <span className="text-gray-600">|</span>
        <span className="text-gray-500">
          {template?.fileName}
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-gray-900 border-b border-gray-800">
        <button
          onClick={handleSave}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 transition-colors"
          title="Save code to session"
        >
          <Save size={12} />
          Save
        </button>
        <button
          onClick={handleTest}
          disabled={isTesting || isDeploying}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 transition-colors disabled:opacity-50"
          title="Run tests"
        >
          {isTesting ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          Test
        </button>
        <button
          onClick={() => setShowDeployForm((v) => !v)}
          disabled={isTesting || isDeploying || status === "testing"}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-cyan-600/20 text-cyan-400 hover:bg-cyan-600/30 transition-colors disabled:opacity-50"
          title="Deploy agent"
        >
          {isDeploying ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
          Deploy
        </button>
        <div className="flex-1" />
        <button
          onClick={handleReset}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200"
          title="Reset to template"
        >
          <RotateCcw size={12} />
        </button>
        <button
          onClick={handleOpenInEditor}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200"
          title="Open in main editor"
        >
          <ChevronRight size={12} />
        </button>
      </div>

      {/* Deploy config form */}
      {showDeployForm && (
        <div className="px-3 py-2 bg-gray-900/80 border-b border-gray-800 space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <label className="text-gray-400 w-20">Node ID</label>
            <input
              type="text"
              value={deployConfig.nodeId ?? ""}
              onChange={(e) =>
                setDeployConfig((prev) => ({
                  ...prev,
                  nodeId: e.target.value || undefined,
                }))
              }
              placeholder="Leave empty for local deploy"
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-400 w-20">Tier</label>
            <select
              value={deployConfig.tier}
              onChange={(e) =>
                setDeployConfig((prev) => ({
                  ...prev,
                  tier: e.target.value as ForgeDeployConfig["tier"],
                }))
              }
              className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-gray-200 focus:outline-none focus:border-cyan-500"
            >
              <option value="basic">Basic</option>
              <option value="standard">Standard</option>
              <option value="advanced">Advanced</option>
              <option value="premium">Premium</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-400 w-20">Auto-start</label>
            <input
              type="checkbox"
              checked={deployConfig.autoStart}
              onChange={(e) =>
                setDeployConfig((prev) => ({
                  ...prev,
                  autoStart: e.target.checked,
                }))
              }
              className="accent-cyan-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-400 w-20">Wallet</label>
            <input
              type="checkbox"
              checked={deployConfig.enableWallet}
              onChange={(e) =>
                setDeployConfig((prev) => ({
                  ...prev,
                  enableWallet: e.target.checked,
                }))
              }
              className="accent-cyan-500"
            />
          </div>
          <button
            onClick={handleDeploy}
            disabled={isDeploying}
            className="w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs bg-cyan-600 hover:bg-cyan-500 text-white transition-colors disabled:opacity-50"
          >
            {isDeploying ? <Loader2 size={12} className="animate-spin" /> : <Rocket size={12} />}
            Confirm Deploy
          </button>
        </div>
      )}

      {/* Monaco editor */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <Editor
          key={session.id}
          height="100%"
          language="typescript"
          value={code}
          theme="vs-dark"
          onChange={handleChange}
          onMount={handleMount}
          options={{
            fontSize: 12,
            fontFamily:
              "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            lineNumbers: "on",
            renderWhitespace: "selection",
            bracketPairColorization: { enabled: true },
            smoothScrolling: true,
            padding: { top: 8 },
            tabSize: 2,
            automaticLayout: true,
            readOnly: isTesting || isDeploying,
          }}
        />
      </div>

      {/* Output / Test results */}
      {(testOutput || deployResult) && (
        <div className="flex-shrink-0 max-h-[200px] overflow-auto bg-gray-900 border-t border-gray-800">
          <div className="flex items-center gap-1 px-3 py-1 bg-gray-900 border-b border-gray-800 text-xs text-gray-400">
            <Terminal size={12} />
            Output
          </div>
          <pre className="px-3 py-2 text-xs font-mono text-gray-300 whitespace-pre-wrap">
            {testOutput}
            {deployResult && (
              <>
                {"\n"}
                {deployResult.success
                  ? `Deployed to ${deployResult.nodeId || "local"} (task ${deployResult.taskId})`
                  : `Deploy failed: ${deployResult.error}`}
              </>
            )}
          </pre>
        </div>
      )}

      {/* Chronicle log stream */}
      <div className="flex-shrink-0 max-h-[160px] overflow-auto bg-gray-950 border-t border-gray-800">
        <div className="flex items-center gap-1 px-3 py-1 bg-gray-900 border-b border-gray-800 text-xs text-gray-400 sticky top-0">
          <Clock size={12} />
          Chronicle Log
        </div>
        <div className="px-2 py-1 space-y-0.5">
          {logs.length === 0 && (
            <div className="text-xs text-gray-600 italic px-1 py-1">No events yet...</div>
          )}
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex items-start gap-2 text-xs px-1 py-0.5 rounded hover:bg-white/5"
            >
              <span className="text-gray-600 whitespace-nowrap">
                {new Date(log.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={
                  log.status === "success"
                    ? "text-green-400"
                    : log.status === "failed"
                    ? "text-red-400"
                    : log.status === "warning"
                    ? "text-yellow-400"
                    : "text-gray-400"
                }
              >
                {log.status === "success" && <CheckCircle2 size={10} className="inline mr-1" />}
                {log.status === "failed" && <AlertCircle size={10} className="inline mr-1" />}
                {log.event}
              </span>
              {log.detail && (
                <span className="text-gray-500 truncate">{log.detail}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
