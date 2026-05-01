import React, { useRef, useCallback } from "react";
import Editor, { OnMount } from "@monaco-editor/react";
import type { OpenFile } from "./types";

interface CodeEditorProps {
  file: OpenFile | null;
  onChange: (path: string, content: string) => void;
  onSave: (path: string) => void;
}

export default function CodeEditor({ file, onChange, onSave }: CodeEditorProps) {
  const editorRef = useRef<any>(null);

  const handleMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;

      // Ctrl+S / Cmd+S to save
      editor.addAction({
        id: "mosaic-save",
        label: "Save File",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => {
          if (file) onSave(file.path);
        },
      });

      editor.focus();
    },
    [file, onSave],
  );

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (file && value !== undefined) {
        onChange(file.path, value);
      }
    },
    [file, onChange],
  );

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-600">
        <div className="text-center">
          <p className="text-lg mb-1">No file open</p>
          <p className="text-sm">Select a file from the explorer to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <Editor
      key={file.path}
      height="100%"
      language={file.language}
      value={file.content}
      theme="vs-dark"
      onChange={handleChange}
      onMount={handleMount}
      options={{
        fontSize: 13,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, monospace",
        minimap: { enabled: true, maxColumn: 80 },
        scrollBeyondLastLine: false,
        wordWrap: "off",
        lineNumbers: "on",
        renderWhitespace: "selection",
        bracketPairColorization: { enabled: true },
        smoothScrolling: true,
        cursorSmoothCaretAnimation: "on",
        padding: { top: 8 },
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  );
}
