// =============================================================================
// STARGATE INTEGRATIONS — IDE-as-Agent-Forge
// Code → Test → Deploy pipeline inside Mosaic's built-in IDE
// =============================================================================

import { unifiedOrchestrator } from './UnifiedOrchestrator';
import { fleetChronicleLogger } from './FleetChronicleLogger';

// =============================================================================
// Agent Template System
// =============================================================================

export type AgentTemplateType = 'anfe-minter' | 'fleet-node' | 'mcp-adapter' | 'custom';

export interface AgentTemplate {
  id: AgentTemplateType;
  name: string;
  description: string;
  fileName: string;
  defaultCode: string;
  icon: string;
  inputs?: string[];
}

export interface ForgeChronicleEvent {
  id: string;
  timestamp: number;
  event: string;
  status: 'success' | 'failed' | 'warning' | 'info';
  detail?: string;
}

export interface AgentForgeSession {
  id: string;
  templateId: AgentTemplateType;
  projectPath: string;
  filePath: string;
  code: string;
  status: 'draft' | 'compiling' | 'testing' | 'ready' | 'deployed' | 'failed';
  testOutput?: string;
  deployedNodeId?: string;
  lastModified: number;
  chronicleEvents: ForgeChronicleEvent[];
}

export interface ForgeDeployConfig {
  nodeId?: string;
  autoStart?: boolean;
  enableWallet?: boolean;
  tier?: 'basic' | 'standard' | 'advanced' | 'premium';
}

// =============================================================================
// Template Library
// =============================================================================

const TEMPLATES: AgentTemplate[] = [
  {
    id: 'anfe-minter',
    name: 'ANFE Minter Agent',
    description: 'Mints ANFE NFTs on Cardano using MeshJS',
    fileName: 'anfe-minter.ts',
    icon: '🎫',
    inputs: ['policyId', 'walletAddress', 'metadata'],
    defaultCode: `// ANFE Minter Agent
// Mints HyperCycle ANFE NFTs on Cardano

import { BlockfrostProvider, MeshWallet, Transaction } from '@meshsdk/core';

interface MintConfig {
  policyId: string;
  walletAddress: string;
  metadata: Record<string, unknown>;
}

export async function mintANFE(config: MintConfig): Promise<string> {
  const provider = new BlockfrostProvider(process.env.BLOCKFROST_API_KEY!);
  const wallet = new MeshWallet({
    networkId: 1,
    fetcher: provider,
    submitter: provider,
    key: { type: 'address', address: config.walletAddress },
  });

  const tx = new Transaction({ initiator: wallet })
    .mintAsset(config.policyId, {
      assetName: 'ANFE',
      assetQuantity: '1',
      metadata: config.metadata,
      label: '721',
    });

  const unsignedTx = await tx.build();
  const signedTx = await wallet.signTx(unsignedTx);
  const txHash = await wallet.submitTx(signedTx);

  return txHash;
}
`,
  },
  {
    id: 'fleet-node',
    name: 'Fleet Node Agent',
    description: 'Registers and manages a HyperCycle fleet compute node',
    fileName: 'fleet-node.ts',
    icon: '⚡',
    inputs: ['nodeId', 'apiHost', 'sshUser', 'computeTier'],
    defaultCode: `// Fleet Node Agent
// Registers a HyperCycle fleet node and exposes compute

import { TailscaleSSH } from '@stargate/ssh';
import { HermesAgent } from '@stargate/agent';

interface FleetConfig {
  nodeId: string;
  apiHost: string;
  sshUser: string;
  computeTier: 'standard' | 'high_performance' | 'dedicated';
}

export async function registerFleetNode(config: FleetConfig): Promise<void> {
  const ssh = new TailscaleSSH({
    host: config.apiHost,
    user: config.sshUser,
  });

  const agent = new HermesAgent({
    nodeId: config.nodeId,
    computeTier: config.computeTier,
  });

  // Register with fleet registry
  await ssh.exec('~/.local/bin/hermes kanban create "Fleet Node Registration"');

  // Start compute listener
  await agent.startComputeListener();

  console.log('Fleet node registered:', config.nodeId);
}
`,
  },
  {
    id: 'mcp-adapter',
    name: 'MCP Adapter Agent',
    description: 'Exposes an AIM as an MCP server for external clients',
    fileName: 'mcp-adapter.ts',
    icon: '🔌',
    inputs: ['aimName', 'endpointUrl', 'apiKey'],
    defaultCode: `// MCP Adapter Agent
// Exposes HyperCycle AIM as an MCP server

import { MCPServer } from '@modelcontextprotocol/sdk';
import { AIMClient } from '@stargate/aim';

interface MCPConfig {
  aimName: string;
  endpointUrl: string;
  apiKey?: string;
}

export async function startMCPAdapter(config: MCPConfig): Promise<void> {
  const aim = new AIMClient({
    name: config.aimName,
    url: config.endpointUrl,
    apiKey: config.apiKey,
  });

  const server = new MCPServer({
    name: 'stargate-aim-' + config.aimName,
    version: '1.0.0',
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [{
      name: 'query_aim',
      description: 'Query the HyperCycle AIM model',
      inputSchema: { type: 'object', properties: { prompt: { type: 'string' } } },
    }],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    if (req.params.name === 'query_aim') {
      const result = await aim.query(req.params.arguments?.prompt as string);
      return { content: [{ type: 'text', text: result }] };
    }
    throw new Error('Unknown tool');
  });

  await server.connect(new StdioServerTransport());
  console.log('MCP adapter started for', config.aimName);
}
`,
  },
  {
    id: 'custom',
    name: 'Custom Agent',
    description: 'Blank canvas — build your own Stargate agent',
    fileName: 'custom-agent.ts',
    icon: '🛠️',
    defaultCode: `// Custom Stargate Agent
// Build your own agent logic here

import { StargateAgent } from '@stargate/core';

const agent = new StargateAgent({
  name: 'my-agent',
  version: '1.0.0',
});

agent.on('prompt', async (prompt: string) => {
  // Your agent logic here
  return 'Response to: ' + prompt;
});

export default agent;
`,
  },
];

