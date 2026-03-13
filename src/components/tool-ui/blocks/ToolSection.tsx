import React, { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { SectionBlock, ToolUIBlock } from "../types";

export const ToolSection: React.FC<SectionBlock & { renderBlock: (block: ToolUIBlock, index: number) => React.ReactNode }> = ({
  title,
  collapsed: initialCollapsed = false,
  blocks,
  renderBlock,
}) => {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-800/60 text-sm font-medium text-gray-200 hover:bg-gray-800 transition-colors"
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        {title}
      </button>
      {!collapsed && (
        <div className="p-3 flex flex-col gap-2" style={{ animation: "toolUiFadeIn 200ms ease-out" }}>
          {blocks.map((block, i) => renderBlock(block, i))}
        </div>
      )}
    </div>
  );
};
