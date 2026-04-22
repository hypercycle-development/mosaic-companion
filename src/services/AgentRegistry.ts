/**
 * Agent Registry - Claw Code ExecutionRegistry Pattern
 * Unified registry for agents with hooks, permissions, and confidence scoring
 * 
 * Key patterns from Claw Code:
 * - ExecutionRegistry: unified command/tool execution
 * - PortingModule: metadata-rich agent definitions
 * - PermissionContext: fine-grained gating
 * - TurnResult: structured execution results
 */

import { Agent } from './MultiAgentService';

// ============================================================================
// PortingModule-inspired Agent Metadata
// ============================================================================

export type AgentStatus = 'mirrored' | 'ported' | 'native';
export type ExecutionMode = 'parallel' | 'sequential' | 'collaborative' | 'orchestrator';

export interface AgentModule {
  id: string;
  name: string;
  role: string;
  responsibility: string;  // What the agent does
  source_hint: string;    // Origin (e.g., "mosaic-default", "hypercycle", "external")
  status: AgentStatus;
  capabilities: string[];
  permissions: string[];  // Required permissions
  metadata: Record<string, any>;
}

export interface AgentExecution {
  agentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'denied';
  result?: string;
  error?: string;
  duration: number;
  cost?: number;
  permissionsDenied?: string[];
}

// ============================================================================
// Permission Context (Claw Code pattern)
// ============================================================================

export interface PermissionContext {
  sessionId: string;
  allowedPermissions: Set<string>;
  blockedPermissions: Set<string>;
  trustLevel: 'low' | 'medium' | 'high';
}

export class AgentPermissionGate {
  private static defaultBlocked = new Set([
    'wallet:transfer',
    'file:delete',
    'bash:execute',
    'network:outbound:unrestricted',
    'mcp:write'
  ]);

  static blocks(action: string, context: PermissionContext): boolean {
    // Block if explicitly blocked
    if (context.blockedPermissions.has(action)) return true;
    
    // Block if not in allowed and not trusted
    if (context.trustLevel !== 'high' && !context.allowedPermissions.has('*')) {
      const allowedArr = Array.from(context.allowedPermissions);
      if (!allowedArr.includes(action) && this.defaultBlocked.has(action)) {
        return true;
      }
    }
    
    return false;
  }

  static inferDenials(agents: AgentModule[]): { agentId: string; reason: string }[] {
    const denials: { agentId: string; reason: string }[] = [];
    
    for (const agent of agents) {
      for (const perm of agent.permissions) {
        if (this.defaultBlocked.has(perm)) {
          denials.push({
            agentId: agent.id,
            reason: `${perm} remains gated in the agent registry`
          });
        }
      }
    }
    
    return denials;
  }
}

// ============================================================================
// Query Engine Confidence Routing (Claw Code pattern)
// ============================================================================

export interface RoutedMatch {
  kind: 'agent' | 'tool';
  name: string;
  source_hint: string;
  score: number;  // Confidence score based on token matching
  reason: string; // Why this was matched
}

export class AgentQueryEngine {
  private agents: Map<string, AgentModule> = new Map();
  private tools: Map<string, AgentModule> = new Map();

  registerAgent(agent: AgentModule): void {
    this.agents.set(agent.id, agent);
  }

  registerTool(tool: AgentModule): void {
    this.tools.set(tool.id, tool);
  }

  /**
   * Route prompt to matching agents/tools using token-based confidence scoring
   * Claw Code pattern: score = sum(matching_tokens)
   */
  routePrompt(prompt: string, limit: number = 5): RoutedMatch[] {
    const tokens = this.tokenize(prompt);
    const agentMatches = this.scoreMatches(tokens, Array.from(this.agents.values()));
    const toolMatches = this.scoreMatches(tokens, Array.from(this.tools.values()));

    // Prioritize agents, then tools
    const selected: RoutedMatch[] = [];
    
    if (agentMatches.length > 0) {
      selected.push(agentMatches[0]);
    }
    if (toolMatches.length > 0) {
      selected.push(toolMatches[0]);
    }

    // Fill remaining slots with highest scoring
    const leftovers = [...agentMatches, ...toolMatches]
      .filter(m => !selected.some(s => s.name === m.name))
      .sort((a, b) => -compareScore(a, b));

    selected.push(...leftovers.slice(0, Math.max(0, limit - selected.length)));
    
    return selected.slice(0, limit);
  }

  private tokenize(prompt: string): Set<string> {
    return new Set(
      prompt.toLowerCase()
        .replace(/[/\-]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 2)
    );
  }

