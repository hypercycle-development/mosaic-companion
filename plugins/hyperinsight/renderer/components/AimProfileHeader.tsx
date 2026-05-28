import React from 'react';
import { Download, Star, Clock, Calendar } from 'lucide-react';
import { AimProfileDto } from '../types';
import { inferCategoryTags, relativeTime, freshnessStatus } from '../utils';
import { Tooltip } from './Tooltip';

interface AimProfileHeaderProps {
  profile: AimProfileDto | null;
}

const FreshnessDot = ({ status }: { status: ReturnType<typeof freshnessStatus> }) => {
  const colour = status === 'fresh' ? 'bg-[var(--success)]' : status === 'stale' ? 'bg-amber-400' : 'bg-red-500';
  return <span className={`inline-block w-2 h-2 rounded-full ${colour} shrink-0`} />;
};

export const AimProfileHeader = ({ profile }: AimProfileHeaderProps) => {
  // Skeleton
  if (!profile) {
    return (
      <div className="px-6 pt-6 pb-4 space-y-4 animate-pulse">
        <div className="h-8 w-64 rounded bg-[var(--surface)]" />
        <div className="h-4 w-32 rounded bg-[var(--surface)]" />
        <div className="h-16 w-full rounded bg-[var(--surface)]" />
        <div className="flex gap-2">
          <div className="h-6 w-20 rounded-full bg-[var(--surface)]" />
          <div className="h-6 w-24 rounded-full bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  const tags = inferCategoryTags(profile.name, profile.namespace);
  const activeCount = profile.latestStats?.activeNodes ?? 0;
  const freshness = freshnessStatus(profile.dataFreshnessUtc);
  const freshnessLabel = relativeTime(profile.dataFreshnessUtc);

  // Prevent double namespace if profile.name already includes "namespace/"
  const hasNamespacePrefix =
    profile.namespace && profile.name.startsWith(`${profile.namespace}/`);
  const displayName = hasNamespacePrefix
    ? profile.name.substring(profile.namespace!.length + 1)
    : profile.name;

  return (
    <div className="px-6 pt-6 pb-4 border-b border-[var(--border)] space-y-4">
      {/* Name & namespace */}
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold font-mono tracking-tight text-[var(--text)]">
          <div>
            {profile.namespace && (
              <span className="text-[var(--textMuted)]">{profile.namespace}/</span>
            )}
            <span className="text-[var(--primary)]">{displayName}</span>
          </div>
          <Tooltip content={`Data as of ${freshnessLabel}${freshness === 'very-stale' ? ' (may be outdated)' : ''}`}>
            <div className="flex items-center -mt-2.5 cursor-help">
              <FreshnessDot status={freshness} />
            </div>
          </Tooltip>
        </h1>
      </div>

      {/* Meta row & Category pills */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--textMuted)]">
        {/* Pills */}
        <div className="flex flex-wrap items-center gap-2">
          {tags.map(tag => (
            <span
              key={tag}
              className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--surface)] border border-[var(--border)] text-[var(--textMuted)]"
            >
              {tag}
            </span>
          ))}
          <span
            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              activeCount > 0
                ? 'bg-[color-mix(in_srgb,var(--success),transparent_85%)] text-[var(--success)]'
                : 'bg-[var(--surface)] text-[var(--textMuted)]'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                activeCount > 0 ? 'bg-[var(--success)]' : 'bg-[var(--textMuted)]'
              }`}
            />
            {activeCount} {activeCount === 1 ? 'node' : 'nodes'} running
          </span>
        </div>

        {/* Separator */}
        <div className="hidden sm:block w-px h-4 bg-[var(--border)]" />

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Download size={14} />
            <span className="font-mono font-semibold text-[var(--text)]">
              {(profile.pullCount ?? 0).toLocaleString()}
            </span>
            <span>pulls</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Star size={14} />
            <span className="font-mono font-semibold text-[var(--text)]">
              {(profile.starCount ?? 0).toLocaleString()}
            </span>
            <span>stars</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar size={14} />
            <span>First seen {new Date(profile.firstSeen).toLocaleDateString()}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} />
            <span>Updated {new Date(profile.lastUpdated).toLocaleDateString()}</span>
          </div>
        </div>
      </div>

      {/* Description */}
      {profile.description && (
        <p className="text-[var(--text)] text-sm leading-relaxed max-w-3xl">
          {profile.description}
        </p>
      )}
    </div>
  );
};
