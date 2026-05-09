// =============================================================================
// Kanban Multi-Agent Dashboard  v2 — With HyperCycle Node Fleet Column
// =============================================================================
// Columns:
//   Backlog   → Agents waiting to be configured or deployed
//   Ready     → Configured agents (local/cloud/HyperCycle)
//   Running   → Active inference sessions
//   Aimified  → Hermes agents wrapped as HyperCycle AIM modules
//   HyperCycle Node → Fleet boxes (R2D2, C-3PO, ...) with Hermes + selection
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard,
  Play,
  Square,
  Settings,
  Box,
  Cpu,
  Globe,
  Anchor,
  Trash2,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MessageSquare,
  Bot,
  User,
  Clock,
  Server,
  Wifi,
  WifiOff,
  MapPin,
} from 'lucide-react';
import type { AIAgentConfig, AIProvider } from '../types/ai';
import { PROVIDER_INFO } from '../types/ai';
import { HermesAimPanel } from './HermesAimPanel';
import { fleetDiscoveryService, FleetNode } from '../services/stargate/FleetDiscoveryService';
import { hermesAgentOrchestrator } from '../services/stargate/HermesAgentOrchestrator';

export interface AgentResponse {
  id: string;
  agentName: string;
  agentId: string;
  provider: AIProvider;
  content: string;
  status: 'success' | 'error';
  timestamp: number;
  column?: KanbanColumn;
}

type KanbanColumn = 'backlog' | 'ready' | 'running' | 'aimified' | 'hypercycle';

interface KanbanAgent extends AIAgentConfig {
  column: KanbanColumn;
  status: 'idle' | 'starting' | 'running' | 'error' | 'aimified';
  lastError?: string;
  nodeFactoryId?: string;    // ANFE tokenId if deployed on-chain
  aimIndex?: number;         // HyperCycle AIM slot
  health?: 'healthy' | 'busy' | 'error' | 'unknown';
}

const COLUMNS: { id: KanbanColumn; label: string; icon: React.ReactNode; color: string }[] = [
  { id: 'backlog',   label: 'Backlog',     icon: <Box    size={16}/>, color: 'bg-slate-700' },
  { id: 'ready',     label: 'Ready',       icon: <CheckCircle2 size={16}/>, color: 'bg-emerald-700' },
  { id: 'running',   label: 'Running',     icon: <Play   size={16}/>, color: 'bg-blue-700' },
  { id: 'aimified',  label: 'Aimified',    icon: <Anchor size={16}/>, color: 'bg-violet-700' },
  { id: 'hypercycle',label: 'HyperCycle Node', icon: <Server size={16}/>, color: 'bg-orange-700' },
];

