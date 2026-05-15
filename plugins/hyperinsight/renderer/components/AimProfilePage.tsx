import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, AlertCircle, RefreshCw, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import {
  AimProfileDto,
  AimNodeInstanceDto,
  ManifestEndpoint,
  AimDeploymentDto,
  SubscriptionDto,
  VerificationEventDto,
} from '../types';
import { relativeTime } from '../utils';
import { useUserGeo } from '../hooks/useUserGeo';
import { AimProfileHeader } from './AimProfileHeader';
import { AimVersionSelector } from './AimVersionSelector';
import { RoutabilityBanner } from './RoutabilityBanner';
import { AimIntelligenceZone } from './AimIntelligenceZone';
import { AimCapabilityZone } from './AimCapabilityZone';
import { AimActivationZone } from './AimActivationZone';
import { TryItPanel } from './TryItPanel';
import { GatedFeature } from './GatedFeature';
import { Tooltip } from './Tooltip';

interface AimReleaseListItem {
  tagName: string;
  lastUpdated?: string;
}

interface AimProfilePageProps {
  aimName: string;
  onBack: () => void;
  onNodeSelect: (nodeLicense: number) => void;
}

// ── VerificationHistoryPanel ──────────────────────────────────────────────────

interface VerificationHistoryPanelProps {
  subscriptions: SubscriptionDto[];
  aimId: number | null;
}

