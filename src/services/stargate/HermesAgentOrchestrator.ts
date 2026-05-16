// =============================================================================
// HERMES AGENT ORCHESTRATOR — Dispatch kanban tasks to fleet nodes
// =============================================================================
// When user clicks "Hire Agent" or "Book Training" in Stargate, this service
// creates a Hermes kanban task that gets picked up by the fleet orchestrator.
//
// NO SSH between nodes. Dispatch uses:
//   1. Electron spawn (hermes kanban create) if available
//   2. Fleet registry task queue (nodes poll registry for tasks)
//   3. Gateway messaging (Telegram/Discord bot) as fallback
// =============================================================================

export interface HireAgentParams {
  agentName: string;
  role: string;
  skills: string[];
  computeTier: 'standard' | 'high_performance' | 'dedicated';
  targetNodeId?: string; // null = "any available fleet node"
  description?: string;
  missionPrompt?: string; // The actual user prompt to execute on remote node
}

export interface BookTrainingParams {
  trainerName: string;
  agentId: string;
  skillName: string;
  targetNodeId?: string;
}

export interface DeployAgentParams {
  agentId: string;
  nodeId: string;
  config?: Record<string, any>;
}

export interface OrchestratorTask {
  taskId: string;
  status: 'backlog' | 'ready' | 'running' | 'aimified' | 'failed';
  type: 'hire' | 'train' | 'deploy';
  params: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  assignedNode?: string;
  logs: string[];
}

const TASK_REGISTRY_URL = 'https://gist.githubusercontent.com/mauro-hyperaibox/fleet-tasks/main/tasks.json';

class HermesAgentOrchestrator {
  // ---------------------------------------------------------------------------
  // Skill File Sync — PHASE 1: Deliver skill files to fleet node before dispatch
  // ---------------------------------------------------------------------------
  private async _syncSkillsToNode(
    skillNames: string[],
    nodeId: string,
    nodeHost?: string
  ): Promise<{ synced: string[]; failed: string[]; remoteSkillDir: string }> {
    const synced: string[] = [];
    const failed: string[] = [];
    const remoteSkillDir = '~/.hermes/skills/stargate-incoming';

    for (const skillName of skillNames) {
      try {
        // Resolve skill source path on orchestrator machine
        const skillPath = this._resolveSkillPath(skillName);
        if (!skillPath) {
          failed.push(`${skillName}: path not found`);
          continue;
        }

        // Determine host for SCP
        const host = nodeHost || this._resolveNodeHost(nodeId);
        if (!host) {
          failed.push(`${skillName}: no host for node ${nodeId}`);
          continue;
        }

        // Create remote directory
        const mkdirResult = await this._dispatchViaSSH(
          nodeId,
          `mkdir -p ${remoteSkillDir}/${skillName}`
        );
        if (mkdirResult === null) {
          failed.push(`${skillName}: mkdir failed on ${nodeId}`);
          continue;
        }

        // SCP entire skill directory (SKILL.md + references/ + scripts/ + templates/)
        const scpResult = await this._scpDirectory(skillPath, host, `${remoteSkillDir}/${skillName}`);
        if (!scpResult) {
          failed.push(`${skillName}: scp failed`);
          continue;
        }

        synced.push(skillName);
        console.log(`[Orchestrator] Skill ${skillName} synced to ${nodeId}:${remoteSkillDir}/${skillName}`);
      } catch (e: any) {
        failed.push(`${skillName}: ${e.message}`);
      }
    }

    return { synced, failed, remoteSkillDir };
  }

  // Resolve skill path on orchestrator filesystem
  private _resolveSkillPath(skillName: string): string | null {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const hermesHome = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');

    // Search under category subdirectories
    const skillsBase = path.join(hermesHome, 'skills');
    if (!fs.existsSync(skillsBase)) return null;

    // Try direct match first
    const direct = path.join(skillsBase, skillName, 'SKILL.md');
    if (fs.existsSync(direct)) return path.join(skillsBase, skillName);

    // Search nested by category
    try {
      const categories = fs.readdirSync(skillsBase, { withFileTypes: true })
        .filter((d: any) => d.isDirectory())
        .map((d: any) => d.name);

      for (const cat of categories) {
        const nested = path.join(skillsBase, cat, skillName, 'SKILL.md');
        if (fs.existsSync(nested)) return path.join(skillsBase, cat, skillName);
      }
    } catch { /* readdir fails silently */ }

    return null;
  }