export const KanbanDashboard: React.FC = () => {
  const [agents, setAgents] = useState<KanbanAgent[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [fleetNodes, setFleetNodes] = useState<FleetNode[]>([]);
  const [fleetLoading, setFleetLoading] = useState(false);
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [showAimPanel, setShowAimPanel] = useState(false);
  const [responses, setResponses] = useState<AgentResponse[]>([]);
  const [showChat, setShowChat] = useState(true);
  const responseEndRef = useRef<HTMLDivElement>(null);

  const addResponse = useCallback((res: AgentResponse) => {
    setResponses(prev => [...prev, res]);
  }, []);

  // Auto-scroll chat to bottom when new responses arrive
  useEffect(() => {
    if (responseEndRef.current) {
      responseEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [responses]);

  // Load agents from Mosaic electron API
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await window.electronAPI.aiAgents.get();
        const mapped: KanbanAgent[] = raw.map((a: any) => ({
          ...a,
          column: a.provider === 'hermes' ? 'aimified'
                : a.isActive ? 'ready'
                : 'backlog',
          status: a.isActive ? 'idle' : 'idle',
          health: 'unknown',
        }));
        setAgents(mapped);
      } catch (e) {
        console.error('[Kanban] load agents failed:', e);
      }
    };
    load();
  }, []);

  // Load fleet nodes on mount and every 30s
  useEffect(() => {
    const loadFleet = async () => {
      setFleetLoading(true);
      const ok = await fleetDiscoveryService.refresh();
      if (ok) {
        setFleetNodes(fleetDiscoveryService.getCachedFleet());
      }
      setFleetLoading(false);
    };
    loadFleet();
    const iv = setInterval(loadFleet, 30000);
    return () => clearInterval(iv);
  }, []);

  const moveAgent = useCallback((agentId: string, to: KanbanColumn) => {
    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, column: to, status: to === 'aimified' ? 'aimified' : a.status } : a
    ));
  }, []);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleNodeSelect = (nodeId: string) => {
    setSelectedNodeIds(prev => {
      const n = new Set(prev);
      n.has(nodeId) ? n.delete(nodeId) : n.add(nodeId);
      return n;
    });
  };

  const runSelected = async () => {
    if ((!globalPrompt.trim()) || (selectedIds.size === 0 && selectedNodeIds.size === 0)) return;
    setIsOrchestrating(true);

    // Add user prompt as first message in chat
    addResponse({
      id: `user-${Date.now()}`,
      agentName: 'You',
      agentId: 'user',
      provider: 'openai',
      content: globalPrompt,
      status: 'success',
      timestamp: Date.now(),
    });

    // ---------- 1. Run selected AI agents (existing logic) ----------
    const selected = agents.filter(a => selectedIds.has(a.id) && a.column === 'ready');
    if (selected.length > 0) {
      selected.forEach(a => moveAgent(a.id, 'running'));
      await Promise.all(
        selected.map(async (agent) => {
          const startTime = Date.now();
          try {
            setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'running' } : a));

            let reply = '';
            if (agent.provider === 'hermes') {
              const { completeWithHermes } = await import('../services/HermesAgentService');
              const msg = { id: '1', role: 'user' as const, content: globalPrompt, timestamp: Date.now(), agentId: agent.id };
              reply = await completeWithHermes(agent, [msg]);
            } else if (agent.provider === 'hypercycle') {
              const r = await fetch(`${agent.baseUrl}${agent.hypercycleBackend === 'basechain' ? '/api/aim/2/request' : '/api/aim/0/request'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: agent.model, messages: [{ role: 'user', content: globalPrompt }] }),
              });
              const j = await r.json();
              reply = j.content || JSON.stringify(j);
            } else {
              const r = await fetch(`${agent.baseUrl || PROVIDER_INFO[agent.provider].baseUrl}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  ...(agent.apiKey ? { Authorization: `Bearer ${agent.apiKey}` } : {}),
                },
                body: JSON.stringify({ model: agent.model, messages: [{ role: 'user', content: globalPrompt }] }),
              });
              const j = await r.json();
              reply = j.choices?.[0]?.message?.content || JSON.stringify(j);
            }

            addResponse({
              id: `${agent.id}-${startTime}`,
              agentName: agent.name,
              agentId: agent.id,
              provider: agent.provider,
              content: reply,
              status: 'success',
              timestamp: Date.now(),
              column: 'ready',
            });

            setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'idle', column: 'ready' } : a));
          } catch (err: any) {
            setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'error', lastError: err.message, column: 'ready' } : a));
            addResponse({
              id: `${agent.id}-${startTime}-err`,
              agentName: agent.name,
              agentId: agent.id,
              provider: agent.provider,
              content: `Failed: ${err.message}`,
              status: 'error',
              timestamp: Date.now(),
            });
          }
        })
      );
    }

    // ---------- 2. Dispatch to selected fleet nodes (NEW) ----------
    if (selectedNodeIds.size > 0) {
      const selectedNodes = fleetNodes.filter(n => selectedNodeIds.has(n.nodeId));
      await Promise.all(
        selectedNodes.map(async (node) => {
          const startTime = Date.now();
          try {
            addResponse({
              id: `node-${node.nodeId}-${startTime}`,
              agentName: `Node ${node.name}`,
              agentId: node.nodeId,
              provider: 'hermes',
              content: `Dispatching mission to ${node.name} via Tailscale...`,
              status: 'success',
              timestamp: Date.now(),
            });

            const result = await hermesAgentOrchestrator.hireAgent({
              nodeId: node.nodeId,
              agentName: 'StargateMission',
              role: 'fleet_worker',
              skills: ['analysis', 'execution'],
              computeTier: node.computeGrade === 'high' ? 'high_performance' : 'standard',
            });

            addResponse({
              id: `node-${node.nodeId}-${startTime}-ok`,
              agentName: `Node ${node.name}`,
              agentId: node.nodeId,
              provider: 'hermes',
              content: result.success
                ? `Task created on ${node.name}: ${result.taskId || 'ok'}`
                : `Failed to dispatch to ${node.name}: ${result.error || 'unknown error'}`,
              status: result.success ? 'success' : 'error',
              timestamp: Date.now(),
            });
          } catch (err: any) {
            addResponse({
              id: `node-${node.nodeId}-${startTime}-err`,
              agentName: `Node ${node.name}`,
              agentId: node.nodeId,
              provider: 'hermes',
              content: `SSH dispatch failed: ${err.message}`,
              status: 'error',
              timestamp: Date.now(),
            });
          }
        })
      );
    }

    setIsOrchestrating(false);
  };

  const stopAll = () => {
    agents.filter(a => a.column === 'running').forEach(a => moveAgent(a.id, 'ready'));
    setIsOrchestrating(false);
    addResponse({
      id: `stop-${Date.now()}`,
      agentName: 'System',
      agentId: 'system',
      provider: 'openai',
      content: 'All agents stopped by user.',
      status: 'error',
      timestamp: Date.now(),
    });
  };

  const totalSelected = selectedIds.size + selectedNodeIds.size;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex flex-col h-full bg-[#0d1117] text-gray-100">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <LayoutDashboard size={20} className="text-violet-400" />
          <h1 className="font-semibold text-lg">Mosaic Kanban — Multi-Agent Command</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAimPanel(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-violet-700 hover:bg-violet-600 rounded text-sm transition"
          >
            <Anchor size={14} /> Aimify Hermes
          </button>
          <button
            onClick={isOrchestrating ? stopAll : runSelected}
            disabled={totalSelected === 0}
            className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition ${
              isOrchestrating
                ? 'bg-red-700 hover:bg-red-600'
                : 'bg-emerald-700 hover:bg-emerald-600'
            } disabled:opacity-40`}
          >
            {isOrchestrating ? <><Square size={14} /> Stop</> : <><Play size={14} /> Run Selected</>}
          </button>
        </div>
      </div>

      {/* Prompt composer */}
      <div className="px-4 py-2 border-b border-gray-800">
        <div className="flex gap-2">
          <input
            value={globalPrompt}
            onChange={(e) => setGlobalPrompt(e.target.value)}
            placeholder="Enter a mission prompt for all selected agents / fleet nodes..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:border-violet-500"
            onKeyDown={(e) => e.key === 'Enter' && runSelected()}
          />
          <span className="text-xs text-gray-500 self-center">
            {totalSelected} selected
          </span>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-4 min-w-[1100px]">
          {COLUMNS.map((col) => (
            <div key={col.id} className="flex-1 min-w-[220px]">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-t ${col.color} text-white text-sm font-medium`}>
                {col.icon} {col.label}
                <span className="ml-auto bg-black/30 px-1.5 rounded-full text-xs">
                  {col.id === 'hypercycle'
                    ? fleetNodes.length
                    : agents.filter(a => a.column === col.id).length}
                </span>
              </div>
              <div className="bg-gray-900/60 border border-gray-800 border-t-0 rounded-b p-2 space-y-2 min-h-[200px]">
                {/* Agent cards (existing) */}
                {col.id !== 'hypercycle' && agents
                  .filter((a) => a.column === col.id)
                  .map((agent) => (
                    <div
                      key={agent.id}
                      onClick={() => toggleSelect(agent.id)}
                      className={`relative p-3 rounded border cursor-pointer transition ${
                        selectedIds.has(agent.id)
                          ? 'border-violet-500 bg-violet-500/10'
                          : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm truncate">{agent.name}</span>
                        <StatusBadge status={agent.status} />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <ProviderIcon provider={agent.provider} />
                        <span>{agent.model}</span>
                        {agent.nodeFactoryId && (
                          <span className="text-violet-400">ANFE #{agent.nodeFactoryId}</span>
                        )}
                      </div>
                      {agent.lastError && (
                        <div className="mt-1 text-xs text-red-400 truncate">{agent.lastError}</div>
                      )}
                      <div className="mt-2 flex gap-1">
                        {col.id !== 'backlog' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); moveAgent(agent.id, 'backlog'); }}
                            className="text-xs px-2 py-0.5 bg-gray-700 rounded hover:bg-gray-600"
                          >Backlog</button>
                        )}
                        {col.id !== 'ready' && agent.provider !== 'hermes' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); moveAgent(agent.id, 'ready'); }}
                            className="text-xs px-2 py-0.5 bg-emerald-800 rounded hover:bg-emerald-700"
                          >Ready</button>
                        )}
                        {agent.provider === 'hermes' && col.id !== 'aimified' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); moveAgent(agent.id, 'aimified'); }}
                            className="text-xs px-2 py-0.5 bg-violet-800 rounded hover:bg-violet-700"
                          >Aimify</button>
                        )}
                      </div>
                    </div>
                  ))}

                {/* Fleet node cards (NEW) */}
                {col.id === 'hypercycle' && (
                  <>
                    {fleetLoading && (
                      <div className="text-xs text-gray-500 text-center py-4 flex items-center justify-center gap-1">
                        <Loader2 size={12} className="animate-spin" /> Polling fleet...
                      </div>
                    )}
                    {fleetNodes.map((node) => (
                      <div
                        key={node.nodeId}
                        onClick={() => toggleNodeSelect(node.nodeId)}
                        className={`relative p-3 rounded border cursor-pointer transition ${
                          selectedNodeIds.has(node.nodeId)
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm truncate flex items-center gap-1.5">
                            <Server size={12} className="text-orange-400" />
                            {node.name}
                          </span>
                          {node.lastSeen > Date.now() - 60000 ? (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200">
                              <Wifi size={10} /> Online
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                              <WifiOff size={10} /> Offline
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <MapPin size={10} />
                          <span>{node.apiHost}:{node.apiPort}</span>
                          <span className="text-orange-400">{node.computeGrade}</span>
                        </div>
                        <div className="mt-1 text-[10px] text-gray-500">
                          License: {node.anfeLicense?.slice(0, 12) || '—'}…
                          {node.hasHermes && <span className="text-violet-400 ml-1">● Hermes</span>}
                        </div>
                      </div>
                    ))}
                    {!fleetLoading && fleetNodes.length === 0 && (
                      <div className="text-xs text-gray-600 text-center py-4">
                        No fleet nodes found.<br/>
                        Check Tailscale + registry Gist.
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Agent Chat Feed */}
      <div className={`border-t border-gray-800 bg-[#0b0e14] transition-all duration-300 ${showChat ? 'h-[240px]' : 'h-[36px]'}`}>
        <div
          className="flex items-center justify-between px-4 py-2 cursor-pointer hover:bg-gray-800/50"
          onClick={() => setShowChat(!showChat)}
        >
          <div className="flex items-center gap-2">
            <MessageSquare size={14} className="text-cyan-400" />
            <span className="text-xs font-medium text-gray-300">
              AI Agent Chat Feed
            </span>
            <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 rounded">
              {responses.length} messages
            </span>
          </div>
          <div className="flex items-center gap-2">
            {responses.length > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); setResponses([]); }}
                className="text-[10px] text-gray-500 hover:text-red-400 px-2 py-0.5 rounded hover:bg-gray-800 transition"
              >
                Clear
              </button>
            )}
            <span className="text-xs text-gray-500">
              {showChat ? '▾ collapse' : '▴ expand'}
            </span>
          </div>
        </div>

        {showChat && (
          <div className="h-[calc(100%-36px)] overflow-y-auto px-4 py-2 space-y-2">
            {responses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-600">
                <Bot size={24} className="mb-2 opacity-50" />
                <p className="text-xs">Run selected agents to see their responses here</p>
                <p className="text-[10px] mt-1">Select agents or fleet nodes + enter prompt → Run Selected</p>
              </div>
            ) : (
              <>
                {responses.map((res) => (
                  <div
                    key={res.id}
                    className={`flex gap-2 rounded-lg px-3 py-2 text-xs ${
                      res.agentId === 'user'
                        ? 'bg-cyan-900/20 border border-cyan-500/20 ml-8'
                        : res.status === 'error'
                        ? 'bg-red-900/20 border border-red-500/20'
                        : 'bg-gray-800/60 border border-gray-700'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {res.agentId === 'user' ? (
                        <User size={14} className="text-cyan-400" />
                      ) : res.status === 'error' ? (
                        <AlertCircle size={14} className="text-red-400" />
                      ) : (
                        <ProviderIcon provider={res.provider} />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium ${
                          res.agentId === 'user' ? 'text-cyan-400' :
                          res.status === 'error' ? 'text-red-400' :
                          'text-violet-300'
                        }`}>
                          {res.agentName}
                        </span>
                        <span className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Clock size={10} />
                          {new Date(res.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className={`text-gray-300 whitespace-pre-wrap break-words ${
                        res.status === 'error' ? 'text-red-300' : ''
                      }`}>
                        {res.content}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={responseEndRef} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Hermes Aimification Panel (modal) */}
      {showAimPanel && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-lg w-[600px] max-h-[80vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Aimify Hermes Agent</h2>
              <button onClick={() => setShowAimPanel(false)} className="text-gray-400 hover:text-white">×</button>
            </div>
            <HermesAimPanel agents={agents.filter(a => a.provider === 'hermes')} />
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const StatusBadge: React.FC<{ status: KanbanAgent['status'] }> = ({ status }) => {
  const map: Record<string, { text: string; cls: string }> = {
    idle:       { text: 'Idle',    cls: 'bg-gray-700 text-gray-300' },
    starting:   { text: 'Start',   cls: 'bg-yellow-700 text-yellow-200' },
    running:    { text: 'Run',     cls: 'bg-blue-700 text-blue-200' },
    error:      { text: 'Error',   cls: 'bg-red-700 text-red-200' },
    aimified:   { text: 'AIM',     cls: 'bg-violet-700 text-violet-200' },
  };
  const s = map[status] || map.idle;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.cls}`}>{s.text}</span>;
};

const ProviderIcon: React.FC<{ provider: AIProvider }> = ({ provider }) => {
  switch (provider) {
    case 'hermes':    return <Anchor size={12} className="text-violet-400" />;
    case 'hypercycle':return <Cpu    size={12} className="text-cyan-400" />;
    case 'ollama':    return <Box    size={12} className="text-purple-400" />;
    case 'openai':    return <Globe  size={12} className="text-emerald-400" />;
    case 'claude':    return <Cpu    size={12} className="text-amber-400" />;
    case 'gemini':    return <Globe  size={12} className="text-blue-400" />;
    default:          return <Settings size={12} className="text-gray-400" />;
  }
};

export default KanbanDashboard;
