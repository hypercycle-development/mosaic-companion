import React from "react";
import type { CodeBlock } from "../types";

export const ToolCode: React.FC<CodeBlock> = ({ content, language }) => (
  <div className="rounded-lg overflow-hidden border border-gray-700">
    {language && (
      <div className="px-3 py-1 bg-gray-800 text-xs text-gray-400 border-b border-gray-700">
        {language}
      </div>
    )}
    <pre className="p-3 bg-gray-900 overflow-x-auto text-sm">
      <code className="text-gray-300 whitespace-pre">{content}</code>
    </pre>
  </div>
);
