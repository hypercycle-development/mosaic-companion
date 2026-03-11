import React from "react";
import type { ToolUIBlock } from "./types";
import { MAX_BLOCK_COUNT, MAX_BLOCK_DEPTH } from "./types";
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
    case "text":      return <ToolText key={index} {...block} />;
    case "markdown":  return <ToolMarkdown key={index} {...block} />;
    case "code":      return <ToolCode key={index} {...block} />;
    case "alert":     return <ToolAlert key={index} {...block} />;
    case "image":     return <ToolImage key={index} {...block} />;
    case "divider":   return <ToolDivider key={index} />;

    // Data
    case "table":     return <ToolTable key={index} {...block} />;
    case "card":      return <ToolCard key={index} {...block} />;
    case "list":      return <ToolList key={index} {...block} />;
    case "chart":     return <ToolChart key={index} {...block} />;

    // Interactive
    case "form":      return <ToolForm key={index} {...block} />;
    case "button":    return <ToolButton key={index} {...block} />;

    // Layout (recursive)
    case "tabs":      return <ToolTabs key={index} {...block} renderBlock={childRenderer} />;
    case "row":       return <ToolRow key={index} {...block} renderBlock={childRenderer} />;
    case "column":    return <ToolColumn key={index} {...block} renderBlock={childRenderer} />;
    case "section":   return <ToolSection key={index} {...block} renderBlock={childRenderer} />;

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
