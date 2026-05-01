import React from "react";
import type { ImageBlock } from "../types";

const DATA_URI_RE = /^data:/;

export const ToolImage: React.FC<ImageBlock> = ({ src, alt, width, height }) => {
  // Security: only allow data: URIs — no external URLs
  if (!DATA_URI_RE.test(src)) {
    return (
      <div className="p-3 rounded-lg border border-red-800 bg-red-950/30 text-sm text-red-300">
        Image blocked: only data: URIs are allowed.
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt ?? "Tool image"}
      width={width}
      height={height}
      className="rounded-lg max-w-full"
    />
  );
};
