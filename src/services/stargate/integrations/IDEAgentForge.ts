// =============================================================================
// STARGATE INTEGRATIONS — IDE-as-Agent-Forge
// Code → Test → Deploy pipeline inside Mosaic's built-in IDE
// =============================================================================

import { unifiedOrchestrator } from './UnifiedOrchestrator';

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

export interface AgentForgeSession {
  id: string;
  templateId: AgentTemplateType;
  projectPath: string;
  filePath: string;
  code: string;
  status: 'draft' | 'compiling' | 'testing' | 'ready' | 'deployed';
  testOutput?: string;
  deployedNodeId?: string;
  lastModified: number;
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
    };

    this.sessions.set(session.id, session);
    return session;
  }

  updateCode(sessionId: string, code: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.code = code;
    session.lastModified = Date.now();
    session.status = 'draft';
  }

  getSession(sessionId: string): AgentForgeSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): AgentForgeSession[] {
    return Array.from(this.sessions.values());
  }

  // ---------------------------------------------------------------------------
  // Phase 2: Test
  // ---------------------------------------------------------------------------

  async runTest(sessionId: string): Promise<{ success: boolean; output: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    session.status = 'testing';

    try {
      const ipc = (window as any).electronAPI?.stargate;
      if (!ipc?.testAgentCode) {
        return {
          success: false,
          output: 'Agent test runner not available. Run in production build.',
        };
      }

      const result = await ipc.testAgentCode(session.code, session.templateId);
      session.testOutput = result.output;
      session.status = result.success ? 'ready' : 'draft';

      return result;
    } catch (e: any) {
      session.status = 'draft';
      return { success: false, output: `Test error: ${e.message}` };
    }
  }

  // ---------------------------------------------------------------------------
  // Phase 3: Deploy
  // ---------------------------------------------------------------------------

  async deployToFleet(
    sessionId: string,
    config: ForgeDeployConfig,
  ): Promise<{ success: boolean; taskId?: string; nodeId?: string; error?: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);

    if (session.status !== 'ready' && session.status !== 'draft') {
      return { success: false, error: 'Agent must be tested before deployment' };
    }

    try {
      // Option A: Deploy via UnifiedOrchestrator to a specific node
      if (config.nodeId) {
        const result = await unifiedOrchestrator.dispatchToFleet(
          `Deploy agent: ${session.code}`,
          [config.nodeId],
          'parallel',
        );

        const nodeResult = result.nodeResults[0];
        if (nodeResult?.status === 'completed') {
          session.status = 'deployed';
          session.deployedNodeId = config.nodeId;
          return {
            success: true,
            taskId: result.jobId,
            nodeId: config.nodeId,
          };
        }

        return {
          success: false,
          error: nodeResult?.error || 'Deployment failed',
        };
      }

      // Option B: Deploy to local ANFE via main process
      const ipc = (window as any).electronAPI?.stargate;
      if (ipc?.deployAgentCode) {
        const result = await ipc.deployAgentCode(session.code, {
          templateId: session.templateId,
          autoStart: config.autoStart ?? true,
          enableWallet: config.enableWallet ?? false,
          tier: config.tier ?? 'standard',
        });

        if (result.success) {
          session.status = 'deployed';
          session.deployedNodeId = result.nodeId;
        }

        return result;
      }

      return { success: false, error: 'No deployment target available' };
    } catch (e: any) {
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

  logLifecycle(sessionId: string, event: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const chronicle = (window as any).electronAPI?.chronicle;
    if (chronicle?.write) {
      chronicle.write('ide-agent-forge', {
        sessionId,
        templateId: session.templateId,
        event,
        timestamp: Date.now(),
      });
    }
  }
}

// =============================================================================
// Singleton
// =============================================================================

export const ideAgentForge = new IDEAgentForge();
export default IDEAgentForge;
