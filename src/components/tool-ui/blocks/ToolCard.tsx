import React from "react";
import {
  Download, Star, Clock, Check, Info, AlertTriangle, Shield, Globe, Cpu, Database, Zap, Hash,
} from "lucide-react";
import type { CardBlock, CellColor } from "../types";

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  download: Download, star: Star, clock: Clock, check: Check,
  info: Info, warning: AlertTriangle, shield: Shield, globe: Globe,
  cpu: Cpu, database: Database, zap: Zap, hash: Hash,
};

const VALUE_COLOR_CLASSES: Record<CellColor, string> = {
  green:  "text-green-400",
  red:    "text-red-400",
  yellow: "text-yellow-400",
  blue:   "text-blue-400",
  purple: "text-purple-400",
  cyan:   "text-cyan-400",
  gray:   "text-gray-500",
};

export const ToolCard: React.FC<CardBlock> = ({ title, titleColor, titleMono, subtitle, fields }) => {
  const titleColorClass = titleColor ? (VALUE_COLOR_CLASSES[titleColor] ?? "text-gray-200") : "text-gray-200";
  const titleMonoClass = titleMono ? " font-mono" : "";

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/40 overflow-hidden transition-all duration-200 hover:border-gray-600 hover:-translate-y-0.5">
      {title && (
        <div className="px-4 py-3 flex items-center justify-between gap-2 border-b border-gray-700">
          <span className={`text-sm font-semibold truncate ${titleColorClass}${titleMonoClass}`}>{title}</span>
          {subtitle && <span className="text-xs text-gray-500 shrink-0">{subtitle}</span>}
        </div>
      )}
      <div className="p-4 grid gap-3">
      {fields.map((f, i) => {
        const IconComp = f.icon ? ICON_MAP[f.icon] : null;
        const valueClass = f.color ? (VALUE_COLOR_CLASSES[f.color] ?? "text-gray-200") : "text-gray-200";
        const iconColorClass = f.iconColor ? (VALUE_COLOR_CLASSES[f.iconColor] ?? "text-gray-500") : f.color ? (VALUE_COLOR_CLASSES[f.color] ?? "text-gray-500") : "text-gray-500";
        return (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-sm text-gray-400 shrink-0">
              {IconComp && <IconComp size={18} className={iconColorClass} />}
              {f.label}
            </span>
            <span className={`text-sm font-medium text-right ${valueClass}`}>{f.value}</span>
          </div>
        );
      })}
    </div>
  </div>
  );
};
