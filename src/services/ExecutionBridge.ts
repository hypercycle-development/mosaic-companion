// Execution Bridge Service
// Parses agent responses for JSON command blocks and executes them via BuilderService

import { builderService } from './BuilderService';
import { memoryService } from './MemoryService';

export interface ExecutionResult {
  success: boolean;
  action: string;
  result?: any;
  error?: string;
}

export class ExecutionBridge {
  /**
   * Parse agent response for JSON command blocks and execute them
   * Returns the modified response with execution results
   * @param response - The agent's response text
   * @param builderEnabled - Whether Builder mode is enabled (from UI state)
   */
  static async processResponse(response: string, builderEnabled: boolean = false): Promise<string> {
    if (!builderEnabled) {
      console.log('[ExecutionBridge] Builder mode disabled, skipping execution');
      return response;
    }

    const results: ExecutionResult[] = [];
    
    // Pattern 1: Multi-line JSON blocks
    // ```json
    // {"action": "..."}
    // ```
    const multiLineRegex = /```json\s*\n([\s\S]*?)\n```/g;
    let match;
    
    while ((match = multiLineRegex.exec(response)) !== null) {
      const jsonStr = match[1];
      try {
        const command = JSON.parse(jsonStr);
        if (command.action) {
          const result = await this.executeCommand(command);
          results.push(result);
        }
      } catch (e) {
        console.log('[ExecutionBridge] Invalid multi-line JSON block, skipping');
      }
    }

    // Pattern 2: Inline JSON blocks (same line)
    // ```json {"action": "..."} ```
    const inlineRegex = /```json\s+(\{[^}]+\})\s*```/g;
    
    while ((match = inlineRegex.exec(response)) !== null) {
      const jsonStr = match[1];
      try {
        const command = JSON.parse(jsonStr);
        if (command.action) {
          const result = await this.executeCommand(command);
          results.push(result);
        }
      } catch (e) {
        console.log('[ExecutionBridge] Invalid inline JSON block, skipping');
      }
    }

    // Pattern 3: JSON objects without code fences (agent might just output raw JSON)
    const rawJsonRegex = /\{"action"\s*:\s*"[^"]+?"[^}]*\}/g;
    
    while ((match = rawJsonRegex.exec(response)) !== null) {
      const jsonStr = match[0];
      try {
        const command = JSON.parse(jsonStr);
        if (command.action) {
          // Skip if we already processed this command
          const alreadyProcessed = results.some(r => r.action === command.action);
          if (!alreadyProcessed) {
            const result = await this.executeCommand(command);
            results.push(result);
          }
        }
      } catch (e) {
        // Not valid JSON, skip
      }
    }

    // If we executed commands, append results
    if (results.length > 0) {
      const resultLines = ['\n\n---\n**Execution Results:**'];
      for (const result of results) {
        resultLines.push(`\n\`${result.action}\`: ${result.success ? '✅' : '❌'}`);
        if (result.success && result.result) {
          const output = typeof result.result === 'string' 
            ? result.result 
            : JSON.stringify(result.result, null, 2);
          resultLines.push(`\`\`\`\n${output.slice(0, 500)}${output.length > 500 ? '...' : ''}\n\`\`\``);
        } else if (result.error) {
          resultLines.push(`Error: ${result.error}`);
        }
      }
      return response + resultLines.join('\n');
    }

    return response;
  }

  /**
   * Execute a single command
   */
  static async executeCommand(command: any): Promise<ExecutionResult> {
    const { action } = command;

    try {
      switch (action) {
        case 'shell':
          return await this.executeShell(command);
        
        case 'read':
          return await this.readFile(command);
        
        case 'write':
          return await this.writeFile(command);
        
        case 'list':
          return await this.listDir(command);
        
        case 'fetch':
          return await this.fetchUrl(command);
        
        case 'graphql':
          return await this.graphql(command);
        
        case 'clone':
          return await this.cloneRepo(command);
        
        case 'remember':
          return await this.storeMemory(command);
        
        case 'recall':
          return await this.recallMemory(command);
        
        case 'mkdir':
          return await this.createDir(command);
        
        case 'delete':
          return await this.deletePath(command);
        
        case 'midnight-init':
          return await this.midnightInitialize(command);
        
        case 'midnight-create-node':
          return await this.midnightCreateNode(command);
        
        case 'midnight-delegate':
          return await this.midnightDelegateNode(command);
        
        case 'midnight-status':
          return await this.midnightGetNodeStatus(command);
        
        default:
          return { success: false, action, error: `Unknown action: ${action}` };
      }
    } catch (error) {
      return { success: false, action, error: (error as Error).message };
    }
  }

  // Command handlers

  private static async executeShell(command: any): Promise<ExecutionResult> {
    const { command: cmd, cwd } = command;
    const result = await builderService.executeShell(cmd, cwd);
    return {
      success: result.success,
      action: 'shell',
      result: result.output,
      error: result.error,
    };
  }

