// =============================================================================
// AIMIFIER SERVICE — Orchestration Core for Hermes → HyperCycle AIM Pipeline
// Discovery-First Orchestration (v2): Runtime truth over generated assumptions.
// =============================================================================

import { EventEmitter } from 'events';
import { toast } from 'react-toastify';
import type { AIAgentConfig } from '../../types/ai';

// ---------------------------------------------------------------------------
// Pipeline Stage Definitions
// ---------------------------------------------------------------------------

export enum PipelineStage {
  IDLE = 'idle',
  DISCOVERY = 'discovery',             // Introspection-first: probe existing AIM, NM, registry
  PREFLIGHT = 'preflight',             // Docker check, repo check
  CONNECT = 'connect',                 // Connect to existing AIM (skips build/deploy)
  CONFIG_GENERATE = 'config_generate', // Write config.yml
  CODE_GENERATE = 'code_generate',     // Run aim-py-gen
  CODE_FIX = 'code_fix',               // Post-process template bugs
  VALIDATE_SPEC = 'validate_spec',     // Run validate_spec.py
  BUILD_DOCKER = 'build_docker',       // docker build
  TEST_LOCAL = 'test_local',           // Start container, test endpoints
  DEPLOY_NODE = 'deploy_node',         // Push to node / NM register
  POST_DEPLOY = 'post_deploy',         // Verify on node
  DONE = 'done',
  ERROR = 'error',
}

export type PipelineStageStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped';

export interface StageState {
  stage: PipelineStage;
  status: PipelineStageStatus;
  startTime?: number;
  endTime?: number;
  message: string;
  logs: string[];
  error?: string;
  result?: { containerId?: string; manifest?: any };
}

// ---------------------------------------------------------------------------
// AIM Introspection / Discovery Result
// ---------------------------------------------------------------------------

export interface AIMEndpointCheck {
  uri: string;
  status: number;
  ok: boolean;
  latencyMs: number;
  data?: any;
}

export interface AIMDiscoveryResult {
  found: boolean;
  url: string;
  version?: string;
  endpoints: string[];
  endpointChecks: AIMEndpointCheck[];
  nodeManagerRouting?: {
    slot: number;
    port: number;
    status: string;
  };
  registryTag?: {
    name: string;
    tag: string;
    digest?: string;
  };
  container?: {
    id: string;
    image: string;
    uptime?: string;
    health?: string;
    port: number;
  };
  activeBackendModel?: string;
  error?: string;
}

export interface DiscoveryEvent {
  stage: PipelineStage;
  result: AIMDiscoveryResult;
}

// ---------------------------------------------------------------------------
// Pipeline Events (typed for streaming UI updates)
// ---------------------------------------------------------------------------

export interface PipelineEventMap {
  'stage:start': { stage: PipelineStage; message: string };
  'stage:progress': { stage: PipelineStage; message: string };
  'stage:log': { stage: PipelineStage; log: string };
  'stage:success': { stage: PipelineStage; result?: any };
  'stage:failed': { stage: PipelineStage; error: string };
  'discovery:complete': { result: AIMDiscoveryResult };
  'pipeline:start': { agentId: string; target: string };
  'pipeline:done': { agentId: string; imageTag: string; nodeUrl?: string };
  'pipeline:error': { agentId: string; stage: PipelineStage; error: string };
  'pipeline:cancelled': { agentId: string };
  'validation:gate': { gate: string; passed: boolean; details?: string };
  'docker:build:progress': { line: string };
  'docker:push:progress': { line: string };
  'test:endpoint': { endpoint: string; status: number; response?: any };
}

// ---------------------------------------------------------------------------
// Validation Gate Definitions
// ---------------------------------------------------------------------------

export interface ValidationGate {
  name: string;
  description: string;
  check: () => Promise<boolean>;
  blocking: boolean; // if true, pipeline stops on failure
}

// ---------------------------------------------------------------------------
// Adapter Interfaces
// ---------------------------------------------------------------------------

