import React, { useState } from "react";
import type { ButtonBlock } from "../types";
import type { ToolUIActionHandler } from "../ToolUIRenderer";

const VARIANT_CLASSES: Record<string, string> = {
  primary:   "bg-blue-600 hover:bg-blue-500 text-white",
  secondary: "bg-gray-700 hover:bg-gray-600 text-gray-200",
  danger:    "bg-red-700 hover:bg-red-600 text-white",
  ghost:     "bg-transparent hover:bg-gray-800 text-gray-300 border border-gray-700",
};

export const ToolButton: React.FC<ButtonBlock & { onAction?: ToolUIActionHandler }> = ({ label, variant = "secondary", action, onAction }) => {
  const [running, setRunning] = useState(false);

  const handleClick = async () => {
    setRunning(true);
    try {
      if (onAction) {
        await onAction(action, action.args ?? {});
      } else {
        const fullToolName = `${action.server}:${action.tool}`;
        await (window as any).electronAPI?.tools?.execute?.(fullToolName, action.args ?? {});
      }
    } finally {
      setRunning(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={running}
      className={`px-3 py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-50 ${
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.secondary
      }`}
    >
      {running ? "Running..." : label}
    </button>
  );
};
