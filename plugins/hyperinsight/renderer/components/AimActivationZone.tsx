import React, { useState } from 'react';
import { Play, CheckCircle, AlertCircle, Loader2, Copy, Check, ExternalLink, Lock } from 'lucide-react';
import { AimNodeInstanceDto, AimDeploymentDto, SubscriptionDto, SubscribePayload } from '../types';
import { relativeTime } from '../utils';
import { useNodeConnect } from '../hooks/useNodeConnect';

interface AimActivationZoneProps {
  aimName: string;
  bestNode: AimNodeInstanceDto | null;
  selectedVersion: string | null;
  onChooseNode: () => void;
  /** Accepting currencies from best node hardware (optional — shown in MCP config copy). */
  acceptingCurrencies?: string[];
  // Stage 8F additions:
  deployments?: AimDeploymentDto[];
  subscriptions?: SubscriptionDto[];
  aimId?: number | null;
  onSubscriptionsChange?: (subs: SubscriptionDto[]) => void;
  routableNodeCount?: number;
  totalActiveNodeCount?: number;
  hasCallableEndpoints?: boolean | null;
}

type ActivationState = 'ready' | 'none-routable' | 'no-nodes' | 'no-callable-endpoints';

export const AimActivationZone = ({
  aimName,
  bestNode,
  selectedVersion,
  onChooseNode,
  acceptingCurrencies = [],
  deployments = [],
  subscriptions = [],
  aimId,
  onSubscriptionsChange,
  routableNodeCount = 0,
  totalActiveNodeCount = 0,
  hasCallableEndpoints = null,
}: AimActivationZoneProps) => {
  const { connect, isConnecting, isConnected, error } = useNodeConnect();
  const [connectSuccess, setConnectSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [unsubscribing, setUnsubscribing] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const endpointUrl = bestNode?.primaryEndpointUrl ?? null;
  const alreadyConnected = endpointUrl ? isConnected(endpointUrl) : false;

  const activationState: ActivationState =
    hasCallableEndpoints === false                               ? 'no-callable-endpoints' :
    bestNode && bestNode.isRoutable                             ? 'ready' :
    totalActiveNodeCount > 0 && routableNodeCount === 0        ? 'none-routable' :
    'no-nodes';

  // Subscription derived state
  const isSubscribed = subscriptions.some(
    s => s.aimId === aimId && s.status !== 'disconnected',
  );
  const activeSubscription = subscriptions.find(
    s => s.aimId === aimId && s.status !== 'disconnected',
  ) ?? null;

  const handleConnect = async () => {
    if (!bestNode || !endpointUrl) return;
    setConnectSuccess(false);
    await connect(endpointUrl, {
      licenseKey: String(bestNode.nodeLicense),
      nodeName: bestNode.nodeName ?? undefined,
    });
    // Check isConnected instead of relying on the async error state update
    if (isConnected(endpointUrl)) {
      setConnectSuccess(true);
    }
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

  const handleSubscribe = async () => {
    if (!aimId) return;

    // Pick best deployment by compositeScore; fall back to bestNode endpoint
    const bestDeployment = deployments.length > 0
      ? deployments.reduce(
          (best, d) => (d.compositeScore > best.compositeScore ? d : best),
          deployments[0],
        )
      : null;

    const subscribeEndpoint = bestDeployment?.endpointUrl ?? bestNode?.primaryEndpointUrl ?? null;
    if (!subscribeEndpoint) return;

    setSubscribing(true);
    setSubscribeError(null);
    try {
      const payload: SubscribePayload = {
        endpointUrl: subscribeEndpoint,
        aimId,
        nodeLicense: bestDeployment?.nodeLicense ?? bestNode?.nodeLicense ?? undefined,
      };
      await window.electronAPI.hyperinsight.subscribe(payload);
      const updated: unknown = await window.electronAPI.hyperinsight.getSubscriptions();
      const updatedSubs = Array.isArray(updated) ? (updated as SubscriptionDto[]) : [];
      onSubscriptionsChange?.(updatedSubs);
    } catch (e: unknown) {
      setSubscribeError(e instanceof Error ? e.message : 'Subscribe failed');
    } finally {
      setSubscribing(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!activeSubscription) return;
    setUnsubscribing(true);
    try {
      await window.electronAPI.hyperinsight.unsubscribe(activeSubscription.id);
      const updated: unknown = await window.electronAPI.hyperinsight.getSubscriptions();
      const updatedSubs = Array.isArray(updated) ? (updated as SubscriptionDto[]) : [];
      onSubscriptionsChange?.(updatedSubs);
    } catch {
      // non-fatal — stale state is acceptable
    } finally {
      setUnsubscribing(false);
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
        {activationState === 'ready' ? (
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
        ) : activationState === 'no-callable-endpoints' ? (
          <div className="flex flex-col items-start gap-2">
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl font-semibold text-sm text-[var(--textMuted)] cursor-not-allowed opacity-50"
            >
              Not Callable
            </button>
            <div className="flex items-start gap-2 p-3 bg-[var(--surface)] border border-[var(--border)] rounded-lg w-full">
              <AlertCircle size={14} className="text-[var(--textMuted)] mt-0.5 shrink-0" />
              <p className="text-xs text-[var(--textMuted)] leading-relaxed">
                This AIM operates as an internal process and does not expose callable HTTP endpoints.
                It cannot be added to your AI workflow.
              </p>
            </div>
          </div>
        ) : activationState === 'none-routable' ? (
          <div className="flex flex-col items-start gap-2">
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[var(--surface)] border border-[var(--border)] rounded-xl font-semibold text-sm text-[var(--textMuted)] cursor-not-allowed opacity-50"
            >
              Cannot Connect
            </button>
            <p className="text-xs text-red-400 flex items-center gap-1">
              <Lock size={12} />
              No publicly accessible nodes are running this AIM.
              Node operators have not exposed a public endpoint.
            </p>
            <button
              onClick={onChooseNode}
              className="text-xs underline text-gray-400 hover:text-gray-200"
            >
              View all nodes →
            </button>
          </div>
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

      {/* MCP / Workflow section — hidden for non-callable AIMs */}
      {activationState !== 'no-callable-endpoints' && <div className="border-t border-[var(--border)] pt-4 space-y-3">
        <h3 className="text-xs font-semibold text-[var(--textMuted)] uppercase tracking-wider">
          Use in Your AI Workflow
        </h3>

        <div className="flex flex-col sm:flex-row gap-2">
          {/* Add to Mosaic — only shown when a routable node is available */}
          {activationState === 'ready' && (
            <button
              onClick={handleConnect}
              disabled={isConnecting || alreadyConnected}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 border border-[var(--primary)] text-[var(--primary)] rounded-lg text-sm font-medium hover:bg-[color-mix(in_srgb,var(--primary),transparent_90%)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {alreadyConnected || connectSuccess ? (
                <>
                  <CheckCircle size={14} />
                  Added
                </>
              ) : (
                <>
                  <Play size={14} />
                  Add to Mosaic
                </>
              )}
            </button>
          )}

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
      </div>}

      {/* Monitor This AIM section */}
      <div className="border-t border-[var(--border)] pt-4 space-y-3">
        <h3 className="text-xs font-semibold text-[var(--textMuted)] uppercase tracking-wider">
          Monitor This AIM
        </h3>

        {isSubscribed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 p-3 bg-[color-mix(in_srgb,var(--success),transparent_90%)] rounded-lg border border-[color-mix(in_srgb,var(--success),transparent_70%)]">
              <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-semibold text-[var(--success)]">Monitoring active</p>
                {activeSubscription?.lastVerifiedAt && (
                  <p className="text-xs text-[var(--textMuted)] mt-0.5">
                    Last verified {relativeTime(activeSubscription.lastVerifiedAt)}
                  </p>
                )}
              </div>
              <button
                onClick={handleUnsubscribe}
                disabled={unsubscribing}
                className="text-xs text-[var(--textMuted)] hover:text-red-400 transition-colors disabled:opacity-50"
              >
                {unsubscribing ? 'Stopping…' : 'Stop'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleSubscribe}
              disabled={subscribing || !aimId || (deployments.length === 0 && !bestNode)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-[var(--border)] text-[var(--textMuted)] rounded-lg text-sm font-medium hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {subscribing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Subscribing…
                </>
              ) : (
                'Subscribe to Monitor'
              )}
            </button>
            {subscribeError && (
              <p className="text-xs text-red-400">{subscribeError}</p>
            )}
            <p className="text-xs text-[var(--textMuted)]">
              Receive alerts when this AIM&apos;s status changes.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
