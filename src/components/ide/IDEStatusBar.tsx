import React, { useEffect, useState } from "react";
import { GitBranch } from "lucide-react";

interface IDEStatusBarProps {
  projectPath: string | null;
  activeFilePath: string | null;
  language: string;
}

export default function IDEStatusBar({ projectPath, activeFilePath, language }: IDEStatusBarProps) {
  const [branch, setBranch] = useState<string | null>(null);

  useEffect(() => {
    if (!projectPath) {
      setBranch(null);
      return;
    }
    window.electronAPI.ide.project.getGitBranch(projectPath).then((r) => {
      if (r.success) setBranch(r.branch ?? null);
      else setBranch(null);
    });
  }, [projectPath]);

  return (
    <div className="flex items-center justify-between px-3 py-0.5 bg-blue-900/40 border-t border-gray-800 text-xs text-gray-400">
      <div className="flex items-center gap-3">
        {branch && (
          <span className="flex items-center gap-1">
            <GitBranch size={12} />
            {branch}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {language && language !== "plaintext" && (
          <span className="capitalize">{language}</span>
        )}
        <span>UTF-8</span>
      </div>
    </div>
  );
}
