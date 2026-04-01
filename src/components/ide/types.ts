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
