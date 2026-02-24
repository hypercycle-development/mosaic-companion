import React, { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Play,
  Square,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Wrench,
  Database,
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  Terminal,
  Globe,
} from "lucide-react";

// =============================================================================
// Types (mirror MCPAPI.ts for renderer use)
// =============================================================================

interface MCPPlugin {
  id: string;
  name: string;
  description?: string;
  transport: "stdio" | "http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  apiKey?: string;
  autoConnect?: boolean;
}

interface MCPTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface MCPServer {
  name: string;
  transport: string;
  initialized: boolean;
  tools: MCPTool[];
  resources: { uri: string; name?: string; description?: string }[];
  prompts: { name: string; description?: string }[];
}

// =============================================================================
// Sub-components
// =============================================================================

const StatusDot: React.FC<{ connected: boolean }> = ({ connected }) => (
  <span
    className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${
      connected ? "bg-green-400" : "bg-gray-600"
    }`}
  />
);

const SectionHeader: React.FC<{ title: string; count?: number }> = ({
  title,
  count,
}) => (
  <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
    <span>{title}</span>
    {count !== undefined && (
      <span className="text-gray-600">({count})</span>
    )}
  </div>
);

// =============================================================================
// Add Plugin Form
// =============================================================================

const defaultPlugin: Omit<MCPPlugin, "id"> = {
  name: "",
  transport: "stdio",
  command: "",
  args: [],
  description: "",
  autoConnect: false,
};

const AddPluginForm: React.FC<{
  onAdd: (plugin: Omit<MCPPlugin, "id">) => void;
  onCancel: () => void;
}> = ({ onAdd, onCancel }) => {
  const [form, setForm] = useState({ ...defaultPlugin, argsStr: "" });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const plugin: Omit<MCPPlugin, "id"> = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      transport: form.transport,
      autoConnect: form.autoConnect,
      ...(form.transport === "stdio"
        ? {
            command: form.command?.trim() || "",
            args: form.argsStr
              ? form.argsStr.split(" ").map((s) => s.trim()).filter(Boolean)
              : [],
          }
        : {
            url: form.url?.trim() || "",
            apiKey: form.apiKey?.trim() || undefined,
          }),
    };
    onAdd(plugin);
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 space-y-2 border-b border-gray-800">
      <p className="text-xs font-semibold text-gray-400 mb-2">Add Plugin</p>

      <input
        type="text"
        placeholder="Name *"
        value={form.name}
        onChange={(e) => set("name", e.target.value)}
        className="w-full px-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
        required
      />
      <input
        type="text"
        placeholder="Description"
        value={form.description}
        onChange={(e) => set("description", e.target.value)}
        className="w-full px-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => set("transport", "stdio")}
          className={`flex-1 py-1 text-xs rounded border transition-colors ${
            form.transport === "stdio"
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
          }`}
        >
          <Terminal size={12} className="inline mr-1" />
          stdio
        </button>
        <button
          type="button"
          onClick={() => set("transport", "http")}
          className={`flex-1 py-1 text-xs rounded border transition-colors ${
            form.transport === "http"
              ? "bg-indigo-600 border-indigo-500 text-white"
              : "bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500"
          }`}
        >
          <Globe size={12} className="inline mr-1" />
          http
        </button>
      </div>

      {form.transport === "stdio" ? (
        <>
          <input
            type="text"
            placeholder="Command (e.g. npx)"
            value={form.command}
            onChange={(e) => set("command", e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="text"
            placeholder="Args (space-separated)"
            value={form.argsStr}
            onChange={(e) => set("argsStr", e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </>
      ) : (
        <>
          <input
            type="text"
            placeholder="URL (e.g. http://localhost:8000/mcp)"
            value={(form as any).url || ""}
            onChange={(e) => set("url", e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
          <input
            type="password"
            placeholder="API Key (optional)"
            value={(form as any).apiKey || ""}
            onChange={(e) => set("apiKey", e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-gray-800 border border-gray-700 rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-500"
          />
        </>
      )}

      <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
        <input
          type="checkbox"
          checked={form.autoConnect}
          onChange={(e) => set("autoConnect", e.target.checked)}
          className="accent-indigo-500"
        />
        Auto-connect on startup
      </label>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          className="flex-1 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded transition-colors"
        >
          Add
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-1.5 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// =============================================================================
// Tool Runner
// =============================================================================

const ToolRunner: React.FC<{
  tool: MCPTool;
  serverName: string;
  onClose: () => void;
}> = ({ tool, serverName, onClose }) => {
  const [argsJson, setArgsJson] = useState("{}");
  const [running, setRunning] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleRun = async () => {
    const api = (window as any).electronAPI?.mcpAPI;
    if (!api) return;

    let args: Record<string, unknown>;
    try {
      args = JSON.parse(argsJson);
    } catch {
      setOutput("Invalid JSON in arguments");
      setIsError(true);
      return;
    }

    setRunning(true);
    setOutput(null);
    setIsError(false);

    try {
      const res = await api.callTool(serverName, tool.name, args);
      if (res.success && res.result) {
        const content = res.result.content
          .map((c: { type: string; text?: string; data?: string; uri?: string; mimeType?: string }) => {
            if (c.type === "text") return c.text || "";
            if (c.type === "image") return `[Image: ${c.mimeType}]`;
            if (c.type === "resource") return `[Resource: ${c.uri}]`;
            return JSON.stringify(c);
          })
          .join("\n");
        setOutput(content || "(empty result)");
        setIsError(!!res.result.isError);
      } else {
        setOutput(res.error || "Unknown error");
        setIsError(true);
      }
    } catch (e) {
      setOutput((e as Error).message);
      setIsError(true);
    } finally {
      setRunning(false);
    }
  };

  // Build arg fields from inputSchema if available
  const schema = tool.inputSchema as {
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  } | undefined;

  const properties = schema?.properties ?? {};
  const required = schema?.required ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div>
          <h3 className="text-sm font-semibold text-gray-100">{tool.name}</h3>
          {tool.description && (
            <p className="text-xs text-gray-500 mt-0.5">{tool.description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-600 hover:text-gray-300 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Schema hints */}
        {Object.keys(properties).length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-gray-500 font-medium">Parameters</p>
            {Object.entries(properties).map(([key, prop]) => (
              <div key={key} className="flex items-start gap-2 text-xs">
                <span
                  className={`font-mono ${
                    required.includes(key) ? "text-indigo-400" : "text-gray-400"
                  }`}
                >
                  {key}
                  {required.includes(key) ? "*" : ""}
                </span>
                <span className="text-gray-600">
                  {prop.type && `(${prop.type})`} {prop.description}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* JSON args editor */}
        <div>
          <p className="text-xs text-gray-500 font-medium mb-1">
            Arguments (JSON)
          </p>
          <textarea
            value={argsJson}
            onChange={(e) => setArgsJson(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 text-xs font-mono bg-gray-800 border border-gray-700 rounded text-gray-200 focus:outline-none focus:border-indigo-500 resize-none"
            spellCheck={false}
          />
        </div>

        <button
          onClick={handleRun}
          disabled={running}
          className="w-full flex items-center justify-center gap-2 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm rounded transition-colors"
        >
          {running ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Play size={14} />
          )}
          {running ? "Running…" : "Run Tool"}
        </button>

        {/* Output */}
        {output !== null && (
          <div
            className={`rounded border p-3 ${
              isError
                ? "border-red-800 bg-red-950/40"
                : "border-gray-700 bg-gray-800"
            }`}
          >
            <p
              className={`text-xs font-medium mb-1 ${
                isError ? "text-red-400" : "text-green-400"
              }`}
            >
              {isError ? "Error" : "Result"}
            </p>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap break-words font-mono">
              {output}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};

// =============================================================================
// Main MCPPage
// =============================================================================

export const MCPPage: React.FC = () => {
  const [plugins, setPlugins] = useState<MCPPlugin[]>([]);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"tools" | "resources" | "prompts">(
    "tools",
  );
  const [selectedTool, setSelectedTool] = useState<MCPTool | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  const api = (window as any).electronAPI?.mcpAPI;

  const loadPlugins = useCallback(async () => {
    if (!api) return;
    try {
      const list = await api.listPlugins();
      setPlugins(list);
    } catch (e) {
      console.error("Failed to load plugins:", e);
    }
  }, [api]);

  const loadServers = useCallback(async () => {
    if (!api) return;
    try {
      const list = await api.listServers();
      setServers(list);
    } catch (e) {
      console.error("Failed to load servers:", e);
    }
  }, [api]);

  useEffect(() => {
    loadPlugins();
    loadServers();

    if (!api) return;

    const offConnected = api.onServerConnected(() => loadServers());
    const offDisconnected = api.onServerDisconnected(() => loadServers());

    return () => {
      offConnected();
      offDisconnected();
    };
  }, [loadPlugins, loadServers]);

  const handleAddPlugin = async (plugin: Omit<MCPPlugin, "id">) => {
    if (!api) return;
    try {
      await api.addPlugin(plugin);
      await loadPlugins();
      setShowAddForm(false);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleRemovePlugin = async (id: string) => {
    if (!api) return;
    try {
      await api.removePlugin(id);
      await loadPlugins();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleConnect = async (plugin: MCPPlugin) => {
    if (!api) return;
    setConnecting((c) => ({ ...c, [plugin.id]: true }));
    setError(null);
    try {
      const res = await api.connectPlugin(plugin.id);
      if (!res.success) setError(res.error ?? "Connection failed");
      await loadServers();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting((c) => ({ ...c, [plugin.id]: false }));
    }
  };

  const handleDisconnect = async (plugin: MCPPlugin) => {
    if (!api) return;
    setConnecting((c) => ({ ...c, [plugin.id]: true }));
    try {
      await api.disconnectPlugin(plugin.id);
      await loadServers();
      if (selectedServer === plugin.name) {
        setSelectedServer(null);
        setSelectedTool(null);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setConnecting((c) => ({ ...c, [plugin.id]: false }));
    }
  };

  const isServerConnected = (pluginName: string) =>
    servers.some((s) => s.name === pluginName);

  const currentServer = servers.find((s) => s.name === selectedServer);

  return (
    <div className="flex h-full bg-gray-950 text-gray-100 overflow-hidden">
      {/* ===== Left Panel: Plugins ===== */}
      <div className="w-64 flex-shrink-0 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-gray-200">MCP Servers</h2>
          <div className="flex items-center gap-1">
            <button
              onClick={loadServers}
              title="Refresh"
              className="p-1 text-gray-500 hover:text-gray-300 rounded transition-colors"
            >
              <RefreshCw size={13} />
            </button>
            <button
              onClick={() => setShowAddForm((v) => !v)}
              title="Add plugin"
              className="p-1 text-gray-500 hover:text-indigo-400 rounded transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>

        {showAddForm && (
          <AddPluginForm
            onAdd={handleAddPlugin}
            onCancel={() => setShowAddForm(false)}
          />
        )}

        {error && (
          <div className="mx-3 mt-2 p-2 text-xs text-red-400 bg-red-950/40 border border-red-800 rounded flex items-center gap-1">
            <XCircle size={12} />
            {error}
            <button
              onClick={() => setError(null)}
              className="ml-auto text-red-600 hover:text-red-400"
            >
              ×
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto py-2">
          {plugins.length === 0 && !showAddForm && (
            <p className="text-xs text-gray-600 text-center mt-8 px-4">
              No plugins yet.
              <br />
              Click + to add an MCP server.
            </p>
          )}

          {plugins.map((plugin) => {
            const connected = isServerConnected(plugin.name);
            const busy = connecting[plugin.id];
            const isSelected = selectedServer === plugin.name && connected;

            return (
              <div
                key={plugin.id}
                className={`mx-2 mb-1 rounded-lg border transition-colors ${
                  isSelected
                    ? "border-indigo-700 bg-indigo-950/40"
                    : "border-transparent hover:border-gray-700 hover:bg-gray-900"
                }`}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                  onClick={() => {
                    if (connected) {
                      setSelectedServer(
                        isSelected ? null : plugin.name,
                      );
                      setSelectedTool(null);
                    }
                  }}
                >
                  <StatusDot connected={connected} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">
                      {plugin.name}
                    </p>
                    {plugin.description && (
                      <p className="text-xs text-gray-600 truncate">
                        {plugin.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-700">
                      {plugin.transport === "stdio"
                        ? plugin.command
                        : plugin.url}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 px-3 pb-2">
                  <button
                    onClick={() =>
                      connected ? handleDisconnect(plugin) : handleConnect(plugin)
                    }
                    disabled={busy}
                    className={`flex items-center gap-1 px-2 py-0.5 text-xs rounded transition-colors ${
                      connected
                        ? "bg-green-900/40 text-green-400 hover:bg-red-900/40 hover:text-red-400 border border-green-800 hover:border-red-800"
                        : "bg-gray-800 text-gray-400 hover:bg-indigo-900/40 hover:text-indigo-400 border border-gray-700 hover:border-indigo-700"
                    } disabled:opacity-50`}
                  >
                    {busy ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : connected ? (
                      <Square size={10} />
                    ) : (
                      <Play size={10} />
                    )}
                    {connected ? "Disconnect" : "Connect"}
                  </button>

                  <button
                    onClick={() => handleRemovePlugin(plugin.id)}
                    className="ml-auto p-0.5 text-gray-700 hover:text-red-500 transition-colors"
                    title="Remove plugin"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Connected summary */}
        {servers.length > 0 && (
          <div className="px-3 py-2 border-t border-gray-800">
            <p className="text-xs text-gray-600">
              {servers.length} server{servers.length !== 1 ? "s" : ""} connected
              &nbsp;·&nbsp;
              {servers.reduce((acc, s) => acc + s.tools.length, 0)} tools
            </p>
          </div>
        )}
      </div>

      {/* ===== Center Panel: Server Explorer ===== */}
      <div
        className={`flex flex-col border-r border-gray-800 overflow-hidden transition-all ${
          selectedServer ? "w-72" : "flex-1"
        }`}
      >
        {!selectedServer ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-600 px-8">
            <Wrench size={40} className="mb-4 text-gray-800" />
            <p className="text-sm">
              Connect a server and select it to explore its tools, resources, and
              prompts.
            </p>
          </div>
        ) : (
          <>
            {/* Server header */}
            <div className="px-4 py-3 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-green-400" />
                <h3 className="text-sm font-semibold text-gray-200">
                  {selectedServer}
                </h3>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mt-2">
                {(["tools", "resources", "prompts"] as const).map((tab) => {
                  const counts: Record<string, number> = {
                    tools: currentServer?.tools.length ?? 0,
                    resources: currentServer?.resources.length ?? 0,
                    prompts: currentServer?.prompts.length ?? 0,
                  };
                  const icons = {
                    tools: Wrench,
                    resources: Database,
                    prompts: MessageSquare,
                  };
                  const Icon = icons[tab];
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        setActiveTab(tab);
                        setSelectedTool(null);
                      }}
                      className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${
                        activeTab === tab
                          ? "bg-indigo-600 text-white"
                          : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                      }`}
                    >
                      <Icon size={11} />
                      {tab}
                      <span className="text-xs opacity-70">
                        ({counts[tab]})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto py-2">
              {activeTab === "tools" &&
                (currentServer?.tools.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center mt-8">
                    No tools
                  </p>
                ) : (
                  currentServer?.tools.map((tool) => (
                    <button
                      key={tool.name}
                      onClick={() => setSelectedTool(tool)}
                      className={`w-full text-left px-4 py-2 hover:bg-gray-900 transition-colors border-l-2 ${
                        selectedTool?.name === tool.name
                          ? "border-indigo-500 bg-gray-900"
                          : "border-transparent"
                      }`}
                    >
                      <p className="text-xs font-mono text-indigo-300">
                        {tool.name}
                      </p>
                      {tool.description && (
                        <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">
                          {tool.description}
                        </p>
                      )}
                    </button>
                  ))
                ))}

              {activeTab === "resources" &&
                (currentServer?.resources.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center mt-8">
                    No resources
                  </p>
                ) : (
                  currentServer?.resources.map((res) => (
                    <div key={res.uri} className="px-4 py-2 border-b border-gray-800/50">
                      <p className="text-xs font-mono text-blue-300 truncate">
                        {res.uri}
                      </p>
                      {res.name && (
                        <p className="text-xs text-gray-400">{res.name}</p>
                      )}
                      {res.description && (
                        <p className="text-xs text-gray-600">{res.description}</p>
                      )}
                    </div>
                  ))
                ))}

              {activeTab === "prompts" &&
                (currentServer?.prompts.length === 0 ? (
                  <p className="text-xs text-gray-600 text-center mt-8">
                    No prompts
                  </p>
                ) : (
                  currentServer?.prompts.map((prompt) => (
                    <div key={prompt.name} className="px-4 py-2 border-b border-gray-800/50">
                      <p className="text-xs font-mono text-purple-300">
                        {prompt.name}
                      </p>
                      {prompt.description && (
                        <p className="text-xs text-gray-600">{prompt.description}</p>
                      )}
                    </div>
                  ))
                ))}
            </div>
          </>
        )}
      </div>

      {/* ===== Right Panel: Tool Runner ===== */}
      {selectedTool && selectedServer && (
        <div className="flex-1 overflow-hidden border-l border-gray-800">
          <ToolRunner
            tool={selectedTool}
            serverName={selectedServer}
            onClose={() => setSelectedTool(null)}
          />
        </div>
      )}

      {!selectedTool && selectedServer && (
        <div className="flex-1 flex items-center justify-center text-gray-700 text-sm">
          Select a tool to run it
        </div>
      )}
    </div>
  );
};
