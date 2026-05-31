// =============================================================================
// STARGATE AIM PANEL — Live AIM inventory with slots, ports, status
// Includes DISCOVERY FALLBACK: probes localhost:9000 when Node Manager shows empty.
// =============================================================================
// Replaces the empty "AI Models" tab with a live list from the local node.
// Uses Tailwind CSS + lucide-react to match existing Mosaic styling.
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { Bot, ExternalLink, CheckCircle2, XCircle, Loader, AlertTriangle, Plug, Box, Eye } from 'lucide-react';
import { localNodeBridge, BridgeAIM } from '../../services/stargate/LocalNodeBridge';
import { enhancedLocalNodeBridge, ExtendedBridgeTelemetry } from '../../services/stargate/EnhancedLocalNodeBridge';

// ===== P0 INTEGRATIONS: AIM as Tool + MCP Everywhere =====
import { mcpAIMService } from '../../services/stargate/integrations/MCPAIMService';
import { agentToolService } from '../../services/stargate/integrations/AgentToolService';


interface FallbackAIM {
  found: boolean;
  url: string;
  version?: string;
  port: number;
  name?: string;
  model?: string;
  status?: string;
}

const StargateAIMPanel: React.FC = () => {
  const [aims, setAims] = useState<BridgeAIM[]>([]);
  const [telemetry, setTelemetry] = useState<ExtendedBridgeTelemetry | null>(null);
  const [loading, setLoading] = useState(true);
  // Discovery fallback: probe localhost:9000 when Node Manager shows empty
  const [fallbackAIM, setFallbackAIM] = useState<FallbackAIM | null>(null);

  useEffect(() => {
    const refresh = async () => {
      setLoading(true);
      await localNodeBridge.refresh();
      const localAims = localNodeBridge.getLocalAIMs();
      setAims(localAims);
      const t = await enhancedLocalNodeBridge.refresh();
      setTelemetry(t);

      // DISCOVERY FALLBACK: if node shows no AIMs, probe localhost:9000
      if (t && t.runningAims.length === 0 && localAims.length === 0) {
        try {
          const resp = await fetch('http://localhost:9000/health', { method: 'GET' });
          if (resp.ok) {
            const data = await resp.json();
            const version = data.aim_version || data.version || 'unknown';
            const name = data.name || 'Mosaic Hermes AIM';
            const model = data.model || 'unknown';
            const status = data.status || 'ok';
            setFallbackAIM({ found: true, url: 'http://localhost:9000', version, port: 9000, name, model, status });
          } else {
            setFallbackAIM(null);
          }
        } catch (_e) {
          setFallbackAIM(null);
        }
      } else {
        setFallbackAIM(null);
      }

      setLoading(false);
    };
    refresh();
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && aims.length === 0 && !fallbackAIM?.found) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (aims.length === 0 && !fallbackAIM?.found) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Bot size={64} className="text-gray-700 mb-4" />
        <h3 className="text-xl font-semibold text-gray-400">No AIMs Running</h3>
        <p className="text-sm text-gray-600 mt-2 max-w-md">
          The local HyperCycle node has no AIM images loaded. Use the Node Manager to install and start AIM containers.
        </p>
        <a
          href="http://localhost:8006"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-colors text-sm"
        >
          Open Node Manager
        </a>
      </div>
    );
  }

  // Slot usage includes fallback AIM if discovered
  const effectiveRunningCount = (telemetry?.runningAims.length || 0) + (fallbackAIM?.found ? 1 : 0);
  const totalSlots = telemetry?.totalAimSlots || 8;
  const slotUsage = totalSlots > 0 ? effectiveRunningCount / totalSlots : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">AI Models</h3>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          slotUsage > 0.75 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-green-500/10 text-green-400'
        }`}>
          {effectiveRunningCount}/{totalSlots} slots
        </span>
      </div>

      <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${slotUsage > 0.75 ? 'bg-yellow-500' : 'bg-cyan-400'}`}
          style={{ width: `${slotUsage * 100}%` }}
        />
      </div>

      <div className="grid gap-3">
        {/* Fallback AIM card — shown when discovered via localhost:9000 probe */}
        {fallbackAIM?.found && (
          <div
            className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-900/10 hover:border-emerald-500/50 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-emerald-500/20">
                  <Eye size={20} className="text-emerald-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{fallbackAIM.name || 'Mosaic Hermes AIM'}</h4>
                    <span className="text-xs text-emerald-400">{fallbackAIM.version}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      {fallbackAIM.status || 'running'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Port {fallbackAIM.port}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Slot 0 (Local)</span>
                    {fallbackAIM.model && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Model: {fallbackAIM.model}</span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-400">Discovery-Fallback</span>
                  </div>
                  <div className="text-[10px] text-gray-500 mt-1">
                    Discovered via localhost:9000 probe (not in Node Manager /info)
                  </div>
                </div>
              </div>
              <a
                href={fallbackAIM.url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-emerald-400 transition-colors"
                title="Open AIM Dashboard"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        )}

        {/* Standard AIM cards from Node Manager */}
        {aims.map((aim) => (
          <div
            key={aim.imageId}
            className="p-4 rounded-xl border border-gray-800 bg-gray-900/50 hover:border-gray-700 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  aim.status === 'running' ? 'bg-green-500/20' : 'bg-gray-700'
                }`}>
                  {aim.status === 'running' ? (
                    <CheckCircle2 size={20} className="text-green-400" />
                  ) : aim.status === 'error' ? (
                    <AlertTriangle size={20} className="text-red-400" />
                  ) : (
                    <Loader size={20} className="text-gray-400" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{aim.name || 'Unnamed AIM'}</h4>
                    <span className="text-xs text-gray-500">{aim.tag}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      aim.status === 'running'
                        ? 'bg-green-500/20 text-green-400'
                        : aim.status === 'error'
                        ? 'bg-red-500/20 text-red-400'
                        : 'bg-gray-700 text-gray-400'
                    }`}>
                      {aim.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Slot {aim.slot}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">Port {aim.port}</span>
                    {aim.whitelisted && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400">Whitelisted</span>
                    )}
                  </div>
                </div>
              </div>
              <a
                href={`http://localhost:${aim.port}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-500 hover:text-cyan-400 transition-colors"
                title="Open AIM endpoint"
              >
                <ExternalLink size={16} />
              </a>
              {/* ===== P0: MCP EVERYWHERE — Expose as MCP Server ===== */}
              <button
                onClick={async () => {
                  const result = await mcpAIMService.registerAIMFromBridge(aim);
                  if (result.success) {
                    alert(`AIM "${aim.name}" exposed as MCP server: ${result.serverName}`);
                  } else {
                    alert(`MCP registration failed: ${result.error}`);
                  }
                }}
                className="p-2 rounded-lg hover:bg-purple-500/20 text-gray-500 hover:text-purple-400 transition-colors"
                title="Expose as MCP Server"
              >
                <Plug size={16} />
              </button>
              {/* ===== P0: AGENT-AS-TOOL — Register ANFE Manifest ===== */}
              <button
                onClick={async () => {
                  const result = await agentToolService.registerFromFleetNode({
                    nodeId: aim.imageId,
                    label: aim.name || 'Unnamed AIM',
                    host: 'localhost',
                    port: aim.port,
                    computeTier: 'standard',
                  });
                  if (result.success) {
                    alert(`AIM "${aim.name}" registered as tool: ${result.toolId}`);
                  } else {
                    alert(`Tool registration failed: ${result.error}`);
                  }
                }}
                className="p-2 rounded-lg hover:bg-cyan-500/20 text-gray-500 hover:text-cyan-400 transition-colors"
                title="Register as Tool"
              >
                <Box size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StargateAIMPanel;
