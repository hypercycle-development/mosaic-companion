import React, { useState } from "react";
import type { TabsBlock, ToolUIBlock } from "../types";

export const ToolTabs: React.FC<TabsBlock & { renderBlock: (block: ToolUIBlock, index: number) => React.ReactNode }> = ({
  tabs,
  renderBlock,
}) => {
  const [activeTab, setActiveTab] = useState(tabs[0]?.id ?? "");

  const active = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <div className="rounded-lg border border-gray-700 overflow-hidden">
      <div className="flex border-b border-gray-700 bg-gray-800/60">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm transition-colors ${
              tab.id === active?.id
                ? "text-gray-100 border-b-2 border-blue-500 -mb-px"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active && (
        <div key={active.id} className="p-3 flex flex-col gap-2" style={{ animation: "toolUiFadeIn 200ms ease-out" }}>
          {active.blocks.map((block, i) => renderBlock(block, i))}
        </div>
      )}
    </div>
  );
};
