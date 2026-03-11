import React from "react";
import ReactMarkdown from "react-markdown";
import type { MarkdownBlock } from "../types";

export const ToolMarkdown: React.FC<MarkdownBlock> = ({ content }) => (
  <div className="prose prose-invert prose-sm max-w-none text-gray-300">
    <ReactMarkdown>{content}</ReactMarkdown>
  </div>
);
