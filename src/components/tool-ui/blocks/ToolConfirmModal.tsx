/**
 * ToolConfirmModal — Confirmation dialog for tool actions.
 *
 * Tools return a confirm-modal block when they need explicit user
 * consent before proceeding (e.g. confirming a transaction, deleting
 * an item, approving a risky operation).
 *
 * Supports three severity levels (info, warning, danger) with matching
 * visual styling. Optional detail blocks between message and buttons.
 *
 * Works both inside ToolPanelView and in the agent chat flow.
 */

import React, { useEffect, useRef, useCallback } from "react";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";
import type { ConfirmModalBlock } from "../types";
import type { ToolUIActionHandler } from "../ToolUIRenderer";

// =============================================================================
// Severity styling
// =============================================================================

const SEVERITY_CONFIG = {
  info: {
    icon: Info,
    iconColor: "text-blue-400",
    borderColor: "border-blue-500/30",
    bgColor: "bg-blue-500/5",
    confirmBg: "bg-blue-600 hover:bg-blue-500",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-yellow-400",
    borderColor: "border-yellow-500/30",
    bgColor: "bg-yellow-500/5",
    confirmBg: "bg-yellow-600 hover:bg-yellow-500",
  },
  danger: {
    icon: ShieldAlert,
    iconColor: "text-red-400",
    borderColor: "border-red-500/30",
    bgColor: "bg-red-500/5",
    confirmBg: "bg-red-600 hover:bg-red-500",
  },
} as const;

// =============================================================================
// Component
// =============================================================================

export interface ToolConfirmModalProps {
  /** The confirm-modal block to render */
  modal: ConfirmModalBlock;
  /** Called when the modal should close (after confirm/cancel action, or Escape) */
  onClose: () => void;
  /** Action handler for confirm/cancel actions */
  onAction?: ToolUIActionHandler;
  /** Render detail blocks inside the modal body */
  renderBlocks?: (blocks: ConfirmModalBlock["details"]) => React.ReactNode;
}

export const ToolConfirmModal: React.FC<ToolConfirmModalProps> = ({
  modal,
  onClose,
  onAction,
  renderBlocks,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const severity = modal.severity ?? "info";
  const config = SEVERITY_CONFIG[severity];
  const IconComp = config.icon;

  // Close on Escape
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
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onClose();
      }
    },
    [onClose],
  );

  const handleConfirm = useCallback(async () => {
    if (onAction) {
      await onAction(modal.confirmAction, modal.confirmAction.args ?? {});
    }
    onClose();
  }, [onAction, modal.confirmAction, onClose]);

  const handleCancel = useCallback(async () => {
    if (modal.cancelAction && onAction) {
      await onAction(modal.cancelAction, modal.cancelAction.args ?? {});
    }
    onClose();
  }, [onAction, modal.cancelAction, onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{ animation: "toolModalFadeIn 150ms ease-out" }}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        className={`relative w-full max-w-lg bg-gray-900 rounded-xl border ${config.borderColor} shadow-2xl`}
        style={{ animation: "toolModalScaleIn 200ms ease-out" }}
      >
        {/* Header */}
        <div className={`flex items-start gap-3 px-6 pt-6 pb-4 ${config.bgColor} rounded-t-xl`}>
          <div className={`p-2 rounded-lg ${config.bgColor} ${config.iconColor} flex-shrink-0 mt-0.5`}>
            <IconComp size={22} />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-white">{modal.title}</h3>
            <p className="text-sm text-gray-300 mt-1 leading-relaxed">
              {modal.message}
            </p>
          </div>
        </div>

        {/* Detail blocks (optional) */}
        {modal.details && modal.details.length > 0 && renderBlocks && (
          <div className="px-6 py-4 border-t border-gray-800">
            {renderBlocks(modal.details)}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
          <button
            onClick={handleCancel}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-colors"
          >
            {modal.cancelLabel ?? "Cancel"}
          </button>
          <button
            onClick={handleConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${config.confirmBg} transition-colors`}
          >
            {modal.confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>

      {/* Keyframe animations */}
      <style>{`
        @keyframes toolModalFadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes toolModalScaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
};
