import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { Plus, X } from "lucide-react";
import "xterm/css/xterm.css";
import type { TerminalInstance } from "./types";

interface TerminalPanelProps {
  projectPath: string;
  terminals: TerminalInstance[];
  activeTerminalId: string | null;
  onAddTerminal: (id: string, title: string) => void;
  onRemoveTerminal: (id: string) => void;
  onSetActive: (id: string) => void;
}

export interface TerminalPanelHandle {
  sendCommand: (command: string) => void;
  createTerminalAndRun: (command: string) => Promise<void>;
}

interface TerminalEntry {
  id: string;
  xterm: Terminal;
  fitAddon: FitAddon;
}

const TerminalPanel = forwardRef<TerminalPanelHandle, TerminalPanelProps>(
  function TerminalPanel(
    { projectPath, terminals, activeTerminalId, onAddTerminal, onRemoveTerminal, onSetActive },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termEntriesRef = useRef<Map<string, TerminalEntry>>(new Map());

    const createTerminal = useCallback(async (): Promise<string | null> => {
      const result = await window.electronAPI.ide.pty.create(projectPath);
      if (!result.success || !result.id) return null;

      const id = result.id;
      const xterm = new Terminal({
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, monospace",
        theme: {
          background: "#0a0a0f",
          foreground: "#e5e7eb",
          cursor: "#60a5fa",
          selectionBackground: "#374151",
        },
        cursorBlink: true,
        allowProposedApi: true,
      });

      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);
      xterm.loadAddon(new WebLinksAddon());

      xterm.onData((data: string) => {
        window.electronAPI.ide.pty.write(id, data);
      });

      termEntriesRef.current.set(id, { id, xterm, fitAddon });
      onAddTerminal(id, `Terminal ${terminals.length + 1}`);
      return id;
    }, [projectPath, terminals.length, onAddTerminal]);

    // Expose imperative handle to parent
    useImperativeHandle(ref, () => ({
      sendCommand(command: string) {
        if (activeTerminalId) {
          window.electronAPI.ide.pty.write(activeTerminalId, command);
        }
      },
      async createTerminalAndRun(command: string) {
        const id = await createTerminal();
        if (id) {
          // small delay for shell to initialize
          setTimeout(() => {
            window.electronAPI.ide.pty.write(id, command);
          }, 300);
        }
      },
    }), [activeTerminalId, createTerminal]);

    // Listen for pty data
    useEffect(() => {
      const cleanupData = window.electronAPI.ide.pty.onData(({ id, data }) => {
        const entry = termEntriesRef.current.get(id);
        if (entry) entry.xterm.write(data);
      });

      const cleanupExit = window.electronAPI.ide.pty.onExit(({ id }) => {
        const entry = termEntriesRef.current.get(id);
        if (entry) {
          entry.xterm.writeln("\r\n\x1b[90m[Process exited]\x1b[0m");
        }
      });

      return () => {
        cleanupData();
        cleanupExit();
      };
    }, []);

    // Mount active terminal to DOM
    useEffect(() => {
      if (!containerRef.current || !activeTerminalId) return;

      const entry = termEntriesRef.current.get(activeTerminalId);
      if (!entry) return;

      containerRef.current.innerHTML = "";
      entry.xterm.open(containerRef.current);

      requestAnimationFrame(() => {
        try {
          entry.fitAddon.fit();
          const dims = entry.fitAddon.proposeDimensions();
          if (dims) {
            window.electronAPI.ide.pty.resize(activeTerminalId, dims.cols, dims.rows);
          }
        } catch {}
        entry.xterm.focus();
      });
    }, [activeTerminalId]);

    // Resize observer
    useEffect(() => {
      if (!containerRef.current) return;

      const observer = new ResizeObserver(() => {
        if (!activeTerminalId) return;
        const entry = termEntriesRef.current.get(activeTerminalId);
        if (!entry) return;
        try {
          entry.fitAddon.fit();
          const dims = entry.fitAddon.proposeDimensions();
          if (dims) {
            window.electronAPI.ide.pty.resize(activeTerminalId, dims.cols, dims.rows);
          }
        } catch {}
      });
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }, [activeTerminalId]);

    // Create first terminal automatically
    useEffect(() => {
      if (terminals.length === 0 && projectPath) {
        createTerminal();
      }
    }, [projectPath]);

    const destroyTerminal = useCallback(
      (id: string) => {
        const entry = termEntriesRef.current.get(id);
        if (entry) {
          entry.xterm.dispose();
          termEntriesRef.current.delete(id);
        }
        window.electronAPI.ide.pty.destroy(id);
        onRemoveTerminal(id);
      },
      [onRemoveTerminal],
    );

    // Cleanup on unmount
    useEffect(() => {
      return () => {
        for (const [id, entry] of termEntriesRef.current) {
          entry.xterm.dispose();
          window.electronAPI.ide.pty.destroy(id);
        }
        termEntriesRef.current.clear();
      };
    }, []);

    return (
      <div className="flex flex-col h-full bg-[#0a0a0f]">
        <div className="flex items-center bg-gray-900 border-t border-gray-800 text-xs">
          {terminals.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-1 px-3 py-1 cursor-pointer border-r border-gray-800 ${
                t.id === activeTerminalId
                  ? "bg-[#0a0a0f] text-gray-200"
                  : "text-gray-500 hover:text-gray-300 hover:bg-gray-800"
              }`}
              onClick={() => onSetActive(t.id)}
            >
              <span>{t.title}</span>
              <button
                className="p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  destroyTerminal(t.id);
                }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <button
            className="p-1 px-2 text-gray-500 hover:text-gray-300 hover:bg-gray-800"
            onClick={() => createTerminal()}
            title="New Terminal"
          >
            <Plus size={12} />
          </button>
        </div>
        <div ref={containerRef} className="flex-1 overflow-hidden px-1" />
      </div>
    );
  },
);

export default TerminalPanel;
