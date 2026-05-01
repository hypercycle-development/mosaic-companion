import React from "react";
import {
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  ScatterChart, Scatter,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import type { ChartBlock, ChartType } from "../types";

/** Default color palette for series */
const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

/**
 * Recharts needs flat objects: [{ x, seriesName1, seriesName2 }]
 * We transform from our per-series format.
 */
function flattenSeries(block: ChartBlock): Record<string, unknown>[] {
  const xMap = new Map<string | number, Record<string, unknown>>();
  for (const s of block.series) {
    for (const pt of s.data) {
      if (!xMap.has(pt.x)) xMap.set(pt.x, { x: pt.x });
      xMap.get(pt.x)![s.name] = pt.y;
    }
  }
  return Array.from(xMap.values());
}

function flattenPie(block: ChartBlock): Array<{ name: string; value: number }> {
  const s = block.series[0];
  if (!s) return [];
  return s.data.map((pt) => ({ name: String(pt.x), value: pt.y }));
}

const ChartInner: React.FC<{ block: ChartBlock }> = ({ block }) => {
  const { chartType, series, xAxis, yAxis } = block;
  const data = flattenSeries(block);
  const seriesNames = series.map((s) => s.name);

  const commonProps = { data, margin: { top: 8, right: 8, bottom: 4, left: 4 } };

  switch (chartType as ChartType) {
    case "bar":
      return (
        <BarChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="x" tick={{ fill: "#9ca3af", fontSize: 12 }} label={xAxis?.label ? { value: xAxis.label, fill: "#9ca3af", fontSize: 12, position: "insideBottom", offset: -2 } : undefined} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} label={yAxis?.label ? { value: yAxis.label, fill: "#9ca3af", fontSize: 12, angle: -90, position: "insideLeft" } : undefined} />
          <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
          {seriesNames.length > 1 && <Legend />}
          {seriesNames.map((name, i) => (
            <Bar key={name} dataKey={name} fill={COLORS[i % COLORS.length]} radius={[3, 3, 0, 0]} animationDuration={800} animationEasing="ease-out" />
          ))}
        </BarChart>
      );

    case "line":
      return (
        <LineChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="x" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
          {seriesNames.length > 1 && <Legend />}
          {seriesNames.map((name, i) => (
            <Line key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} animationDuration={800} animationEasing="ease-out" />
          ))}
        </LineChart>
      );

    case "area":
      return (
        <AreaChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="x" tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <YAxis tick={{ fill: "#9ca3af", fontSize: 12 }} />
          <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
          {seriesNames.length > 1 && <Legend />}
          {seriesNames.map((name, i) => (
            <Area key={name} type="monotone" dataKey={name} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.2} animationDuration={800} animationEasing="ease-out" />
          ))}
        </AreaChart>
      );

    case "scatter":
      return (
        <ScatterChart {...commonProps}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis dataKey="x" tick={{ fill: "#9ca3af", fontSize: 12 }} name={xAxis?.label} />
          <YAxis dataKey="y" tick={{ fill: "#9ca3af", fontSize: 12 }} name={yAxis?.label} />
          <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
          {series.map((s, i) => (
            <Scatter key={s.name} name={s.name} data={s.data} fill={COLORS[i % COLORS.length]} />
          ))}
        </ScatterChart>
      );

    case "pie":
    case "donut": {
      const pieData = flattenPie(block);
      const innerRadius = chartType === "donut" ? "40%" : 0;
      return (
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={innerRadius} outerRadius="80%" paddingAngle={2} label={{ fill: "#9ca3af", fontSize: 11 }} animationDuration={800} animationEasing="ease-out">
            {pieData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }} />
          <Legend />
        </PieChart>
      );
    }

    default:
      return <div className="text-sm text-gray-500">Unsupported chart type: {chartType}</div>;
  }
};

export const ToolChart: React.FC<ChartBlock> = (block) => {
  // Guard against invalid series data — agent may send malformed JSON
  if (!block.series || !Array.isArray(block.series) || block.series.length === 0) {
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-800/40 p-3">
        {block.title && <div className="text-sm font-medium text-gray-200 mb-1">{block.title}</div>}
        <div className="text-xs text-gray-500">Chart data unavailable — missing or invalid series.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-800/40 overflow-hidden" style={{ minWidth: 220 }}>
      {block.title && (
        <div className="px-3 py-2 text-sm font-medium text-gray-200 border-b border-gray-700">
          {block.title}
        </div>
      )}
      <div className="p-2" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ChartInner block={block} />
        </ResponsiveContainer>
      </div>
    </div>
  );
};
