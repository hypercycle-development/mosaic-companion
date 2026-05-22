// =============================================================================
// HERMES AIM PANEL — Discovery-First Orchestration v2
// Connected to AimifierService + streaming stage events
// Default path: CONNECT TO EXISTING if detected; BUILD is opt-in only.
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Anchor, Box, Cpu, Globe, Loader2, CheckCircle2, AlertCircle,
  XCircle, ChevronDown, ChevronUp, Terminal, Rocket, Settings,
  Activity, FileJson, ShieldCheck, Container, Server, Eye,
  ExternalLink, RefreshCw, Play, LogIn
} from 'lucide-react';
import { toast } from 'react-toastify';
import type { AIAgentConfig } from '../types/ai';
import {
  AimifierService,
  PipelineStage,
  PipelineStageStatus,
  type StageState,
  type AIMDiscoveryResult,
} from '../services/stargate/AimifierService';
import {
  createDefaultAdapters,
} from '../services/stargate/AimifierAdapters';

// ---------------------------------------------------------------------------
// Stage Configuration — Discovery-first ordering
// ---------------------------------------------------------------------------

interface StageConfig {
  stage: PipelineStage;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const STAGES: StageConfig[] = [
  { stage: PipelineStage.DISCOVERY,     label: 'Discovery',     icon: <Eye size={16} />, description: 'Probe existing AIM, NM registry, container state' },
  { stage: PipelineStage.CONNECT,       label: 'Connect',       icon: <LogIn size={16} />, description: 'Link to existing deployed AIM' },
  { stage: PipelineStage.PREFLIGHT,     label: 'Preflight',     icon: <Settings size={16} />, description: 'Docker, aim-py-gen, Hermes health checks' },
  { stage: PipelineStage.CONFIG_GENERATE, label: 'Config',    icon: <FileJson size={16} />, description: 'Generate real hermes-agent config (embedded, no proxy)' },
  { stage: PipelineStage.CODE_GENERATE,   label: 'Generate',  icon: <Cpu size={16} />,    description: 'Generate embedded wrapper + main.py + Dockerfile' },
  { stage: PipelineStage.CODE_FIX,         label: 'Fix',       icon: <ShieldCheck size={16} />, description: 'Post-process template bugs' },
  { stage: PipelineStage.VALIDATE_SPEC,   label: 'Validate',  icon: <ShieldCheck size={16} />, description: 'Validate generated manifest + Dockerfile' },
  { stage: PipelineStage.BUILD_DOCKER,     label: 'Build',     icon: <Container size={16} />, description: 'Build Docker image' },
  { stage: PipelineStage.TEST_LOCAL,       label: 'Test',      icon: <Activity size={16} />, description: 'Local integration tests' },
  { stage: PipelineStage.DEPLOY_NODE,      label: 'Deploy',    icon: <Server size={16} />, description: 'Register on HyperCycle node' },
  { stage: PipelineStage.POST_DEPLOY,      label: 'Verify',    icon: <CheckCircle2 size={16} />, description: 'Verify on node' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface HermesAimPanelProps {
  agents: AIAgentConfig[];
  onClose?: () => void;
  onAimified?: (agentId: string, imageTag: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const HermesAimPanel: React.FC<HermesAimPanelProps> = ({ agents, onClose, onAimified }) => {
  const [selectedAgent, setSelectedAgent] = useState<AIAgentConfig | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState<PipelineStage>(PipelineStage.IDLE);
  const [stageStates, setStageStates] = useState<Map<PipelineStage, StageState>>(new Map());
  const [expandedStage, setExpandedStage] = useState<PipelineStage | null>(null);
  const [testResults, setTestResults] = useState<{ endpoint: string; status: number; ok: boolean }[]>([]);
  const [target, setTarget] = useState<'local' | 'node'>('local');
  const [nodeUrl, setNodeUrl] = useState('');
  const [discoveryPort, setDiscoveryPort] = useState(9000);
  const [imageTag, setImageTag] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Discovery / Connect mode state
  const [discoveryResult, setDiscoveryResult] = useState<AIMDiscoveryResult | null>(null);
  const [forceRebuild, setForceRebuild] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectUrl, setConnectUrl] = useState('');

  // Auto-select first agent when panel mounts
  useEffect(() => {
    const firstHermes = agents.find(a => a.provider === 'hermes');
    if (firstHermes && !selectedAgent) {
      setSelectedAgent(firstHermes);
    }
  }, [agents, selectedAgent]);
  const serviceRef = useRef<AimifierService | null>(null);
  const getService = useCallback(() => {
    if (!serviceRef.current) {
      const adapters = createDefaultAdapters();
      serviceRef.current = new AimifierService(
        adapters.docker,
        adapters.aimPyGen,
        adapters.hermes,
        adapters.nodeManager,
      );
    }
    return serviceRef.current;
  }, []);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Subscribe to pipeline events
  useEffect(() => {
    const service = getService();

    const onStageStart = ({ stage, message }: any) => {
      setCurrentStage(stage);
      setStageStates(prev => new Map(prev).set(stage, {
        stage,
        status: 'running',
        startTime: Date.now(),
        message,
        logs: [],
      }));
      setLogs(prev => [...prev, `[${stage}] ${message}`]);
    };

    const onStageLog = ({ stage, log }: any) => {
      setStageStates(prev => {
        const next = new Map(prev);
        const state = next.get(stage);
        if (state) {
          state.logs.push(log);
          next.set(stage, { ...state });
        }
        return next;
      });
      setLogs(prev => [...prev, log]);
    };

    const onStageSuccess = ({ stage }: any) => {
      setStageStates(prev => {
        const next = new Map(prev);
        const state = next.get(stage);
        if (state) {
          state.status = 'success';
          state.endTime = Date.now();
          next.set(stage, { ...state });
        }
        return next;
      });
    };

    const onStageFailed = ({ stage, error }: any) => {
      setStageStates(prev => {
        const next = new Map(prev);
        const state = next.get(stage);
        if (state) {
          state.status = 'failed';
          state.endTime = Date.now();
          state.error = error;
          next.set(stage, { ...state });
        }
        return next;
      });
      setIsRunning(false);
    };

    const onTestEndpoint = ({ endpoint, status }: any) => {
      setTestResults(prev => [...prev, { endpoint, status, ok: status === 200 }]);
    };

    const onPipelineDone = ({ imageTag: tag }: any) => {
      setIsRunning(false);
      setImageTag(tag);
      setCurrentStage(PipelineStage.DONE);
      // If tag starts with "connected-to-existing", we are in connect mode
      if (tag?.startsWith('connected-to-existing:')) {
        const port = tag.split(':')[1];
        setConnectUrl(`http://localhost:${port}`);
        setIsConnected(true);
        toast.success('Connected to existing AIM. No rebuild performed.');
        // Mark all build/deploy stages as skipped since they were bypassed
        setStageStates(prev => {
          const next = new Map(prev);
          const buildStages = [
            PipelineStage.PREFLIGHT,
            PipelineStage.CONFIG_GENERATE,
            PipelineStage.CODE_GENERATE,
            PipelineStage.CODE_FIX,
            PipelineStage.VALIDATE_SPEC,
            PipelineStage.BUILD_DOCKER,
            PipelineStage.TEST_LOCAL,
            PipelineStage.DEPLOY_NODE,
            PipelineStage.POST_DEPLOY,
          ];
          for (const stage of buildStages) {
            next.set(stage, {
              stage,
              status: 'skipped',
              startTime: Date.now(),
              endTime: Date.now(),
              message: 'Skipped — connected to existing AIM',
              logs: [],
            });
          }
          return next;
        });
      } else {
        if (selectedAgent && onAimified) {
          onAimified(selectedAgent.id, tag);
        }
      }
    };

    const onPipelineError = ({ error }: any) => {
      setIsRunning(false);
      toast.error(`Pipeline failed: ${error}`);
    };

    const onDiscoveryComplete = ({ result }: any) => {
      setDiscoveryResult(result);
    };

    service.on('stage:start', onStageStart);
    service.on('stage:log', onStageLog);
    service.on('stage:success', onStageSuccess);
    service.on('stage:failed', onStageFailed);
    service.on('test:endpoint', onTestEndpoint);
    service.on('pipeline:done', onPipelineDone);
    service.on('pipeline:error', onPipelineError);
    service.on('discovery:complete', onDiscoveryComplete);

    return () => {
      service.off('stage:start', onStageStart);
      service.off('stage:log', onStageLog);
      service.off('stage:success', onStageSuccess);
      service.off('stage:failed', onStageFailed);
      service.off('test:endpoint', onTestEndpoint);
      service.off('pipeline:done', onPipelineDone);
      service.off('pipeline:error', onPipelineError);
      service.off('discovery:complete', onDiscoveryComplete);
    };
  }, [getService, selectedAgent, onAimified]);

  // -------------------------------------------------------------------------
  // Start Pipeline (Discovery-First)
  // -------------------------------------------------------------------------
  const startAimification = async () => {
    if (!selectedAgent) {
      toast.warning('Select a Hermes agent first');
      return;
    }
    if (isRunning) return;

    setIsRunning(true);
    setStageStates(new Map());
    setTestResults([]);
    setLogs([]);
    setImageTag('');
    setDiscoveryResult(null);
    setIsConnected(false);
    setConnectUrl('');

    try {
      const service = getService();
      await service.aimifyAgent(selectedAgent, {
        target,
        nodeUrl: target === 'node' ? nodeUrl : undefined,
        forceRebuild,
        discoveryPort,
      });
    } catch (e: any) {
      // Error handled by event listener
      console.error('Aimification error:', e);
    }
  };

  // -------------------------------------------------------------------------
  // Cancel Pipeline
  // -------------------------------------------------------------------------
  const cancelPipeline = () => {
    if (!selectedAgent) return;
    const service = getService();
    service.cancelPipeline(selectedAgent.id);
    setIsRunning(false);
  };

  // -------------------------------------------------------------------------
  // Quick actions for CONNECT MODE
  // -------------------------------------------------------------------------
  const openWindow = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // -------------------------------------------------------------------------
  // Stage UI helpers
  // -------------------------------------------------------------------------
  const getStageStatus = (stage: PipelineStage): PipelineStageStatus => {
    return stageStates.get(stage)?.status || 'pending';
  };

  const getStageIcon = (status: PipelineStageStatus) => {
    switch (status) {
      case 'success':  return <CheckCircle2 size={18} className="text-emerald-400" />;
      case 'failed':   return <XCircle size={18} className="text-red-400" />;
      case 'running':  return <Loader2 size={18} className="text-blue-400 animate-spin" />;
      case 'skipped':  return <span className="text-gray-500 text-xs">SKIP</span>;
      default:         return <span className="text-gray-600 text-xs">○</span>;
    }
  };

  const hermesAgents = agents.filter(a => a.provider === 'hermes');

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
      {/* Header */}
      <div className="text-sm text-gray-300">
        <p className="mb-2">
          <strong className="text-violet-400">Hermes AIM Orchestration</strong>{' '}
          Discovery-first: detects existing AIMs before any build. Connect or rebuild at will.
        </p>
      </div>

      {/* Agent selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400">Select Hermes Agent</label>
        <div className="grid grid-cols-2 gap-2 max-h-[120px] overflow-y-auto">
          {hermesAgents.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedAgent(a)}
              disabled={isRunning}
              className={`p-2 rounded border text-left text-sm transition ${
                selectedAgent?.id === a.id
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              } disabled:opacity-50`}
            >
              <div className="font-medium truncate">{a.name}</div>
              <div className="text-xs text-gray-400 truncate">{a.model} @ {a.baseUrl || 'local'}</div>
            </button>
          ))}
          {hermesAgents.length === 0 && (
            <div className="col-span-2 text-xs text-gray-500 text-center py-4 border border-dashed border-gray-700 rounded">
              No Hermes agents found. Add one in Agent Settings.
            </div>
          )}
        </div>
      </div>

      {/* Target selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400">Deployment Target</label>
        <div className="flex gap-2">
          <button
            onClick={() => setTarget('local')}
            disabled={isRunning}
            className={`flex-1 px-3 py-2 rounded text-xs transition ${
              target === 'local'
                ? 'bg-violet-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Local Test Only
          </button>
          <button
            onClick={() => setTarget('node')}
            disabled={isRunning}
            className={`flex-1 px-3 py-2 rounded text-xs transition ${
              target === 'node'
                ? 'bg-violet-700 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            HyperCycle Node
          </button>
        </div>
        {target === 'node' && (
          <input
            type="text"
            value={nodeUrl}
            onChange={(e) => setNodeUrl(e.target.value)}
            placeholder="http://node-ip:8080"
            disabled={isRunning}
            className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs focus:outline-none focus:border-violet-500"
          />
        )}
      </div>

      {/* Discovery Port input (always visible) */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-gray-400">Discovery Port</label>
        <input
          type="number"
          value={discoveryPort}
          onChange={(e) => setDiscoveryPort(Number(e.target.value))}
          placeholder="9000"
          disabled={isRunning}
          className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-xs focus:outline-none focus:border-violet-500"
        />
        <p className="text-[10px] text-gray-500">
          Port to probe for an existing AIM. Default 9000.
        </p>
      </div>

      {/* Force Rebuild toggle */}
      <div className="flex items-center gap-2">
        <input
          id="forceRebuild"
          type="checkbox"
          checked={forceRebuild}
          onChange={(e) => setForceRebuild(e.target.checked)}
          disabled={isRunning}
          className="rounded border-gray-600 bg-gray-800 text-violet-500 focus:ring-violet-500"
        />
        <label htmlFor="forceRebuild" className="text-xs text-gray-400 cursor-pointer select-none">
          Force Rebuild (ignore existing AIM and rebuild from scratch)
        </label>
      </div>

      {/* CONNECTED STATE — Action Panel */}
      {isConnected && discoveryResult && (
        <div className="rounded border border-emerald-500/30 bg-emerald-900/10 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-400" />
            <span className="text-sm font-semibold text-emerald-300">AIM Connected — Live Runtime</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-emerald-200/70">
            <div>Port: {discoveryResult?.url?.split(':').pop()}</div>
            <div>Endpoints: {discoveryResult?.endpoints?.length || 0} OK</div>
            <div>Version: {discoveryResult?.version || 'unknown'}</div>
            <div>Model: {discoveryResult?.activeBackendModel || 'unknown'}</div>
            {discoveryResult?.container && (
              <>
                <div>Container: {discoveryResult.container.id?.slice(0, 12)}</div>
                <div>Uptime: {discoveryResult.container.uptime}</div>
              </>
            )}
            {discoveryResult?.nodeManagerRouting && (
              <>
                <div>NM Slot: {discoveryResult.nodeManagerRouting.slot}</div>
                <div>NM Status: {discoveryResult.nodeManagerRouting.status}</div>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={() => openWindow(discoveryResult.url)}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-700/40 hover:bg-emerald-600/40 text-emerald-200 text-xs transition"
            >
              <ExternalLink size={12} /> Open AIM Dashboard
            </button>
            <button
              onClick={() => openWindow('http://127.0.0.1:9119')}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-700/40 hover:bg-emerald-600/40 text-emerald-200 text-xs transition"
            >
              <ExternalLink size={12} /> Open Kanban
            </button>
            <button
              onClick={() => {
                // Trigger a health re-check
                setIsConnected(false);
                setDiscoveryResult(null);
                startAimification();
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-700/40 hover:bg-emerald-600/40 text-emerald-200 text-xs transition"
            >
              <RefreshCw size={12} /> Restart / Re-check
            </button>
            <button
              onClick={() => {
                setForceRebuild(true);
                setIsConnected(false);
                setDiscoveryResult(null);
                startAimification();
              }}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-red-700/30 hover:bg-red-600/30 text-red-300 text-xs transition"
            >
              <Rocket size={12} /> Force Rebuild
            </button>
          </div>
        </div>
      )}

      {/* Discovery results summary (shown during/after discovery) */}
      {!isConnected && discoveryResult && (
        <div className="rounded border border-gray-700 bg-gray-900/50 p-3 space-y-2">
          <div className="flex items-center gap-2">
            {discoveryResult.found ? (
              <CheckCircle2 size={16} className="text-emerald-400" />
            ) : (
              <AlertCircle size={16} className="text-yellow-400" />
            )}
            <span className="text-xs font-medium text-gray-200">
              {discoveryResult.found
                ? `Existing AIM detected on ${discoveryResult.url}`
                : 'No existing AIM detected — build path required'}
            </span>
          </div>
          {discoveryResult.found && (
            <div className="text-[10px] text-gray-400 space-y-0.5">
              <div>Endpoints checked: {discoveryResult.endpointChecks.map(c => `${c.uri}(${c.ok ? 'OK' : 'FAIL'})`).join(', ')}</div>
              {discoveryResult.version && <div>Version: {discoveryResult.version}</div>}
              {discoveryResult.activeBackendModel && <div>Backend model: {discoveryResult.activeBackendModel}</div>}
            </div>
          )}
        </div>
      )}

      {/* Pipeline stage visualizer */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-gray-400">Pipeline Stages</label>
        <div className="bg-gray-900 rounded border border-gray-800">
          {STAGES.map((cfg) => {
            const status = getStageStatus(cfg.stage);
            const isActive = currentStage === cfg.stage;
            const isExpanded = expandedStage === cfg.stage;
            const state = stageStates.get(cfg.stage);

            return (
              <div
                key={cfg.stage}
                className={`border-b border-gray-800 last:border-0 ${isActive ? 'bg-gray-800/50' : ''}`}
              >
                <button
                  onClick={() => setExpandedStage(isExpanded ? null : cfg.stage)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-800/30 transition"
                >
                  {getStageIcon(status)}
                  <span className="text-xs font-medium text-gray-200">{cfg.label}</span>
                  <span className="text-[10px] text-gray-500 ml-1">{cfg.description}</span>
                  {state?.logs.length ? (
                    <span className="ml-auto text-[10px] text-gray-500">
                      {state.logs.length} logs
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </span>
                  ) : null}
                </button>
                {isExpanded && state?.logs.length ? (
                  <div className="px-3 pb-2">
                    <div className="bg-black rounded p-2 max-h-[120px] overflow-y-auto space-y-0.5">
                      {state.logs.map((l, i) => (
                        <div key={i} className="text-[10px] font-mono text-gray-400 leading-tight">
                          {l}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
                {status === 'failed' && state?.error && (
                  <div className="px-3 pb-2">
                    <div className="text-[10px] text-red-400 bg-red-900/20 rounded p-2">
                      {state.error}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Test results */}
      {testResults.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-gray-400">Integration Tests</label>
          <div className="flex gap-2 flex-wrap">
            {testResults.map((t, i) => (
              <span
                key={i}
                className={`text-[10px] px-2 py-1 rounded ${
                  t.ok ? 'bg-emerald-900/30 text-emerald-400' : 'bg-red-900/30 text-red-400'
                }`}
              >
                {t.endpoint} {t.ok ? '✓' : `✗ ${t.status}`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Image tag */}
      {imageTag && !imageTag.startsWith('connected-to-existing:') && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-400">Built Image</label>
          <div className="text-xs font-mono text-violet-400 bg-violet-900/20 rounded px-3 py-2">
            {imageTag}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        {!isRunning && !isConnected ? (
          <button
            onClick={startAimification}
            disabled={!selectedAgent || (target === 'node' && !nodeUrl)}
            className="flex items-center gap-2 px-4 py-2 bg-violet-700 hover:bg-violet-600 disabled:opacity-40 rounded text-sm transition"
          >
            <Eye size={14} /> Discover &amp; Connect
          </button>
        ) : isConnected ? (
          <button
            onClick={() => {
              setIsConnected(false);
              setDiscoveryResult(null);
              setForceRebuild(true);
              startAimification();
            }}
            disabled={!selectedAgent || (target === 'node' && !nodeUrl)}
            className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 rounded text-sm transition"
          >
            <Rocket size={14} /> Force Rebuild
          </button>
        ) : (
          <button
            onClick={cancelPipeline}
            className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-600 rounded text-sm transition"
          >
            <XCircle size={14} /> Cancel
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-sm transition ml-auto"
          >
            Close
          </button>
        )}
      </div>

      {/* Global logs */}
      {logs.length > 0 && (
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-400 flex items-center gap-1">
            <Terminal size={12} /> Live Logs
          </label>
          <div className="bg-black rounded border border-gray-800 p-2 max-h-[180px] overflow-y-auto">
            {logs.slice(-50).map((l, i) => (
              <div key={i} className="text-[10px] font-mono text-gray-400 leading-tight">
                {l}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
};

export default HermesAimPanel;
