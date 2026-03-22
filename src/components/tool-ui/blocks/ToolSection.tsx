import React, { useState } from "react";
import {
  ChevronDown, ChevronRight,
  Server, Zap, Cpu, Activity, Trophy, BarChart3, Globe, Database, Layers, Box, Shield, Hash,
} from "lucide-react";
import type { SectionBlock, TabIcon, ToolUIBlock } from "../types";

const SECTION_ICON_MAP: Record<TabIcon, React.FC<{ size?: number; className?: string }>> = {
  server: Server, zap: Zap, cpu: Cpu, activity: Activity, trophy: Trophy,
  chart: BarChart3, globe: Globe, database: Database, layers: Layers,
  box: Box, shield: Shield, hash: Hash,
};

export const ToolSection: React.FC<SectionBlock & { renderBlock: (block: ToolUIBlock, index: number) => React.ReactNode }> = ({
  title,
  subtitle,
  collapsed: initialCollapsed = false,
  icon,
  iconColor,
  blocks,
  renderBlock,
}) => {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const IconComp = icon ? SECTION_ICON_MAP[icon] : null;

  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800/60 text-sm font-medium text-gray-200 hover:bg-gray-800 transition-colors"
      >
        {IconComp && <IconComp size={22} className={iconColor ?? "text-gray-400"} />}
        <div className="flex flex-col items-start flex-1 min-w-0">
          <span className="truncate font-semibold">{title}</span>
          {subtitle && <span className="text-xs text-gray-500 font-normal">{subtitle}</span>}
        </div>
        {collapsed ? <ChevronRight size={16} className="text-gray-500 shrink-0" /> : <ChevronDown size={16} className="text-gray-500 shrink-0" />}
      </button>
      {!collapsed && (
        <div className="p-4 flex flex-col gap-3" style={{ animation: "toolUiFadeIn 200ms ease-out" }}>
          {blocks.map((block, i) => renderBlock(block, i))}
        </div>
      )}
    </div>
  );
};
