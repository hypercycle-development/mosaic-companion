import React from 'react';
import { AimVersionSummaryDto } from '../types';

interface AimVersionSelectorProps {
  versions: AimVersionSummaryDto[];
  selectedVersion: string | null;
  onVersionChange: (version: string | null) => void;
}

export const AimVersionSelector = ({
  versions,
  selectedVersion,
  onVersionChange,
}: AimVersionSelectorProps) => {
  if (!versions || versions.length === 0) return null;

  return (
    <div
      className="sticky top-0 z-10 bg-[var(--background)] border-b border-[var(--border)] px-6 py-2"
    >
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
        {/* "All versions" pill */}
        <button
          onClick={() => onVersionChange(null)}
          className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
            selectedVersion === null
              ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
              : 'bg-transparent border-[var(--border)] text-[var(--textMuted)] hover:text-[var(--text)] hover:border-[var(--text)]'
          }`}
        >
          All versions
        </button>

        {versions.map(v => (
          <button
            key={v.tagName}
            onClick={() => onVersionChange(v.tagName)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
              selectedVersion === v.tagName
                ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                : 'bg-transparent border-[var(--border)] text-[var(--textMuted)] hover:text-[var(--text)] hover:border-[var(--text)]'
            }`}
          >
            <span className="font-mono">{v.tagName}</span>
            {v.activeInstanceCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  selectedVersion === v.tagName
                    ? 'bg-white/20 text-white'
                    : 'bg-[color-mix(in_srgb,var(--success),transparent_80%)] text-[var(--success)]'
                }`}
              >
                {v.activeInstanceCount}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
