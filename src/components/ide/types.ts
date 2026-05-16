export interface OpenFile {
  path: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export interface DirEntry {
  name: string;
  type: "file" | "directory" | "symlink";
  size: number;
  modifiedMs: number;
}

export interface TerminalInstance {
  id: string;
  title: string;
}

export interface IDEState {
  projectPath: string | null;
  openFiles: OpenFile[];
  activeFilePath: string | null;
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  showTerminal: boolean;
  showAIPanel: boolean;
  showFileExplorer: boolean;
}

// =============================================================================
// Agent Forge Types
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

export type ForgeStatus = 'draft' | 'compiling' | 'testing' | 'ready' | 'deployed' | 'failed';

export interface AgentForgeSession {
  id: string;
  templateId: AgentTemplateType;
  projectPath: string;
  filePath: string;
  code: string;
  status: ForgeStatus;
  testOutput?: string;
  deployedNodeId?: string;
  lastModified: number;
  chronicleEvents: ForgeChronicleEvent[];
}

export interface ForgeChronicleEvent {
  id: string;
  timestamp: number;
  event: string;
  status: 'success' | 'failed' | 'warning' | 'info';
  detail?: string;
}

export interface ForgeDeployConfig {
  nodeId?: string;
  autoStart?: boolean;
  enableWallet?: boolean;
  tier?: 'basic' | 'standard' | 'advanced' | 'premium';
}
