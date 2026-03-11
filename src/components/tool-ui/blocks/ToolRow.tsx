import React from "react";
import type { RowBlock, ToolUIBlock } from "../types";

export const ToolRow: React.FC<RowBlock & { renderBlock: (block: ToolUIBlock, index: number) => React.ReactNode }> = ({
  gap = 12,
  blocks,
  renderBlock,
}) => (
  <div className="flex flex-wrap items-start" style={{ gap }}>
    {blocks.map((block, i) => (
      <div key={i} className="flex-1" style={{ minWidth: 220 }}>
        {renderBlock(block, i)}
      </div>
    ))}
  </div>
);
