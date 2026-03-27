// Builder Service
// Handles execution capabilities when Builder mode is enabled
// Connected to Electron IPC for real system access

import {
  BuilderModeConfig,
  BuilderAction,
  BuilderActionResult,
  DEFAULT_BUILDER_CONFIG,
} from '../types/builderMode';

// Extended ElectronAPI interface with network and shell capabilities
interface ExtendedElectronAPI {
  shell: {
    execute: (command: string, options?: { cwd?: string; timeout?: number }) => Promise<{
      success: boolean;
      stdout?: string;
      stderr?: string;
      error?: string;
    }>;
  };
  network: {
    fetch: (url: string, options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      timeout?: number;
    }) => Promise<{
      success: boolean;
      status?: number;
      data?: string;
      error?: string;
    }>;
    graphql: (url: string, query: string, variables?: Record<string, any>) => Promise<{
      success: boolean;
      status?: number;
      data?: any;
      error?: string;
    }>;
  };
  midnight?: {
    initialize: () => Promise<{ success: boolean; error?: string }>;
    createNode: (config: { type: string; stake: number; privacy: string }) => Promise<{
      success: boolean;
      nodeId?: string;
      error?: string;
    }>;
    delegateNode: (nodeId: string, agentId: string) => Promise<{
      success: boolean;
      delegationId?: string;
      error?: string;
    }>;
    getNodeStatus: (nodeId: string) => Promise<{
      success: boolean;
      status?: any;
      error?: string;
    }>;
  };
}

// Type assertion helper
function getExtendedAPI(): ExtendedElectronAPI | null {
  if (typeof window === 'undefined') {
    console.log('[Builder] Window not available (SSR mode)');
    return null;
  }
  
  const api = (window as any).electronAPI;
  console.log('[Builder] Checking electronAPI:', {
    exists: !!api,
    type: typeof api,
    keys: api ? Object.keys(api) : 'none',
    hasShell: !!(api?.shell),
    hasNetwork: !!(api?.network)
  });
  
  if (!api) {
    console.log('[Builder] electronAPI not found - running in browser mode or preload failed');
    return null;
  }
  
  // Check if shell exists and has execute method
  if (api.shell && typeof api.shell.execute === 'function') {
    console.log('[Builder] Shell API available');
    return api as ExtendedElectronAPI;
  }
  
  console.log('[Builder] Shell API not available, keys:', Object.keys(api));
  return null;
}

class BuilderServiceImpl {
  private config: BuilderModeConfig;

  constructor(config?: Partial<BuilderModeConfig>) {
    this.config = { ...DEFAULT_BUILDER_CONFIG, ...config };
  }

  // Check if Builder mode is enabled
  isEnabled(): boolean {
    return this.config.enabled;
  }

  // Enable Builder mode
  enable(): void {
    this.config.enabled = true;
  }

  // Disable Builder mode
  disable(): void {
    this.config.enabled = false;
  }

  // Check if an action requires confirmation
  requiresConfirmation(action: BuilderAction): boolean {
    if (!this.config.safety.require_confirmation) {
      return false;
    }
    return action.requires_confirmation;
  }

  // Validate a shell command against blocked commands
  isValidShellCommand(command: string): boolean {
    const blockedCommands = this.config.safety.blocked_commands;
    const lowerCommand = command.toLowerCase();
    
    for (const blocked of blockedCommands) {
      if (lowerCommand.includes(blocked.toLowerCase())) {
        return false;
      }
    }
    return true;
  }

  // Validate a file path against allowed directories
  isValidFilePath(path: string): boolean {
    if (this.config.capabilities.file_system === 'none') {
      return false;
    }
    return true; // In Builder mode, allow all paths
  }

  // Expand home directory
  private expandPath(path: string): string {
    if (path.startsWith('~/')) {
      const home = process.env.HOME || process.env.USERPROFILE || '/home/user';
      return path.replace('~', home);
    }
    return path;
  }

