import React from "react";
import type { CardBlock } from "../types";

export const ToolCard: React.FC<CardBlock> = ({ title, fields }) => (
  <div className="rounded-lg border border-gray-700 bg-gray-800/40 overflow-hidden">
    {title && (
      <div className="px-3 py-2 text-sm font-medium text-gray-200 border-b border-gray-700">
        {title}
      </div>
    )}
    <div className="p-3 grid gap-2">
      {fields.map((f, i) => (
        <div key={i} className="flex items-baseline justify-between gap-4">
          <span className="text-xs text-gray-500 shrink-0">{f.label}</span>
          <span className="text-sm text-gray-200 text-right">{f.value}</span>
        </div>
      ))}
    </div>
  </div>
);
