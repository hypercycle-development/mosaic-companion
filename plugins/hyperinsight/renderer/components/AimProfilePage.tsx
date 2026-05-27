import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, AlertCircle, RefreshCw, MapPin } from 'lucide-react';
import { AimProfileDto, AimNodeInstanceDto, ManifestEndpoint } from '../types';
import { useUserGeo } from '../hooks/useUserGeo';
import { AimProfileHeader } from './AimProfileHeader';
import { AimVersionSelector } from './AimVersionSelector';
import { AimIntelligenceZone } from './AimIntelligenceZone';
import { AimCapabilityZone } from './AimCapabilityZone';
import { AimActivationZone } from './AimActivationZone';
import { TryItPanel } from './TryItPanel';

interface AimReleaseListItem {
  tagName: string;
  lastUpdated?: string;
}

interface AimProfilePageProps {
  aimName: string;
  onBack: () => void;
  onNodeSelect: (nodeLicense: number) => void;
}

export const AimProfilePage = ({ aimName, onBack, onNodeSelect }: AimProfilePageProps) => {
  const [geoEnabled, setGeoEnabled] = useState(false);
  const userGeo = useUserGeo(geoEnabled);

  const [profile, setProfile] = useState<AimProfileDto | null>(null);
  const [nodes, setNodes] = useState<AimNodeInstanceDto[]>([]);
  const [bestNode, setBestNode] = useState<AimNodeInstanceDto | null>(null);
  const [releases, setReleases] = useState<AimReleaseListItem[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nodeTableExpanded, setNodeTableExpanded] = useState(false);

  const [showTryIt, setShowTryIt] = useState(false);
  const [tryItEndpoint, setTryItEndpoint] = useState<ManifestEndpoint | null>(null);
  const [tryItNodeUrl, setTryItNodeUrl] = useState<string | null>(null);

  const fetchInitial = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [profileData, nodesData, bestNodeData, releasesData] = await Promise.all([
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
      ]);

      if (profileData?.error) throw new Error(profileData.error);

      setProfile(profileData ?? null);
      setNodes(Array.isArray(nodesData) ? nodesData : []);
      setBestNode(Array.isArray(bestNodeData) ? bestNodeData[0] ?? null : bestNodeData ?? null);
      setReleases(Array.isArray(releasesData) ? releasesData : []);
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

        <div className="p-6 space-y-6">
          <AimIntelligenceZone
            aimName={aimName}
            nodes={nodes}
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
            onTryEndpoint={(endpoint, nodeUrl) => {
              setTryItEndpoint(endpoint);
              setTryItNodeUrl(nodeUrl);
              setShowTryIt(true);
            }}
          />

          <AimActivationZone
            aimName={aimName}
            bestNode={bestNode}
            selectedVersion={selectedVersion}
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