export interface DockerAdapter {
  isAvailable(): Promise<boolean>;
  buildImage(contextPath: string, imageName: string, tag: string): AsyncGenerator<string, string, unknown>;
  pushImage(imageName: string, tag: string): AsyncGenerator<string, string, unknown>;
  runContainer(imageName: string, tag: string, port: number, env: Record<string, string>): Promise<{ containerId: string; logs: string }>;
  stopContainer(containerId: string): Promise<void>;
  testEndpoint(url: string, method: string, body?: any, headers?: Record<string, string>): Promise<{ status: number; data: any }>;
  inspectContainer(imageName: string): Promise<{ id: string; image: string; uptime?: string; health?: string; port: number } | null>;
  getLocalImageInfo(imageName: string, tag: string): Promise<{ digest?: string; created?: string } | null>;
}

export interface AimPyGenAdapter {
  isAvailable(): Promise<boolean>;
  generateConfig(agent: AIAgentConfig, projectDir: string): Promise<{ configPath: string }>;
  generateCode(projectName: string, projectDir: string): AsyncGenerator<string, string, unknown>;
  fixGeneratedCode(projectDir: string): Promise<void>;
  validateSpec(projectDir: string): Promise<{ passed: number; warnings: number; errors: number }>;
}

export interface HermesAdapter {
  checkHealth(baseUrl: string): Promise<{ healthy: boolean; status: any }>;
  chat(baseUrl: string, message: string, systemPrompt?: string): Promise<{ response: string; cost: number }>;
}

export interface NodeManagerAdapter {
  registerAIM(nodeUrl: string, manifest: any, imageTag: string): Promise<{ success: boolean; aimIndex?: number; error?: string }>;
  verifyAIM(nodeUrl: string, aimIndex: number, manifest?: any): Promise<{ running: boolean; health?: any }>;
  queryNodeInfo(nodeUrl: string): Promise<{ ok: boolean; name?: string; aims?: any[]; error?: string }>;
  queryRegistry(tag: string): Promise<{ ok: boolean; digest?: string; tags?: string[]; error?: string }>;
}

// ---------------------------------------------------------------------------
// AimifierService — Orchestration Core
// ---------------------------------------------------------------------------

export class AimifierService extends EventEmitter {
  private _currentPipeline: Map<string, {
    agent: AIAgentConfig;
    stages: Map<PipelineStage, StageState>;
    active: boolean;
    cancelled: boolean;
    startTime: number;
    endTime?: number;
    projectDir: string;
    imageTag: string;
    containerId?: string;
    nodeUrl?: string;
    discoveryResult?: AIMDiscoveryResult;
  }> = new Map();

  private _dockerAdapter: DockerAdapter;
  private _aimPyGenAdapter: AimPyGenAdapter;
  private _hermesAdapter: HermesAdapter;
  private _nmAdapter: NodeManagerAdapter;

  constructor(
    dockerAdapter: DockerAdapter,
    aimPyGenAdapter: AimPyGenAdapter,
    hermesAdapter: HermesAdapter,
    nmAdapter: NodeManagerAdapter,
  ) {
    super();
    this._dockerAdapter = dockerAdapter;
    this._aimPyGenAdapter = aimPyGenAdapter;
    this._hermesAdapter = hermesAdapter;
    this._nmAdapter = nmAdapter;
  }

