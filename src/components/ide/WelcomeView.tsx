import React, { useEffect, useState } from "react";
import { FolderOpen, Clock, Code2 } from "lucide-react";

interface WelcomeViewProps {
  onOpenFolder: (path: string) => void;
}

export default function WelcomeView({ onOpenFolder }: WelcomeViewProps) {
  const [recentProjects, setRecentProjects] = useState<string[]>([]);

  useEffect(() => {
    window.electronAPI.ide.project.getRecent().then(setRecentProjects);
  }, []);

  const handleOpenFolder = async () => {
    const result = await window.electronAPI.ide.fs.openFolder();
    if (result.success && result.path) {
      onOpenFolder(result.path);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center bg-gray-950">
      <div className="max-w-md w-full px-8">
        <div className="text-center mb-8">
          <Code2 size={48} className="mx-auto mb-4 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Mosaic IDE</h1>
          <p className="text-gray-500 text-sm">Open a folder to get started</p>
        </div>

        <button
          onClick={handleOpenFolder}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium mb-6 transition-colors"
        >
          <FolderOpen size={18} />
          Open Folder
        </button>

        {recentProjects.length > 0 && (
          <div>
            <h2 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              <Clock size={12} />
              Recent Projects
            </h2>
            <div className="space-y-1">
              {recentProjects.map((p) => (
                <button
                  key={p}
                  onClick={() => onOpenFolder(p)}
                  className="w-full text-left px-3 py-2 rounded text-sm text-gray-300 hover:bg-white/5 hover:text-gray-100 transition-colors truncate"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
