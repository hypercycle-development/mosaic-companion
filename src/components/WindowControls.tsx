import React, { useState, useEffect } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";

interface WindowControlsProps {
  className?: string;
}

/**
 * Custom window controls for frameless Electron window.
 * Provides minimize, maximize/restore, and close buttons.
 */
export const WindowControls: React.FC<WindowControlsProps> = ({
  className = "",
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  // Check initial maximized state
  useEffect(() => {
    const checkMaximized = async () => {
      if (window.electronAPI?.window?.isMaximized) {
        const maximized = await window.electronAPI.window.isMaximized();
        setIsMaximized(maximized);
      }
    };
    checkMaximized();

    // Check periodically in case window state changes externally
    const interval = setInterval(checkMaximized, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleMinimize = async () => {
    await window.electronAPI?.window?.minimize();
  };

  const handleMaximize = async () => {
    await window.electronAPI?.window?.maximize();
    // Toggle state optimistically
    setIsMaximized(!isMaximized);
  };

  const handleClose = async () => {
    await window.electronAPI?.window?.close();
  };

  const buttonBase =
    "flex items-center justify-center w-8 h-8 transition-colors focus:outline-none";

  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {/* Minimize */}
      <button
        onClick={handleMinimize}
        className={`${buttonBase} text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded`}
        title="Minimize"
      >
        <Minus size={14} />
      </button>

      {/* Maximize/Restore */}
      <button
        onClick={handleMaximize}
        className={`${buttonBase} text-gray-400 hover:text-gray-200 hover:bg-gray-700/50 rounded`}
        title={isMaximized ? "Restore" : "Maximize"}
      >
        {isMaximized ? <Maximize2 size={12} /> : <Square size={11} />}
      </button>

      {/* Close */}
      <button
        onClick={handleClose}
        className={`${buttonBase} text-gray-400 hover:text-white hover:bg-red-600 rounded`}
        title="Close"
      >
        <X size={14} />
      </button>
    </div>
  );
};