  // Execute a shell command using Electron IPC
  async executeShell(command: string, cwd?: string): Promise<BuilderActionResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Builder mode is disabled' };
    }

    if (!this.config.capabilities.shell_execution) {
      return { success: false, error: 'Shell execution is disabled' };
    }

    if (!this.isValidShellCommand(command)) {
      return { success: false, error: 'Command is blocked for safety' };
    }

    const startTime = Date.now();

    try {
      const api = getExtendedAPI();
      if (!api?.shell) {
        const msg = typeof window === 'undefined' 
          ? 'Not in browser environment' 
          : !(window as any).electronAPI 
            ? 'Electron preload not loaded - are you in browser mode? Use npm run start instead of npm run web'
            : 'Shell API missing from electronAPI';
        return { success: false, error: `Shell execution unavailable: ${msg}` };
      }
      
      console.log('[Builder] Executing shell command:', command);
      const result = await api.shell.execute(command, { cwd });
      
      return {
        success: result.success,
        output: result.stdout,
        error: result.error || result.stderr,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  // Read a file using shell command
  async readFile(path: string): Promise<BuilderActionResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Builder mode is disabled' };
    }

    if (this.config.capabilities.file_system === 'none') {
      return { success: false, error: 'File system access is disabled' };
    }

    const startTime = Date.now();
    const expandedPath = this.expandPath(path);

    try {
      const api = getExtendedAPI();
      if (!api?.shell) {
        return { success: false, error: 'Shell execution not available' };
      }

      // Use cat command for reading
      const result = await api.shell.execute(`cat "${expandedPath}"`);
      
      if (result.success) {
        return {
          success: true,
          output: result.stdout,
          duration: Date.now() - startTime,
        };
      } else {
        return {
          success: false,
          error: result.error || result.stderr || 'Failed to read file',
          duration: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  // Write a file using shell command
  async writeFile(path: string, content: string): Promise<BuilderActionResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Builder mode is disabled' };
    }

    if (this.config.capabilities.file_system !== 'read_write') {
      return { success: false, error: 'File system write access is disabled' };
    }

    const startTime = Date.now();
    const expandedPath = this.expandPath(path);

    try {
      const api = getExtendedAPI();
      if (!api?.shell) {
        return { success: false, error: 'Shell execution not available' };
      }

      // Use heredoc for writing (escaped content)
      const escapedContent = content.replace(/'/g, "'\"'\"'");
      const result = await api.shell.execute(
        `echo '${escapedContent}' > "${expandedPath}"`
      );
      
      if (result.success) {
        return {
          success: true,
          output: 'File written successfully',
          duration: Date.now() - startTime,
        };
      } else {
        return {
          success: false,
          error: result.error || result.stderr || 'Failed to write file',
          duration: Date.now() - startTime,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  // Fetch URL content using Electron IPC
  async fetchUrl(url: string, headers?: Record<string, string>): Promise<BuilderActionResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Builder mode is disabled' };
    }

    if (!this.config.capabilities.network_access) {
      return { success: false, error: 'Network access is disabled' };
    }

    const startTime = Date.now();

    try {
      const api = getExtendedAPI();
      if (!api?.network) {
        return { success: false, error: 'Network access not available' };
      }

      const result = await api.network.fetch(url, {
        method: 'GET',
        headers: headers,
      });
      
      return {
        success: result.success,
        output: result.data,
        error: result.error,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  // GraphQL query
  async graphql(url: string, query: string, variables?: Record<string, any>): Promise<BuilderActionResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Builder mode is disabled' };
    }

    if (!this.config.capabilities.network_access) {
      return { success: false, error: 'Network access is disabled' };
    }

    const startTime = Date.now();

    try {
      const api = getExtendedAPI();
      if (!api?.network) {
        return { success: false, error: 'Network access not available' };
      }

      const result = await api.network.graphql(url, query, variables);
      
      return {
        success: result.success,
        output: JSON.stringify(result.data, null, 2),
        error: result.error,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  // Clone a git repository
  async cloneRepo(repoUrl: string, targetDir?: string): Promise<BuilderActionResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Builder mode is disabled' };
    }

    if (!this.config.capabilities.shell_execution) {
      return { success: false, error: 'Shell execution is disabled' };
    }

    const startTime = Date.now();
    const dir = targetDir || '.';
    
    try {
      const api = getExtendedAPI();
      if (!api?.shell) {
        return { success: false, error: 'Shell execution not available' };
      }

      const result = await api.shell.execute(
        `git clone "${repoUrl}" "${dir}"`,
        { timeout: 120000 }
      );
      
      return {
        success: result.success,
        output: result.stdout,
        error: result.error || result.stderr,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  // List directory contents
  async listDir(path: string): Promise<BuilderActionResult> {
    const result = await this.executeShell(`ls -la "${this.expandPath(path)}"`);
    return result;
  }

  // Create directory
  async createDir(path: string): Promise<BuilderActionResult> {
    const result = await this.executeShell(`mkdir -p "${this.expandPath(path)}"`);
    return result;
  }

  // Delete file or directory
  async delete(path: string): Promise<BuilderActionResult> {
    if (!this.isValidShellCommand(`rm -rf "${path}"`)) {
      return { success: false, error: 'Delete operation not allowed for this path' };
    }
    const result = await this.executeShell(`rm -rf "${this.expandPath(path)}"`);
    return result;
  }

  // Check if file exists
  async fileExists(path: string): Promise<boolean> {
    const result = await this.executeShell(`test -f "${this.expandPath(path)}" && echo "exists" || echo "not found"`);
    return result.output?.trim() === 'exists';
  }

  // ==================== MIDNIGHT NETWORK INTEGRATION ====================

  // Initialize Midnight connection
  async midnightInitialize(): Promise<BuilderActionResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Builder mode is disabled' };
    }

    const startTime = Date.now();

    try {
      const api = getExtendedAPI();
      if (!api?.midnight) {
        return { success: false, error: 'Midnight integration not available. Ensure Electron mode is enabled.' };
      }

      const result = await api.midnight.initialize();
      
      return {
        success: result.success,
        output: 'Connected to Midnight Network',
        error: result.error,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  // Create a new node on Midnight Network
  async midnightCreateNode(config: {
    type: 'validator' | 'full' | 'light';
    stake: number;
    privacy: 'public' | 'shielded' | 'private';
    agentId?: string;
  }): Promise<BuilderActionResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Builder mode is disabled' };
    }

    const startTime = Date.now();

    try {
      const api = getExtendedAPI();
      if (!api?.midnight) {
        return { success: false, error: 'Midnight integration not available' };
      }

      const result = await api.midnight.createNode(config);
      
      return {
        success: result.success,
        output: result.nodeId ? `Node created: ${result.nodeId}` : undefined,
        data: result as any,
        error: result.error,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  // Delegate node to an agent
  async midnightDelegateNode(nodeId: string, agentId: string): Promise<BuilderActionResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Builder mode is disabled' };
    }

    const startTime = Date.now();

    try {
      const api = getExtendedAPI();
      if (!api?.midnight) {
        return { success: false, error: 'Midnight integration not available' };
      }

      const result = await api.midnight.delegateNode(nodeId, agentId);
      
      return {
        success: result.success,
        output: result.delegationId ? `Delegation created: ${result.delegationId}` : undefined,
        data: result as any,
        error: result.error,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  // Get node status
  async midnightGetNodeStatus(nodeId: string): Promise<BuilderActionResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Builder mode is disabled' };
    }

    const startTime = Date.now();

    try {
      const api = getExtendedAPI();
      if (!api?.midnight) {
        return { success: false, error: 'Midnight integration not available' };
      }

      const result = await api.midnight.getNodeStatus(nodeId);
      
      return {
        success: result.success,
        output: JSON.stringify(result.status, null, 2),
        data: result.status,
        error: result.error,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
        duration: Date.now() - startTime,
      };
    }
  }

  // Get current working directory
  async getCwd(): Promise<string> {
    const result = await this.executeShell('pwd');
    return result.output?.trim() || process.cwd();
  }

  // Get current configuration
  getConfig(): BuilderModeConfig {
    return { ...this.config };
  }

  // Update configuration
  updateConfig(newConfig: Partial<BuilderModeConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export singleton instance
export const builderService = new BuilderServiceImpl();