import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    Server, Activity, Cpu, Zap, HardDrive, Wallet, FileJson, ChevronRight, Globe, ChevronDown, DollarSign
} from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { NodeDetail, RunningAimDetail, NodeProfileDto } from '../types';
import { formatUtcDate, cn, relativeTime, freshnessStatus, formatBytes } from '../utils';
import { UptimeDonut } from './UptimeDonut';
import { GatedFeature } from './GatedFeature';
import { useNodeConnect } from '../hooks/useNodeConnect';

interface NodeDetailPanelProps {
  licenseKey: string;
  onClose: () => void;
  sidebarOpen?: boolean;
}

const AimDetailItem = ({ aim, licenseKey }: { aim: RunningAimDetail, licenseKey: string }) => {
    const [stage, setStage] = useState<'initial' | 'ready' | 'fetching' | 'viewing'>('initial');
    const [manifest, setManifest] = useState<unknown>(null);
    const [error, setError] = useState<string | null>(null);

    const handleInitialClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setStage('ready');
    };

    const handleFetch = async (e: React.MouseEvent) => {
        e.stopPropagation();
        setStage('fetching');
        setError(null);
        try {
            const data = await window.electronAPI.hyperinsight.getAimManifest(licenseKey, aim.name);
            setManifest(data);
            setStage('viewing');
        } catch (err: unknown) {
            console.error(err);
            setError("Failed to retrieve manifest");
            setStage('ready');
        }
    };

    return (
        <div className="border border-[var(--border)] rounded-lg p-3 bg-[var(--surfaceAlt)] shadow-sm mb-3 last:mb-0 transition-all hover:shadow-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-2">
                <div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-[var(--primary)]">{aim.name}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full border border-[var(--primary)]/20">
                            {aim.version || 'Unknown Ver'}
                        </span>
                    </div>
                    {aim.description && (
                        <p className="text-xs text-[var(--textMuted)] mt-1.5 leading-relaxed">{aim.description}</p>
                    )}
                </div>
            </div>

            <div className="mt-2">
                {stage === 'initial' && (
                    <button
                        onClick={handleInitialClick}
                        className="text-xs text-[var(--textMuted)] hover:text-[var(--primary)] flex items-center gap-1 group transition-colors"
                    >
                        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                        Load this aim
                    </button>
                )}

                {stage === 'ready' && (
                    <div className="animate-in slide-in-from-left-2 duration-300 fade-in">
                        <button
                            onClick={handleFetch}
                            className="bg-[var(--primary)] text-white text-xs px-3 py-1.5 rounded shadow-sm hover:bg-[var(--primaryAlt)] transition-colors flex items-center gap-2"
                        >
                            <FileJson size={12} />
                            Retrieve Manifest
                        </button>
                    </div>
                )}

                {stage === 'fetching' && (
                     <div className="text-xs text-[var(--textMuted)] flex items-center gap-2 animate-pulse">
                        <div className="w-2 h-2 bg-[var(--textMuted)] rounded-full animate-bounce" />
                        Fetching manifest from node...
                     </div>
                )}

                {error && (
                    <div className="text-xs text-red-500 mt-1 bg-red-500/10 p-2 rounded">
                        Error: {error}
                    </div>
                )}

                {stage === 'viewing' && manifest && (
                    <div className="mt-2 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-center mb-1">
                             <span className="text-[10px] uppercase text-[var(--textMuted)] font-bold tracking-wider">Manifest.json</span>
                             <button onClick={() => setStage('ready')} className="text-[10px] text-[var(--textMuted)] hover:text-[var(--primary)] underline">Close</button>
                        </div>
                        <div className="bg-black/80 text-gray-200 p-3 rounded text-[10px] font-mono overflow-auto max-h-60 border border-[var(--border)] shadow-inner custom-scrollbar">
                            <pre>{JSON.stringify(manifest, null, 2)}</pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const AccordionSection = ({
    id,
    title,
    icon: Icon,
    expanded,
    onToggle,
    children
}: {
    id: string,
    title: string,
    icon: React.ComponentType<{ size: number; className?: string }>,
    expanded: boolean,
    onToggle: (id: string) => void,
    children: React.ReactNode
}) => {
    return (
        <div className="border-b border-[var(--border)] last:border-0">
            <button
                onClick={() => onToggle(id)}
                className={cn(
                    "w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-[var(--surfaceAlt)]",
                    expanded ? "bg-[var(--surfaceAlt)]" : ""
                )}
            >
                <div className="flex items-center gap-3">
                    <Icon size={18} className="text-[var(--primary)]" />
                    <span className="font-semibold text-sm text-[var(--text)] uppercase tracking-wide">{title}</span>
                </div>
                {expanded ? <ChevronDown size={16} className="text-[var(--textMuted)]" /> : <ChevronRight size={16} className="text-[var(--textMuted)]" />}
            </button>

            {expanded && (
                <div className="p-4 bg-[var(--surface)] animate-in slide-in-from-top-2 duration-200 fade-in border-t border-[var(--border)]/50">
                    {children}
                </div>
            )}
        </div>
    );
};


export const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ licenseKey, onClose, sidebarOpen = false }) => {
  const [node, setNode] = useState<NodeDetail | null>(null);
  const [profile, setProfile] = useState<NodeProfileDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState<string | null>('status');

  const { connect, disconnect, isConnecting, isConnected, error: connectError } = useNodeConnect();

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      // Fetch legacy detail (always — used as fallback)
      try {
        const result = await window.electronAPI.hyperinsight.getNodeDetail(licenseKey);
        setNode(result);
      } catch (e) {
        console.error(e);
      }
      // Fetch full profile (primary source for enriched data)
      try {
        const prof = await window.electronAPI.hyperinsight.getNodeProfile(licenseKey);
        if (prof && !prof.error) setProfile(prof);
        else console.warn('[NodeDetailPanel] getNodeProfile failed, using fallback');
      } catch (e) {
        console.warn('[NodeDetailPanel] getNodeProfile failed, using fallback', e);
      }
      setLoading(false);
    };
    fetchAll();
  }, [licenseKey]);

  const primaryEndpointUrl = node?.endpoints
    ? (node.endpoints.find((e: { isPrimary: boolean }) => e.isPrimary) || node.endpoints[0])?.url ?? ''
    : '';

  const handleConnectToggle = async () => {
    if (!node || !node.endpoints || node.endpoints.length === 0) return;
    const endpoint = node.endpoints.find((e: { isPrimary: boolean }) => e.isPrimary) || node.endpoints[0];
    if (isConnected(endpoint.url)) {
      if (confirm("Are you sure you want to disconnect from this node? This will remove it from your configuration.")) {
        await disconnect(endpoint.url);
        if (!connectError) alert("Node disconnected successfully.");
        else alert(connectError);
      }
    } else {
      await connect(endpoint.url, {
        licenseKey: node.licenseKey,
        runningAims: node.runningAims,
        nodeName: node.name,
      });
      if (!connectError) alert("Node connected successfully!");
      else alert(connectError);
    }
  };

  const toggleSection = (id: string) => {
      setExpandedSection(current => current === id ? null : id);
  };

  // Prefer profile data when available, fall back to node detail
  const hw = profile?.hardware;
  const status = profile?.currentStatus;
  const uptimePct = status ? status.uptimePercent * 100 : (node?.uptimePercent ? node.uptimePercent * 100 : 0);
  const sparklineColour = uptimePct >= 90 ? '#22c55e' : uptimePct >= 70 ? '#f59e0b' : '#ef4444';

  const displayName = profile?.name ?? node?.name ?? (loading ? 'Loading Node...' : 'Unknown Node');

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-all duration-300 ease-in-out backdrop-blur-sm"
        style={{ left: sidebarOpen ? '18rem' : '0' }}
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 bottom-0 w-[450px] bg-[var(--surface)] border-l border-[var(--border)] shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)] sticky top-0 z-10">
        <div className="flex items-center gap-2">
            <button onClick={onClose} className="p-1 hover:bg-[var(--surfaceAlt)] rounded text-[var(--textMuted)] hover:text-[var(--text)] transition-colors" title="Close Panel">
                <ChevronRight size={20} />
            </button>

            <div>
                <h3 className="font-bold flex items-center gap-2 text-[var(--text)] text-lg">
                    <Server size={20} className="text-[var(--primary)]" />
                    <span className="truncate max-w-[180px]" title={displayName}>{displayName}</span>
                </h3>
                <div className="text-xs text-[var(--textMuted)] font-medium mt-0.5 ml-7">Node Details</div>
                {/* Data freshness indicator */}
                {profile?.dataFreshnessUtc && (
                  <p className={cn(
                    'text-xs ml-7',
                    freshnessStatus(profile.dataFreshnessUtc) === 'very-stale' ? 'text-red-400' :
                    freshnessStatus(profile.dataFreshnessUtc) === 'stale'      ? 'text-amber-400' :
                    'text-gray-400'
                  )}>
                    Data as of {relativeTime(profile.dataFreshnessUtc)}
                  </p>
                )}
            </div>
        </div>

        {(node || profile) && (
            <div className="flex gap-4 items-center pr-2">
                <div className="flex flex-col items-center">
                    <UptimeDonut percentage={uptimePct} />
                    <div className="text-[9px] text-[var(--textMuted)] uppercase tracking-wider font-bold mt-1">Uptime</div>
                </div>
                <div className="flex flex-col items-center">
                    <div className="h-[42px] flex items-center justify-center">
                        <div className="text-sm font-bold text-blue-500 font-mono">
                            {(status?.totalHeartbeats ?? node?.totalHeartbeats)?.toLocaleString() || '-'}
                        </div>
                    </div>
                    <div className="text-[9px] text-[var(--textMuted)] uppercase tracking-wider font-bold mt-1">Heartbeats</div>
                </div>
            </div>
        )}
      </div>

      {/* Uptime sparkline (30-day history) */}
      {profile?.uptimeHistory && profile.uptimeHistory.length > 0 ? (
        <div className="px-3 pt-2 pb-1 border-b border-[var(--border)]/30">
          <div className="text-[9px] text-[var(--textMuted)] uppercase tracking-wider font-bold mb-1">30-Day Uptime</div>
          <ResponsiveContainer width="100%" height={60}>
            <AreaChart data={profile.uptimeHistory} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="uptimeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={sparklineColour} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={sparklineColour} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                formatter={(value: number) => [`${value.toFixed(1)}%`, 'Uptime']}
                labelFormatter={(label: string) => new Date(label).toLocaleDateString()}
                contentStyle={{ fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey="uptimePercent"
                stroke={sparklineColour}
                fill="url(#uptimeGradient)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : loading ? (
        <div className="px-3 pt-2 pb-1 border-b border-[var(--border)]/30">
          <div className="w-full h-16 bg-gray-700 animate-pulse rounded" />
        </div>
      ) : null}

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-[var(--textMuted)]">
          <div className="flex flex-col items-center gap-2">
            <Activity className="animate-spin" />
            Loading details...
          </div>
        </div>
      ) : !node && !profile ? (
        <div className="p-8 text-center text-red-400">Failed to load node details.</div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">

          <AccordionSection
            id="status"
            title="Status & Identity"
            icon={Activity}
            expanded={expandedSection === 'status'}
            onToggle={toggleSection}
          >
            <div className="space-y-3 text-sm font-mono">
                <div className="flex justify-between border-b border-[var(--border)]/50 pb-2">
                    <span className="text-[var(--textMuted)]">License</span>
                    <span className="text-[var(--primary)] font-bold truncate ml-4" title={licenseKey}>{licenseKey}</span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)]/50 pb-2">
                    <span className="text-[var(--textMuted)]">Status</span>
                    <span className={(status?.isAlive ?? node?.isAlive) ? "text-emerald-500 font-bold" : "text-red-500 font-bold"}>
                        {(status?.isAlive ?? node?.isAlive) ? "ONLINE" : "OFFLINE"}
                    </span>
                </div>
                <div className="flex justify-between border-b border-[var(--border)]/50 pb-2">
                    <span className="text-[var(--textMuted)]">Platform</span>
                    <span className="text-[var(--text)]">{profile?.platform ?? node?.platform ?? 'Unknown'}</span>
                </div>
                <div className="flex justify-between pb-1">
                    <span className="text-[var(--textMuted)]">Last Contact</span>
                    <span className="text-[var(--text)] text-xs">
                        {formatUtcDate(profile?.lastContactAt ?? node?.lastContactAt)}
                    </span>
                </div>
                {/* TODO: Tilling Score
                    Composite score of uptime_ratio × computation_ratio × reputation_ratio.
                    Source: Merklizer API (external) — not yet in database.
                    When available, display here as a 0-2.0 score with breakdown.
                    See HyperCycle whitepaper section 4.2 for formula details. */}
            </div>
          </AccordionSection>

          <AccordionSection
            id="hardware"
            title="Hardware Resources"
            icon={Cpu}
            expanded={expandedSection === 'hardware'}
            onToggle={toggleSection}
          >
            <div className="space-y-3 text-sm font-mono">
                <div className="flex items-center justify-between border-b border-[var(--border)]/50 pb-2">
                    <div className="flex items-center gap-2 text-[var(--textMuted)]">
                        <Cpu size={14} /> CPU
                    </div>
                    <span className="text-[var(--text)] font-bold">{(hw?.cpuCount ?? node?.cpuCount ?? 0)} Cores</span>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--border)]/50 pb-2">
                    <div className="flex items-center gap-2 text-[var(--textMuted)]">
                        <Zap size={14} /> GPU
                    </div>
                    <span className="text-[var(--text)] font-bold">
                        {(hw?.gpuCount ?? node?.gpuCount ?? 0) > 0
                            ? `${hw?.gpuCount ?? node?.gpuCount}x ${hw?.gpuName ?? node?.gpuName ?? 'Unknown'}`
                            : 'None'}
                    </span>
                </div>
                <div className="flex items-center justify-between border-b border-[var(--border)]/50 pb-2">
                    <div className="flex items-center gap-2 text-[var(--textMuted)]">
                        <HardDrive size={14} /> RAM
                    </div>
                    <span className="text-[var(--text)]">{formatBytes(hw?.ramBytes ?? node?.ramBytes)}</span>
                </div>
                <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2 text-[var(--textMuted)]">
                        <Zap size={14} /> VRAM
                    </div>
                    <span className="text-[var(--text)]">{formatBytes(hw?.vramBytes ?? node?.vramBytes)}</span>
                </div>
            </div>
          </AccordionSection>

          <AccordionSection
            id="wallets"
            title="Wallets"
            icon={Wallet}
            expanded={expandedSection === 'wallets'}
            onToggle={toggleSection}
          >
             <div className="space-y-4 font-mono">
                 <div>
                     <span className="text-xs text-[var(--textMuted)] block mb-1">Hot Wallet (Tiller)</span>
                     <code className="block bg-[var(--surfaceAlt)] p-2 rounded text-[10px] text-[var(--text)] break-all border border-[var(--border)]">
                         {hw?.hotWalletAddress ?? node?.hotWalletAddress ?? 'Not Assigned'}
                     </code>
                 </div>
                 <div>
                     <span className="text-xs text-[var(--textMuted)] block mb-1">Cold Wallet</span>
                     <code className="block bg-[var(--surfaceAlt)] p-2 rounded text-[10px] text-[var(--text)] break-all border border-[var(--border)]">
                         {hw?.coldWalletAddress ?? node?.coldWalletAddress ?? 'Not Assigned'}
                     </code>
                 </div>
             </div>
          </AccordionSection>

          <AccordionSection
            id="endpoints"
            title="Endpoints"
            icon={Globe}
            expanded={expandedSection === 'endpoints'}
            onToggle={toggleSection}
          >
            <div className="space-y-2 font-mono">
                {node?.endpoints && node.endpoints.length > 0 ? (
                    node.endpoints.map((ep, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs p-2 bg-[var(--surfaceAlt)] rounded border border-[var(--border)]">
                            <span className="text-[var(--textMuted)] uppercase px-1.5 py-0.5 bg-[var(--surface)] rounded text-[9px] border border-[var(--border)]">
                                {ep.type}
                            </span>
                            <a href={ep.url} target="_blank" rel="noopener noreferrer" className="text-[var(--primary)] hover:underline truncate ml-2 flex-1 text-right">
                                {ep.url}
                            </a>
                        </div>
                    ))
                ) : (
                    <span className="text-sm text-[var(--textMuted)] italic block text-center py-2">No endpoints listed</span>
                )}
            </div>
          </AccordionSection>

          <AccordionSection
            id="aims"
            title="Running AIMs"
            icon={Server}
            expanded={expandedSection === 'aims'}
            onToggle={toggleSection}
          >
            {node?.runningAims && node.runningAims.length > 0 ? (
                <div className="space-y-2">
                    {node.runningAims.map((aim, idx) => (
                        <AimDetailItem key={idx} aim={aim} licenseKey={licenseKey} />
                    ))}
                </div>
            ) : (
                <span className="text-sm text-[var(--textMuted)] italic block text-center py-2">No active AIMs</span>
            )}
          </AccordionSection>

          <AccordionSection
            id="revenue"
            title="Revenue"
            icon={DollarSign}
            expanded={expandedSection === 'revenue'}
            onToggle={toggleSection}
          >
            {profile?.isRevenueIncluded && profile.revenue ? (
              <div className="space-y-2 text-sm font-mono">
                <div className="flex justify-between border-b border-[var(--border)]/50 pb-2">
                  <span className="text-[var(--textMuted)]">Total Revenue</span>
                  <span className="text-[var(--success)] font-bold">
                    ${profile.revenue.totalRevenueUsdc.toFixed(2)} USDC
                  </span>
                </div>
                {profile.revenue.revenueBySource.map((s, i) => (
                  <div key={i} className="flex justify-between text-xs">
                    <span className="text-[var(--textMuted)]">{s.source} ({s.chain})</span>
                    <span>${s.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <GatedFeature tier="pro" label="Node revenue analytics available with Pro" minHeight={80}>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Total revenue</span>
                    <span>—</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Revenue by source</span>
                    <span>—</span>
                  </div>
                </div>
              </GatedFeature>
            )}
          </AccordionSection>

        </div>
      )}

      {/* Footer / Actions */}
      <div className="p-4 border-t border-[var(--border)] bg-[var(--surface)] mt-auto sticky bottom-0 z-20">
        <button
            onClick={handleConnectToggle}
            disabled={isConnecting || !(status?.isAlive ?? node?.isAlive)}
            className={cn(
                "w-full flex items-center justify-center gap-2 text-white py-3 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-[0.98]",
                isConnected(primaryEndpointUrl)
                    ? "bg-red-500 hover:bg-red-600 hover:shadow-red-500/20"
                    : "bg-[var(--primary)] hover:bg-[var(--primaryAlt)] hover:shadow-[var(--primary)]/20"
            )}
        >
            <Server size={18} />
            {isConnecting
                ? (isConnected(primaryEndpointUrl) ? 'DISCONNECTING...' : 'CONNECTING...')
                : (isConnected(primaryEndpointUrl) ? 'DISCONNECT FROM NODE' : 'CONNECT TO NODE')}
        </button>
      </div>
    </div>
    </>,
    document.body
  );
};