  // -------------------------------------------------------------------------
  // Public: Introspection — Discover existing AIM before any build
  // -------------------------------------------------------------------------
  async discoverExistingAIM(
    target: 'local' | 'node' = 'local',
    nodeUrl?: string,
    options: {
      probeEndpoints?: string[];
      expectedImageName?: string;
      expectedImageTag?: string;
      expectedPort?: number;
    } = {}
  ): Promise<AIMDiscoveryResult> {
    const {
      probeEndpoints = ['/health', '/manifest.json', '/costs', '/'],
      expectedImageName = 'mosaic-hermes-aim',
      expectedImageTag = '1.0.4',
      expectedPort = 9000,
    } = options;

    const result: AIMDiscoveryResult = {
      found: false,
      url: `http://localhost:${expectedPort}`,
      endpoints: [],
      endpointChecks: [],
    };

    // 1. Probe AIM HTTP endpoints
    for (const endpoint of probeEndpoints) {
      const probeUrl = `http://localhost:${expectedPort}${endpoint}`;
      const start = Date.now();
      try {
        const resp = await this._dockerAdapter.testEndpoint(probeUrl, 'GET');
        const latencyMs = Date.now() - start;
        result.endpointChecks.push({ uri: endpoint, status: resp.status, ok: resp.status === 200, latencyMs, data: resp.data });
        if (resp.status === 200) {
          result.found = true;
          result.endpoints.push(endpoint);

          if (endpoint === '/manifest.json' && resp.data) {
            result.version = resp.data.version || resp.data.aim_version;
          }
        }
      } catch (e: any) {
        result.endpointChecks.push({ uri: endpoint, status: 0, ok: false, latencyMs: Date.now() - start, data: e.message });
      }
    }

    // 2. Detect active backend model from health endpoint
    const healthCheck = result.endpointChecks.find(c => c.uri === '/health' && c.ok);
    if (healthCheck?.data) {
      result.activeBackendModel = healthCheck.data.model || healthCheck.data.status?.model;
    }

    // 3. Inspect Docker container
    try {
      const container = await this._dockerAdapter.inspectContainer(expectedImageName);
      if (container) {
        result.container = container;
      }
    } catch (_e) {
      // container inspection optional
    }

    // 4. Check Node Manager routing
    try {
      const nmInfo = await this._nmAdapter.queryNodeInfo(nodeUrl || 'http://localhost');
      if (nmInfo.ok && nmInfo.aims) {
        const slot = nmInfo.aims.find((a: any) => a.port === expectedPort || a.image_name?.includes(expectedImageName));
        if (slot) {
          result.nodeManagerRouting = {
            slot: slot.aim_index ?? 0,
            port: slot.port ?? expectedPort,
            status: slot.status || 'unknown',
          };
        }
      }
    } catch (_e) {
      // Node Manager query optional
    }

    // 5. Check local Docker registry
    try {
      const regInfo = await this._nmAdapter.queryRegistry(`${expectedImageName}:${expectedImageTag}`);
      if (regInfo.ok) {
        result.registryTag = {
          name: expectedImageName,
          tag: expectedImageTag,
          digest: regInfo.digest,
        };
      }
    } catch (_e) {
      // registry query optional
    }

    return result;
  }

