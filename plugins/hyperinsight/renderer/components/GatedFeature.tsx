// TODO: When monetisation launches, replace the hardcoded "always gated" logic
// with a tier check from the user auth context. The current behaviour gates
// all features for all users regardless of tier. API key tier is available
// in api_keys.tier ('free' | 'pro' | 'enterprise') and will need to be
// surfaced to the renderer via a new IPC event.

import React from 'react';

interface GatedFeatureProps {
  tier: 'pro' | 'dev' | 'enterprise';
  children: React.ReactNode;
  label?: string;
  blurContent?: boolean;   // default true
  minHeight?: number;      // px, optional minimum height for the container
}

export function GatedFeature({
  tier,
  children,
  label,
  blurContent = true,
  minHeight,
}: GatedFeatureProps) {
  const tierLabel = tier === 'pro' ? 'PRO' : tier === 'dev' ? 'DEV' : 'ENTERPRISE';
  const tierColour =
    tier === 'pro'        ? 'bg-amber-500 text-white' :
    tier === 'dev'        ? 'bg-blue-600 text-white'  :
    /* enterprise */        'bg-purple-600 text-white';
  const defaultLabel = `Upgrade to ${tierLabel} to unlock this feature`;

  return (
    <div
      className="relative overflow-hidden"
      style={minHeight ? { minHeight } : undefined}
    >
      {/* Content — blurred when blurContent is true */}
      <div
        className={blurContent ? 'pointer-events-none select-none' : undefined}
        style={blurContent ? { filter: 'blur(3px)' } : undefined}
      >
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/10">
        <span className={`px-2 py-0.5 rounded text-xs font-bold ${tierColour}`}>
          {tierLabel}
        </span>
        <span className="text-xs text-center px-4 max-w-xs">
          {label ?? defaultLabel}
        </span>
        <button
          className="text-xs underline opacity-70 hover:opacity-100"
          onClick={() => {
            console.log('upgrade_intent', tier, label ?? defaultLabel);
            // TODO: replace with actual upgrade flow / analytics event
            //       when monetisation launches.
          }}
        >
          Learn more
        </button>
      </div>
    </div>
  );
}

export default GatedFeature;
