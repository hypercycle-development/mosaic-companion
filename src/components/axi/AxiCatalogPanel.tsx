import React, { useState } from "react";
import { Terminal, Play, Package, ArrowRight, RefreshCw, Rocket, Box } from "lucide-react";

interface AxiTool {
  id: string;
  name: string;
  status: "built" | "aimified" | "deployed";
  commands: string[];
  description: string;
}

const TOOLS: AxiTool[] = [
  {
    id: "hbox-axi",
    name: "HyperAIBox Manager",
    status: "built",
    commands: ["status", "status --full", "logs", "restart"],
    description: "Fleet management: C-3PO + R2D2 health, SSH, logs, service restart",
  },
  {
    id: "spo-axi",
    name: "SPO Orchestrator",
    status: "built",
    commands: ["status", "boxes", "deploy", "scale", "logs"],
    description: "Stargate Pool Orchestrator: box registry, AIM deployment, scaling",
  },
  {
    id: "aimify",
    name: "AIMify Wrapper",
    status: "built",
    commands: ["aimify <tool>"],
    description: "Wrap AXI tools as HyperCycle AIM modules (manifest + Dockerfile)",
  },
];

export function AxiCatalogPanel(): React.ReactElement {
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [activeTool, setActiveTool] = useState<string>("");

  const api = (window as any).electronAPI;

  const runTool = async (toolId: string, command: string) => {
    setLoading(true);
    setActiveTool(`${toolId} ${command}`);
    setOutput(`$ ${toolId} ${command}\n...`);
    try {
      let result: { success: boolean; output?: string; error?: string };
      if (toolId === "hbox-axi") {
        result = await api.axiStatus({ full: command.includes("--full") });
      } else if (toolId === "spo-axi") {
        result = await api.axiSpoStatus();
      } else if (toolId === "aimify") {
        result = await api.axiAimify({ tool: "hbox-axi" });
      } else {
        result = { success: false, error: "Unknown tool" };
      }
      setOutput(`$ ${toolId} ${command}\n${result.output || result.error || "No output"}`);
    } catch (e) {
      setOutput(`$ ${toolId} ${command}\nError: ${e}`);
    }
    setLoading(false);
  };

  const deployTool = async (toolId: string) => {
    setLoading(true);
    setActiveTool(`deploy ${toolId}`);
    setOutput(`$ spo-axi deploy ${toolId}\n...`);
    try {
      const result = await api.axiDeploy({ module: toolId });
      setOutput(`$ spo-axi deploy ${toolId}\n${result.output || result.error || "No output"}`);
    } catch (e) {
      setOutput(`$ spo-axi deploy ${toolId}\nError: ${e}`);
    }
    setLoading(false);
  };

  const statusColors: Record<string, string> = {
    built: "var(--warning)",
    aimified: "var(--primary)",
    deployed: "var(--success)",
  };

  return (
    <div className="space-y-4">
      <div className="text-[10px] font-bold text-gray-600 uppercase tracking-widest flex items-center gap-2">
        <Package size={10} />
        <span>AXI Tool Catalog — Agent-Native CLI Tools</span>
      </div>

      <div className="text-[10px] text-gray-500 leading-relaxed">
        Tools built by the AXI Forge. Mosaic Bot can run these autonomously to manage
        the Stargate ecosystem, then AIMify + deploy them to Node Factories.
      </div>

      <div className="space-y-2">
        {TOOLS.map((tool) => (
          <div key={tool.id} className="bg-gray-900 rounded-xl p-3 border border-gray-800">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <Terminal size={12} style={{ color: "var(--primary)" }} />
                <span className="text-xs font-bold text-gray-200">{tool.name}</span>
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                  style={{
                    color: statusColors[tool.status],
                    backgroundColor: `color-mix(in srgb, ${statusColors[tool.status]} 15%, transparent)`,
                  }}
                >
                  {tool.status}
                </span>
              </div>
              <button
                onClick={() => deployTool(tool.id)}
                disabled={loading}
                className="flex items-center gap-1 text-[9px] px-2 py-1 rounded transition-colors"
                style={{
                  color: "var(--success)",
                  backgroundColor: "color-mix(in srgb, var(--success) 10%, transparent)",
                }}
                title="Deploy via SPO to Node Factories"
              >
                <Rocket size={9} />
                Deploy
              </button>
            </div>
            <div className="text-[10px] text-gray-500 mb-2">{tool.description}</div>
            <div className="flex flex-wrap gap-1">
              {tool.commands.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => runTool(tool.id, cmd)}
                  disabled={loading}
                  className="text-[9px] font-mono px-2 py-0.5 rounded bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {(output || loading) && (
        <div className="bg-gray-950 border border-gray-800 rounded-xl p-3">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            {loading ? <RefreshCw size={10} className="animate-spin" /> : <ArrowRight size={10} />}
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {loading ? `Running: ${activeTool}` : "Output"}
            </span>
          </div>
          <pre
            className="text-[10px] font-mono whitespace-pre overflow-x-auto"
            style={{ color: "var(--success)" }}
          >
            {output}
          </pre>
        </div>
      )}

      <div className="text-[9px] text-gray-700 font-mono text-center pt-1">
        Pipeline: Forge → Build → Test → AIMify → Deploy (SPO → Node Manager → Tiller)
      </div>
    </div>
  );
}
