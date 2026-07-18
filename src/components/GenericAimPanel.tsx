// =============================================================================
// GENERIC AIM PANEL — Package ANY AI model as a HyperCycle AIM
// Browse model directory → enter metadata → configure → build Docker → deploy
// Includes guided templates (Home Automation, Custom Model, Docker Image)
// =============================================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Rocket, Folder, FileCode, Container, Settings, CheckCircle2,
  ChevronRight, ChevronLeft, Eye, Cpu, Database, ShieldCheck,
  Home, Zap, X, Loader2, RefreshCw, AlertCircle
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  AimifierService,
  PipelineStage,
  type StageState,
} from '../services/stargate/AimifierService';
import { createDefaultAdapters } from '../services/stargate/AimifierAdapters';

type WizardStep = 'source' | 'meta' | 'config' | 'build';

interface ModelSource {
  type: 'directory' | 'dockerfile' | 'template';
  path: string;
  templateId?: string;
  dockerImageName?: string;
}

interface ModelMeta {
  name: string;
  description: string;
  version: string;
  author: string;
  tags: string[];
}

interface ModelConfig {
  port: number;
  entrypoint: string;
  envVars: Record<string, string>;
  hasGpu: boolean;
  hasDataset: boolean;
  datasetDescription: string;
  monetizationType: 'api' | 'dataset' | 'subscription' | 'one_time';
}

interface GenericAimPanelProps {
  onClose?: () => void;
  onAimified?: (modelName: string, imageTag: string) => void;
}

const TEMPLATES = [
  {
    id: 'home_automation',
    label: 'Home Automation AI',
    icon: <Home size={18} />,
    description: 'Analyse device data and suggest automation rules based on learned behaviour. Dataset monetization ready.',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    suggestedMeta: {
      name: 'Home Automation Assistant',
      description: 'AI that analyses smart-home device data and suggests automation rules based on learned behaviour patterns. Includes anonymised behavioural dataset for resale.',
      version: '1.0.0',
      author: '',
      tags: ['iot', 'home-automation', 'behaviour-analysis', 'dataset'],
    },
    suggestedConfig: {
      port: 8080,
      entrypoint: 'python main.py',
      envVars: { MODEL_TYPE: 'home_automation', DATASET_ENABLED: 'true' },
      hasGpu: false,
      hasDataset: true,
      datasetDescription: 'Anonymised behavioural patterns: device usage times, room occupancy, energy consumption, preferred temperature/lighting settings. GDPR-compliant. No PII.',
      monetizationType: 'dataset' as const,
    },
  },
  {
    id: 'custom_model',
    label: 'Custom Model',
    icon: <Cpu size={18} />,
    description: 'Package your own AI model from a local directory or Git repo.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    suggestedMeta: {
      name: 'My AI Model',
      description: 'Describe what your model does and who it helps.',
      version: '1.0.0',
      author: '',
      tags: ['custom'],
    },
    suggestedConfig: {
      port: 8000,
      entrypoint: 'python main.py',
      envVars: {},
      hasGpu: false,
      hasDataset: false,
      datasetDescription: '',
      monetizationType: 'api' as const,
    },
  },
  {
    id: 'docker_image',
    label: 'Existing Docker Image',
    icon: <Container size={18} />,
    description: 'Wrap an already-built Docker image with AIM metadata and HyperCycle registration.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    suggestedMeta: {
      name: 'Docker AIM Wrapper',
      description: 'Existing container image wrapped for HyperCycle node deployment.',
      version: '1.0.0',
      author: '',
      tags: ['docker', 'container'],
    },
    suggestedConfig: {
      port: 8080,
      entrypoint: '',
      envVars: {},
      hasGpu: false,
      hasDataset: false,
      datasetDescription: '',
      monetizationType: 'api' as const,
    },
  },
];