  private static async readFile(command: any): Promise<ExecutionResult> {
    const { path } = command;
    const result = await builderService.readFile(path);
    return {
      success: result.success,
      action: 'read',
      result: result.output,
      error: result.error,
    };
  }

  private static async writeFile(command: any): Promise<ExecutionResult> {
    const { path, content } = command;
    const result = await builderService.writeFile(path, content);
    return {
      success: result.success,
      action: 'write',
      result: result.output,
      error: result.error,
    };
  }

  private static async listDir(command: any): Promise<ExecutionResult> {
    const { path } = command;
    const result = await builderService.listDir(path || '.');
    return {
      success: result.success,
      action: 'list',
      result: result.output,
      error: result.error,
    };
  }

  private static async fetchUrl(command: any): Promise<ExecutionResult> {
    const { url, headers } = command;
    const result = await builderService.fetchUrl(url, headers);
    return {
      success: result.success,
      action: 'fetch',
      result: result.output,
      error: result.error,
    };
  }

  private static async graphql(command: any): Promise<ExecutionResult> {
    const { url, query, variables } = command;
    const result = await builderService.graphql(url, query, variables);
    return {
      success: result.success,
      action: 'graphql',
      result: result.output,
      error: result.error,
    };
  }

  private static async cloneRepo(command: any): Promise<ExecutionResult> {
    const { repo, target } = command;
    const result = await builderService.cloneRepo(repo, target);
    return {
      success: result.success,
      action: 'clone',
      result: result.output,
      error: result.error,
    };
  }

  private static async storeMemory(command: any): Promise<ExecutionResult> {
    const { type, key, value, agentId, importance } = command;
    
    switch (type) {
      case 'fact':
        memoryService.storeFact(key, value, agentId, importance || 5);
        break;
      case 'preference':
        memoryService.storePreference(key, value, agentId || 'default');
        break;
      case 'skill':
        memoryService.storeSkill(key, value, agentId || 'default');
        break;
      case 'context':
        memoryService.storeContext(value, agentId);
        break;
      default:
        memoryService.storeFact(key, value, agentId, importance || 5);
    }
    
    return {
      success: true,
      action: 'remember',
      result: `Stored ${type}: ${key}`,
    };
  }

  private static async recallMemory(command: any): Promise<ExecutionResult> {
    const { query, agentId } = command;
    const results = memoryService.search(query, agentId);
    
    return {
      success: true,
      action: 'recall',
      result: results.map(r => ({
        type: r.type,
        key: r.key,
        value: r.value,
        timestamp: new Date(r.timestamp).toISOString(),
      })),
    };
  }

  private static async createDir(command: any): Promise<ExecutionResult> {
    const { path } = command;
    const result = await builderService.createDir(path);
    return {
      success: result.success,
      action: 'mkdir',
      result: result.output,
      error: result.error,
    };
  }

  private static async deletePath(command: any): Promise<ExecutionResult> {
    const { path } = command;
    const result = await builderService.delete(path);
    return {
      success: result.success,
      action: 'delete',
      result: result.output,
      error: result.error,
    };
  }

  // ==================== MIDNIGHT NETWORK COMMANDS ====================

  private static async midnightInitialize(command: any): Promise<ExecutionResult> {
    const result = await builderService.midnightInitialize();
    return {
      success: result.success,
      action: 'midnight-init',
      result: result.output,
      error: result.error,
    };
  }

  private static async midnightCreateNode(command: any): Promise<ExecutionResult> {
    const { type, stake, privacy, agentId } = command;
    const result = await builderService.midnightCreateNode({
      type: type || 'validator',
      stake: stake || 1000,
      privacy: privacy || 'shielded',
      agentId
    });
    return {
      success: result.success,
      action: 'midnight-create-node',
      result: result.output,
      error: result.error,
    };
  }

  private static async midnightDelegateNode(command: any): Promise<ExecutionResult> {
    const { nodeId, agentId } = command;
    if (!nodeId || !agentId) {
      return {
        success: false,
        action: 'midnight-delegate',
        error: 'Missing required fields: nodeId, agentId'
      };
    }
    const result = await builderService.midnightDelegateNode(nodeId, agentId);
    return {
      success: result.success,
      action: 'midnight-delegate',
      result: result.output,
      error: result.error,
    };
  }

  private static async midnightGetNodeStatus(command: any): Promise<ExecutionResult> {
    const { nodeId } = command;
    if (!nodeId) {
      return {
        success: false,
        action: 'midnight-status',
        error: 'Missing required field: nodeId'
      };
    }
    const result = await builderService.midnightGetNodeStatus(nodeId);
    return {
      success: result.success,
      action: 'midnight-status',
      result: result.output,
      error: result.error,
    };
  }
}