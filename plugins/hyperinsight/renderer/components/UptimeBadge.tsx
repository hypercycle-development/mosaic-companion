import React from 'react';
import { Tooltip } from './Tooltip';

interface UptimeBadgeProps {
  measuredUptime7d: number | null;
  measuredUptime30d?: number | null;
  nodeReportedUptime?: number | null;
}

function getTextColor(value: number): string {
  if (value >= 90) return 'text-green-400';
  if (value >= 70) return 'text-amber-400';
  return 'text-red-400';
}

function fmt(val: number | null | undefined): string {
  return val != null ? `${val.toFixed(1)}%` : '—';
}

function UptimeTooltipContent({
  measuredUptime7d,
  measuredUptime30d,
  nodeReportedUptime,
}: UptimeBadgeProps) {
  return (
    <span className="font-mono text-xs whitespace-pre block">
      {`7-day uptime:            ${fmt(measuredUptime7d)}   (HyperInsight measured)\n`}
      {`30-day uptime:           ${fmt(measuredUptime30d)}\n`}
      {`Node-reported lifetime:  ${fmt(nodeReportedUptime)}   (self-reported)`}
    </span>
  );
}

export function UptimeBadge({
  measuredUptime7d,
  measuredUptime30d,
  nodeReportedUptime,
}: UptimeBadgeProps) {
  let display: React.ReactNode;

  if (measuredUptime7d !== null && measuredUptime7d !== undefined) {
    const colorClass = getTextColor(measuredUptime7d);
    display = (
      <span className={`text-xs font-mono font-semibold ${colorClass}`}>
        {measuredUptime7d.toFixed(1)}%
      </span>
    );
  } else if (nodeReportedUptime !== null && nodeReportedUptime !== undefined) {
    const colorClass = getTextColor(nodeReportedUptime);
    display = (
      <span className="text-xs font-mono">
        <span className={colorClass}>{nodeReportedUptime.toFixed(1)}%</span>
        <span className="text-gray-500 ml-1">(node-reported)</span>
      </span>
    );
  } else {
    display = <span className="text-xs font-mono text-gray-500">—</span>;
  }

  return (
    <Tooltip
      content={
        <UptimeTooltipContent
          measuredUptime7d={measuredUptime7d}
          measuredUptime30d={measuredUptime30d}
          nodeReportedUptime={nodeReportedUptime}
        />
      }
    >
      <span className="inline-flex items-center">{display}</span>
    </Tooltip>
  );
}