  // -------------------------------------------------------------------------
  // Public: Start Pipeline (Discovery-First)
  // -------------------------------------------------------------------------
  async aimifyAgent(
    agent: AIAgentConfig,
    options: {
      target?: 'local' | 'node';
      nodeUrl?: string;
      skipStages?: PipelineStage[];
      forceRebuild?: boolean;
      discoveryPort?: number;
    } = {}
  ): Promise<string> {
    const { target = 'local', nodeUrl, skipStages = [], forceRebuild = false, discoveryPort = 9000 } = options;
    const pipelineId = `aim-${agent.id}-${Date.now()}`;
    const projectDir = `/tmp/aimifier-pipelines/${pipelineId}`;
    const imageTag = `mosaic-hermes-aim:${agent.id}-v${Date.now()}`;

    this._currentPipeline.set(pipelineId, {
      agent,
      stages: new Map(),
      active: true,
      cancelled: false,
      startTime: Date.now(),
      projectDir,
      imageTag,
      nodeUrl,
    });

    this.emit('pipeline:start', { agentId: agent.id, target });

    try {
      // -------------------------------------------------------------
      // PHASE 1: DISCOVERY FIRST
      // Probe existing AIM before any generation/build/deploy.
      // -------------------------------------------------------------
      let discoveryResult: AIMDiscoveryResult | undefined;
      if (!skipStages.includes(PipelineStage.DISCOVERY)) {
        discoveryResult = await this._runStage(pipelineId, PipelineStage.DISCOVERY, async (log) => {
          log(`[DISCOVERY] Probing existing AIM on port ${discoveryPort}...`);
          const d = await this.discoverExistingAIM(target, nodeUrl, { expectedPort: discoveryPort });
          this._currentPipeline.get(pipelineId)!.discoveryResult = d;
          log(`[DISCOVERY] Found: ${d.found}`);

          if (d.found) {
            log(`[DISCOVERY] Endpoints OK: ${d.endpoints.join(', ')}`);
            if (d.version) log(`[DISCOVERY] Version: ${d.version}`);
            if (d.activeBackendModel) log(`[DISCOVERY] Active model: ${d.activeBackendModel}`);
            if (d.container) log(`[DISCOVERY] Container: ${d.container.id?.slice(0, 12)} port ${d.container.port}`);
            if (d.nodeManagerRouting) log(`[DISCOVERY] NM slot ${d.nodeManagerRouting.slot} -> port ${d.nodeManagerRouting.port} (${d.nodeManagerRouting.status})`);
          } else {
            log('[DISCOVERY] No existing AIM detected — build path required.');
          }
          this.emit('discovery:complete', { result: d });
          return d;
        });
      }

      // -------------------------------------------------------------
      // BRANCH: DISCOVERED + NOT FORCE REBUILD → CONNECT MODE
      // Skip build/deploy entirely.
      // -------------------------------------------------------------
      if (discoveryResult?.found && !forceRebuild) {
        if (!skipStages.includes(PipelineStage.CONNECT)) {
          await this._runStage(pipelineId, PipelineStage.CONNECT, async (log) => {
            log('[CONNECT] Existing AIM detected. Skipping generation/build/deploy.');
            log(`[CONNECT] Dashboard: http://localhost:${discoveryPort}/`);
            log(`[CONNECT] Health:    http://localhost:${discoveryPort}/health`);
            log(`[CONNECT] Manifest:  http://localhost:${discoveryPort}/manifest.json`);
            log('[CONNECT] Kanban:    http://127.0.0.1:9119');
            return { discoveryResult };
          });
        }
        this._currentPipeline.get(pipelineId)!.active = false;
        this.emit('pipeline:done', { agentId: agent.id, imageTag: `connected-to-existing:${discoveryPort}`, nodeUrl: pipelineUrlFromDiscovery(discoveryResult) });
        toast.success('Connected to existing AIM. No rebuild needed.');
        return `connected-to-existing:${discoveryPort}`;
      }

      // If discovered but forceRebuild is true, warn and proceed
      if (discoveryResult?.found && forceRebuild) {
        await this._runStage(pipelineId, PipelineStage.PREFLIGHT, async (log) => {
          log('[PREFLIGHT] WARNING: AIM already exists on port ' + discoveryPort + ' but forceRebuild=true.');
          return {};
        });
      }

      // -------------------------------------------------------------
      // PHASE 2: PREFLIGHT
      // -------------------------------------------------------------
      if (!skipStages.includes(PipelineStage.PREFLIGHT)) {
        await this._runStage(pipelineId, PipelineStage.PREFLIGHT, async (log) => {
          log('[PREFLIGHT] Checking Docker availability...');
          const dockerOk = await this._dockerAdapter.isAvailable();
          if (!dockerOk) throw new Error('Docker not available. Install Docker and ensure daemon is running.');
          log('[PREFLIGHT] Docker available.');

          log('[PREFLIGHT] Checking aim-py-gen availability...');
          const aimOk = await this._aimPyGenAdapter.isAvailable();
          if (!aimOk) throw new Error('aim-py-gen not available. Clone from https://github.com/hypercycle-development/aim-py-gen');
          log('[PREFLIGHT] aim-py-gen available.');

          log('[PREFLIGHT] All gates passed. Ready to aimify.');
          return { dockerOk, aimOk };
        });
      }

      // STAGE 2: CONFIG GENERATE
      if (!skipStages.includes(PipelineStage.CONFIG_GENERATE)) {
        await this._runStage(pipelineId, PipelineStage.CONFIG_GENERATE, async (log) => {
          log(`[CONFIG] Writing HermesAIMSpec v1.0.0 config for agent ${agent.name}...`);
          const { configPath } = await this._aimPyGenAdapter.generateConfig(agent, projectDir);
          log(`[CONFIG] Written to ${configPath}`);
          return { configPath };
        });
      }

      // STAGE 3: CODE GENERATE
      if (!skipStages.includes(PipelineStage.CODE_GENERATE)) {
        await this._runStage(pipelineId, PipelineStage.CODE_GENERATE, async (log) => {
          log('[GENERATE] Running aim-py-gen generate.py...');
          const projectName = `${agent.id}-aim`;
          for await (const line of this._aimPyGenAdapter.generateCode(projectName, projectDir)) {
            log(`[GENERATE] ${line}`);
          }
          log('[GENERATE] Code generation complete.');
          return { projectName };
        });
      }

      // STAGE 4: CODE FIX
      if (!skipStages.includes(PipelineStage.CODE_FIX)) {
        await this._runStage(pipelineId, PipelineStage.CODE_FIX, async (log) => {
          log('[FIX] Post-processing generated code (template bug fixes)...');
          await this._aimPyGenAdapter.fixGeneratedCode(projectDir);
          log('[FIX] Fixed cost variable bug in main.py.');
          log('[FIX] Copied HermesAIMWrapper shim.');
          log('[FIX] Created minimal requirements.txt.');
          return {};
        });
      }

      // STAGE 5: VALIDATE SPEC
      if (!skipStages.includes(PipelineStage.VALIDATE_SPEC)) {
        await this._runStage(pipelineId, PipelineStage.VALIDATE_SPEC, async (log) => {
          log('[VALIDATE] Running HermesAIMSpec v1 validator...');
          const result = await this._aimPyGenAdapter.validateSpec(projectDir);
          log(`[VALIDATE] Passed: ${result.passed}, Warnings: ${result.warnings}, Errors: ${result.errors}`);
          if (result.errors > 0) throw new Error(`Spec validation failed with ${result.errors} errors`);
          return result;
        });
      }

      // STAGE 6: BUILD DOCKER
      if (!skipStages.includes(PipelineStage.BUILD_DOCKER)) {
        await this._runStage(pipelineId, PipelineStage.BUILD_DOCKER, async (log) => {
          log(`[BUILD] Building Docker image ${imageTag}...`);
          for await (const line of this._dockerAdapter.buildImage(projectDir, 'mosaic-hermes-aim', `${agent.id}-v${Date.now()}`)) {
            log(`[BUILD] ${line}`);
            this.emit('docker:build:progress', { line });
          }
          log(`[BUILD] Image ${imageTag} built successfully.`);
          return { imageTag };
        });
      }

      // STAGE 7: TEST LOCAL
      if (!skipStages.includes(PipelineStage.TEST_LOCAL)) {
        await this._runStage(pipelineId, PipelineStage.TEST_LOCAL, async (log) => {
          log('[TEST] Starting local container for integration test...');
          const testPort = 49000 + Math.floor(Math.random() * 1000);
          const env = {
            HERMES_MODEL: agent.model || 'kimi-k2.6',
            HERMES_PROVIDER: agent.provider || '',
            HERMES_API_KEY: agent.apiKey || '',
            PORT: String(testPort),
          };
          const { containerId } = await this._dockerAdapter.runContainer('mosaic-hermes-aim', `${agent.id}-v${Date.now()}`, testPort, env);
          this._currentPipeline.get(pipelineId)!.containerId = containerId;
          log(`[TEST] Container ${containerId.slice(0, 12)} running on port ${testPort}`);

          // Test manifest.json
          log('[TEST] GET /manifest.json ...');
          const manifest = await this._dockerAdapter.testEndpoint(`http://localhost:${testPort}/manifest.json`, 'GET');
          if (manifest.status !== 200) throw new Error(`manifest.json returned ${manifest.status}`);
          this.emit('test:endpoint', { endpoint: '/manifest.json', status: manifest.status, response: manifest.data });
          log('[TEST] manifest.json OK');

          // Test health
          log('[TEST] GET /health ...');
          const health = await this._dockerAdapter.testEndpoint(`http://localhost:${testPort}/health`, 'GET');
          if (health.status !== 200) throw new Error(`/health returned ${health.status}`);
          this.emit('test:endpoint', { endpoint: '/health', status: health.status });
          log('[TEST] /health OK');

          // Test chat
          log('[TEST] POST /chat ...');
          const chat = await this._dockerAdapter.testEndpoint(
            `http://localhost:${testPort}/chat`, 'POST',
            { message: 'Hello HyperCycle AIM', system_prompt: 'You are a test agent.' }
          );
          if (chat.status !== 200) throw new Error(`/chat returned ${chat.status}`);
          this.emit('test:endpoint', { endpoint: '/chat', status: chat.status, response: chat.data });
          log('[TEST] /chat OK — response: ' + JSON.stringify(chat.data).slice(0, 100));

          // Test cost_only
          log('[TEST] POST /chat with cost_only header ...');
          const cost = await this._dockerAdapter.testEndpoint(
            `http://localhost:${testPort}/chat`, 'POST',
            { message: 'test' },
            { cost_only: 'true' }
          );
          if (cost.status !== 200) throw new Error(`/chat cost_only returned ${cost.status}`);
          log('[TEST] cost_only OK');

          // Stop test container
          await this._dockerAdapter.stopContainer(containerId);
          log('[TEST] Container stopped. All integration tests passed.');
          return { containerId, testPort };
        });
      }

      // STAGE 8: DEPLOY NODE
      if (target === 'node' && nodeUrl && !skipStages.includes(PipelineStage.DEPLOY_NODE)) {
        await this._runStage(pipelineId, PipelineStage.DEPLOY_NODE, async (log) => {
          log(`[DEPLOY] Registering AIM on node ${nodeUrl}...`);
          // Load manifest from project dir (generated during CONFIG_GENERATE)
          const manifestData = await (window as any).electronAPI.stargate.aimify.readFile(`${projectDir}/manifest.json`);
          const manifest = manifestData.success ? JSON.parse(manifestData.content || '{}') : {};
          const result = await this._nmAdapter.registerAIM(nodeUrl, manifest, imageTag);
          if (!result.success) throw new Error(`Node registration failed: ${result.error}`);
          log(`[DEPLOY] AIM registered at index ${result.aimIndex}`);
          return { aimIndex: result.aimIndex };
        });
      }

      // STAGE 9: POST DEPLOY
      if (target === 'node' && nodeUrl && !skipStages.includes(PipelineStage.POST_DEPLOY)) {
        await this._runStage(pipelineId, PipelineStage.POST_DEPLOY, async (log) => {
          log('[VERIFY] Verifying AIM on node...');
          const pipeline = this._currentPipeline.get(pipelineId);
          const aimIndex = pipeline?.stages.get(PipelineStage.DEPLOY_NODE)?.status === 'success'
            ? (pipeline.stages.get(PipelineStage.DEPLOY_NODE) as any).result?.aimIndex
            : undefined;
          if (aimIndex === undefined) throw new Error('No aimIndex from deploy stage');
          const manifestData = await (window as any).electronAPI.stargate.aimify.readFile(`${projectDir}/manifest.json`);
          const manifest = manifestData.success ? JSON.parse(manifestData.content || '{}') : {};
          const verify = await this._nmAdapter.verifyAIM(nodeUrl, aimIndex, manifest);
          if (!verify.running) throw new Error(`AIM not running on node: ${JSON.stringify(verify.health)}`);
          log('[VERIFY] AIM running and healthy on node.');
          return verify;
        });
      }

      // DONE
      const pipeline = this._currentPipeline.get(pipelineId)!;
      pipeline.active = false;
      this.emit('pipeline:done', { agentId: agent.id, imageTag, nodeUrl: pipeline.nodeUrl });
      toast.success(`Aimification complete: ${imageTag}`);

      return imageTag;

    } catch (error: any) {
      const pipeline = this._currentPipeline.get(pipelineId);
      if (pipeline) {
        pipeline.active = false;
      }
      this.emit('pipeline:error', { agentId: agent.id, stage: this._findFailedStage(pipelineId), error: error.message });
      toast.error(`Aimification failed: ${error.message}`);
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // Public: Cancel Pipeline
  // -------------------------------------------------------------------------
  cancelPipeline(agentId: string): void {
    const entry = Array.from(this._currentPipeline.entries()).find(([id, p]) => p.agent.id === agentId);
    if (!entry) return;
    const [, pipeline] = entry;
    pipeline.cancelled = true;
    if (pipeline.containerId) {
      this._dockerAdapter.stopContainer(pipeline.containerId).catch(() => {});
    }
    this.emit('pipeline:cancelled', { agentId });
    toast.info('Aimification cancelled');
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------
  getPipelineState(agentId: string): StageState[] | null {
    const entry = Array.from(this._currentPipeline.entries()).find(([id, p]) => p.agent.id === agentId);
    return entry ? Array.from(entry[1].stages.values()) : null;
  }

  getDiscoveryResult(agentId: string): AIMDiscoveryResult | null {
    const entry = Array.from(this._currentPipeline.entries()).find(([id, p]) => p.agent.id === agentId);
    return entry?.[1].discoveryResult || null;
  }

  isRunning(agentId: string): boolean {
    const entry = Array.from(this._currentPipeline.entries()).find(([id, p]) => p.agent.id === agentId && p.active);
    return !!entry;
  }

  // -------------------------------------------------------------------------
  // Private: Stage Runner
  // -------------------------------------------------------------------------
  private async _runStage(
    pipelineId: string,
    stage: PipelineStage,
    fn: (log: (msg: string) => void) => Promise<any>
  ): Promise<any> {
    const pipeline = this._currentPipeline.get(pipelineId);
    if (!pipeline) throw new Error('Pipeline not found');
    if (pipeline.cancelled) throw new Error('Pipeline cancelled');

    const state: StageState = {
      stage,
      status: 'running',
      startTime: Date.now(),
      message: `Starting ${stage}...`,
      logs: [],
    };
    pipeline.stages.set(stage, state);

    this.emit('stage:start', { stage, message: state.message });

    const log = (msg: string) => {
      state.logs.push(msg);
      this.emit('stage:log', { stage, log: msg });
    };

    try {
      const result = await fn(log);
      state.status = 'success';
      state.endTime = Date.now();
      state.message = `${stage} completed`;
      state.result = result;
      this.emit('stage:success', { stage, result });
      return result;
    } catch (error: any) {
      state.status = 'failed';
      state.endTime = Date.now();
      state.error = error.message;
      state.message = `${stage} failed: ${error.message}`;
      this.emit('stage:failed', { stage, error: error.message });
      throw error;
    }
  }

  private _findFailedStage(pipelineId: string): PipelineStage {
    const pipeline = this._currentPipeline.get(pipelineId);
    if (!pipeline) return PipelineStage.ERROR;
    for (const [stage, state] of pipeline.stages) {
      if (state.status === 'failed') return stage;
    }
    return PipelineStage.ERROR;
  }

  // ---------------------------------------------------------------------------
  // Persistent Pipeline History
  // ---------------------------------------------------------------------------

  async saveHistory(agentId: string, imageTag: string): Promise<void> {
    const pipeline = this._currentPipeline.get(agentId);
    if (!pipeline) return;
    const historyDir = this._getHistoryDir();
    const entry = {
      timestamp: new Date().toISOString(),
      agentId: pipeline.agent.id,
      agentName: pipeline.agent.name,
      imageTag,
      nodeUrl: pipeline.nodeUrl,
      totalTimeMs: pipeline.endTime ? pipeline.endTime - pipeline.startTime : 0,
      stages: Array.from(pipeline.stages.entries()).map(([stage, state]) => ({
        stage,
        status: state.status,
        startTime: state.startTime,
        endTime: state.endTime,
        message: state.message,
        logs: state.logs,
        error: state.error,
        result: state.result,
      })),
    };
    const historyFile = `${historyDir}/${agentId}-${Date.now()}.json`;
    try {
      const stargate = (window as any).electronAPI?.stargate?.aimify;
      if (stargate?.writeFile) {
        await stargate.writeFile(historyFile, JSON.stringify(entry, null, 2));
      }
    } catch (err) {
      console.warn('Failed to save pipeline history:', err);
    }
  }

  private _getHistoryDir(): string {
    return `/tmp/aimifier-pipelines/history`;
  }
}

// ---------------------------------------------------------------------------
// Singleton Factory
// ---------------------------------------------------------------------------

let _service: AimifierService | null = null;

export function getAimifierService(
  dockerAdapter: DockerAdapter,
  aimPyGenAdapter: AimPyGenAdapter,
  hermesAdapter: HermesAdapter,
  nmAdapter: NodeManagerAdapter,
): AimifierService {
  if (!_service) {
    _service = new AimifierService(dockerAdapter, aimPyGenAdapter, hermesAdapter, nmAdapter);
  }
  return _service;
}

function pipelineUrlFromDiscovery(result: AIMDiscoveryResult): string | undefined {
  if (result.found) {
    return result.url;
  }
  return undefined;
}

export default AimifierService;
