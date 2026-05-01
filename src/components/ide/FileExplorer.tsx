import React, { useState, useEffect, useCallback } from "react";
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  RefreshCw,
} from "lucide-react";
import type { DirEntry } from "./types";
import { getFileIconStyle, getFolderColor } from "./utils";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory" | "symlink";
  children?: TreeNode[];
  loaded?: boolean;
  expanded?: boolean;
}

interface FileExplorerProps {
  projectPath: string;
  onOpenFile: (filePath: string) => void;
  activeFilePath: string | null;
}

function FileIcon({ name }: { name: string }) {
  const style = getFileIconStyle(name);
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 mr-1.5 flex-shrink-0 text-[9px] font-bold leading-none ${style.color}`}
    >
      {style.label || (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      )}
    </span>
  );
}

function FileTreeItem({
  node,
  depth,
  onOpenFile,
  activeFilePath,
  onToggle,
}: {
  node: TreeNode;
  depth: number;
  onOpenFile: (path: string) => void;
  activeFilePath: string | null;
  onToggle: (node: TreeNode) => void;
}) {
  const isActive = node.path === activeFilePath;
  const isDir = node.type === "directory";
  const folderColor = isDir ? getFolderColor(node.name) : "";

  const handleClick = () => {
    if (isDir) {
      onToggle(node);
    } else {
      onOpenFile(node.path);
    }
  };

  return (
    <>
      <div
        className={`flex items-center cursor-pointer py-[3px] px-2 text-[13px] leading-tight hover:bg-white/5 ${
          isActive ? "bg-white/10 text-blue-400" : "text-gray-300"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {isDir ? (
          <span className="mr-0.5 flex-shrink-0 text-gray-500">
            {node.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        ) : (
          <span className="mr-0.5 w-3.5 flex-shrink-0" />
        )}
        {isDir ? (
          node.expanded ? (
            <FolderOpen size={15} className={`mr-1.5 flex-shrink-0 ${folderColor}`} />
          ) : (
            <Folder size={15} className={`mr-1.5 flex-shrink-0 ${folderColor}`} />
          )
        ) : (
          <FileIcon name={node.name} />
        )}
        <span className="truncate">{node.name}</span>
      </div>
      {isDir && node.expanded && node.children && (
        <>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              onOpenFile={onOpenFile}
              activeFilePath={activeFilePath}
              onToggle={onToggle}
            />
          ))}
          {node.children.length === 0 && (
            <div
              className="text-xs text-gray-600 italic py-0.5"
              style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
            >
              empty
            </div>
          )}
        </>
      )}
    </>
  );
}

export default function FileExplorer({ projectPath, onOpenFile, activeFilePath }: FileExplorerProps) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDir = useCallback(
    async (dirPath: string): Promise<TreeNode[]> => {
      const result = await window.electronAPI.ide.fs.readDir(dirPath);
      if (!result.success || !result.entries) return [];
      return result.entries.map((entry: DirEntry) => ({
        name: entry.name,
        path: `${dirPath}/${entry.name}`,
        type: entry.type,
        children: entry.type === "directory" ? [] : undefined,
        loaded: false,
        expanded: false,
      }));
    },
    [],
  );

  const loadRoot = useCallback(async () => {
    setLoading(true);
    const nodes = await loadDir(projectPath);
    setTree(nodes);
    setLoading(false);
  }, [projectPath, loadDir]);

  useEffect(() => {
    loadRoot();
  }, [loadRoot]);

  const toggleNode = useCallback(
    async (target: TreeNode) => {
      if (target.type !== "directory") return;

      if (!target.loaded) {
        const children = await loadDir(target.path);
        setTree((prev) =>
          updateTreeNode(prev, target.path, { children, loaded: true, expanded: true }),
        );
      } else {
        setTree((prev) =>
          updateTreeNode(prev, target.path, { expanded: !target.expanded }),
        );
      }
    },
    [loadDir],
  );

  const projectName = projectPath.split("/").pop() ?? projectPath;

  return (
    <div className="h-full flex flex-col bg-gray-950 border-r border-gray-800">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider truncate">
          {projectName}
        </span>
        <button
          onClick={loadRoot}
          className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-gray-300"
          title="Refresh"
        >
          <RefreshCw size={12} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-1">
        {loading ? (
          <div className="text-xs text-gray-500 px-3 py-2">Loading...</div>
        ) : (
          tree.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              depth={0}
              onOpenFile={onOpenFile}
              activeFilePath={activeFilePath}
              onToggle={toggleNode}
            />
          ))
        )}
      </div>
    </div>
  );
}

function updateTreeNode(
  nodes: TreeNode[],
  targetPath: string,
  updates: Partial<TreeNode>,
): TreeNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath) {
      return { ...node, ...updates };
    }
    if (node.children && targetPath.startsWith(node.path + "/")) {
      return { ...node, children: updateTreeNode(node.children, targetPath, updates) };
    }
    return node;
  });
}
