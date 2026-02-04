import React, { useState, useEffect } from 'react';
import { Server, Zap, Cpu, Download, Star, Clock, ArrowLeft, Layers, Box, Terminal, Info, ChevronDown, ChevronUp, Search, List } from 'lucide-react';
import { AimTrendChart } from './AimTrendChart';

// --- Types ---
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
}

export const AimDetailView = ({ name, onBack }: { name: string, onBack: () => void }) => {
    // Stats State
    const [range, setRange] = useState('1d');
    const [metric, setMetric] = useState('activeNodes');
    const [historicalStats, setHistoricalStats] = useState<any[]>([]);
    const [realtimeStats, setRealtimeStats] = useState<any>(null);
    const [meta, setMeta] = useState<any>(null);
    
    // Loading States
    const [loadingHistory, setLoadingHistory] = useState(true);
    const [loadingMeta, setLoadingMeta] = useState(true);

    // New State for Releases
    const [showReleaseExplorer, setShowReleaseExplorer] = useState(false);
    const [releases, setReleases] = useState<AimReleaseListItem[]>([]);
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [releaseDetail, setReleaseDetail] = useState<AimReleaseDetail | null>(null);
    const [loadingReleases, setLoadingReleases] = useState(false);
    const [loadingReleaseDetail, setLoadingReleaseDetail] = useState(false);
    const [activeArchIndex, setActiveArchIndex] = useState(0);
    const [labelSearch, setLabelSearch] = useState('');
    const [showRawLabels, setShowRawLabels] = useState(false);

    // Fetch Historical Stats
    useEffect(() => {
        const fetchHistory = async () => {
            setLoadingHistory(true);
            try {
                const data = await window.electronAPI.hyperinsight.getAimStats(name, range);
                setHistoricalStats(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error("Failed to fetch stats", e);
            } finally {
                setLoadingHistory(false);
            }
        };
        fetchHistory();
    }, [name, range]);

    // Fetch Real-time Stats
    useEffect(() => {
        const fetchCurrent = async () => {
            try {
                const data = await window.electronAPI.hyperinsight.getAimStatsCurrent(name);
                setRealtimeStats(data);
            } catch (e) {
                console.error("Failed to fetch current stats", e);
            }
        };
        fetchCurrent();
    }, [name]);

    // Fetch Meta
    useEffect(() => {
        const fetchMeta = async () => {
            setLoadingMeta(true);
            try {
                const data = await window.electronAPI.hyperinsight.getAimDetails(name);
                setMeta(data);
            } catch (e) {
                console.error("Failed to fetch meta", e);
            } finally {
                setLoadingMeta(false);
            }
        };
        fetchMeta();
    }, [name]);

    // Fetch Releases
    useEffect(() => {
        const fetchReleases = async () => {
            if (releases.length > 0) return;

            setLoadingReleases(true);
            try {
                const data = await window.electronAPI.hyperinsight.getAimReleases(name);
                if (Array.isArray(data)) {
                    setReleases(data);
                    // Select first tag if available
                    if (data.length > 0 && !selectedTag) {
                        const first = data[0];
                        // Handle potential object structure issues
                        const tag = first.tagName || (typeof first === 'string' ? first : null);
                        if (tag) setSelectedTag(tag);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch releases", e);
            } finally {
                setLoadingReleases(false);
            }
        };
        
        if (showReleaseExplorer) {
            fetchReleases();
        }
    }, [name, showReleaseExplorer]);

    // Fetch Release Detail
    useEffect(() => {
        if (!selectedTag) return;

        const fetchDetail = async () => {
            setLoadingReleaseDetail(true);
            try {
                const data = await window.electronAPI.hyperinsight.getAimReleaseDetail(name, selectedTag);
                setReleaseDetail(data);
                setActiveArchIndex(0); // Reset arch tab
            } catch (e) {
                console.error("Failed to fetch release detail", e);
            } finally {
                setLoadingReleaseDetail(false);
            }
        };
        fetchDetail();
    }, [name, selectedTag]);

    const currentArch = releaseDetail?.architectures?.[activeArchIndex];

    // Helpers
    const formatBytes = (bytes?: number) => {
        if (!bytes) return 'N/A';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="space-y-8 p-6 font-sans animate-in fade-in duration-300">
            <header className="space-y-6">
                <div className="flex items-center space-x-4">
                    <button onClick={onBack} className="p-2 hover:bg-[var(--surface)] rounded-full transition-colors text-[var(--textMuted)]">
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-[var(--text)] font-mono">
                            <span className="text-[var(--primary)]">{name}</span>
                        </h1>
                        <p className="text-[var(--textMuted)]">Performance & Analytics</p>
                    </div>
                </div>

                {/* Current Stats (Real-time) */}
                <div className="grid gap-4 md:grid-cols-3">
                    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--success),transparent_90%)] text-[var(--success)]"><Server size={20} /></div>
                            <h3 className="text-sm font-medium text-[var(--textMuted)] font-mono">Active Nodes</h3>
                        </div>
                        <p className="text-2xl font-bold text-[var(--text)] font-mono">
                            {realtimeStats ? realtimeStats.activeNodes || 0 : '...'}
                        </p>
                    </div>
                    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--accent),transparent_90%)] text-[var(--accent)]"><Zap size={20} /></div>
                            <h3 className="text-sm font-medium text-[var(--textMuted)] font-mono">Compute (TFLOPS)</h3>
                        </div>
                        <p className="text-2xl font-bold text-[var(--text)] font-mono">
                            {realtimeStats ? (realtimeStats.totalComputeTflops || 0).toFixed(1) : '...'}
                        </p>
                    </div>
                    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4">
                        <div className="flex items-center space-x-3 mb-2">
                            <div className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--primary),transparent_90%)] text-[var(--primary)]"><Cpu size={20} /></div>
                            <h3 className="text-sm font-medium text-[var(--textMuted)] font-mono">CPU (cGHz)</h3>
                        </div>
                        <p className="text-2xl font-bold text-[var(--text)] font-mono">
                            {realtimeStats ? (realtimeStats.totalComputeCghz || 0).toFixed(0) : '...'}
                        </p>
                    </div>
                </div>

                {/* Metadata Card */}
                {!loadingMeta && meta && (
                    <div className="bg-[var(--surface)] rounded-xl border border-[var(--border)] p-6 grid gap-6 md:grid-cols-2">
                        <div>
                            <h3 className="text-sm font-medium text-[var(--textMuted)] uppercase tracking-wider mb-2 font-mono">About</h3>
                            <p className="text-[var(--text)] text-sm leading-relaxed">{meta.description || 'No description available.'}</p>
                        </div>
                        <div className="flex flex-col justify-center space-y-4">
                            <div className="flex items-center space-x-3 text-sm">
                                <div className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--primary),transparent_90%)] text-[var(--primary)]">
                                    <Download size={18} />
                                </div>
                                <div>
                                    <p className="text-[var(--textMuted)] text-xs uppercase">Total Pulls</p>
                                    <p className="text-[var(--text)] font-mono font-bold">{meta.pullCount?.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3 text-sm">
                                <div className="p-2 bg-[color-mix(in_srgb,var(--warning),transparent_90%)] rounded-lg text-[var(--warning)]">
                                    <Star size={18} />
                                </div>
                                <div>
                                    <p className="text-[var(--textMuted)] text-xs uppercase">Stars</p>
                                    <p className="text-[var(--text)] font-mono font-bold">{meta.starCount?.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center space-x-3 text-sm">
                                <div className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--success),transparent_90%)] text-[var(--success)]">
                                    <Clock size={18} />
                                </div>
                                <div>
                                    <p className="text-[var(--textMuted)] text-xs uppercase">Last Updated</p>
                                    <p className="text-[var(--text)] font-mono font-bold">
                                        {meta.lastUpdated ? new Date(meta.lastUpdated).toLocaleDateString() : 'N/A'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Release Explorer Section */}
            <section className="bg-[var(--surface)] rounded-xl border border-[var(--border)] overflow-hidden">
                <button 
                    onClick={() => setShowReleaseExplorer(!showReleaseExplorer)}
                    className="w-full flex items-center justify-between p-4 hover:bg-[var(--surfaceAlt)] transition-colors"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-[color-mix(in_srgb,var(--danger),transparent_90%)] text-[var(--danger)]">
                            <Layers size={20} />
                        </div>
                        <div className="text-left">
                            <h3 className="text-sm font-medium text-[var(--text)] font-mono">Release Explorer</h3>
                            <p className="text-xs text-[var(--textMuted)]">View versions, architectures, and requirements</p>
                        </div>
                    </div>
                    {showReleaseExplorer ? <ChevronUp size={20} className="text-[var(--textMuted)]" /> : <ChevronDown size={20} className="text-[var(--textMuted)]" />}
                </button>

                {showReleaseExplorer && (
                    <div className="p-4 border-t border-gray-700/50 space-y-6">
                        {loadingReleases ? (
                             <div className="text-center py-4 text-gray-500">Loading releases...</div>
                        ) : releases.length === 0 ? (
                             <div className="text-center py-4 text-gray-500">No releases found.</div>
                        ) : (
                            <>
                                {/* Control Bar: Version & Arch Tabs */}
                                <div className="flex flex-col-reverse sm:flex-row sm:items-end justify-between gap-6 border-b border-gray-700/50 pb-4 mb-6">
                                    {/* Architecture Tabs (Left) */}
                                    <div className="flex-1 overflow-x-auto pb-0.5 no-scrollbar min-h-[32px] flex items-end">
                                        {!loadingReleaseDetail && releaseDetail ? (
                                            <div className="flex gap-4">
                                                {releaseDetail.architectures?.map((arch, idx) => (
                                                    <button
                                                        key={`${arch.os}/${arch.architecture}`}
                                                        onClick={() => setActiveArchIndex(idx)}
                                                        className={`pb-2 text-sm font-mono border-b-2 transition-colors whitespace-nowrap ${
                                                            activeArchIndex === idx 
                                                                ? "border-[var(--primary)] text-[var(--primary)]" 
                                                                : "border-transparent text-[var(--textMuted)] hover:text-[var(--text)]"
                                                        }`}
                                                    >
                                                        {arch.os}/{arch.architecture}
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-sm text-[var(--textMuted)] italic pb-2">Select a version to view architectures</span>
                                        )}
                                    </div>

                                    {/* Version Selector (Right) */}
                                    <div className="w-full sm:w-auto min-w-[200px]">
                                        <label className="block text-xs text-[var(--textMuted)] mb-1 font-mono uppercase text-left">Version Tag</label>
                                        <select 
                                            value={selectedTag || ''} 
                                            onChange={(e) => setSelectedTag(e.target.value)}
                                            className="w-full bg-[var(--background)] border border-[var(--border)] text-[var(--text)] rounded-lg p-2 text-sm focus:ring-2 focus:ring-[var(--primary)] focus:outline-none"
                                        >
                                            {releases.map((r, idx) => {
                                                const tag = r.tagName || (typeof r === 'string' ? r : `v${idx}`);
                                                return <option key={tag} value={tag}>{tag}</option>;
                                            })}
                                        </select>
                                    </div>
                                </div>

                                {loadingReleaseDetail ? (
                                    <div className="text-center py-8 text-gray-500 animate-pulse">Loading release details...</div>
                                ) : releaseDetail && (
                                    <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                        
                                        {currentArch ? (
                                            <div className="grid gap-6 md:grid-cols-2">
                                                {/* Requirements */}
                                                <div className="space-y-4">
                                                    <h4 className="text-xs font-semibold text-[var(--textMuted)] uppercase tracking-wider flex items-center gap-2">
                                                        <Box size={14} /> Requirements & Specs
                                                    </h4>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)]">
                                                            <div className="text-xs text-[var(--textMuted)] mb-1">GPU Memory</div>
                                                            <div className="text-sm font-mono text-[var(--text)]">{currentArch.gpuMemory || 'N/A'}</div>
                                                        </div>
                                                        <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)]">
                                                            <div className="text-xs text-[var(--textMuted)] mb-1">Image Size</div>
                                                            <div className="text-sm font-mono text-[var(--text)]">{formatBytes(currentArch.size)}</div>
                                                        </div>
                                                        <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] col-span-2">
                                                            <div className="text-xs text-[var(--textMuted)] mb-1">Ports</div>
                                                            <div className="text-sm font-mono text-[var(--text)] flex flex-wrap gap-2">
                                                                {currentArch.ports && currentArch.ports.length > 0 
                                                                    ? currentArch.ports.map(p => <span key={p} className="bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--border)] text-xs">{p}</span>)
                                                                    : <span className="text-[var(--textMuted)] italic">No exposed ports</span>
                                                                }
                                                            </div>
                                                        </div>
                                                        <div className="bg-[var(--background)] p-3 rounded-lg border border-[var(--border)] col-span-2 overflow-hidden">
                                                            <div className="text-xs text-[var(--textMuted)] mb-1">Digest</div>
                                                            <div className="text-xs font-mono text-[var(--textMuted)] truncate" title={currentArch.digest}>
                                                                {currentArch.digest || 'N/A'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Labels (Raw JSON Viewer) */}
                                                <div className="space-y-4">
                                                    <div className="flex items-center justify-between">
                                                        <h3 className="text-sm font-medium text-[var(--textMuted)] uppercase tracking-wider flex items-center gap-2">
                                                            <Info size={16} /> Configuration Labels
                                                        </h3>
                                                        <button 
                                                            onClick={() => setShowRawLabels(!showRawLabels)}
                                                            className="text-xs text-[var(--primary)] hover:underline"
                                                        >
                                                            {showRawLabels ? 'Hide' : 'Show All'}
                                                        </button>
                                                    </div>
                                                    
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-2.5 text-[var(--textMuted)]" size={14} />
                                                        <input 
                                                            type="text" 
                                                            placeholder="Search labels..." 
                                                            className="w-full bg-[var(--background)] border border-[var(--border)] rounded-md py-2 pl-9 pr-4 text-sm focus:ring-1 focus:ring-[var(--primary)] text-[var(--text)]"
                                                            value={labelSearch}
                                                            onChange={(e) => setLabelSearch(e.target.value)}
                                                        />
                                                    </div>

                                                    <div className={`bg-[var(--background)] rounded-lg p-4 overflow-auto font-mono text-xs text-[var(--text)] custom-scrollbar ${
                                                        showRawLabels ? "max-h-[500px]" : "max-h-[200px]"
                                                    }`}>
                                                        <table className="w-full border-collapse">
                                                            <tbody>
                                                                {(() => {
                                                                    try {
                                                                        const labels = typeof currentArch.labels === 'string' 
                                                                            ? JSON.parse(currentArch.labels) 
                                                                            : currentArch.labels || {};
                                                                        
                                                                        const entries = Object.entries(labels)
                                                                            .filter(([k, v]) => 
                                                                                k.toLowerCase().includes(labelSearch.toLowerCase()) || 
                                                                                String(v).toLowerCase().includes(labelSearch.toLowerCase())
                                                                            );
                                                                        
                                                                        if (entries.length === 0) return <tr><td className="text-[var(--textMuted)] italic">No matches</td></tr>;

                                                                        return entries.map(([key, value]) => (
                                                                            <tr key={key} className="border-b border-[var(--border)] last:border-0 hover:bg-[var(--surfaceAlt)]">
                                                                                <td className="py-2 pr-4 text-[var(--primary)] font-semibold align-top whitespace-nowrap">{key}</td>
                                                                                <td className="py-2 text-[var(--text)] break-all">{String(value)}</td>
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
                                            <div className="text-center py-8 text-gray-500 italic">
                                                Select an architecture to view details.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}
            </section>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row justify-between items-center bg-[var(--surface)] rounded-xl border border-[var(--border)] p-4 gap-4">
                {/* Metric Toggle */}
                <div className="flex space-x-2 bg-[var(--background)] p-1 rounded-lg border border-[var(--border)] transition-colors">
                    <button
                        onClick={() => setMetric('activeNodes')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                            metric === 'activeNodes' ? "bg-[var(--surface)] text-[var(--text)] shadow" : "text-[var(--textMuted)] hover:text-[var(--text)]"
                        }`}
                    >
                        <Server size={16} />
                        <span>Nodes</span>
                    </button>
                    <button
                        onClick={() => setMetric('totalComputeTflops')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                            metric === 'totalComputeTflops' ? "bg-[var(--surface)] text-[var(--text)] shadow" : "text-[var(--textMuted)] hover:text-[var(--text)]"
                        }`}
                    >
                        <Zap size={16} />
                        <span>TFLOPS</span>
                    </button>
                    <button
                        onClick={() => setMetric('totalComputeCghz')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center space-x-2 ${
                            metric === 'totalComputeCghz' ? "bg-[var(--surface)] text-[var(--text)] shadow" : "text-[var(--textMuted)] hover:text-[var(--text)]"
                        }`}
                    >
                        <Cpu size={16} />
                        <span>cGHz</span>
                    </button>
                </div>

                {/* Range Toggle */}
                <div className="flex space-x-2">
                    {['1d', '1w', '1m', '1y'].map((r) => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-3 py-1 rounded-md text-sm font-mono transition-colors border ${
                                range === r 
                                    ? "bg-[var(--primary)] border-[var(--primary)] text-white" 
                                    : "bg-[var(--background)] border-[var(--border)] text-[var(--textMuted)] hover:border-[var(--text)]"
                            }`}
                        >
                            {r.toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Chart */}
            <section>
                <AimTrendChart data={historicalStats} isLoading={loadingHistory} metric={metric} />
            </section>
        </div>
    );
};