  private scoreMatches(tokens: Set<string>, modules: AgentModule[]): RoutedMatch[] {
    const matches: RoutedMatch[] = [];

    for (const module of modules) {
      const haystacks = [
        module.name.toLowerCase(),
        module.responsibility.toLowerCase(),
        module.source_hint.toLowerCase(),
        ...module.capabilities.map(c => c.toLowerCase())
      ];

      let score = 0;
      const matchedTokens: string[] = [];

      for (const token of Array.from(tokens)) {
        if (haystacks.some(h => h.includes(token))) {
          score++;
          matchedTokens.push(token);
        }
      }

      if (score > 0) {
        const reason = matchedTokens.length > 0
          ? `matched: ${matchedTokens.join(', ')}`
          : 'semantic match';
        
        matches.push({
          kind: modules[0].capabilities.length > 0 ? 'agent' : 'tool',
          name: module.name,
          source_hint: module.source_hint,
          score,
          reason
        });
      }
    }

    return matches.sort((a, b) => -compareScore(a, b));
  }
}

// ============================================================================
// Execution Registry (Claw Code pattern)
// ============================================================================

export type ExecutionHook = (ctx: ExecutionContext) => Promise<void> | void;

export interface ExecutionContext {
  type: 'agent' | 'tool';
  name: string;
  prompt: string;
  matchedAgents: string[];
  matchedTools: string[];
  deniedPermissions: { name: string; reason: string }[];
  sessionId: string;
  metadata: Record<string, any>;
}

export interface TurnResult {
  output: string;
  stop_reason: 'completed' | 'max_turns' | 'denied' | 'error';
  matched_agents: string[];
  matched_tools: string[];
  permission_denials: { name: string; reason: string }[];
  executions: AgentExecution[];
  duration: number;
}

export class AgentExecutionRegistry {
  private hooks: {
    beforeExecute: ExecutionHook[];
    afterExecute: ExecutionHook[];
  } = { beforeExecute: [], afterExecute: [] };

  private permissionContext: PermissionContext | null = null;

  // Hook registration (Claw Code pattern)
  registerBeforeHook(hook: ExecutionHook): void {
    this.hooks.beforeExecute.push(hook);
  }

  registerAfterHook(hook: ExecutionHook): void {
    this.hooks.afterExecute.push(hook);
  }

  setPermissionContext(ctx: PermissionContext): void {
    this.permissionContext = ctx;
  }

  async execute(
    type: 'agent' | 'tool',
    name: string,
    prompt: string,
    executeFn: (name: string, prompt: string) => Promise<string>
  ): Promise<AgentExecution> {
    const startTime = Date.now();

    // Build context
    const ctx: ExecutionContext = {
      type,
      name,
      prompt,
      matchedAgents: [],
      matchedTools: [],
      deniedPermissions: [],
      sessionId: this.permissionContext?.sessionId || 'default',
      metadata: {}
    };

    // Check permissions before execution
    if (this.permissionContext) {
      const module = type === 'agent' 
        ? this.agents.get(name) 
        : this.tools.get(name);
      
      if (module) {
        for (const perm of module.permissions) {
          if (AgentPermissionGate.blocks(perm, this.permissionContext!)) {
            return {
              agentId: name,
              status: 'denied',
              error: `Permission denied: ${perm}`,
              duration: 0,
              permissionsDenied: [perm]
            };
          }
        }
      }
    }

    // Run before hooks
    for (const hook of this.hooks.beforeExecute) {
      await hook(ctx);
    }

    // Execute
    let result: string;
    let status: AgentExecution['status'] = 'completed';
    
    try {
      result = await executeFn(name, prompt);
    } catch (error) {
      status = 'failed';
      result = `Error: ${error}`;
    }

    const execution: AgentExecution = {
      agentId: name,
      status,
      result,
      duration: Date.now() - startTime,
    };

    // Run after hooks
    ctx.metadata.result = result;
    ctx.metadata.status = status;
    
    for (const hook of this.hooks.afterExecute) {
      await hook(ctx);
    }

    return execution;
  }

  // Agent/tool lookup
  private agents: Map<string, AgentModule> = new Map();
  private tools: Map<string, AgentModule> = new Map();

  getAgent(name: string): AgentModule | undefined {
    return this.agents.get(name);
  }

  tool(name: string): AgentModule | undefined {
    return this.tools.get(name);
  }

  register(module: AgentModule): void {
    if (module.capabilities.length > 0) {
      this.agents.set(module.id, module);
    } else {
      this.tools.set(module.id, module);
    }
  }
}

// ============================================================================
// Utility
// ============================================================================

function compareScore(a: RoutedMatch, b: RoutedMatch): number {
  if (a.score !== b.score) return b.score - a.score;
  if (a.kind !== b.kind) return a.kind === 'agent' ? -1 : 1;
  return a.name.localeCompare(b.name);
}

// ============================================================================
// Singleton Registry
// ============================================================================

export const agentRegistry = new AgentExecutionRegistry();
export const agentQueryEngine = new AgentQueryEngine();

export default agentRegistry;