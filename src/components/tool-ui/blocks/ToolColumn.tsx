import React from "react";
import type { ColumnBlock, ToolUIBlock } from "../types";

export const ToolColumn: React.FC<ColumnBlock & { renderBlock: (block: ToolUIBlock, index: number) => React.ReactNode }> = ({
  blocks,
  renderBlock,
}) => (
  <div className="flex flex-col gap-3">
    {blocks.map((block, i) => renderBlock(block, i))}
  </div>
);
