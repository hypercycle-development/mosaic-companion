import { Tooltip } from './Tooltip';

interface CompositeScoreBadgeProps {
  score: number | null;
  healthScore?: number | null;
  latencyScore?: number | null;
  uptimeScore?: number | null;
  capabilityScore?: number | null;
  costScore?: number | null;
  hardwareBonus?: number | null;
  size?: 'sm' | 'md';
}

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5',
  md: 'text-sm px-2 py-1',
};

function getBgColor(score: number | null): string {
  if (score === null) return 'bg-gray-700';
  if (score >= 80) return 'bg-green-700';
  if (score >= 50) return 'bg-amber-700';
  return 'bg-red-700';
}

function fmt(val: number | null | undefined): string {
  return val != null ? String(val) : '—';
}

function BreakdownTooltip({
  score,
  healthScore,
  latencyScore,
  uptimeScore,
  capabilityScore,
  costScore,
  hardwareBonus,
}: Omit<CompositeScoreBadgeProps, 'size'>) {
  const hasSubScores =
    healthScore != null ||
    latencyScore != null ||
    uptimeScore != null ||
    capabilityScore != null ||
    costScore != null ||
    hardwareBonus != null;

  if (!hasSubScores) {
    return (
      <span>
        Composite Score: {score != null ? `${score}/100` : '—'}
      </span>
    );
  }

  return (
    <span className="font-mono text-xs whitespace-pre block">
      {`Composite Score: ${score != null ? `${score}/100` : '—'}\n`}
      {'──────────────────────────\n'}
      {`Health:     ${fmt(healthScore)}/100\n`}
      {`Latency:    ${fmt(latencyScore)}/100\n`}
      {`Uptime:     ${fmt(uptimeScore)}/100\n`}
      {`Capability: ${fmt(capabilityScore)}/100\n`}
      {`Cost:       ${fmt(costScore)}/100\n`}
      {`Hardware:   +${hardwareBonus ?? 0} bonus`}
    </span>
  );
}

export function CompositeScoreBadge({
  score,
  healthScore,
  latencyScore,
  uptimeScore,
  capabilityScore,
  costScore,
  hardwareBonus,
  size = 'sm',
}: CompositeScoreBadgeProps) {
  const bg = getBgColor(score);
  const display = score != null ? String(score) : '—';

  return (
    <Tooltip
      content={
        <BreakdownTooltip
          score={score}
          healthScore={healthScore}
          latencyScore={latencyScore}
          uptimeScore={uptimeScore}
          capabilityScore={capabilityScore}
          costScore={costScore}
          hardwareBonus={hardwareBonus}
        />
      }
    >
      <span
        className={`inline-block rounded-full font-mono font-semibold text-white ${bg} ${sizeClasses[size]}`}
      >
        {display}
      </span>
    </Tooltip>
  );
}
