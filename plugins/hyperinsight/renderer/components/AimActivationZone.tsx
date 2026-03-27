import React, { useState } from 'react';
import { Play, CheckCircle, AlertCircle, Loader2, Copy, Check, ExternalLink } from 'lucide-react';
import { AimNodeInstanceDto } from '../types';
import { useNodeConnect } from '../hooks/useNodeConnect';

interface AimActivationZoneProps {
  aimName: string;
  bestNode: AimNodeInstanceDto | null;
  selectedVersion: string | null;
  onChooseNode: () => void;
  /** Accepting currencies from best node hardware (optional — shown in MCP config copy). */
  acceptingCurrencies?: string[];
}

export const AimActivationZone = ({
  aimName,
  bestNode,
  selectedVersion,
  onChooseNode,
  acceptingCurrencies = [],
}: AimActivationZoneProps) => {
  const { connect, isConnecting, isConnected, error } = useNodeConnect();
  const [connectSuccess, setConnectSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const endpointUrl = bestNode?.primaryEndpointUrl ?? null;
  const alreadyConnected = endpointUrl ? isConnected(endpointUrl) : false;

  const handleConnect = async () => {
    if (!bestNode || !endpointUrl) return;
    setConnectSuccess(false);
    await connect(endpointUrl, {
      licenseKey: String(bestNode.nodeLicense),
      nodeName: bestNode.nodeName ?? undefined,
    });
    if (!error) setConnectSuccess(true);
  };

  const handleCopyMcp = async () => {
    if (!endpointUrl) return;
    const config = {
      name: aimName,
      endpoint: `${endpointUrl}/aim/0`,
      accepting_currencies: acceptingCurrencies.length > 0 ? acceptingCurrencies : ['nullpay'],
    };
    try {
      await navigator.clipboard.writeText(JSON.stringify(config, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard denied
    }
  };

  const nodeName = bestNode?.nodeName ?? `Node #${bestNode?.nodeLicense}`;
  const nodeRegion = bestNode?.region ?? null;

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 space-y-5">
      <h2 className="text-xs font-semibold text-[var(--textMuted)] uppercase tracking-wider">
        Run This AIM
      </h2>

      {/* Primary CTA */}
      <div className="space-y-3">
        {bestNode ? (
          <>
            <button
              onClick={handleConnect}
              disabled={isConnecting || alreadyConnected}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--primary)] text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Connecting to {nodeName}…
                </>
              ) : alreadyConnected || connectSuccess ? (
                <>
                  <CheckCircle size={16} />
                  Connected
                </>
              ) : (
                <>
                  <Play size={16} />
                  Run This AIM
                </>
              )}
            </button>

            {(alreadyConnected || connectSuccess) && (
              <div className="flex items-start gap-2 p-3 bg-[color-mix(in_srgb,var(--success),transparent_90%)] rounded-lg border border-[color-mix(in_srgb,var(--success),transparent_70%)]">
                <CheckCircle size={14} className="text-[var(--success)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-[var(--success)]">
                    Connected — {nodeName}{nodeRegion ? ` (${nodeRegion})` : ''}
                  </p>
                  <p className="text-xs text-[var(--textMuted)] mt-0.5">
                    This AIM is now available in your Mosaic AI assistant.
                  </p>
                </div>
              </div>
            )}

            {error && !isConnecting && (
              <div className="flex items-start gap-2 p-3 bg-[color-mix(in_srgb,var(--danger),transparent_90%)] rounded-lg border border-[color-mix(in_srgb,var(--danger),transparent_70%)]">
                <AlertCircle size={14} className="text-[var(--danger)] mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-[var(--danger)]">{error}</p>
                  <button
                    onClick={onChooseNode}
                    className="text-xs text-[var(--primary)] hover:underline mt-1"
                  >
                    Try a different node
                  </button>
                </div>
              </div>
            )}

            <p className="text-xs text-[var(--textMuted)]">
              Best available node: <span className="font-mono text-[var(--text)]">{nodeName}</span>
              {nodeRegion && <span> · {nodeRegion}</span>}
            </p>
          </>
        ) : (
          <div className="space-y-2">
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl font-semibold text-sm text-[var(--textMuted)] cursor-not-allowed"
            >
              <AlertCircle size={16} className="text-red-400" />
              No nodes available
            </button>
            <p className="text-xs text-[var(--textMuted)] text-center">
              No nodes are currently running this AIM.
            </p>
          </div>
        )}

        <button
          onClick={onChooseNode}
          className="text-xs text-[var(--primary)] hover:underline flex items-center gap-1"
        >
          Choose a specific node
          <ExternalLink size={10} />
        </button>
      </div>

      {/* MCP / Workflow section */}
      <div className="border-t border-[var(--border)] pt-4 space-y-3">
        <h3 className="text-xs font-semibold text-[var(--textMuted)] uppercase tracking-wider">
          Use in Your AI Workflow
        </h3>

        <div className="flex flex-col sm:flex-row gap-2">
          {/* Add to Mosaic (secondary) */}
          <button
            onClick={handleConnect}
            disabled={isConnecting || alreadyConnected || !bestNode}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-[var(--primary)] text-[var(--primary)] rounded-lg text-sm font-medium hover:bg-[color-mix(in_srgb,var(--primary),transparent_90%)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play size={14} />
            Add to Mosaic
          </button>

          {/* Copy MCP config */}
          <button
            onClick={handleCopyMcp}
            disabled={!endpointUrl}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-[var(--border)] text-[var(--textMuted)] rounded-lg text-sm font-medium hover:border-[var(--text)] hover:text-[var(--text)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {copied ? (
              <>
                <Check size={14} className="text-[var(--success)]" />
                <span className="text-[var(--success)]">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                Copy MCP config
              </>
            )}
          </button>
        </div>

        {/* Estimated cost per call */}
        <p className="text-xs text-[var(--textMuted)]">
          {/* TODO: parse first non-public, non-health endpoint cost from manifest (AimCapabilityZone).
              Until wired up, show fallback message. */}
          Cost varies by endpoint — see capabilities above.
        </p>
      </div>
    </div>
  );
};