// =============================================================================
// IDEAgentForge Service
// =============================================================================

class IDEAgentForge {
  private sessions: Map<string, AgentForgeSession> = new Map();

  getTemplates(): AgentTemplate[] {
    return TEMPLATES;
  }

  getTemplate(id: AgentTemplateType): AgentTemplate | undefined {
    return TEMPLATES.find(t => t.id === id);
  }

  createSession(templateId: AgentTemplateType, projectPath: string): AgentForgeSession {
    const template = this.getTemplate(templateId);
    if (!template) throw new Error(`Unknown template: ${templateId}`);

    const session: AgentForgeSession = {
      id: `forge-${Date.now()}`,
      templateId,
      projectPath,
      filePath: `${projectPath}/${template.fileName}`,
      code: template.defaultCode,
      status: 'draft',
      lastModified: Date.now(),
      chronicleEvents: [],
    };

    this.sessions.set(session.id, session);
    this.logLifecycle(session.id, 'session_created');
    return session;
  }

  updateCode(sessionId: string, code: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.code = code;
    session.lastModified = Date.now();
    session.status = 'draft';
    this.logLifecycle(sessionId, 'code_updated');
  }

  getSession(sessionId: string): AgentForgeSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): AgentForgeSession[] {
    return Array.from(this.sessions.values());
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Test
  // v2: delegates to AgentForgeEngine (main process) via IPC
  // ---------------------------------------------------------------------------

  async runTest(sessionId: string): Promise<{ success: boolean; output: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.status = 'testing';
    this.logLifecycle(sessionId, 'test_started');

    try {
      // Persist code first
      ideAgentForge.updateCode(session.id, session.code);

      const result = await this._ipc('testAgentCode', session.code, session.templateId);
      session.testOutput = result.output;
      session.status = result.success ? 'ready' : 'failed';

      this.logLifecycle(
        sessionId,
        result.success ? 'test_passed' : 'test_failed',
        result.output,
      );
      this._persistSessions();

      // Sync back
      const updated = ideAgentForge.getSession(session.id);
      if (updated) {
        this.sessions.set(session.id, updated);
      }

      return result;
    } catch (e: any) {
      session.status = 'failed';
      this.logLifecycle(sessionId, 'test_error', e.message);
      return { success: false, output: `Test error: ${e.message}` };
    }
  }

  async deployToFleet(
    sessionId: string,
    config: ForgeDeployConfig,
  ): Promise<{ success: boolean; taskId?: string; nodeId?: string; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    this.logLifecycle(sessionId, 'deploy_started', `nodeId=${config.nodeId || 'local'}`);

    try {
      const result = await this._ipc('deployAgentCode', session.code, {
        templateId: session.templateId,
        autoStart: config.autoStart ?? true,
        enableWallet: config.enableWallet ?? false,
        tier: config.tier ?? 'standard',
        nodeId: config.nodeId,
      });

      if (result.success) {
        session.status = 'deployed';
        session.deployedNodeId = result.nodeId || config.nodeId || 'local';
        this.logLifecycle(sessionId, 'deploy_success', `nodeId=${session.deployedNodeId}`);
      } else {
        this.logLifecycle(sessionId, 'deploy_failed', result.error);
      }
      this._persistSessions();

      return result;
    } catch (e: any) {
      this.logLifecycle(sessionId, 'deploy_error', e.message);
      return { success: false, error: e.message };
    }
  }

  // ---------------------------------------------------------------------------
  // Quick deploy: template → test → deploy in one flow
  // ---------------------------------------------------------------------------

  async forgeAndDeploy(
    templateId: AgentTemplateType,
    projectPath: string,
    deployConfig: ForgeDeployConfig,
  ): Promise<{ success: boolean; sessionId: string; output: string }> {
    const session = this.createSession(templateId, projectPath);

    // Auto-test
    const testResult = await this.runTest(session.id);
    if (!testResult.success) {
      return { success: false, sessionId: session.id, output: testResult.output };
    }

    // Auto-deploy
    const deployResult = await this.deployToFleet(session.id, deployConfig);
    if (!deployResult.success) {
      return { success: false, sessionId: session.id, output: deployResult.error || 'Deploy failed' };
    }

    return {
      success: true,
      sessionId: session.id,
      output: `Agent deployed to ${deployResult.nodeId || 'local'}`,
    };
  }

  // ---------------------------------------------------------------------------
  // Chronicle integration: log forge lifecycle
  // ---------------------------------------------------------------------------

  logLifecycle(sessionId: string, event: string, detail?: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Log to renderer bridge if available
    const chronicle = (window as any).electronAPI?.chronicle;
    if (chronicle?.write) {
      chronicle.write('ide-agent-forge', {
        sessionId,
        templateId: session.templateId,
        event,
        timestamp: Date.now(),
      });
    }

    // Log to FleetChronicleLogger for unified audit trail
    try {
      fleetChronicleLogger.logIDE(sessionId, event, 'info', detail);
    } catch {
      // FleetChronicleLogger may not be fully initialized in all contexts
    }
  }

  // ---------------------------------------------------------------------------
  // Session persistence
  // ---------------------------------------------------------------------------

  private readonly PERSIST_KEY = 'forge_sessions_v2';

  private _persistSessions(): void {
    try {
      const data = Array.from(this.sessions.values());
      localStorage.setItem(this.PERSIST_KEY, JSON.stringify(data));
    } catch {}
  }

  restoreSessions(): void {
    try {
      const raw = localStorage.getItem(this.PERSIST_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as AgentForgeSession[];
      parsed.forEach((s) => this.sessions.set(s.id, s));
    } catch {}
  }

  // ---------------------------------------------------------------------------
  // Typed IPC helper
  // ---------------------------------------------------------------------------

  private _ipc(method: string, ...args: any[]): Promise<any> {
    const api = (window as any).electronAPI?.stargate;
    if (!api?.[method]) {
      return Promise.reject(new Error(`IPC method stargate.${method} not available`));
    }
    return api[method](...args);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle queries (v2)
  // ---------------------------------------------------------------------------

  async listDeployedAgents(): Promise<{ success: boolean; agents: any[] }> {
    return this._ipc('listDeployedAgents');
  }

  async listRunningAgents(): Promise<{ success: boolean; agents: any[] }> {
    return this._ipc('listRunningAgents');
  }

  async stopAgent(agentId: string): Promise<{ success: boolean }> {
    return this._ipc('stopAgent', agentId);
  }

  // ---------------------------------------------------------------------------
  // Cross-node Deploy (v2.1)
  // ---------------------------------------------------------------------------

  async deployToNode(
    sessionId: string,
    nodeConfig: { host: string; user: string; agentDir?: string },
  ): Promise<{ success: boolean; taskId?: string; nodeId?: string; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    this.logLifecycle(sessionId, 'deploy_node_started', `host=${nodeConfig.host}`);

    try {
      const result = await this._ipc('deployAgentToNode', session.code, {
        templateId: session.templateId,
        nodeConfig: {
          host: nodeConfig.host,
          user: nodeConfig.user,
          agentDir: nodeConfig.agentDir,
        },
        autoStart: true,
        enableWallet: false,
        tier: 'standard',
      });

      if (result.success) {
        session.status = 'deployed';
        session.deployedNodeId = result.nodeId;
        this.logLifecycle(sessionId, 'deploy_node_success', `nodeId=${result.nodeId}`);
      } else {
        this.logLifecycle(sessionId, 'deploy_node_failed', result.error);
      }
      this._persistSessions();

      return result;
    } catch (e: any) {
      this.logLifecycle(sessionId, 'deploy_node_error', e.message);
      return { success: false, error: e.message };
    }
  }

  // ---------------------------------------------------------------------------
  // Health Monitoring (v2.2)
  // ---------------------------------------------------------------------------

  async enableHealthCheck(
    agentId: string,
    intervalMs?: number,
    maxRestarts?: number,
  ): Promise<{ success: boolean }> {
    return this._ipc('enableHealthCheck', agentId, intervalMs, maxRestarts);
  }

  async disableHealthCheck(agentId: string): Promise<{ success: boolean }> {
    return this._ipc('disableHealthCheck', agentId);
  }

  async isHealthy(agentId: string): Promise<{ healthy: boolean }> {
    return this._ipc('isHealthy', agentId);
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const ideAgentForge = new IDEAgentForge();
export default IDEAgentForge;

// Restore persisted sessions on module load
ideAgentForge.restoreSessions();
