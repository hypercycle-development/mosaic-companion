import React from "react";
import { Rocket, X, FileCode, Zap, Plug, Wrench, ArrowRight } from "lucide-react";
import { ideAgentForge } from "../../services/stargate/integrations";
import type { AgentTemplateType } from "./types";

interface AgentForgeTemplatePickerProps {
  projectPath: string;
  onSelect: (templateId: AgentTemplateType) => void;
  onCancel: () => void;
}

const TEMPLATE_META: {
  id: AgentTemplateType;
  gradient: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "anfe-minter",
    gradient: "from-purple-600/20 to-blue-600/20",
    icon: <FileCode size={20} className="text-purple-400" />,
  },
  {
    id: "fleet-node",
    gradient: "from-yellow-600/20 to-orange-600/20",
    icon: <Zap size={20} className="text-yellow-400" />,
  },
  {
    id: "mcp-adapter",
    gradient: "from-green-600/20 to-cyan-600/20",
    icon: <Plug size={20} className="text-green-400" />,
  },
  {
    id: "custom",
    gradient: "from-gray-600/20 to-gray-500/20",
    icon: <Wrench size={20} className="text-gray-400" />,
  },
];

export default function AgentForgeTemplatePicker({
  projectPath,
  onSelect,
  onCancel,
}: AgentForgeTemplatePickerProps) {
  const templates = ideAgentForge.getTemplates();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Rocket size={18} className="text-cyan-400" />
            <div>
              <h2 className="text-sm font-semibold text-gray-100">Forge Agent</h2>
              <p className="text-xs text-gray-500">Select a template to scaffold your agent</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Templates grid */}
        <div className="p-4 space-y-2">
          {templates.map((tmpl) => {
            const meta = TEMPLATE_META.find((m) => m.id === tmpl.id)!;
            return (
              <button
                key={tmpl.id}
                onClick={() => onSelect(tmpl.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-gradient-to-r ${meta.gradient} border border-gray-800 hover:border-gray-600 hover:bg-white/5 transition-all text-left group`}
              >
                <div className="p-2 rounded-md bg-gray-800/80 group-hover:bg-gray-800 transition-colors">
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-200">
                      {tmpl.name}
                    </span>
                    <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
                      {tmpl.fileName}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {tmpl.description}
                  </p>
                  {tmpl.inputs && (
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {tmpl.inputs.map((inp) => (
                        <span
                          key={inp}
                          className="text-[10px] text-cyan-400/70 bg-cyan-950/30 border border-cyan-900/50 px-1.5 py-0.5 rounded"
                        >
                          {inp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <ArrowRight
                  size={14}
                  className="text-gray-600 group-hover:text-gray-300 transition-colors"
                />
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-gray-900/50 border-t border-gray-800 text-xs text-gray-500">
          Project: <span className="text-gray-400 truncate">{projectPath}</span>
        </div>
      </div>
    </div>
  );
}
