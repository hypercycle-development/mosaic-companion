import React, { useState } from "react";
import {
  Server, Zap, Cpu, Activity, Trophy, BarChart3, Globe, Database, Layers, Box, Shield, Hash,
} from "lucide-react";
import type { TabsBlock, TabIcon, ToolUIBlock } from "../types";

const TAB_ICON_MAP: Record<TabIcon, React.FC<{ size?: number; className?: string }>> = {
  server: Server, zap: Zap, cpu: Cpu, activity: Activity, trophy: Trophy,
  chart: BarChart3, globe: Globe, database: Database, layers: Layers,
  box: Box, shield: Shield, hash: Hash,
};

export const ToolTabs: React.FC<TabsBlock & { renderBlock: (block: ToolUIBlock, index: number) => React.ReactNode }> = ({
  tabs,
  renderBlock,
}) => {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex border-b border-gray-700 bg-gray-800/60">
        {tabs.map((tab) => {
          const IconComp = tab.icon ? TAB_ICON_MAP[tab.icon] : null;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                tab.id === active?.id
                  ? "text-gray-100 border-b-2 border-blue-500 -mb-px"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {IconComp && <IconComp size={16} />}
              {tab.label}
            </button>
          );
        })}
      </div>
      {active && (
        <div key={active.id} className="p-4 flex flex-col gap-3" style={{ animation: "toolUiFadeIn 200ms ease-out" }}>
          {active.blocks.map((block, i) => renderBlock(block, i))}
        </div>
      )}
    </div>
  );
};
