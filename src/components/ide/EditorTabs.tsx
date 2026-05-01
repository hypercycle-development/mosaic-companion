import React from "react";
import { X } from "lucide-react";
import type { OpenFile } from "./types";
import { getFileName } from "./utils";

interface EditorTabsProps {
  files: OpenFile[];
  activeFilePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export default function EditorTabs({ files, activeFilePath, onSelect, onClose }: EditorTabsProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex items-center bg-gray-900 border-b border-gray-800 overflow-x-auto scrollbar-hide">
      {files.map((file) => {
        const isActive = file.path === activeFilePath;
        const name = getFileName(file.path);
        return (
          <div
            key={file.path}
            className={`group flex items-center gap-1.5 px-3 py-1.5 text-sm cursor-pointer border-r border-gray-800 min-w-0 ${
              isActive
                ? "bg-gray-950 text-gray-100 border-t-2 border-t-blue-500"
                : "bg-gray-900 text-gray-400 hover:bg-gray-800 border-t-2 border-t-transparent"
            }`}
            onClick={() => onSelect(file.path)}
          >
            <span className="truncate max-w-[140px]">
              {file.isDirty && <span className="text-yellow-400 mr-0.5">*</span>}
              {name}
            </span>
            <button
              className="p-0.5 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onClose(file.path);
              }}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
