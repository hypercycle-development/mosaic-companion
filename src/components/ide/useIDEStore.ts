import { useState, useCallback, useRef } from "react";
import type {
  OpenFile,
  TerminalInstance,
  IDEState,
  AgentForgeSession,
  AgentTemplateType,
} from "./types";
import { detectLanguage } from "./utils";
import { ideAgentForge } from "../../services/stargate/integrations";

const STORAGE_KEY = "mosaic_ide_state";

function loadPersistedState(): Partial<IDEState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        projectPath: parsed.projectPath ?? null,
        showTerminal: parsed.showTerminal ?? true,
        showAIPanel: parsed.showAIPanel ?? false,
        showFileExplorer: parsed.showFileExplorer ?? true,
      };
    }
  } catch {}
  return {};
}

function persistState(state: IDEState): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        projectPath: state.projectPath,
        showTerminal: state.showTerminal,
        showAIPanel: state.showAIPanel,
        showFileExplorer: state.showFileExplorer,
      }),
    );
  } catch {}
}

export function useIDEStore(initialProjectPath?: string | null) {
  const persisted = useRef(loadPersistedState()).current;

  const [projectPath, setProjectPathRaw] = useState<string | null>(
    initialProjectPath ?? persisted.projectPath ?? null,
  );
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [terminals, setTerminals] = useState<TerminalInstance[]>([]);
  const [activeTerminalId, setActiveTerminalId] = useState<string | null>(null);
  const [showTerminal, setShowTerminal] = useState(persisted.showTerminal ?? true);
  const [showAIPanel, setShowAIPanel] = useState(persisted.showAIPanel ?? false);
  const [showFileExplorer, setShowFileExplorer] = useState(persisted.showFileExplorer ?? true);

  // Agent Forge state
  const [forgeSessions, setForgeSessions] = useState<AgentForgeSession[]>([]);
  const [activeForgeSessionId, setActiveForgeSessionId] = useState<string | null>(null);
  const [showForgePanel, setShowForgePanel] = useState(false);

  const persist = useCallback(() => {
    persistState({
      projectPath,
      openFiles,
      activeFilePath,
      terminals,
      activeTerminalId,
      showTerminal,
      showAIPanel,
      showFileExplorer,
    });
  }, [projectPath, showTerminal, showAIPanel, showFileExplorer]);

  const setProjectPath = useCallback((p: string | null) => {
    setProjectPathRaw(p);
    setOpenFiles([]);
    setActiveFilePath(null);
    if (p) {
      window.electronAPI.ide.project.saveRecent(p);
    }
  }, []);

  const openFile = useCallback(
    async (filePath: string) => {
      const existing = openFiles.find((f) => f.path === filePath);
      if (existing) {
        setActiveFilePath(filePath);
        return;
      }
      const result = await window.electronAPI.ide.fs.readFile(filePath);
      if (!result.success) return;
      if (result.isBinary) return;
      const language = detectLanguage(filePath);
      setOpenFiles((prev) => [...prev, { path: filePath, content: result.content ?? "", language, isDirty: false }]);
      setActiveFilePath(filePath);
    },
    [openFiles],
  );

  const closeFile = useCallback(
    (filePath: string) => {
      setOpenFiles((prev) => prev.filter((f) => f.path !== filePath));
      if (activeFilePath === filePath) {
        setActiveFilePath((prev) => {
          const remaining = openFiles.filter((f) => f.path !== filePath);
          return remaining.length > 0 ? remaining[remaining.length - 1].path : null;
        });
      }
    },
    [activeFilePath, openFiles],
  );

  const updateFileContent = useCallback((filePath: string, content: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => (f.path === filePath ? { ...f, content, isDirty: true } : f)),
    );
  }, []);

  const saveFile = useCallback(async (filePath: string) => {
    const file = openFiles.find((f) => f.path === filePath);
    if (!file) return;
    const result = await window.electronAPI.ide.fs.writeFile(filePath, file.content);
    if (result.success) {
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === filePath ? { ...f, isDirty: false } : f)),
      );
    }
  }, [openFiles]);

  const addTerminal = useCallback((id: string, title: string) => {
    setTerminals((prev) => [...prev, { id, title }]);
    setActiveTerminalId(id);
  }, []);

  const removeTerminal = useCallback(
    (id: string) => {
      setTerminals((prev) => prev.filter((t) => t.id !== id));
      if (activeTerminalId === id) {
        setActiveTerminalId((prev) => {
          const remaining = terminals.filter((t) => t.id !== id);
          return remaining.length > 0 ? remaining[remaining.length - 1].id : null;
        });
      }
    },
    [activeTerminalId, terminals],
  );

  // ---------------------------------------------------------------------------
  // Agent Forge actions
  // ---------------------------------------------------------------------------

  const createForgeSession = useCallback(
    (templateId: AgentTemplateType) => {
      if (!projectPath) return null;
      const rawSession = ideAgentForge.createSession(templateId, projectPath);
      const session: AgentForgeSession = {
        ...rawSession,
        chronicleEvents: [],
      };
      setForgeSessions((prev) => [...prev, session]);
      setActiveForgeSessionId(session.id);
      setShowForgePanel(true);
      // Also write the template file to disk so it appears in the file explorer
      window.electronAPI.ide.fs.writeFile(session.filePath, session.code).then(() => {
        // Update with potentially saved code
        const updated = ideAgentForge.getSession(session.id);
        if (updated) {
          setForgeSessions((prev) =>
            prev.map((s) => (s.id === session.id ? { ...s, code: updated.code } : s)),
          );
        }
      });
      return session;
    },
    [projectPath],
  );

  const updateForgeSession = useCallback((session: AgentForgeSession) => {
    setForgeSessions((prev) =>
      prev.map((s) => (s.id === session.id ? session : s)),
    );
  }, []);

  const closeForgeSession = useCallback((sessionId: string) => {
    setForgeSessions((prev) => prev.filter((s) => s.id !== sessionId));
    setActiveForgeSessionId((prev) => {
      if (prev === sessionId) {
        const remaining = forgeSessions.filter((s) => s.id !== sessionId);
        return remaining.length > 0 ? remaining[0].id : null;
      }
      return prev;
    });
  }, [forgeSessions]);

  const selectForgeSession = useCallback((sessionId: string | null) => {
    setActiveForgeSessionId(sessionId);
    if (sessionId) setShowForgePanel(true);
  }, []);

  return {
    projectPath,
    setProjectPath,
    openFiles,
    activeFilePath,
    setActiveFilePath,
    openFile,
    closeFile,
    updateFileContent,
    saveFile,
    terminals,
    activeTerminalId,
    setActiveTerminalId,
    addTerminal,
    removeTerminal,
    showTerminal,
    setShowTerminal,
    showAIPanel,
    setShowAIPanel,
    showFileExplorer,
    setShowFileExplorer,
    persist,
    // Forge
    forgeSessions,
    activeForgeSessionId,
    showForgePanel,
    setShowForgePanel,
    createForgeSession,
    updateForgeSession,
    closeForgeSession,
    selectForgeSession,
  };
}
