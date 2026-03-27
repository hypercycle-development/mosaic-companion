// Builder Mode Types
// Enables system execution capabilities for AI agents

export interface BuilderCapabilities {
  network_access: boolean;
  shell_execution: boolean;
  file_system: 'none' | 'read' | 'read_write';
  docker_control: boolean;
  auto_loop: boolean;
}

export interface BuilderSafety {
  require_confirmation: boolean;
  sandbox: boolean;
  allowed_directories: string[];
  blocked_commands: string[];
}

export interface BuilderModeConfig {
  enabled: boolean;
  capabilities: BuilderCapabilities;
  safety: BuilderSafety;
}

// Default Builder mode configuration
export const DEFAULT_BUILDER_CONFIG: BuilderModeConfig = {
  enabled: false,
  capabilities: {
    network_access: true,
    shell_execution: true,
    file_system: 'read_write',
    docker_control: false,
    auto_loop: true,
  },
  safety: {
    require_confirmation: true,
    sandbox: true,
    allowed_directories: [
      '~/.openclaw',
      '~/workspace',
      './',
    ],
    blocked_commands: [
      'rm -rf /',
      'rm -rf ~',
      'sudo',
      'mkfs',
      'dd if=',
      ':(){ :|:& };:',
      'chmod 777',
      'chown root',
    ],
  },
};

// Tool definitions for Builder mode
export interface BuilderTool {
  name: string;
  type: 'shell' | 'http' | 'file' | 'docker';
  description: string;
  requires_confirmation: boolean;
}

export const BUILDER_TOOLS: BuilderTool[] = [
  {
    name: 'run_shell',
    type: 'shell',
    description: 'Execute shell commands (bash)',
    requires_confirmation: true,
  },
  {
    name: 'fetch_url',
    type: 'http',
    description: 'Fetch content from URLs',
    requires_confirmation: false,
  },
  {
    name: 'search_web',
    type: 'http',
    description: 'Search the web for information',
    requires_confirmation: false,
  },
  {
    name: 'read_file',
    type: 'file',
    description: 'Read file contents',
    requires_confirmation: false,
  },
  {
    name: 'write_file',
    type: 'file',
    description: 'Write content to files',
    requires_confirmation: true,
  },
  {
    name: 'delete_file',
    type: 'file',
    description: 'Delete files',
    requires_confirmation: true,
  },
  {
    name: 'docker_ps',
    type: 'docker',
    description: 'List Docker containers',
    requires_confirmation: false,
  },
  {
    name: 'docker_run',
    type: 'docker',
    description: 'Run Docker containers',
    requires_confirmation: true,
  },
];

// Action types for Builder mode
export type BuilderActionType =
  | 'shell_command'
  | 'file_read'
  | 'file_write'
  | 'file_delete'
  | 'http_request'
  | 'docker_command';

export interface BuilderAction {
  type: BuilderActionType;
  command?: string;
  path?: string;
  content?: string;
  url?: string;
  requires_confirmation: boolean;
}

export interface BuilderActionResult {
  success: boolean;
  output?: string;
  error?: string;
  duration?: number;
  data?: any; // For structured responses (e.g., Midnight node data)
}