  // Resolve node Tailscale IP from fleet registry
  private _resolveNodeHost(nodeId: string): string | null {
    try {
      const registryRaw = localStorage.getItem('fleet_registry_nodes') || '[]';
      const nodes = JSON.parse(registryRaw);
      const node = nodes.find((n: any) => n.nodeId === nodeId);
      return node?.apiHost || null;
    } catch {
      return null;
    }
  }

  // SCP an entire directory to a remote host
  private async _scpDirectory(
    localPath: string,
    host: string,
    remotePath: string,
    user: string = 'hyperai'
  ): Promise<boolean> {
    try {
      const { execSync } = require('child_process');
      const cmd = `scp -r -o ConnectTimeout=5 -o StrictHostKeyChecking=no "${localPath}" ${user}@${host}:${remotePath}`;
      execSync(cmd, { timeout: 30000, stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Skill Verification — PHASE 3: Verify skills loaded on remote node
  // ---------------------------------------------------------------------------
  private async _verifySkillsOnNode(
    nodeId: string,
    skillNames: string[],
    remoteSkillDir: string
  ): Promise<{ loaded: string[]; missing: string[] }> {
    const loaded: string[] = [];
    const missing: string[] = [];

    for (const skillName of skillNames) {
      // Check if SKILL.md exists in remote incoming dir
      const checkResult = await this._dispatchViaSSH(
        nodeId,
        `test -f ${remoteSkillDir}/${skillName}/SKILL.md && echo OK || echo MISSING`
      );

      if (checkResult?.trim() === 'OK') {
        loaded.push(skillName);
      } else {
        missing.push(skillName);
      }
    }

    return { loaded, missing };
  }

  // ---------------------------------------------------------------------------
  // Skill Activation — PHASE 4: Move synced skills into Hermes skill path
  // ---------------------------------------------------------------------------
  private async _activateSkillsOnNode(
    nodeId: string,
    skillNames: string[],
    remoteSkillDir: string
  ): Promise<{ activated: string[]; failed: string[] }> {
    const activated: string[] = [];
    const failed: string[] = [];

    for (const skillName of skillNames) {
      const result = await this._dispatchViaSSH(
        nodeId,
        `mkdir -p ~/.hermes/skills && cp -r ${remoteSkillDir}/${skillName} ~/.hermes/skills/ && echo OK || echo FAIL`
      );

      if (result?.trim() === 'OK') {
        activated.push(skillName);
      } else {
        failed.push(skillName);
      }
    }

    return { activated, failed };
  }

  // ---------------------------------------------------------------------------
  // Hire Agent → kanban task (with full skill delivery)
  // ---------------------------------------------------------------------------
  async hireAgent(params: HireAgentParams): Promise<OrchestratorTask> {
    const task: OrchestratorTask = {
      taskId: `hire-${Date.now()}`,
      status: 'backlog',
      type: 'hire',
      params,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      logs: [`Created hire task for ${params.agentName} (${params.role})`],
    };

    const targetNodeId = params.targetNodeId;

    // ========================================================================
    // PHASE 1 & 2: Skill File Sync + Structured Dispatch
    // ========================================================================
    if (targetNodeId && params.skills.length > 0) {
      task.logs.push(`Syncing ${params.skills.length} skills to ${targetNodeId}...`);

      // 1a. Sync skill files via SCP
      const { synced, failed, remoteSkillDir } = await this._syncSkillsToNode(
        params.skills,
        targetNodeId
      );

      task.logs.push(`Skills synced: [${synced.join(', ')}]`);
      if (failed.length > 0) {
        task.logs.push(`Skills failed: [${failed.join(', ')}]`);
      }

      // 1b. Verify skills arrived
      if (synced.length > 0) {
        const { loaded, missing } = await this._verifySkillsOnNode(targetNodeId, synced, remoteSkillDir);
        task.logs.push(`Skills verified: [${loaded.join(', ')}]`);
        if (missing.length > 0) {
          task.logs.push(`Skills missing: [${missing.join(', ')}]`);
        }

        // 1c. Activate skills into Hermes path
        if (loaded.length > 0) {
          const { activated, failed: activateFailed } = await this._activateSkillsOnNode(
            targetNodeId,
            loaded,
            remoteSkillDir
          );
          task.logs.push(`Skills activated: [${activated.join(', ')}]`);
          if (activateFailed.length > 0) {
            task.logs.push(`Skills activation failed: [${activateFailed.join(', ')}]`);
          }
        }
      }

      // 2. Build structured task body with skill metadata
      const skillPayload = {
        skills: params.skills,
        syncedSkills: synced,
        remoteSkillDir,
        computeTier: params.computeTier,
        missionPrompt: params.missionPrompt || null,
        skillDelivery: 'scp+activate',
      };

      const profileName = targetNodeId === 'c-3po' ? 'c-3po-worker' : 'r2d2-orchestrator';

      // PHASE 2: Structured skill metadata embedded in task body
      // The kanban worker on the remote node will parse this JSON block
      const skillPayload = {
        __stargate_skills__: {
          required: params.skills,
          synced: synced,
          verified: synced.filter(s => !failed.includes(s)),
          remoteSkillDir,
          computeTier: params.computeTier,
          skillDelivery: 'scp+activate',
        },
      };
      const skillMetaJSON = JSON.stringify(skillPayload);

      const taskBody = params.missionPrompt
        ? `Mission: ${params.missionPrompt}\nSkills: ${params.skills.join(', ')}\nTier: ${params.computeTier}\nMETA: ${skillMetaJSON}`
        : `Skills: ${params.skills.join(', ')} | Tier: ${params.computeTier}\nMETA: ${skillMetaJSON}`;

      // Dispatch with skill payload as JSON in the task body
      const sshOut = await this._dispatchViaSSH(
        targetNodeId,
        `~/.local/bin/hermes kanban create "Deploy ${params.agentName} (${params.role})" --body "${taskBody}" --assignee ${profileName}`
      );

      if (sshOut !== null) {
        task.taskId = sshOut.trim() || task.taskId;
        task.status = 'ready';
        task.assignedNode = targetNodeId;
        task.logs.push(`Dispatched via Tailscale SSH to ${targetNodeId}`);
        return task;
      }
    }

    // ========================================================================
    // Fallback: Electron spawn (local machine only)
    // ========================================================================
    const electronTaskId = await this._spawnKanbanTask(
      `Deploy ${params.agentName} (${params.role})`,
      `Skills: ${params.skills.join(', ')} | Tier: ${params.computeTier} | Node: ${targetNodeId || 'any'}`,
      targetNodeId
    );
    if (electronTaskId) {
      task.taskId = electronTaskId;
      task.status = 'ready';
      task.logs.push(`Dispatched via Electron to kanban: ${electronTaskId}`);
      return task;
    }

    // ========================================================================
    // Last resort: fleet registry queue
    // ========================================================================
    await this._appendToFleetRegistry(task);
    task.logs.push(`Appended to fleet registry task queue`);
    return task;
  }

  // ---------------------------------------------------------------------------
  // Book Training → kanban task
  // ---------------------------------------------------------------------------
  async bookTraining(params: BookTrainingParams): Promise<OrchestratorTask> {
    const task: OrchestratorTask = {
      taskId: `train-${Date.now()}`,
      status: 'backlog',
      type: 'train',
      params,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      logs: [`Created training task: ${params.skillName} for ${params.agentId}`],
    };

    const electronTaskId = await this._spawnKanbanTask(
      `Train ${params.agentId} on ${params.skillName}`,
      `Trainer: ${params.trainerName}`,
      params.targetNodeId
    );

    if (electronTaskId) {
      task.taskId = electronTaskId;
      task.status = 'ready';
    } else {
      await this._appendToFleetRegistry(task);
    }

    return task;
  }

  // ---------------------------------------------------------------------------
  // Deploy to specific node
  // ---------------------------------------------------------------------------
  async deployToNode(params: DeployAgentParams): Promise<OrchestratorTask> {
    const task: OrchestratorTask = {
      taskId: `deploy-${Date.now()}`,
      status: 'backlog',
      type: 'deploy',
      params,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      logs: [`Deploy ${params.agentId} to ${params.nodeId}`],
    };

    // Try gateway message if node has Telegram/Discord
    const sent = await this._sendViaGateway(params.nodeId, `deploy:${params.agentId}`);
    if (sent) {
      task.status = 'running';
      task.logs.push(`Sent deploy command via gateway`);
    } else {
      await this._appendToFleetRegistry(task);
    }

    return task;
  }

  // ---------------------------------------------------------------------------
  // Internal: Tailscale SSH dispatch to fleet node
  // ---------------------------------------------------------------------------
  private async _dispatchViaSSH(nodeId: string, command: string): Promise<string | null> {
    try {
      // Look up node tailscale IP from fleet registry
      const registryRaw = localStorage.getItem('fleet_registry_nodes') || '[]';
      const nodes = JSON.parse(registryRaw);
      const node = nodes.find((n: any) => n.nodeId === nodeId);
      if (!node?.apiHost) return null;

      // Rewrite hermes → absolute path for non-interactive SSH (.bashrc not sourced)
      const safeCommand = command.replace(/\bhermes\b/g, '~/.local/bin/hermes');

      // Electron IPC bridge (production)
      const meshDispatch = (window as any).electronAPI?.mesh?.dispatch;
      if (meshDispatch) {
        const result = await meshDispatch({
          host: node.apiHost,
          user: 'hyperai',
          command: safeCommand,
          timeout: 30000,
        });
        return result.exitCode === 0 ? (result.stdout || '') : null;
      }

      // Browser dev mode fallback (requires Vite proxy to local SSH endpoint)
      const res = await fetch('/mesh/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: node.apiHost,
          user: 'hyperai',
          command: safeCommand,
          timeout: 30000,
        }),
        signal: AbortSignal.timeout(35000),
      });
      if (!res.ok) return null;
      const body = await res.json();
      return body.exitCode === 0 ? (body.stdout || '') : null;
    } catch (e: any) {
      console.error('[Orchestrator] SSH dispatch failed:', e.message);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: Electron spawn
  // ---------------------------------------------------------------------------
  private async _spawnKanbanTask(title: string, description: string, profile?: string): Promise<string | null> {
    try {
      const spawn = (window as any).electronAPI?.system?.spawn;
      if (!spawn) return null;

      const cmd = `~/.local/bin/hermes`;
      const args = [
        'kanban', 'create',
        title,
        '--body', description,
      ];
      if (profile) args.push('--assignee', profile);

      const result = await spawn(cmd, args);
      return result?.taskId || null;
    } catch (e: any) {
      console.error('[Orchestrator] spawn failed:', e.message);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Internal: Fleet registry task queue (no SSH required)
  // ---------------------------------------------------------------------------
  private async _appendToFleetRegistry(task: OrchestratorTask): Promise<void> {
    try {
      // Pull current tasks
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 10000);
      const res = await fetch(TASK_REGISTRY_URL, { signal: ctrl.signal });
      clearTimeout(to);
      const registry = res.ok ? await res.json() : { tasks: [] };
      const tasks: OrchestratorTask[] = registry.tasks || [];

      // Append and push back (read-only in this demo — real impl needs a backend)
      tasks.push(task);

      // In a real DAO, this would be a POST to a coordinator backend
      console.log('[Orchestrator] Would push task to registry:', task.taskId);
      localStorage.setItem('pending_fleet_tasks', JSON.stringify(tasks.slice(-50)));
    } catch (e: any) {
      console.error('[Orchestrator] Registry append failed:', e.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Dispatch a prompt to a fleet node via SSH mesh
  // ---------------------------------------------------------------------------
  async dispatchPrompt(
    nodeId: string,
    prompt: string,
    _profile?: string
  ): Promise<{ response: string }> {
    const result = await this._dispatchViaSSH(
      nodeId,
      `~/.local/bin/hermes chat -q ${JSON.stringify(prompt)}`
    );
    return { response: result ?? '(no response from node)' };
  }

  // ---------------------------------------------------------------------------
  // Internal: Gateway message (Telegram/Discord bot)
  // ---------------------------------------------------------------------------
  private async _sendViaGateway(nodeId: string, message: string): Promise<boolean> {
    try {
      const gateway = (window as any).electronAPI?.gateway;
      if (!gateway) return false;
      // Lookup node's gateway channel from fleet registry
      const fleet = JSON.parse(localStorage.getItem('fleet_registry') || '[]');
      const node = fleet.find((n: any) => n.nodeId === nodeId);
      if (!node?.gatewayChannel) return false;

      await gateway.sendMessage(node.gatewayChannel, message);
      return true;
    } catch {
      return false;
    }
  }
}

export const hermesAgentOrchestrator = new HermesAgentOrchestrator();
export default HermesAgentOrchestrator;