const VerificationHistoryPanel = ({ subscriptions, aimId }: VerificationHistoryPanelProps) => {
  const [events, setEvents] = useState<VerificationEventDto[]>([]);
  const [loading, setLoading] = useState(false);

  const activeSub = subscriptions.find(
    s => s.aimId === aimId && s.status !== 'disconnected',
  ) ?? null;

  useEffect(() => {
    if (!activeSub) return;
    setLoading(true);
    window.electronAPI.hyperinsight
      .getVerificationHistory(activeSub.id)
      .then((data: unknown) =>
        setEvents(Array.isArray(data) ? (data as VerificationEventDto[]) : []),
      )
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSub?.id]);

  if (!activeSub) {
    return (
      <p className="text-xs text-[var(--textMuted)] italic py-2">
        Subscribe to monitor this AIM to view full verification history.
      </p>
    );
  }
  if (loading) {
    return <p className="text-xs text-[var(--textMuted)] py-2">Loading history…</p>;
  }
  if (events.length === 0) {
    return <p className="text-xs text-[var(--textMuted)] italic py-2">No verification events yet.</p>;
  }
  return (
    <table className="w-full text-left border-collapse text-xs">
      <thead>
        <tr className="border-b border-[var(--border)]">
          <th className="py-1.5 px-2 text-[var(--textMuted)] font-medium">Time</th>
          <th className="py-1.5 px-2 text-[var(--textMuted)] font-medium">Type</th>
          <th className="py-1.5 px-2 text-[var(--textMuted)] font-medium">Status</th>
          <th className="py-1.5 px-2 text-[var(--textMuted)] font-medium">Latency</th>
          <th className="py-1.5 px-2 text-[var(--textMuted)] font-medium">Error</th>
        </tr>
      </thead>
      <tbody>
        {events.map((ev, i) => (
          <tr key={i} className="border-b border-[var(--border)] last:border-0">
            <td className="py-1.5 px-2 font-mono">{relativeTime(ev.time)}</td>
            <td className="py-1.5 px-2">{ev.probeType}</td>
            <td className="py-1.5 px-2">
              <span className={ev.isHealthy ? 'text-[var(--success)]' : 'text-red-400'}>
                {ev.isHealthy ? 'OK' : `HTTP ${ev.httpStatus ?? '—'}`}
              </span>
            </td>
            <td className="py-1.5 px-2 font-mono">
              {ev.latencyMs != null ? `${ev.latencyMs}ms` : '—'}
            </td>
            <td className="py-1.5 px-2 text-red-400 max-w-[200px] truncate">
              {ev.errorMessage ?? '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ── AimProfilePage ────────────────────────────────────────────────────────────

export const AimProfilePage = ({ aimName, onBack, onNodeSelect }: AimProfilePageProps) => {
  const [geoEnabled, setGeoEnabled] = useState(false);
  const userGeo = useUserGeo(geoEnabled);

  const [profile, setProfile] = useState<AimProfileDto | null>(null);
  const [nodes, setNodes] = useState<AimNodeInstanceDto[]>([]);
  const [bestNode, setBestNode] = useState<AimNodeInstanceDto | null>(null);
  const [releases, setReleases] = useState<AimReleaseListItem[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [deployments, setDeployments] = useState<AimDeploymentDto[]>([]);
  const [subscriptions, setSubscriptions] = useState<SubscriptionDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeTableExpanded, setNodeTableExpanded] = useState(false);
  const [verHistExpanded, setVerHistExpanded] = useState(false);

  const [aimHasCallableEndpoints, setAimHasCallableEndpoints] = useState<boolean | null>(null);

  const [showTryIt, setShowTryIt] = useState(false);
  const [tryItEndpoint, setTryItEndpoint] = useState<ManifestEndpoint | null>(null);
  const [tryItNodeUrl, setTryItNodeUrl] = useState<string | null>(null);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, nodesData, bestNodeData, releasesData, subsData] = await Promise.all([
        window.electronAPI.hyperinsight.getAimProfile(aimName),
        window.electronAPI.hyperinsight.getAimNodes(aimName, {
          userLat: userGeo?.lat,
          userLng: userGeo?.lng,
        }),
        window.electronAPI.hyperinsight.getAimBestNode(aimName, {
          userLat: userGeo?.lat,
          userLng: userGeo?.lng,
        }),
        window.electronAPI.hyperinsight.getAimReleases(aimName),
        window.electronAPI.hyperinsight.getSubscriptions(),
      ]);

      if (profileData?.error) throw new Error(profileData.error);

      setProfile(profileData ?? null);
      setNodes(Array.isArray(nodesData) ? nodesData : []);
      setBestNode(Array.isArray(bestNodeData) ? bestNodeData[0] ?? null : bestNodeData ?? null);
      setReleases(Array.isArray(releasesData) ? releasesData : []);
      setSubscriptions(Array.isArray(subsData) ? subsData : []);

      // Sequential: requires profileData.id
      if (profileData?.id != null) {
        try {
          const deploymentsData = await window.electronAPI.hyperinsight.getAimDeployments(profileData.id);
          setDeployments(Array.isArray(deploymentsData) ? deploymentsData : []);
        } catch {
          setDeployments([]); // non-fatal — node table still works without deployments
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load AIM profile');
    } finally {
      setLoading(false);
    }
  }, [aimName, userGeo?.lat, userGeo?.lng]);

  // Initial fetch (run once geo is settled — may be null if denied)
  useEffect(() => {
    fetchInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aimName]);

  // Re-fetch nodes + bestNode when version filter changes
  useEffect(() => {
    if (loading) return; // skip while initial load in progress
    const fetchVersionNodes = async () => {
      try {
        const opts = {
          version: selectedVersion ?? undefined,
          userLat: userGeo?.lat,
          userLng: userGeo?.lng,
        };
        const [nodesData, bestNodeData] = await Promise.all([
          window.electronAPI.hyperinsight.getAimNodes(aimName, opts),
          window.electronAPI.hyperinsight.getAimBestNode(aimName, opts),
        ]);
        setNodes(Array.isArray(nodesData) ? nodesData : []);
        setBestNode(Array.isArray(bestNodeData) ? bestNodeData[0] ?? null : bestNodeData ?? null);
      } catch {
        // non-fatal — keep stale data
      }
    };
    fetchVersionNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVersion]);

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-[var(--background)] text-[var(--text)]">
        {/* Back bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--overlay)] shrink-0">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--textMuted)]"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-sm text-[var(--textMuted)] font-mono">{aimName}</span>
        </div>
        {/* Skeleton */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-pulse">
          <div className="h-32 rounded-xl bg-[var(--surface)]" />
          <div className="h-10 rounded-lg bg-[var(--surface)]" />
          <div className="grid grid-cols-4 gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="h-24 rounded-xl bg-[var(--surface)]" />
            ))}
          </div>
          <div className="h-64 rounded-xl bg-[var(--surface)]" />
          <div className="h-48 rounded-xl bg-[var(--surface)]" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col bg-[var(--background)] text-[var(--text)]">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--overlay)] shrink-0">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--textMuted)]"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-sm text-[var(--textMuted)] font-mono">{aimName}</span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <AlertCircle size={48} className="text-[var(--danger)]" />
          <p className="text-[var(--danger)] text-center max-w-sm">{error}</p>
          <button
            onClick={fetchInitial}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--surface)] border border-[var(--border)] rounded-lg hover:bg-[var(--surfaceAlt)] transition-colors text-sm"
          >
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      </div>
    );
  }

  // Liveness dot strip: dot color based on healthScore thresholds, failing = red + pulse
  const livenessDots = deployments.map(d => {
    const isFailing = d.consecutiveFailures >= 5;
    const dotClass = isFailing
      ? 'bg-red-500 animate-pulse'
      : d.healthScore >= 80
      ? 'bg-green-500'
      : d.healthScore >= 50
      ? 'bg-amber-500'
      : 'bg-red-500';
    const tooltip = `${d.nodeName ?? `#${d.nodeLicense}`}${
      d.consecutiveFailures > 0 ? ` — ${d.consecutiveFailures} consecutive failure${d.consecutiveFailures !== 1 ? 's' : ''}` : ''
    }`;
    return { key: d.nodeLicense, dotClass, tooltip };
  });

  // Free-tier verification summary: most-recently-probed deployment
  const sortedByProbe = [...deployments]
    .filter(d => d.lastProbedAt != null)
    .sort(
      (a, b) =>
        new Date(b.lastProbedAt!).getTime() - new Date(a.lastProbedAt!).getTime(),
    );
  const latestProbedDeployment = sortedByProbe[0] ?? null;

  return (
    <div className="aim-profile-page h-full flex flex-col overflow-hidden bg-[var(--background)] text-[var(--text)]">
      {/* Back navigation bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--overlay)] backdrop-blur shrink-0 z-10">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 p-1.5 hover:bg-[var(--surface)] rounded-lg transition-colors text-[var(--textMuted)] hover:text-[var(--text)]"
        >
          <ArrowLeft size={18} />
          <span className="text-sm font-medium">Back</span>
        </button>
        <span className="text-sm text-[var(--textMuted)] font-mono truncate flex-1">{aimName}</span>
        <button
          onClick={() => setGeoEnabled(v => !v)}
          title={geoEnabled ? 'Location-based node sorting enabled — click to disable' : 'Enable location-based node sorting'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
            geoEnabled
              ? 'bg-[var(--primary)] text-white border-transparent'
              : 'bg-[var(--surface)] text-[var(--textMuted)] border-[var(--border)] hover:bg-[var(--surfaceAlt)]'
          }`}
        >
          <MapPin size={13} />
          {geoEnabled ? 'Location on' : 'Use my location'}
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <AimProfileHeader profile={profile} />

        <AimVersionSelector
          versions={profile?.versions ?? []}
          selectedVersion={selectedVersion}
          onVersionChange={setSelectedVersion}
        />

        <RoutabilityBanner
          totalActiveNodeCount={profile?.totalActiveNodeCount ?? 0}
          routableNodeCount={profile?.routableNodeCount ?? 0}
        />

        {/* Liveness dot strip (shown only when deployment data is present) */}
        {livenessDots.length > 0 && (
          <div className="px-6 py-2 flex items-center gap-1.5 overflow-x-auto border-b border-[var(--border)]">
            <span className="text-xs text-[var(--textMuted)] shrink-0 mr-1">Probed nodes:</span>
            {livenessDots.map(({ key, dotClass, tooltip }) => (
              <Tooltip key={key} content={tooltip}>
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotClass}`} />
              </Tooltip>
            ))}
            <span className="text-xs text-[var(--textMuted)] ml-2">
              {deployments.length} deployment{deployments.length !== 1 ? 's' : ''}
            </span>
          </div>
        )}

        <div className="p-6 space-y-6">
          <AimIntelligenceZone
            aimName={aimName}
            nodes={nodes}
            deployments={deployments}
            stats={profile?.latestStats ?? null}
            dataFreshnessUtc={profile?.dataFreshnessUtc ?? null}
            hasUserGeo={userGeo !== null}
            expanded={nodeTableExpanded}
            onExpandChange={setNodeTableExpanded}
            onNodeSelect={onNodeSelect}
          />

          <AimCapabilityZone
            aimName={aimName}
            releases={releases}
            selectedVersion={selectedVersion}
            completenessScore={profile?.completenessScore ?? null}
            onEndpointsResolved={setAimHasCallableEndpoints}
            onTryEndpoint={(endpoint, nodeUrl) => {
              setTryItEndpoint(endpoint);
              setTryItNodeUrl(nodeUrl);
              setShowTryIt(true);
            }}
          />

          {/* Verification History (shown only when deployment data is present) */}
          {deployments.length > 0 && (
            <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 space-y-3">
              <button
                onClick={() => setVerHistExpanded(v => !v)}
                className="flex items-center gap-2 w-full text-left"
              >
                {verHistExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <h2 className="text-xs font-semibold text-[var(--textMuted)] uppercase tracking-wider">
                  Verification History
                </h2>
              </button>

              {/* Free tier: latest probe summary from deployments array */}
              {latestProbedDeployment && (
                <div className="text-xs text-[var(--textMuted)] space-y-1">
                  <p>
                    Last probed:{' '}
                    <span className="text-[var(--text)]">
                      {relativeTime(latestProbedDeployment.lastProbedAt)}
                    </span>
                    {latestProbedDeployment.nodeName && (
                      <span className="font-mono ml-1">
                        ({latestProbedDeployment.nodeName})
                      </span>
                    )}
                  </p>
                  {latestProbedDeployment.consecutiveFailures > 0 && (
                    <p className="text-amber-400">
                      {latestProbedDeployment.consecutiveFailures} consecutive failure
                      {latestProbedDeployment.consecutiveFailures !== 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              )}

              {/* Pro-gated: full verification history */}
              {verHistExpanded && (
                <GatedFeature
                  tier="pro"
                  label="Full verification history requires Pro"
                  minHeight={120}
                >
                  <VerificationHistoryPanel
                    subscriptions={subscriptions}
                    aimId={profile?.id ?? null}
                  />
                </GatedFeature>
              )}
            </div>
          )}

          <AimActivationZone
            aimName={aimName}
            bestNode={bestNode}
            selectedVersion={selectedVersion}
            hasCallableEndpoints={aimHasCallableEndpoints}
            deployments={deployments}
            subscriptions={subscriptions}
            aimId={profile?.id}
            onSubscriptionsChange={setSubscriptions}
            routableNodeCount={profile?.routableNodeCount ?? 0}
            totalActiveNodeCount={profile?.totalActiveNodeCount ?? 0}
            onChooseNode={() => {
              setNodeTableExpanded(true);
              // Scroll Intelligence Zone into view
              document.querySelector('.aim-intelligence-zone')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </div>
      </div>

      {/* TryIt slide-out panel */}
      {showTryIt && tryItEndpoint && tryItNodeUrl && (
        <TryItPanel
          aimName={aimName}
          endpoint={tryItEndpoint}
          nodeEndpointUrl={tryItNodeUrl}
          onClose={() => {
            setShowTryIt(false);
            setTryItEndpoint(null);
            setTryItNodeUrl(null);
          }}
        />
      )}
    </div>
  );
};
