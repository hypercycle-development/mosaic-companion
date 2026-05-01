/**
 * ToolDetailSidebar — Right-side detail drawer for tools.
 *
 * Slides in from the right when a tool action targets "sidebar" or
 * when a detail-panel block is returned. Contains a header (title,
 * subtitle, close button) and a scrollable body of child blocks.
 *
 * MosAIc owns the animation, overlay, and dismiss behavior.
 * The tool only provides the content blocks.
 */

import React, { useEffect, useRef, useCallback } from "react";
import { X } from "lucide-react";
import type { DetailPanelBlock } from "../types";

// =============================================================================
// Width mapping
// =============================================================================

const WIDTH_CLASSES: Record<NonNullable<DetailPanelBlock["width"]>, string> = {
  narrow: "w-96",    // 384px
  medium: "w-[480px]",
  wide: "w-[640px]",
};

// =============================================================================
// Component
// =============================================================================

export interface ToolDetailSidebarProps {
  /** The detail-panel block to render */
  panel: DetailPanelBlock;
  /** Called when the sidebar should close (X, Escape, backdrop click) */
  onClose: () => void;
  /** Render child blocks — provided by ToolPanelView so block nesting works */
  renderBlocks: (blocks: DetailPanelBlock["blocks"]) => React.ReactNode;
}

export const ToolDetailSidebar: React.FC<ToolDetailSidebarProps> = ({
  panel,
  onClose,
  renderBlocks,
}) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const widthClass = WIDTH_CLASSES[panel.width ?? "medium"];

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity duration-200"
        style={{ animation: "toolSidebarFadeIn 200ms ease-out" }}
      />

      {/* Sidebar panel */}
      <div
        ref={sidebarRef}
        className={`relative ${widthClass} max-w-[85vw] h-full bg-gray-900 border-l border-gray-700/50 shadow-2xl flex flex-col`}
        style={{ animation: "toolSidebarSlideIn 250ms ease-out" }}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-6 py-5 border-b border-gray-800 flex-shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-white truncate">
              {panel.title}
            </h2>
            {panel.subtitle && (
              <p className="text-sm text-gray-400 mt-0.5 truncate">
                {panel.subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors flex-shrink-0"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {renderBlocks(panel.blocks)}
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes toolSidebarSlideIn {
          from { transform: translateX(100%); }
          to   { transform: translateX(0); }
        }
        @keyframes toolSidebarFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  );
};
