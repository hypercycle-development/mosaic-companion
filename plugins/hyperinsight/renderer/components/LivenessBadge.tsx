import { Tooltip } from './Tooltip';

interface LivenessBadgeProps {
  healthScore: number | null;
  consecutiveFailures?: number;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const sizeClasses = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
};

type State = 'nodata' | 'failing' | 'healthy' | 'degraded' | 'unhealthy';

function getState(
  healthScore: number | null,
  consecutiveFailures: number | undefined,
): State {
  if (consecutiveFailures !== undefined && consecutiveFailures >= 5) return 'failing';
  if (healthScore === null) return 'nodata';
  if (healthScore >= 80) return 'healthy';
  if (healthScore >= 50) return 'degraded';
  return 'unhealthy';
}

const stateConfig: Record<
  State,
  { dotColor: string; label: string; tooltipFn: (score: number | null, failures: number | undefined) => string }
> = {
  nodata: {
    dotColor: 'bg-gray-400',
    label: 'Unknown',
    tooltipFn: () => 'Health data unavailable',
  },
  failing: {
    dotColor: 'bg-red-500',
    label: 'Failing',
    tooltipFn: (_score, failures) =>
      `Unhealthy: ${failures ?? 0} consecutive probe failures`,
  },
  healthy: {
    dotColor: 'bg-green-500',
    label: 'Healthy',
    tooltipFn: (score) => `Healthy — Score: ${score}/100`,
  },
  degraded: {
    dotColor: 'bg-amber-500',
    label: 'Degraded',
    tooltipFn: (score) => `Degraded — Score: ${score}/100`,
  },
  unhealthy: {
    dotColor: 'bg-red-500',
    label: 'Unhealthy',
    tooltipFn: (score) => `Unhealthy — Score: ${score}/100`,
  },
};

export function LivenessBadge({
  healthScore,
  consecutiveFailures,
  showLabel = false,
  size = 'sm',
}: LivenessBadgeProps) {
  const state = getState(healthScore, consecutiveFailures);
  const { dotColor, label, tooltipFn } = stateConfig[state];
  const tooltipText = tooltipFn(healthScore, consecutiveFailures);
  const pulse = state === 'failing';

  return (
    <span className="inline-flex items-center gap-1.5">
      <Tooltip content={tooltipText}>
        <span
          className={`rounded-full ${dotColor} ${sizeClasses[size]}${pulse ? ' animate-pulse' : ''} inline-block`}
        />
      </Tooltip>
      {showLabel && (
        <span className="text-xs text-gray-400">{label}</span>
      )}
    </span>
  );
}
