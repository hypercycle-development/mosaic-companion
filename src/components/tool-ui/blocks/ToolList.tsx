import React from "react";
import { AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";
import type { ListBlock, ListItemIcon } from "../types";

const ICON_MAP: Record<ListItemIcon, React.ReactNode> = {
  info:    <Info size={14} className="text-blue-400" />,
  success: <CheckCircle size={14} className="text-green-400" />,
  warning: <AlertTriangle size={14} className="text-yellow-400" />,
  error:   <AlertCircle size={14} className="text-red-400" />,
  none:    null,
};

export const ToolList: React.FC<ListBlock> = ({ ordered, items }) => {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={`space-y-1.5 text-sm text-gray-300 ${ordered ? "list-decimal pl-5" : "pl-1"}`}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          {!ordered && (
            <span className="mt-0.5 shrink-0">
              {ICON_MAP[item.icon ?? "none"] ?? <span className="w-1.5 h-1.5 rounded-full bg-gray-500 inline-block mt-1.5" />}
            </span>
          )}
          <span>{item.text}</span>
        </li>
      ))}
    </Tag>
  );
};
