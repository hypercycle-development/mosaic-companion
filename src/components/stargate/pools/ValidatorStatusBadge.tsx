// =============================================================================
// VALIDATOR STATUS BADGE — Color-coded sync status dot + label
// synced=green, catching_up=yellow, offline=red
// =============================================================================

import React from 'react';
import { CheckCircle2, Loader, XCircle } from 'lucide-react';
import { ValidatorSyncStatus } from '../../../types/validator';

export interface ValidatorStatusBadgeProps {
  status: ValidatorSyncStatus;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const STATUS_META: Record<
  ValidatorSyncStatus,
  {
    label: string;
    dotClass: string;
    textClass: string;
    bgClass: string;
    borderClass: string;
    icon: React.ReactNode;
  }
> = {
  synced: {
    label: 'Synced',
    dotClass: 'bg-green-400',
    textClass: 'text-green-400',
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/20',
    icon: <CheckCircle2 size={12} />,
  },
  catching_up: {
    label: 'Catching Up',
    dotClass: 'bg-yellow-400',
    textClass: 'text-yellow-400',
    bgClass: 'bg-yellow-500/10',
    borderClass: 'border-yellow-500/20',
    icon: <Loader size={12} className="animate-spin" />,
  },
  offline: {
    label: 'Offline',
    dotClass: 'bg-red-400',
    textClass: 'text-red-400',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/20',
    icon: <XCircle size={12} />,
  },
};

const SIZE_META = {
  sm: { badge: 'px-1.5 py-0.5 text-[10px] gap-1', dot: 'w-1.5 h-1.5' },
  md: { badge: 'px-2 py-0.5 text-xs gap-1.5', dot: 'w-2 h-2' },
};

const ValidatorStatusBadge: React.FC<ValidatorStatusBadgeProps> = ({
  status,
  showLabel = true,
  size = 'sm',
}) => {
  const meta = STATUS_META[status];
  const sz = SIZE_META[size];

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${sz.badge} ${meta.bgClass} ${meta.borderClass} ${meta.textClass}`}
      title={meta.label}
    >
      <span className={`shrink-0 rounded-full ${sz.dot} ${meta.dotClass}`} />
      {showLabel && meta.label}
      {!showLabel && meta.icon}
    </span>
  );
};

export default ValidatorStatusBadge;
