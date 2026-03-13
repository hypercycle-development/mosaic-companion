/**
 * ToolPanelView — Renders persistent UI panels from a running WASM tool.
 *
 * When a tool declares `ui.panels` in its manifest, this component:
 * 1. Calls `mosaic_render_panel(panelId)` via IPC to get ToolUIBlocks
 * 2. Renders them with ToolUIRenderer
 * 3. Handles button/form actions (calls tool functions, then re-renders)
 * 4. Supports sub-tabs when a tool declares multiple panels
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  Cpu,
  LayoutDashboard,
} from "lucide-react";
import { ToolUIRenderer } from "./tool-ui/ToolUIRenderer";
import type { ToolUIActionHandler } from "./tool-ui/ToolUIRenderer";
import type { ToolUIBlock } from "./tool-ui/types";
import type {
  ToolManifest,
  ToolUIPanel,
  ToolCallResult,
} from "../../electron/integrations/sandbox/types";

// =============================================================================
// Types
// =============================================================================

export interface ToolPanelViewProps {
  /** The tool's manifest ID */
  toolId: string;
  /** The tool's manifest (for display name, panels list) */
  manifest: ToolManifest;
  /** Dev-mode: supply mock blocks keyed by panelId to bypass IPC.
   *  Can be a static map or a function that receives (panelId, context) for dynamic panels. */
  mockData?: Record<string, ToolUIBlock[]> | ((panelId: string, context?: Record<string, unknown>) => ToolUIBlock[] | undefined);
}

interface PanelState {
  blocks: ToolUIBlock[];
  loading: boolean;
  error: string | null;
}

// =============================================================================
// Component
// =============================================================================

export const ToolPanelView: React.FC<ToolPanelViewProps> = ({
  toolId,
  manifest,
  mockData,
}) => {
  const panels = manifest.ui?.panels ?? [];
  const [activePanelId, setActivePanelId] = useState<string>(
    panels[0]?.id ?? "",
  );
  const [panelState, setPanelState] = useState<PanelState>({
    blocks: [],
    loading: true,
    error: null,
  });
  const mountedRef = useRef(true);
  /** Context from a navigation action (e.g. which AIM was clicked) */
  const panelContextRef = useRef<Record<string, unknown> | undefined>(undefined);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ─── Render Panel ──────────────────────────────────────────────────

  const renderPanel = useCallback(
    async (panelId: string) => {
      setPanelState((s) => ({ ...s, loading: true, error: null }));

      // Dev-mode: use mock data instead of IPC
      if (mockData) {
        const blocks = typeof mockData === "function"
          ? mockData(panelId, panelContextRef.current)
          : mockData[panelId];
        setPanelState({
          blocks: blocks ?? [],
          loading: false,
          error: blocks ? null : `No mock data for panel "${panelId}"`,
        });
        return;
      }

      try {
        const result: ToolCallResult =
          await window.electronAPI.toolSandbox.renderPanel(toolId, panelId);

        if (!mountedRef.current) return;

        if (result.success) {
          setPanelState({
            blocks: (result.ui ?? []) as ToolUIBlock[],
            loading: false,
            error: null,
          });
        } else {
          setPanelState({
            blocks: [],
            loading: false,
            error: result.error ?? "Failed to render panel",
          });
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setPanelState({
          blocks: [],
          loading: false,
          error: (err as Error).message,
        });
      }
    },
    [toolId, mockData],
  );

  // Load panel on mount and when active panel changes
  useEffect(() => {
    if (activePanelId) {
      renderPanel(activePanelId);
    }
  }, [activePanelId, renderPanel]);

  // ─── Action Handler (buttons/forms in panels) ─────────────────────

  const handleAction: ToolUIActionHandler = useCallback(
    async (action, args) => {
      // Panel navigation: switch to a different panel tab with context
      if (action.tool === "__navigate_panel__") {
        const targetPanel = String(args.__panel ?? "");
        if (targetPanel && panels.some((p: ToolUIPanel) => p.id === targetPanel)) {
          // Strip internal keys, keep the rest as context
          const { __panel, ...context } = args;
          panelContextRef.current = context;
          setActivePanelId(targetPanel);
          return;
        }
      }

      // Dev-mode: log instead of calling IPC
      if (mockData) {
        console.log("[ToolPanelView] Mock action:", { action, args });
        return;
      }
      try {
        await window.electronAPI.toolSandbox.callFunction(
          toolId,
          action.tool,
          args,
        );
        // Re-render the panel after the action completes
        if (activePanelId) {
          await renderPanel(activePanelId);
        }
      } catch (err) {
        console.error("[ToolPanelView] Action error:", err);
      }
    },
    [toolId, activePanelId, renderPanel, mockData],
  );

  // ─── No panels declared ───────────────────────────────────────────

  if (panels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-500">
        <LayoutDashboard size={48} className="mb-4 text-gray-700" />
        <p className="text-lg">No panels declared</p>
        <p className="text-sm mt-1">
          This tool doesn't declare any UI panels in its manifest.
        </p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-3">
        <div className="flex items-center gap-3">
          <Cpu size={20} className="text-indigo-400" />
          <div>
            <h1 className="text-lg font-semibold text-white">
              {manifest.displayName}
            </h1>
            <p className="text-xs text-gray-500">{manifest.description}</p>
          </div>
        </div>
        <button
          onClick={() => activePanelId && renderPanel(activePanelId)}
          disabled={panelState.loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors disabled:opacity-50"
          title="Refresh panel"
        >
          {panelState.loading ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <RefreshCw size={14} />
          )}
          Refresh
        </button>
      </div>

      {/* Sub-tabs (if multiple panels) */}
      {panels.length > 1 && (
        <div className="flex gap-1 px-6 border-b border-gray-800">
          {panels.map((panel: ToolUIPanel) => (
            <button
              key={panel.id}
              onClick={() => setActivePanelId(panel.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activePanelId === panel.id
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {panel.title}
            </button>
          ))}
        </div>
      )}

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {panelState.loading && panelState.blocks.length === 0 && (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={32} className="animate-spin text-gray-500" />
          </div>
        )}

        {panelState.error && (
          <div className="flex items-start gap-2 p-3 border border-red-800 bg-red-950/50 rounded-lg text-sm text-red-300">
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <p>{panelState.error}</p>
              <button
                onClick={() => activePanelId && renderPanel(activePanelId)}
                className="mt-2 text-xs text-red-400 hover:text-red-300 underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {!panelState.loading && !panelState.error && panelState.blocks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500">
            <LayoutDashboard size={32} className="mb-2 text-gray-700" />
            <p className="text-sm">Panel returned no content.</p>
          </div>
        )}

        {panelState.blocks.length > 0 && (
          <ToolUIRenderer blocks={panelState.blocks} onAction={handleAction} />
        )}
      </div>
    </div>
  );
};
