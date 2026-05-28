import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { deriveRoutabilityState } from '../utils';

interface RoutabilityBannerProps {
  totalActiveNodeCount: number | null | undefined;
  routableNodeCount: number | null | undefined;
}

export const RoutabilityBanner = ({ totalActiveNodeCount, routableNodeCount }: RoutabilityBannerProps) => {
  const state = deriveRoutabilityState(totalActiveNodeCount, routableNodeCount);
  const total = totalActiveNodeCount ?? 0;
  const routable = routableNodeCount ?? 0;
  const privateCount = total - routable;

  if (state === 'none-routable') {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm mx-6 mb-2"
      >
        <AlertTriangle size={16} className="text-red-400 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-red-400">
            No accessible node runners available
          </p>
          <p className="mt-0.5 text-red-300/80">
            This AIM is running on {total} node{total !== 1 ? 's' : ''}, but none have publicly
            accessible endpoints. Node operators may be behind a firewall or NAT.
            The AIM cannot be connected to until an operator exposes a public endpoint.
          </p>
        </div>
      </div>
    );
  }

  if (state === 'partially-routable') {
    return (
      <div
        role="note"
        className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/8 px-4 py-3 text-sm mx-6 mb-2"
      >
        <Info size={16} className="text-amber-400 mt-0.5 shrink-0" />
        <div>
          <p className="font-medium text-amber-400">
            Some nodes are not publicly accessible
          </p>
          <p className="mt-0.5 text-amber-300/80">
            {routable} of {total} nodes have public endpoints.{' '}
            The remaining {privateCount} node{privateCount !== 1 ? 's are' : ' is'} behind
            a firewall or NAT and cannot be directly connected to.
          </p>
        </div>
      </div>
    );
  }

  return null;
};
