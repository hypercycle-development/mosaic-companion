import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelBottomClose,
  PanelBottomOpen,
  Bot,
  FolderOpen,
} from "lucide-react";
import { useIDEStore } from "./useIDEStore";
import FileExplorer from "./FileExplorer";
import EditorTabs from "./EditorTabs";
import CodeEditor from "./CodeEditor";
import TerminalPanel from "./TerminalPanel";
import type { TerminalPanelHandle } from "./TerminalPanel";
import AIAssistPanel from "./AIAssistPanel";
import IDEStatusBar from "./IDEStatusBar";
import WelcomeView from "./WelcomeView";

interface IDEPageProps {
  url: string;
  onNavigate?: (url: string) => void;
}

export default function IDEPage({ url }: IDEPageProps) {
  // Extract ?path= from URL
  const urlPath = (() => {
    try {
      const search = url.split("?")[1];
      if (search) {
        const params = new URLSearchParams(search);
        return params.get("path") ?? null;
      }
    } catch {}
    return null;
  })();

  const store = useIDEStore(urlPath);
  const {
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
  } = store;

  const [explorerWidth, setExplorerWidth] = useState(240);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [aiPanelWidth, setAIPanelWidth] = useState(320);

  const terminalRef = useRef<TerminalPanelHandle>(null);

  // Persist layout on changes
  useEffect(() => {
    persist();
  }, [showTerminal, showAIPanel, showFileExplorer, projectPath]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "b") {
        e.preventDefault();
        setShowFileExplorer((v) => !v);
      }
      if (mod && e.key === "`") {
        e.preventDefault();
        setShowTerminal((v) => !v);
      }
      if (mod && e.key === "j") {
        e.preventDefault();
        setShowAIPanel((v) => !v);
      }
      if (mod && e.key === "s") {
        e.preventDefault();
        if (activeFilePath) saveFile(activeFilePath);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activeFilePath, saveFile, setShowFileExplorer, setShowTerminal, setShowAIPanel]);

  const handleOpenFolder = useCallback(
    (p: string) => {
      setProjectPath(p);
    },
    [setProjectPath],
  );

  const handleBrowseFolder = useCallback(async () => {
    const result = await window.electronAPI.ide.fs.openFolder();
    if (result.success && result.path) {
      setProjectPath(result.path);
    }
  }, [setProjectPath]);

  const activeFile = openFiles.find((f) => f.path === activeFilePath) ?? null;

  // Resizable explorer
  const explorerResizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const handleExplorerResizeStart = useCallback(
    (e: React.MouseEvent) => {
      explorerResizeRef.current = { startX: e.clientX, startW: explorerWidth };
      const onMove = (ev: MouseEvent) => {
        if (!explorerResizeRef.current) return;
        const newW = explorerResizeRef.current.startW + (ev.clientX - explorerResizeRef.current.startX);
        setExplorerWidth(Math.max(160, Math.min(500, newW)));
      };
      const onUp = () => {
        explorerResizeRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [explorerWidth],
  );

  // Resizable terminal
  const termResizeRef = useRef<{ startY: number; startH: number } | null>(null);
  const handleTermResizeStart = useCallback(
    (e: React.MouseEvent) => {
      termResizeRef.current = { startY: e.clientY, startH: terminalHeight };
      const onMove = (ev: MouseEvent) => {
        if (!termResizeRef.current) return;
        const newH = termResizeRef.current.startH - (ev.clientY - termResizeRef.current.startY);
        setTerminalHeight(Math.max(100, Math.min(600, newH)));
      };
      const onUp = () => {
        termResizeRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [terminalHeight],
  );

  // Resizable AI panel
  const aiResizeRef = useRef<{ startX: number; startW: number } | null>(null);
  const handleAIResizeStart = useCallback(
    (e: React.MouseEvent) => {
      aiResizeRef.current = { startX: e.clientX, startW: aiPanelWidth };
      const onMove = (ev: MouseEvent) => {
        if (!aiResizeRef.current) return;
        const newW = aiResizeRef.current.startW - (ev.clientX - aiResizeRef.current.startX);
        setAIPanelWidth(Math.max(240, Math.min(600, newW)));
      };
      const onUp = () => {
        aiResizeRef.current = null;
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [aiPanelWidth],
  );

  if (!projectPath) {
    return <WelcomeView onOpenFolder={handleOpenFolder} />;
  }

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-100">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-900 border-b border-gray-800 text-xs">
        <button
          onClick={() => setShowFileExplorer((v) => !v)}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200"
          title="Toggle Explorer (Ctrl+B)"
        >
          {showFileExplorer ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
        </button>
        <button
          onClick={() => setShowTerminal((v) => !v)}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200"
          title="Toggle Terminal (Ctrl+`)"
        >
          {showTerminal ? <PanelBottomClose size={14} /> : <PanelBottomOpen size={14} />}
        </button>
        <button
          onClick={() => setShowAIPanel((v) => !v)}
          className={`p-1 rounded hover:bg-white/10 ${showAIPanel ? "text-blue-400" : "text-gray-400 hover:text-gray-200"}`}
          title="Toggle AI Assist (Ctrl+J)"
        >
          <Bot size={14} />
        </button>

        <div className="mx-2 h-3 w-px bg-gray-700" />
        <button
          onClick={handleBrowseFolder}
          className="p-1 rounded hover:bg-white/10 text-gray-400 hover:text-gray-200"
          title="Open Folder"
        >
          <FolderOpen size={14} />
        </button>
        <span className="ml-2 text-gray-500 truncate">{projectPath}</span>
      </div>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* File explorer */}
        {showFileExplorer && (
          <>
            <div style={{ width: explorerWidth }} className="flex-shrink-0 overflow-hidden">
              <FileExplorer
                projectPath={projectPath}
                onOpenFile={openFile}
                activeFilePath={activeFilePath}
              />
            </div>
            <div
              className="w-1 cursor-col-resize bg-gray-800 hover:bg-blue-500/50 flex-shrink-0"
              onMouseDown={handleExplorerResizeStart}
            />
          </>
        )}

        {/* Editor + Terminal */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Editor tabs + editor */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <EditorTabs
              files={openFiles}
              activeFilePath={activeFilePath}
              onSelect={setActiveFilePath}
              onClose={closeFile}
            />
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                file={activeFile}
                onChange={updateFileContent}
                onSave={saveFile}
              />
            </div>
          </div>

          {/* Terminal — always mounted to preserve PTY sessions; hidden with CSS when toggled */}
          {showTerminal && (
            <div
              className="h-1 cursor-row-resize bg-gray-800 hover:bg-blue-500/50 flex-shrink-0"
              onMouseDown={handleTermResizeStart}
            />
          )}
          <div
            style={{ height: showTerminal ? terminalHeight : 0 }}
            className="flex-shrink-0 overflow-hidden"
          >
            <TerminalPanel
              ref={terminalRef}
              projectPath={projectPath}
              terminals={terminals}
              activeTerminalId={activeTerminalId}
              onAddTerminal={addTerminal}
              onRemoveTerminal={removeTerminal}
              onSetActive={setActiveTerminalId}
              visible={showTerminal}
            />
          </div>
        </div>

        {/* AI assist panel */}
        {showAIPanel && (
          <>
            <div
              className="w-1 cursor-col-resize bg-gray-800 hover:bg-blue-500/50 flex-shrink-0"
              onMouseDown={handleAIResizeStart}
            />
            <div style={{ width: aiPanelWidth }} className="flex-shrink-0 overflow-hidden">
              <AIAssistPanel
                activeFilePath={activeFilePath}
                activeFileContent={activeFile?.content ?? null}
                projectPath={projectPath}
                onClose={() => setShowAIPanel(false)}
              />
            </div>
          </>
        )}
      </div>

      {/* Status bar */}
      <IDEStatusBar
        projectPath={projectPath}
        activeFilePath={activeFilePath}
        language={activeFile?.language ?? ""}
      />
    </div>
  );
}
