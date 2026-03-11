import React from "react";
import type { ToolUIBlock } from "./types";
import { MAX_BLOCK_COUNT, MAX_BLOCK_DEPTH } from "./types";

// =============================================================================
// Error Boundary — prevents a single bad block from crashing the whole app
// =============================================================================

interface ErrorBoundaryState { hasError: boolean }

class BlockErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) {
    console.warn("[ToolUI] Block render error:", error.message);
  }
  render() {
    if (this.state.hasError) {
      return <div className="text-xs text-red-400/70 px-2 py-1">Block failed to render.</div>;
    }
    return this.props.children;
  }
}
import {
  ToolText,
  ToolMarkdown,
  ToolCode,
  ToolAlert,
  ToolImage,
  ToolDivider,
  ToolTable,
  ToolCard,
  ToolList,
  ToolChart,
  ToolForm,
  ToolButton,
  ToolTabs,
  ToolRow,
  ToolColumn,
  ToolSection,
} from "./blocks";

// =============================================================================
// Block renderer — maps block.type → React component
// =============================================================================

const renderBlock = (block: ToolUIBlock, index: number, depth: number): React.ReactNode => {
  if (depth > MAX_BLOCK_DEPTH) {
    return (
      <div key={index} className="text-xs text-yellow-500 px-2 py-1">
        Max nesting depth ({MAX_BLOCK_DEPTH}) exceeded — block skipped.
      </div>
    );
  }

  const childRenderer = (child: ToolUIBlock, i: number) => renderBlock(child, i, depth + 1);

  switch (block.type) {
    // Display
    case "text":      return <BlockErrorBoundary key={index}><ToolText {...block} /></BlockErrorBoundary>;
    case "markdown":  return <BlockErrorBoundary key={index}><ToolMarkdown {...block} /></BlockErrorBoundary>;
    case "code":      return <BlockErrorBoundary key={index}><ToolCode {...block} /></BlockErrorBoundary>;
    case "alert":     return <BlockErrorBoundary key={index}><ToolAlert {...block} /></BlockErrorBoundary>;
    case "image":     return <BlockErrorBoundary key={index}><ToolImage {...block} /></BlockErrorBoundary>;
    case "divider":   return <BlockErrorBoundary key={index}><ToolDivider /></BlockErrorBoundary>;

    // Data
    case "table":     return <BlockErrorBoundary key={index}><ToolTable {...block} /></BlockErrorBoundary>;
    case "card":      return <BlockErrorBoundary key={index}><ToolCard {...block} /></BlockErrorBoundary>;
    case "list":      return <BlockErrorBoundary key={index}><ToolList {...block} /></BlockErrorBoundary>;
    case "chart":     return <BlockErrorBoundary key={index}><ToolChart {...block} /></BlockErrorBoundary>;

    // Interactive
    case "form":      return <BlockErrorBoundary key={index}><ToolForm {...block} /></BlockErrorBoundary>;
    case "button":    return <BlockErrorBoundary key={index}><ToolButton {...block} /></BlockErrorBoundary>;

    // Layout (recursive)
    case "tabs":      return <BlockErrorBoundary key={index}><ToolTabs {...block} renderBlock={childRenderer} /></BlockErrorBoundary>;
    case "row":       return <BlockErrorBoundary key={index}><ToolRow {...block} renderBlock={childRenderer} /></BlockErrorBoundary>;
    case "column":    return <BlockErrorBoundary key={index}><ToolColumn {...block} renderBlock={childRenderer} /></BlockErrorBoundary>;
    case "section":   return <BlockErrorBoundary key={index}><ToolSection {...block} renderBlock={childRenderer} /></BlockErrorBoundary>;

    default:
      return (
        <div key={index} className="text-xs text-gray-500 px-2 py-1">
          Unknown block type: {(block as any).type}
        </div>
      );
  }
};

// =============================================================================
// Public Component
// =============================================================================

export interface ToolUIRendererProps {
  blocks: ToolUIBlock[];
}

/**
 * Renders an array of Tool UI blocks.
 *
 * This is the ONLY entry point for tool UI rendering.
 * Drop it anywhere: inline in chat, in a panel tab, wherever.
 */
export const ToolUIRenderer: React.FC<ToolUIRendererProps> = ({ blocks }) => {
  if (!blocks || blocks.length === 0) return null;

  const capped = blocks.slice(0, MAX_BLOCK_COUNT);

  return (
    <div className="tool-ui-container flex flex-col gap-2 mt-2">
      {capped.map((block, i) => renderBlock(block, i, 0))}
      {blocks.length > MAX_BLOCK_COUNT && (
        <div className="text-xs text-yellow-500 px-2 py-1">
          Showing first {MAX_BLOCK_COUNT} of {blocks.length} blocks.
        </div>
      )}
    </div>
  );
};
