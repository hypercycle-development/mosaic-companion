import React from "react";
import {
  Cpu, Database, Globe, Zap, Server, Activity, Layers, Box, Shield, Hash, Info,
} from "lucide-react";
import type { StatCardBlock, StatCardColor, TrendPoint } from "../types";

// ── Color mapping ────────────────────────────────────────────────────────────

const ACCENT: Record<StatCardColor, { border: string; text: string; line: string; iconBg: string }> = {
  blue:   { border: "border-blue-800/50",   text: "text-blue-400",   line: "#3b82f6", iconBg: "bg-blue-900/50" },
  green:  { border: "border-green-800/50",  text: "text-green-400",  line: "#10b981", iconBg: "bg-green-900/50" },
  red:    { border: "border-red-800/50",    text: "text-red-400",    line: "#ef4444", iconBg: "bg-red-900/50" },
  yellow: { border: "border-yellow-800/50", text: "text-yellow-400", line: "#f59e0b", iconBg: "bg-yellow-900/50" },
  purple: { border: "border-purple-800/50", text: "text-purple-400", line: "#8b5cf6", iconBg: "bg-purple-900/50" },
  cyan:   { border: "border-cyan-800/50",   text: "text-cyan-400",   line: "#06b6d4", iconBg: "bg-cyan-900/50" },
  gray:   { border: "border-gray-700",      text: "text-gray-300",   line: "#6b7280", iconBg: "bg-gray-800" },
};

// ── Icon mapping ─────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  cpu: Cpu, database: Database, globe: Globe, zap: Zap, server: Server,
  activity: Activity, layers: Layers, box: Box, shield: Shield, hash: Hash,
};

// ── Inline SVG sparkline ─────────────────────────────────────────────────────

const Sparkline: React.FC<{ data: TrendPoint[]; color: string }> = ({ data, color }) => {
  if (data.length < 2) return null;
  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 100;
  const h = 32;
  const pad = 2;

  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-8 mt-2" preserveAspectRatio="none">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ strokeDasharray: 500, strokeDashoffset: 0, animation: "toolUiSparkDraw 1s ease-out" }}
      />
    </svg>
  );
};

// ── Component ────────────────────────────────────────────────────────────────

export const ToolStatCard: React.FC<StatCardBlock> = ({
  label,
  value,
  subtext,
  color = "blue",
  trend,
  icon,
  tooltip,
}) => {
  const accent = ACCENT[color] ?? ACCENT.blue;
  const IconComp = icon ? ICON_MAP[icon] : null;

  return (
    <div
      className={`rounded-lg border ${accent.border} bg-gray-800/40 p-5 flex flex-col justify-between min-h-[140px] transition-all duration-200 hover:bg-gray-800/60 hover:-translate-y-0.5`}
      title={tooltip}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
          {IconComp && (
            <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${accent.iconBg}`}>
              <IconComp size={16} className={accent.text} />
            </span>
          )}
          {label}
        </span>
        {tooltip && <Info size={16} className="text-gray-600 hover:text-gray-400 cursor-help transition-colors" />}
      </div>
      <div className="mt-2">
        <span className={`text-3xl font-bold ${accent.text}`}>{value}</span>
        {subtext && <span className="ml-2 text-sm text-gray-500">{subtext}</span>}
      </div>
      {trend && trend.length >= 2 && <Sparkline data={trend} color={accent.line} />}
    </div>
  );
};