export const GenericAimPanel: React.FC<GenericAimPanelProps> = ({ onClose, onAimified }) => {
  const [step, setStep] = useState<WizardStep>('source');
  const [source, setSource] = useState<ModelSource | null>(null);
  const [meta, setMeta] = useState<ModelMeta>({
    name: '',
    description: '',
    version: '1.0.0',
    author: '',
    tags: [],
  });
  const [config, setConfig] = useState<ModelConfig>({
    port: 8000,
    entrypoint: 'python main.py',
    envVars: {},
    hasGpu: false,
    hasDataset: false,
    datasetDescription: '',
    monetizationType: 'api',
  });
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [imageTag, setImageTag] = useState('');
  const [currentStage, setCurrentStage] = useState<PipelineStage>(PipelineStage.IDLE);
  const [stageStates, setStageStates] = useState<Map<PipelineStage, StageState>>(new Map());
  const [dockerAvailable, setDockerAvailable] = useState<boolean | null>(null);
  const [dockerImageName, setDockerImageName] = useState('');

  // ── Docker preflight check on mount ──────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const adapters = createDefaultAdapters();
        const ok = await adapters.docker.isAvailable();
        setDockerAvailable(ok);
      } catch {
        setDockerAvailable(false);
      }
    })();
  }, []);

  // ── Keep source.dockerImageName in sync with input field ───────────────
  useEffect(() => {
    if (source?.templateId === 'docker_image') {
      setSource(prev => prev ? { ...prev, dockerImageName } : prev);
    }
  }, [dockerImageName, source?.templateId]);

  // ── Browse for directory ──────────────────────────────────────────────────
  const browseDirectory = useCallback(async () => {
    if (dockerAvailable === false) {
      toast.error('Docker is required to continue. Install Docker first.');
      return;
    }
    try {
      const picked = await window.electronAPI?.dialog?.openDirectory?.();
      if (picked) {
        setSource({ type: 'directory', path: picked });
        toast.success(`Selected: ${picked}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to browse directory');
    }
  }, [dockerAvailable]);

  // ── Browse for Dockerfile ───────────────────────────────────────────────
  const browseDockerfile = useCallback(async () => {
    if (dockerAvailable === false) {
      toast.error('Docker is required to continue. Install Docker first.');
      return;
    }
    try {
      const eapi = (window as any).electronAPI;
      const picked = await eapi?.dialog?.openFile?.({
        filters: [{ name: 'Dockerfile', extensions: ['*'] }],
      });
      if (picked) {
        setSource({ type: 'dockerfile', path: picked });
        toast.success(`Selected: ${picked}`);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to browse file');
    }
  }, [dockerAvailable]);

  // ── Apply template ────────────────────────────────────────────────────────
  const applyTemplate = useCallback((templateId: string) => {
    if (dockerAvailable === false) {
      toast.error('Docker is required to continue. Install Docker first.');
      return;
    }
    const t = TEMPLATES.find(x => x.id === templateId);
    if (!t) return;
    if (templateId === 'docker_image') {
      setSource({ type: 'template', path: '', templateId, dockerImageName });
    } else {
      setSource({ type: 'template', path: '', templateId });
    }
    setMeta(prev => ({ ...prev, ...t.suggestedMeta }));
    setConfig(prev => ({ ...prev, ...t.suggestedConfig }));
    setStep('meta');
  }, [dockerImageName, dockerAvailable]);

  // ── Start build pipeline — REAL docker build via aimifyGenericModel ─────
  const startBuild = useCallback(async () => {
    if (!source || !meta.name) {
      toast.warning('Select a model source and enter a name first');
      return;
    }
    if (source.templateId === 'docker_image' && !dockerImageName) {
      toast.warning('Enter a base Docker image name before building');
      return;
    }
    setIsRunning(true);
    setLogs([]);
    setStageStates(new Map());
    setImageTag('');

    try {
      const adapters = createDefaultAdapters();
      const service = new AimifierService(
        adapters.docker,
        adapters.aimPyGen,
        adapters.hermes,
        adapters.nodeManager,
      );

      // Wire real-time stage updates
      service.on('stage:start', (ev: any) => {
        setCurrentStage(ev.stage);
        setStageStates(prev => new Map(prev).set(ev.stage, {
          stage: ev.stage,
          status: 'running',
          startTime: Date.now(),
          message: ev.message,
          logs: [],
        }));
        setLogs(prev => [...prev, `[${ev.stage}] ${ev.message}`]);
      });
      service.on('stage:log', (ev: any) => {
        setLogs(prev => [...prev, `[${ev.stage}] ${ev.log}`]);
        setStageStates(prev => {
          const next = new Map(prev);
          const s = next.get(ev.stage);
          if (s) { s.logs.push(ev.log); next.set(ev.stage, { ...s }); }
          return next;
        });
      });
      service.on('stage:success', (ev: any) => {
        setStageStates(prev => {
          const next = new Map(prev);
          const s = next.get(ev.stage);
          if (s) { s.status = 'success'; s.endTime = Date.now(); next.set(ev.stage, { ...s }); }
          return next;
        });
        setLogs(prev => [...prev, `[${ev.stage}] Done`]);
      });
      service.on('stage:failed', (ev: any) => {
        setStageStates(prev => {
          const next = new Map(prev);
          const s = next.get(ev.stage);
          if (s) { s.status = 'failed'; s.endTime = Date.now(); s.error = ev.error; next.set(ev.stage, { ...s }); }
          return next;
        });
        setLogs(prev => [...prev, `[${ev.stage}] FAILED: ${ev.error}`]);
      });
      service.on('docker:build:progress', (ev: any) => {
        setLogs(prev => [...prev, ev.line]);
      });

      const tag = await service.aimifyGenericModel(
        { source, meta, config },
        { target: 'local' }
      );
      setImageTag(tag);
      toast.success(`Model packaged: ${tag}`);
      onAimified?.(meta.name, tag);
    } catch (e: any) {
      toast.error(e.message || 'Build failed');
      setLogs(prev => [...prev, `[ERROR] ${e.message}`]);
    } finally {
      setIsRunning(false);
    }
  }, [source, meta, config, onAimified]);

  // ── Navigation helpers ────────────────────────────────────────────────────
  const canNext = () => {
    switch (step) {
      case 'source': return !!source && dockerAvailable !== false;
      case 'meta': return !!meta.name && !!meta.description;
      case 'config':
        // docker_image / dockerfile sources don't need an entrypoint — the image/Dockerfile already defines CMD
        return source?.type === 'template' && source?.templateId === 'docker_image' ? true
          : source?.type === 'dockerfile' ? true
          : !!config.entrypoint;
      case 'build': return !isRunning;
    }
  };

  const nextStep = () => {
    if (step === 'source') {
      if (dockerAvailable === false) {
        toast.error('Docker is required. Install Docker to continue.');
        return;
      }
      setStep('meta');
    } else if (step === 'meta') setStep('config');
    else if (step === 'config') setStep('build');
  };

  const prevStep = () => {
    if (step === 'meta') setStep('source');
    else if (step === 'config') setStep('meta');
    else if (step === 'build') setStep('config');
  };

  const steps: { id: WizardStep; label: string }[] = [
    { id: 'source', label: 'Source' },
    { id: 'meta', label: 'Info' },
    { id: 'config', label: 'Config' },
    { id: 'build', label: 'Build' },
  ];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-4">
        {steps.map((s, i) => (
          <React.Fragment key={s.id}>
            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
              step === s.id
                ? 'bg-cyan-500/20 text-cyan-400'
                : steps.findIndex(x => x.id === step) > i
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-gray-800 text-gray-500'
            }`}>
              {steps.findIndex(x => x.id === step) > i ? <CheckCircle2 size={12} /> : <span>{i + 1}</span>}
              {s.label}
            </div>
            {i < steps.length - 1 && (
              <ChevronRight size={14} className="text-gray-600" />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* ── STEP 1: SOURCE ─────────────────────────────────────────────── */}
      {step === 'source' && (
        <div className="space-y-4">
          {/* Docker preflight warning */}
          {dockerAvailable === false && (
            <div className="rounded-xl border border-red-500/30 bg-red-900/20 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-semibold text-red-300">Docker Required</h3>
                  <p className="text-xs text-red-200/70 mt-1">
                    Aimify requires Docker to build and package your model as a HyperCycle AIM.
                    Install Docker Desktop to continue.
                  </p>
                  <a
                    href="https://docs.docker.com/get-docker/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-xs text-cyan-400 hover:text-cyan-300 underline"
                  >
                    Get Docker →
                  </a>
                </div>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-400">
            Choose how you want to package your AI model. Select a template or browse your local files.
          </p>

          {/* Templates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {TEMPLATES.map(t => (
              <button
                key={t.id}
                onClick={() => applyTemplate(t.id)}
                disabled={dockerAvailable === false}
                className={`p-4 rounded-xl border text-left transition-all ${
                  source?.templateId === t.id
                    ? 'border-cyan-500 bg-cyan-500/10'
                    : dockerAvailable === false
                      ? 'border-gray-800 bg-gray-900/20 opacity-50 cursor-not-allowed'
                      : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg ${t.bg} flex items-center justify-center shrink-0`}>
                    <span className={t.color}>{t.icon}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-white text-sm">{t.label}</h3>
                    <p className="text-xs text-gray-400 mt-1">{t.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Docker image name input for docker_image template */}
          {source?.templateId === 'docker_image' && (
            <div className="rounded border border-gray-800 bg-gray-900/50 p-3">
              <label className="text-xs font-medium text-gray-400">Base Docker Image</label>
              <input
                type="text"
                value={dockerImageName}
                onChange={e => setDockerImageName(e.target.value)}
                placeholder="e.g. myregistry.com/myimage:1.0"
                className="w-full mt-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                The existing image will be wrapped with AIM metadata. It must be pullable from this host.
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">or bring your own</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Browse buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={browseDirectory}
              disabled={dockerAvailable === false}
              className={`p-4 rounded-xl border text-left transition-all ${
                source?.type === 'directory'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : dockerAvailable === false
                    ? 'border-gray-800 bg-gray-900/20 opacity-50 cursor-not-allowed'
                    : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <Folder size={18} className="text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Browse Directory</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Select a folder containing your model code, requirements.txt, and README.
                  </p>
                  {source?.type === 'directory' && (
                    <p className="text-xs text-cyan-400 mt-1 truncate">{source.path}</p>
                  )}
                </div>
              </div>
            </button>

            <button
              onClick={browseDockerfile}
              disabled={dockerAvailable === false}
              className={`p-4 rounded-xl border text-left transition-all ${
                source?.type === 'dockerfile'
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : dockerAvailable === false
                    ? 'border-gray-800 bg-gray-900/20 opacity-50 cursor-not-allowed'
                    : 'border-gray-800 bg-gray-900/50 hover:border-gray-700'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0">
                  <FileCode size={18} className="text-gray-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Browse Dockerfile</h3>
                  <p className="text-xs text-gray-400 mt-1">
                    Point to an existing Dockerfile to wrap with AIM metadata.
                  </p>
                  {source?.type === 'dockerfile' && (
                    <p className="text-xs text-cyan-400 mt-1 truncate">{source.path}</p>
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2: META ──────────────────────────────────────────────── */}
      {step === 'meta' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-400">Model Name</label>
            <input
              type="text"
              value={meta.name}
              onChange={e => setMeta(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. Home Automation Assistant"
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400">Description</label>
            <textarea
              value={meta.description}
              onChange={e => setMeta(prev => ({ ...prev, description: e.target.value }))}
              placeholder="What does your model do? Who benefits from it?"
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400">Version</label>
              <input
                type="text"
                value={meta.version}
                onChange={e => setMeta(prev => ({ ...prev, version: e.target.value }))}
                placeholder="1.0.0"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400">Author</label>
              <input
                type="text"
                value={meta.author}
                onChange={e => setMeta(prev => ({ ...prev, author: e.target.value }))}
                placeholder="Your name or org"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-400">Tags (comma-separated)</label>
            <input
              type="text"
              value={meta.tags.join(', ')}
              onChange={e => setMeta(prev => ({ ...prev, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))}
              placeholder="iot, home-automation, dataset, ..."
              className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Monetization hint for Home Automation */}
          {source?.templateId === 'home_automation' && (
            <div className="rounded border border-amber-500/30 bg-amber-900/10 p-3">
              <div className="flex items-center gap-2 mb-1">
                <Database size={14} className="text-amber-400" />
                <span className="text-xs font-semibold text-amber-300">Dataset Monetization</span>
              </div>
              <p className="text-xs text-amber-200/70">
                Your anonymised behavioural dataset (device usage patterns, room occupancy, energy trends)
                can be sold to smart-home manufacturers, energy companies, and urban planners.
                Ensure GDPR compliance and clear opt-in in your user terms.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: CONFIG ─────────────────────────────────────────────── */}
      {step === 'config' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400">Service Port</label>
              <input
                type="number"
                value={config.port}
                onChange={e => setConfig(prev => ({ ...prev, port: Number(e.target.value) }))}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400">Entrypoint</label>
              <input
                type="text"
                value={config.entrypoint}
                onChange={e => setConfig(prev => ({ ...prev, entrypoint: e.target.value }))}
                placeholder="python main.py"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* PORT callout */}
          <div className="rounded border border-cyan-500/30 bg-cyan-900/10 p-3">
            <div className="flex items-center gap-2 mb-1">
              <Container size={14} className="text-cyan-400" />
              <span className="text-xs font-semibold text-cyan-300">Runtime Port Assignment</span>
            </div>
            <p className="text-xs text-cyan-200/70">
              Aimify assigns a random port (49000-49999) and passes it via the <code className="text-cyan-300">PORT</code> env var.
              Your containerized app <strong>must</strong> read <code className="text-cyan-300">process.env.PORT</code> dynamically.
              Hardcoding a port will cause the health check to fail with &quot;connection reset by peer.&quot;
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-400">Environment Variables</label>
            {Object.entries(config.envVars).map(([k, v], i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="text"
                  value={k}
                  onChange={e => {
                    const newVars = { ...config.envVars };
                    delete newVars[k];
                    newVars[e.target.value] = v;
                    setConfig(prev => ({ ...prev, envVars: newVars }));
                  }}
                  placeholder="KEY"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
                <input
                  type="text"
                  value={v}
                  onChange={e => {
                    setConfig(prev => ({ ...prev, envVars: { ...prev.envVars, [k]: e.target.value } }));
                  }}
                  placeholder="value"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
                />
                <button
                  onClick={() => {
                    const newVars = { ...config.envVars };
                    delete newVars[k];
                    setConfig(prev => ({ ...prev, envVars: newVars }));
                  }}
                  className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => setConfig(prev => ({ ...prev, envVars: { ...prev.envVars, '': '' } }))}
              className="text-xs text-cyan-400 hover:text-cyan-300"
            >
              + Add variable
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="hasGpu"
              type="checkbox"
              checked={config.hasGpu}
              onChange={e => setConfig(prev => ({ ...prev, hasGpu: e.target.checked }))}
              className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="hasGpu" className="text-xs text-gray-400 cursor-pointer">
              Requires GPU (CUDA)
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="hasDataset"
              type="checkbox"
              checked={config.hasDataset}
              onChange={e => setConfig(prev => ({ ...prev, hasDataset: e.target.checked }))}
              className="rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            <label htmlFor="hasDataset" className="text-xs text-gray-400 cursor-pointer">
              Includes monetisable dataset
            </label>
          </div>

          {config.hasDataset && (
            <div>
              <label className="text-xs font-medium text-gray-400">Dataset Description</label>
              <textarea
                value={config.datasetDescription}
                onChange={e => setConfig(prev => ({ ...prev, datasetDescription: e.target.value }))}
                placeholder="Describe the dataset: what data, how collected, anonymisation method, potential buyers..."
                rows={3}
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-cyan-500"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-400">Monetization Model</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {(['api', 'dataset', 'subscription', 'one_time'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setConfig(prev => ({ ...prev, monetizationType: m }))}
                  className={`px-3 py-2 rounded text-xs transition ${
                    config.monetizationType === m
                      ? 'bg-cyan-700 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {m === 'api' && 'API Calls'}
                  {m === 'dataset' && 'Dataset Access'}
                  {m === 'subscription' && 'Subscription'}
                  {m === 'one_time' && 'One-time Purchase'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4: BUILD ───────────────────────────────────────────────── */}
      {step === 'build' && (
        <div className="space-y-4">
          <div className="rounded border border-gray-800 bg-gray-900/50 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Folder size={14} className="text-gray-500" />
              <span className="text-xs text-gray-400">Source:</span>
              <span className="text-xs text-white">{source?.type === 'template' ? `Template: ${source.templateId}` : source?.path || '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Cpu size={14} className="text-gray-500" />
              <span className="text-xs text-gray-400">Name:</span>
              <span className="text-xs text-white">{meta.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Container size={14} className="text-gray-500" />
              <span className="text-xs text-gray-400">Port:</span>
              <span className="text-xs text-white">{config.port}</span>
            </div>
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-gray-500" />
              <span className="text-xs text-gray-400">Monetization:</span>
              <span className="text-xs text-white capitalize">{config.monetizationType.replace('_', ' ')}</span>
            </div>
          </div>

          {/* Pipeline stages */}
          {isRunning && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400">Pipeline</label>
              <div className="space-y-1">
                {Array.from(stageStates.entries()).map(([stage, state]) => (
                  <div key={stage} className="flex items-center gap-2 text-xs">
                    {state.status === 'running' && <Loader2 size={12} className="text-blue-400 animate-spin" />}
                    {state.status === 'success' && <CheckCircle2 size={12} className="text-emerald-400" />}
                    {state.status === 'failed' && <X size={12} className="text-red-400" />}
                    {state.status === 'pending' && <span className="text-gray-600">○</span>}
                    <span className={state.status === 'running' ? 'text-blue-400' : state.status === 'success' ? 'text-emerald-400' : 'text-gray-500'}>
                      {stage}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="bg-black rounded border border-gray-800 p-2 max-h-[200px] overflow-y-auto">
              {logs.map((l, i) => (
                <div key={i} className="text-[10px] font-mono text-gray-400 leading-tight">
                  {l}
                </div>
              ))}
            </div>
          )}

          {/* Image tag */}
          {imageTag && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-400">Built Image</label>
              <div className="text-xs font-mono text-cyan-400 bg-cyan-900/20 rounded px-3 py-2">
                {imageTag}
              </div>
            </div>
          )}

          {/* Build button */}
          {!isRunning && !imageTag && (
            <button
              onClick={startBuild}
              disabled={!source || !meta.name}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 rounded text-sm transition"
            >
              <Rocket size={14} /> Build & Package
            </button>
          )}

          {imageTag && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setImageTag('');
                    setLogs([]);
                    setStageStates(new Map());
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
                >
                  <RefreshCw size={14} /> Rebuild
                </button>
                <button
                  onClick={async () => {
                    try {
                      const adapters = createDefaultAdapters();
                      const service = new AimifierService(
                        adapters.docker,
                        adapters.aimPyGen,
                        adapters.hermes,
                        adapters.nodeManager,
                      );
                      toast.info('Deploying to local node...');
                      const tag = await service.aimifyGenericModel(
                        { source, meta, config },
                        { target: 'node', nodeUrl: 'http://localhost:8000' }
                      );
                      toast.success(`Deployed: ${tag}`);
                    } catch (e: any) {
                      toast.error(`Deploy failed: ${e.message}`);
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded text-sm transition"
                >
                  <Rocket size={14} /> Deploy to Node
                </button>
              </div>
              <p className="text-xs text-gray-500">
                Deploying registers the AIM on your local HyperCycle node (localhost:8000).
                After deploy, the AIM will appear in the <strong>Aimified</strong> column on the Dashboard.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      {step !== 'build' && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={prevStep}
            disabled={step === 'source'}
            className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-30 transition"
          >
            <ChevronLeft size={14} /> Back
          </button>
          <button
            onClick={nextStep}
            disabled={!canNext()}
            className="flex items-center gap-1 px-4 py-2 bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 rounded text-sm transition"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default GenericAimPanel;
