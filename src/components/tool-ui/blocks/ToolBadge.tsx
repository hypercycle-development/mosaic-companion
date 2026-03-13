import React from "react";
import {
  Download, Star, Clock, Check, Info, AlertTriangle, Zap, Globe, Hash,
} from "lucide-react";
import type { BadgeBlock, BadgeColor } from "../types";

const COLOR_CLASSES: Record<BadgeColor, string> = {
  blue:   "bg-blue-900/40 text-blue-400 border-blue-800/50",
  green:  "bg-green-900/40 text-green-400 border-green-800/50",
  red:    "bg-red-900/40 text-red-400 border-red-800/50",
  yellow: "bg-yellow-900/40 text-yellow-400 border-yellow-800/50",
  purple: "bg-purple-900/40 text-purple-400 border-purple-800/50",
  cyan:   "bg-cyan-900/40 text-cyan-400 border-cyan-800/50",
  gray:   "bg-gray-800/60 text-gray-400 border-gray-700",
};

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  download: Download, star: Star, clock: Clock, check: Check,
  info: Info, warning: AlertTriangle, zap: Zap, globe: Globe, hash: Hash,
};

export const ToolBadge: React.FC<BadgeBlock> = ({ label, color = "gray", icon }) => {
  const cls = COLOR_CLASSES[color] ?? COLOR_CLASSES.gray;
  const IconComp = icon ? ICON_MAP[icon] : null;

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cls}`}>
      {IconComp && <IconComp size={12} />}
      {label}
    </span>
  );
};
