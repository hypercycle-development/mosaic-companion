import React from "react";
import type { RowBlock, ToolUIBlock } from "../types";

export const ToolRow: React.FC<RowBlock & { renderBlock: (block: ToolUIBlock, index: number) => React.ReactNode }> = ({
  gap = 16,
  blocks,
  inline,
  renderBlock,
}) => (
  <div className={`flex flex-wrap ${inline ? "items-center" : "items-start"}`} style={{ gap }}>
    {blocks.map((block, i) => (
      <div key={i} className={inline ? undefined : "flex-1"} style={inline ? undefined : { minWidth: 220 }}>
        {renderBlock(block, i)}
      </div>
    ))}
  </div>
);
