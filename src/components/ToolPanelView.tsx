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
  ArrowLeft,
  Server, Zap, Activity, Trophy, BarChart3, Globe, Database, Layers, Box, Shield, Hash,
} from "lucide-react";
import { ToolUIRenderer } from "./tool-ui/ToolUIRenderer";
import type { ToolUIActionHandler } from "./tool-ui/ToolUIRenderer";
import type { ToolUIBlock } from "./tool-ui/types";
import type {
  ToolManifest,
  ToolUIPanel,
  ToolCallResult,
} from "../../electron/integrations/sandbox/types";

const PANEL_ICON_MAP: Record<string, React.FC<{ size?: number; className?: string }>> = {
  server: Server, zap: Zap, cpu: Cpu, activity: Activity, trophy: Trophy,
  chart: BarChart3, globe: Globe, database: Database, layers: Layers,
  box: Box, shield: Shield, hash: Hash,
};

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
  const allPanels = manifest.ui?.panels ?? [];
  const panels = allPanels.filter((p: ToolUIPanel) => !p.hidden);
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
  /** Navigation history stack for back button */
  const navHistoryRef = useRef<string[]>([]);

  /** Whether the active panel is a hidden panel (navigated into, not tabbed to) */
  const isHiddenPanel = !panels.some((p: ToolUIPanel) => p.id === activePanelId);

  const goBack = useCallback(() => {
    const history = navHistoryRef.current;
    if (history.length > 0) {
      const prev = history.pop()!;
      panelContextRef.current = undefined;
      setActivePanelId(prev);
    }
  }, []);

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
        if (targetPanel && allPanels.some((p: ToolUIPanel) => p.id === targetPanel)) {
          // Push current panel to history for back navigation
          if (activePanelId) {
            navHistoryRef.current.push(activePanelId);
          }
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
      <div className="flex items-center justify-between px-8 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <Cpu size={24} className="text-indigo-400" />
          <div>
            <h1 className="text-xl font-semibold text-white">
              {manifest.displayName}
            </h1>
            <p className="text-sm text-gray-500">{manifest.description}</p>
          </div>
        </div>
        <button
          onClick={() => activePanelId && renderPanel(activePanelId)}
          disabled={panelState.loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm transition-colors disabled:opacity-50"
          title="Refresh panel"
        >
          {panelState.loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Refresh
        </button>
      </div>

      {/* Sub-tabs (if multiple panels) */}
      {panels.length > 1 && (
        <div className="flex items-center gap-1 px-8 border-b border-gray-800">
          {isHiddenPanel && (
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 px-3 py-3 text-gray-400 hover:text-gray-200 transition-colors mr-1"
              title="Go back"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          {panels.map((panel: ToolUIPanel) => {
            const IconComp = panel.icon ? PANEL_ICON_MAP[panel.icon] : null;
            return (
              <button
                key={panel.id}
                onClick={() => {
                  panelContextRef.current = undefined;
                  navHistoryRef.current = [];
                  setActivePanelId(panel.id);
                }}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activePanelId === panel.id
                    ? "border-indigo-500 text-indigo-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {IconComp && <IconComp size={16} />}
                {panel.title}
              </button>
            );
          })}
        </div>
      )}

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
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
