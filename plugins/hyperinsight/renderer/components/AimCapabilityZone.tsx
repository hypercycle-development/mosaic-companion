import React, { useState, useEffect } from 'react';
import {
  Code2, ChevronDown, ChevronUp, Info, Search, Box, Layers, Zap,
} from 'lucide-react';
import { ManifestEndpoint, ManifestCost } from '../types';
import { formatUsdcMicro, scoreToColourClass } from '../utils';
import { GatedFeature } from './GatedFeature';

interface AimReleaseListItem {
  tagName: string;
  lastUpdated?: string;
}

interface AimReleaseArchitecture {
  os: string;
  architecture: string;
  gpuMemory?: string;
  ports?: string[];
  labels?: string | Record<string, string>;
  digest?: string;
  size?: number;
}

interface AimReleaseDetail extends AimReleaseListItem {
  architectures: AimReleaseArchitecture[];
  manifestJson?: string;
}

interface AimCapabilityZoneProps {
  aimName: string;
  releases: AimReleaseListItem[];
  selectedVersion: string | null;
  completenessScore: number | null;
  onTryEndpoint: (endpoint: ManifestEndpoint, nodeEndpointUrl: string) => void;
  onEndpointsResolved?: (hasCallable: boolean) => void;
}

// Derive a human-readable endpoint name from a URI path
function uriToLabel(uri: string): string {
  return uri
    .replace(/^\//, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase()) || uri;
}

// Parse ManifestEndpoint array from label JSON
function parseEndpoints(labels: unknown): ManifestEndpoint[] {
  try {
    const parsed = typeof labels === 'string' ? JSON.parse(labels) : labels;
    if (!parsed || typeof parsed !== 'object') return [];

    // Try direct 'endpoints' key
    const endpointsRaw = (parsed as Record<string, unknown>)['endpoints'];
    if (Array.isArray(endpointsRaw)) {
      return endpointsRaw
        .filter((e): e is ManifestEndpoint => e && typeof e === 'object' && 'uri' in e);
    }

    // Try scanning for any array of objects with 'uri' fields
    for (const val of Object.values(parsed as Record<string, unknown>)) {
      if (Array.isArray(val) && val.length > 0 && val[0] && typeof val[0] === 'object' && 'uri' in val[0]) {
        return val.filter((e): e is ManifestEndpoint => 'uri' in e);
      }
    }
  } catch {
    // ignore parse errors
  }
  return [];
}

// Pricing summary from all endpoints
function getPricingSummary(endpoints: ManifestEndpoint[]) {
  const allCosts: ManifestCost[] = endpoints.flatMap(e => e.costs ?? []);
  const currencies = [...new Set(
    endpoints
      .map(e => e.currency)
      .filter((c): c is string => Boolean(c))
      .concat(allCosts.map(c => c.currency))
  )];

  const hasCosts = allCosts.length > 0;
  const hasVariableCosts = hasCosts && allCosts.some(c => c.min !== c.max);
  const model = !hasCosts ? 'Not declared' : hasVariableCosts ? 'Variable' : 'Fixed';

  return { currencies, model, totalEndpoints: endpoints.length };
}

const MethodBadge = ({ method }: { method: string }) => {
  const m = method.toUpperCase();
  const cls = m === 'GET'
    ? 'bg-[color-mix(in_srgb,var(--success),transparent_85%)] text-[var(--success)]'
    : 'bg-[color-mix(in_srgb,var(--primary),transparent_85%)] text-[var(--primary)]';
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono ${cls}`}>{m}</span>
  );
};

interface EndpointCardProps {
  endpoint: ManifestEndpoint;
  bestNodeUrl: string | null;
  onTry: (ep: ManifestEndpoint, nodeUrl: string) => void;
}

const EndpointCard = ({ endpoint, bestNodeUrl, onTry }: EndpointCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const cost = endpoint.costs?.[0] ?? null;
  const isPublic = endpoint.isPublic === true;

  return (
    <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-3 hover:bg-[var(--surfaceAlt)] transition-colors"
      >
        <div className="flex items-center gap-2 text-left">
          <Code2 size={14} className="text-[var(--primary)] shrink-0" />
          <span className="font-medium text-sm text-[var(--text)]">{uriToLabel(endpoint.uri)}</span>
          <span className="font-mono text-xs text-[var(--textMuted)]">{endpoint.uri}</span>
          {(endpoint.inputMethods ?? []).map(m => <MethodBadge key={m} method={m} />)}
          {isPublic && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[color-mix(in_srgb,var(--accent),transparent_85%)] text-[var(--accent)]">
              Public
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-[var(--textMuted)]">{formatUsdcMicro(cost?.estimated)}</span>
          {expanded ? <ChevronUp size={14} className="text-[var(--textMuted)]" /> : <ChevronDown size={14} className="text-[var(--textMuted)]" />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-[var(--border)]">
          {endpoint.documentation && (
            <p className="text-xs text-[var(--textMuted)] pt-2 leading-relaxed">{endpoint.documentation}</p>
          )}

          <div className="grid md:grid-cols-2 gap-3">
            {/* Input */}
            {endpoint.inputBody && Object.keys(endpoint.inputBody).length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase text-[var(--textMuted)] mb-1">Input</div>
                <div className="space-y-0.5">
                  {Object.entries(endpoint.inputBody).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs font-mono">
                      <span className="text-[var(--primary)]">{k}</span>
                      <span className="text-[var(--textMuted)]">{String(typeof v === 'object' ? JSON.stringify(v) : v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Output */}
            {endpoint.output && Object.keys(endpoint.output).length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase text-[var(--textMuted)] mb-1">Output</div>
                <div className="space-y-0.5">
                  {Object.entries(endpoint.output).map(([k, v]) => (
                    <div key={k} className="flex gap-2 text-xs font-mono">
                      <span className="text-[var(--primary)]">{k}</span>
                      <span className="text-[var(--textMuted)]">{String(typeof v === 'object' ? JSON.stringify(v) : v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Try It button — hidden for public endpoints */}
          {!isPublic && (
            <button
              disabled={!bestNodeUrl}
              onClick={() => bestNodeUrl && onTry(endpoint, bestNodeUrl)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--primary)] text-white hover:opacity-80 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {bestNodeUrl ? 'Try It' : 'No nodes available'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return 'N/A';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const AimCapabilityZone = ({
  aimName,
  releases,
  selectedVersion,
  completenessScore,
  onTryEndpoint,
  onEndpointsResolved,
}: AimCapabilityZoneProps) => {
  const [releaseDetail, setReleaseDetail] = useState<AimReleaseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [bestNodeUrl, setBestNodeUrl] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  // Release explorer state (ported from AimDetailView)
  const [showReleaseExplorer, setShowReleaseExplorer] = useState(false);
  const [activeArchIndex, setActiveArchIndex] = useState(0);
  const [labelSearch, setLabelSearch] = useState('');
  const [showRawLabels, setShowRawLabels] = useState(false);

  const targetTag = selectedVersion ?? releases[0]?.tagName ?? null;

  useEffect(() => {
    if (!targetTag) return;
    const fetch = async () => {
      setLoadingDetail(true);
      setActiveArchIndex(0);
      try {
        const [detail, bestNode] = await Promise.all([
          window.electronAPI.hyperinsight.getAimReleaseDetail(aimName, targetTag),
          window.electronAPI.hyperinsight.getAimBestNode(aimName, {
            version: selectedVersion ?? undefined,
          }),
        ]);
        setReleaseDetail(detail ?? null);
        const bn = Array.isArray(bestNode) ? bestNode[0] : bestNode;
        setBestNodeUrl(bn?.primaryEndpointUrl ?? null);

        const manifestEndpoints = detail?.manifestJson ? parseEndpoints(detail.manifestJson) : [];
        const firstArch = detail?.architectures?.[0];
        const hasCallable = manifestEndpoints.length > 0 ||
          (firstArch ? parseEndpoints(firstArch.labels).length > 0 : false);
        onEndpointsResolved?.(hasCallable);
      } catch {
        // non-fatal
      } finally {
        setLoadingDetail(false);
      }
    };
    fetch();
  }, [aimName, targetTag, selectedVersion]);

  const currentArch = releaseDetail?.architectures?.[activeArchIndex];
  const endpoints = (() => {
    if (releaseDetail?.manifestJson) {
      const fromManifest = parseEndpoints(releaseDetail.manifestJson);
      if (fromManifest.length > 0) return fromManifest;
    }
    return currentArch ? parseEndpoints(currentArch.labels) : [];
  })();
  const pricing = getPricingSummary(endpoints);

  const scoreColour =
    completenessScore == null
      ? 'text-[var(--textMuted)]'
      : completenessScore >= 70
      ? 'text-[var(--success)]'
      : completenessScore >= 40
      ? 'text-amber-400'
      : 'text-red-400';

  const rawJson = releaseDetail?.manifestJson
    ? (() => {
        try { return JSON.stringify(JSON.parse(releaseDetail.manifestJson), null, 2); }
        catch { return releaseDetail.manifestJson; }
      })()
    : null;

  return (
    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-5 space-y-5">
      <h2 className="text-xs font-semibold text-[var(--textMuted)] uppercase tracking-wider">Capabilities</h2>

      {loadingDetail ? (
        <div className="animate-pulse space-y-3">
          <div className="h-16 rounded-lg bg-[var(--background)]" />
          <div className="h-24 rounded-lg bg-[var(--background)]" />
        </div>
      ) : (
        <>
          {/* Pricing summary card */}
          {endpoints.length > 0 && (
            <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-3 flex flex-wrap gap-4 items-center text-xs">
              <div>
                <div className="text-[var(--textMuted)] mb-0.5">Currencies</div>
                <div className="font-mono text-[var(--text)]">
                  {pricing.currencies.length > 0
                    ? pricing.currencies.map(c => c === 'nullpay' ? 'Free (nullpay)' : c).join(', ')
                    : 'Not declared'}
                </div>
              </div>
              <div>
                <div className="text-[var(--textMuted)] mb-0.5">Pricing model</div>
                <div className="font-medium text-[var(--text)]">{pricing.model}</div>
              </div>
              <div>
                <div className="text-[var(--textMuted)] mb-0.5">Endpoints</div>
                <div className="font-mono font-bold text-[var(--text)]">{pricing.totalEndpoints}</div>
              </div>
            </div>
          )}

          {/* Endpoint cards */}
          {endpoints.length > 0 ? (
            <div className="space-y-2">
              {endpoints.map(ep => (
                <EndpointCard
                  key={ep.uri}
                  endpoint={ep}
                  bestNodeUrl={bestNodeUrl}
                  onTry={onTryEndpoint}
                />
              ))}
            </div>
          ) : releases.length > 0 && (
            <p className="text-xs text-[var(--textMuted)] italic">
              No structured endpoint manifest found for this release.
            </p>
          )}

          {/* Manifest completeness score */}
          <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-[var(--textMuted)]">
                <Info size={12} /> Manifest Quality
              </div>
              {completenessScore != null ? (
                <span className={`font-mono font-bold text-sm ${scoreColour}`}>
                  {completenessScore}/100
                </span>
              ) : (
                <span className="text-xs text-[var(--textMuted)] italic">Score pending</span>
              )}
            </div>
            {/* TODO: Future decision on gating this feature. Leaving it unlocked for now. */}
            {/* <GatedFeature tier="pro" label="Full manifest audit available with Pro" minHeight={100}> */}
              <div className="space-y-1 text-xs text-[var(--textMuted)]">
                <p>Missing: endpoint documentation on /generate</p>
                <p>Warning: no example_calls defined for /generate</p>
              </div>
            {/* </GatedFeature> */}
          </div>

          {/* Raw manifest viewer */}
          {rawJson && (
            <div>
              <button
                onClick={() => setShowRaw(r => !r)}
                className="flex items-center gap-1.5 text-xs text-[var(--primary)] hover:underline"
              >
                <Code2 size={12} />
                {showRaw ? 'Hide raw manifest.json' : 'View raw manifest.json'}
              </button>
              {showRaw && (
                <pre className="mt-2 bg-[var(--background)] rounded-lg p-3 text-xs font-mono text-[var(--text)] overflow-y-auto overflow-x-hidden max-h-96 custom-scrollbar border border-[var(--border)] whitespace-pre-wrap break-all">
                  {rawJson}
                </pre>
              )}
            </div>
          )}
        </>
      )}

      {/* Release history section (ported from AimDetailView) */}
      {releases.length > 0 && (
        <div className="border-t border-[var(--border)] pt-4">
          <button
            onClick={() => setShowReleaseExplorer(!showReleaseExplorer)}
            className="w-full flex items-center justify-between py-2 hover:bg-[var(--surfaceAlt)] transition-colors rounded-lg px-2 -mx-2"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--textMuted)] uppercase tracking-wider">
              <Layers size={14} className="text-[var(--danger)]" />
              <span className="text-[var(--text)]">Release Explorer</span>
            </div>
            {showReleaseExplorer ? <ChevronUp size={16} className="text-[var(--textMuted)]" /> : <ChevronDown size={16} className="text-[var(--textMuted)]" />}
          </button>

          {showReleaseExplorer && (
            <div className="mt-4 space-y-4">
              {/* Version selector + arch tabs control bar */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-end justify-between gap-4 border-b border-[var(--border)] pb-3">
                {/* Architecture Tabs */}
                <div className="flex-1 overflow-x-auto pb-0.5 no-scrollbar min-h-[32px] flex items-end">
                  {!loadingDetail && releaseDetail ? (
                    <div className="flex gap-4">
                      {releaseDetail.architectures?.map((arch, idx) => (
                        <button
                          key={`${arch.os}/${arch.architecture}`}
                          onClick={() => setActiveArchIndex(idx)}
                          className={`pb-2 text-xs font-mono border-b-2 transition-colors whitespace-nowrap ${
                            activeArchIndex === idx
                              ? 'border-[var(--primary)] text-[var(--primary)]'
                              : 'border-transparent text-[var(--textMuted)] hover:text-[var(--text)]'
                          }`}
                        >
                          {arch.os}/{arch.architecture}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-[var(--textMuted)] italic pb-2">Select a version to view architectures</span>
                  )}
                </div>

                {/* Version selector */}
                <div className="w-full sm:w-auto min-w-[180px]">
                  <label className="block text-[10px] text-[var(--textMuted)] mb-1 font-mono uppercase">Version Tag</label>
                  <select
                    value={targetTag ?? ''}
                    onChange={e => {
                      const tag = e.target.value;
                      if (tag) {
                        setActiveArchIndex(0);
                        setLoadingDetail(true);
                        window.electronAPI.hyperinsight.getAimReleaseDetail(aimName, tag)
                          .then(d => setReleaseDetail(d ?? null))
                          .catch(() => {})
                          .finally(() => setLoadingDetail(false));
                      }
                    }}
                    className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--text)] rounded-lg p-2 text-xs focus:ring-1 focus:ring-[var(--primary)] focus:outline-none"
                  >
                    {releases.map((r, idx) => {
                      const tag = r.tagName || `v${idx}`;
                      return <option key={tag} value={tag}>{tag}</option>;
                    })}
                  </select>
                </div>
              </div>

              {/* Architecture detail */}
              {loadingDetail ? (
                <div className="text-center py-6 text-[var(--textMuted)] animate-pulse text-xs">Loading release details...</div>
              ) : currentArch ? (
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Requirements */}
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-semibold text-[var(--textMuted)] uppercase tracking-wider flex items-center gap-1.5">
                      <Box size={12} /> Requirements & Specs
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[var(--background)] p-2.5 rounded-lg border border-[var(--border)]">
                        <div className="text-[10px] text-[var(--textMuted)] mb-1">GPU Memory</div>
                        <div className="text-xs font-mono text-[var(--text)]">{currentArch.gpuMemory ?? 'N/A'}</div>
                      </div>
                      <div className="bg-[var(--background)] p-2.5 rounded-lg border border-[var(--border)]">
                        <div className="text-[10px] text-[var(--textMuted)] mb-1">Image Size</div>
                        <div className="text-xs font-mono text-[var(--text)]">{formatBytes(currentArch.size)}</div>
                      </div>
                      <div className="bg-[var(--background)] p-2.5 rounded-lg border border-[var(--border)] col-span-2">
                        <div className="text-[10px] text-[var(--textMuted)] mb-1">Ports</div>
                        <div className="flex flex-wrap gap-1">
                          {currentArch.ports && currentArch.ports.length > 0
                            ? currentArch.ports.map(p => (
                              <span key={p} className="bg-[var(--surface)] px-1.5 py-0.5 rounded border border-[var(--border)] text-[10px] font-mono">{p}</span>
                            ))
                            : <span className="text-[var(--textMuted)] italic text-xs">No exposed ports</span>
                          }
                        </div>
                      </div>
                      <div className="bg-[var(--background)] p-2.5 rounded-lg border border-[var(--border)] col-span-2 overflow-hidden">
                        <div className="text-[10px] text-[var(--textMuted)] mb-1">Digest</div>
                        <div className="text-[10px] font-mono text-[var(--textMuted)] truncate" title={currentArch.digest}>
                          {currentArch.digest ?? 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-semibold text-[var(--textMuted)] uppercase tracking-wider flex items-center gap-1.5">
                        <Info size={12} /> Configuration Labels
                      </h4>
                      <button
                        onClick={() => setShowRawLabels(v => !v)}
                        className="text-[10px] text-[var(--primary)] hover:underline"
                      >
                        {showRawLabels ? 'Hide' : 'Show All'}
                      </button>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2 text-[var(--textMuted)]" size={12} />
                      <input
                        type="text"
                        placeholder="Search labels..."
                        className="w-full bg-[var(--background)] border border-[var(--border)] rounded-md py-1.5 pl-8 pr-3 text-xs focus:ring-1 focus:ring-[var(--primary)] text-[var(--text)]"
                        value={labelSearch}
                        onChange={e => setLabelSearch(e.target.value)}
                      />
                    </div>
                    <div className={`bg-[var(--background)] rounded-lg p-3 overflow-auto font-mono text-xs text-[var(--text)] custom-scrollbar ${showRawLabels ? 'max-h-[400px]' : 'max-h-[180px]'}`}>
                      <table className="w-full border-collapse">
                        <tbody>
                          {(() => {
                            try {
                              const labels = typeof currentArch.labels === 'string'
                                ? JSON.parse(currentArch.labels)
                                : currentArch.labels ?? {};
                              const entries = Object.entries(labels as Record<string, unknown>)
                                .filter(([k, v]) =>
                                  k.toLowerCase().includes(labelSearch.toLowerCase()) ||
                                  String(v).toLowerCase().includes(labelSearch.toLowerCase())
                                );
                              if (entries.length === 0) return (
                                <tr><td className="text-[var(--textMuted)] italic">No matches</td></tr>
                              );
                              return entries.map(([key, value]) => (
                                <tr key={key} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surfaceAlt)]">
                                  <td className="py-1.5 pr-3 text-[var(--primary)] font-semibold align-top whitespace-nowrap">{key}</td>
                                  <td className="py-1.5 text-[var(--text)] break-all">{String(value)}</td>
                                </tr>
                              ));
                            } catch {
                              return <tr><td className="text-[var(--danger)]">Error parsing labels</td></tr>;
                            }
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-[var(--textMuted)] italic text-xs">
                  Select an architecture to view details.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
