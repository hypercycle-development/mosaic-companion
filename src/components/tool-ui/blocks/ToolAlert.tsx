import React from "react";
import { AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";
import type { AlertBlock, AlertLevel } from "../types";

const LEVEL_CONFIG: Record<AlertLevel, { icon: React.ReactNode; border: string; bg: string; text: string }> = {
  info:    { icon: <Info size={16} />,          border: "border-blue-700",   bg: "bg-blue-950/40",   text: "text-blue-300" },
  success: { icon: <CheckCircle size={16} />,   border: "border-green-700",  bg: "bg-green-950/40",  text: "text-green-300" },
  warning: { icon: <AlertTriangle size={16} />, border: "border-yellow-700", bg: "bg-yellow-950/40", text: "text-yellow-300" },
  error:   { icon: <AlertCircle size={16} />,   border: "border-red-700",    bg: "bg-red-950/40",    text: "text-red-300" },
};

export const ToolAlert: React.FC<AlertBlock> = ({ level, title, message }) => {
  const cfg = LEVEL_CONFIG[level] ?? LEVEL_CONFIG.info;
  return (
    <div className={`flex items-start gap-2.5 p-3 rounded-lg border ${cfg.border} ${cfg.bg}`}>
      <span className={`mt-0.5 ${cfg.text}`}>{cfg.icon}</span>
      <div className="min-w-0">
        {title && <div className={`text-sm font-medium ${cfg.text}`}>{title}</div>}
        <div className="text-sm text-gray-300">{message}</div>
      </div>
    </div>
  );
};
