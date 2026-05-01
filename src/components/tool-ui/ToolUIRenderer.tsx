import React from "react";
import type { ToolUIBlock, ButtonAction, FormSubmitAction } from "./types";
import { MAX_BLOCK_COUNT, MAX_BLOCK_DEPTH } from "./types";

/** Callback for interactive block actions (button clicks, form submissions) */
export type ToolUIActionHandler = (
  action: ButtonAction | FormSubmitAction,
  /** Merged args (for forms: submitAction.args + form values) */
  args: Record<string, unknown>,
) => Promise<void>;

// =============================================================================
// CSS Keyframes — injected once for block animations
// =============================================================================

const TOOL_UI_KEYFRAMES = `
@keyframes toolUiFadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes toolUiSparkDraw {
  from { stroke-dashoffset: 500; }
  to   { stroke-dashoffset: 0; }
}
`;

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
  ToolStatCard,
  ToolBadge,
} from "./blocks";

// =============================================================================
// Block renderer — maps block.type → React component
// =============================================================================

const renderBlock = (
  block: ToolUIBlock,
  index: number,
  depth: number,
  onAction?: ToolUIActionHandler,
): React.ReactNode => {
  if (depth > MAX_BLOCK_DEPTH) {
    return (
      <div key={index} className="text-xs text-yellow-500 px-2 py-1">
        Max nesting depth ({MAX_BLOCK_DEPTH}) exceeded — block skipped.
      </div>
    );
  }

  const childRenderer = (child: ToolUIBlock, i: number) => renderBlock(child, i, depth + 1, onAction);

  switch (block.type) {
    // Display
    case "text":      return <BlockErrorBoundary key={index}><ToolText {...block} /></BlockErrorBoundary>;
    case "markdown":  return <BlockErrorBoundary key={index}><ToolMarkdown {...block} /></BlockErrorBoundary>;
    case "code":      return <BlockErrorBoundary key={index}><ToolCode {...block} /></BlockErrorBoundary>;
    case "alert":     return <BlockErrorBoundary key={index}><ToolAlert {...block} /></BlockErrorBoundary>;
    case "image":     return <BlockErrorBoundary key={index}><ToolImage {...block} /></BlockErrorBoundary>;
    case "divider":   return <BlockErrorBoundary key={index}><ToolDivider /></BlockErrorBoundary>;

    // Data
    case "table":     return <BlockErrorBoundary key={index}><ToolTable {...block} onAction={onAction} /></BlockErrorBoundary>;
    case "card":      return <BlockErrorBoundary key={index}><ToolCard {...block} /></BlockErrorBoundary>;
    case "list":      return <BlockErrorBoundary key={index}><ToolList {...block} /></BlockErrorBoundary>;
    case "chart":     return <BlockErrorBoundary key={index}><ToolChart {...block} /></BlockErrorBoundary>;

    // Interactive
    case "form":      return <BlockErrorBoundary key={index}><ToolForm {...block} onAction={onAction} /></BlockErrorBoundary>;
    case "button":    return <BlockErrorBoundary key={index}><ToolButton {...block} onAction={onAction} /></BlockErrorBoundary>;

    // Layout (recursive)
    case "tabs":      return <BlockErrorBoundary key={index}><ToolTabs {...block} renderBlock={childRenderer} /></BlockErrorBoundary>;
    case "row":       return <BlockErrorBoundary key={index}><ToolRow {...block} renderBlock={childRenderer} /></BlockErrorBoundary>;
    case "column":    return <BlockErrorBoundary key={index}><ToolColumn {...block} renderBlock={childRenderer} /></BlockErrorBoundary>;
    case "section":   return <BlockErrorBoundary key={index}><ToolSection {...block} renderBlock={childRenderer} /></BlockErrorBoundary>;

    // Enhanced
    case "stat-card": return <BlockErrorBoundary key={index}><ToolStatCard {...block} /></BlockErrorBoundary>;
    case "badge":     return <BlockErrorBoundary key={index}><ToolBadge {...block} /></BlockErrorBoundary>;

    // Overlay blocks — handled by ToolPanelView/Chatview, not rendered inline.
    // If they somehow reach the renderer, skip them silently.
    case "detail-panel":
    case "confirm-modal":
    case "toast":
      return null;

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
  /** Optional handler for interactive block actions (buttons, forms). If not provided, interactive blocks fall back to direct electronAPI calls. */
  onAction?: ToolUIActionHandler;
}

/**
 * Renders an array of Tool UI blocks.
 *
 * This is the ONLY entry point for tool UI rendering.
 * Drop it anywhere: inline in chat, in a panel tab, wherever.
 */
export const ToolUIRenderer: React.FC<ToolUIRendererProps> = ({ blocks, onAction }) => {
  if (!blocks || blocks.length === 0) return null;

  const capped = blocks.slice(0, MAX_BLOCK_COUNT);

  return (
    <div className="tool-ui-container flex flex-col gap-4 mt-2">
      <style>{TOOL_UI_KEYFRAMES}</style>
      {capped.map((block, i) => renderBlock(block, i, 0, onAction))}
      {blocks.length > MAX_BLOCK_COUNT && (
        <div className="text-xs text-yellow-500 px-2 py-1">
          Showing first {MAX_BLOCK_COUNT} of {blocks.length} blocks.
        </div>
      )}
    </div>
  );
};
