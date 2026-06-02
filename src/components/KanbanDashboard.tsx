// =============================================================================
// Kanban Multi-Agent Dashboard  v2 — With HyperCycle Node Fleet Column
// =============================================================================
// Columns:
//   Backlog   → Agents waiting to be configured or deployed
//   Ready     → Configured agents (local/cloud/HyperCycle)
//   Running   → Active inference sessions
//   Aimified  → Hermes agents wrapped as REAL HyperCycle AIM modules (v2.0.0 — embedded AIAgent, no proxy)
//   HyperCycle Node → Fleet boxes (R2D2, C-3PO, ...) with Hermes + selection
// =============================================================================

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'react-toastify';
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
  Rocket,
} from 'lucide-react';
import type { AIAgentConfig, AIProvider } from '../types/ai';
import { PROVIDER_INFO } from '../types/ai';
import { HermesAimPanel } from './HermesAimPanel';
import { GenericAimPanel } from './GenericAimPanel';
import { fleetDiscoveryService, FleetNode, FleetNodeStatus, EnrichedFleetNode } from '../services/stargate/FleetDiscoveryService';
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
  imageTag?: string;         // Docker image tag if aimified
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
  const [fleetNodes, setFleetNodes] = useState<EnrichedFleetNode[]>([]);
  const [fleetStatus, setFleetStatus] = useState<Map<string, FleetNodeStatus>>(new Map());
  const [fleetLoading, setFleetLoading] = useState(false);
  const [globalPrompt, setGlobalPrompt] = useState('');
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [nodeKanban, setNodeKanban] = useState<Map<string, {id:string;status:string;assignee:string;title:string}[]>>(new Map());
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [showAimPanel, setShowAimPanel] = useState(false);
  const [showGenericAimPanel, setShowGenericAimPanel] = useState(false);
  const [aimifyAgentId, setAimifyAgentId] = useState<string | null>(null);
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

  // Fetch kanban tasks from a fleet node via mesh:dispatch (bidirectional visibility)
  const fetchNodeKanban = useCallback(async (node: FleetNode) => {
    try {
      const meshDispatch = (window as any).electronAPI?.mesh?.dispatch;
      if (!meshDispatch) return;
      const result = await meshDispatch({
        host: node.apiHost,
        user: 'hyperai',
        command: `python3 -c "import sqlite3,json;db='/home/hyperai/.hermes/kanban/boards/stargate/kanban.db';conn=sqlite3.connect(db);cur=conn.cursor();cur.execute('SELECT id,status,assignee,title FROM tasks');rows=cur.fetchall();print(json.dumps([{'id':r[0],'status':r[1],'assignee':r[2],'title':r[3]} for r in rows]))"`,
        timeout: 15000,
      });
      if (result.exitCode === 0 && result.stdout) {
        const tasks = JSON.parse(result.stdout);
        setNodeKanban(prev => {
          const next = new Map(prev);
          next.set(node.nodeId, tasks);
          return next;
        });
      }
    } catch (e: any) {
      console.error('[Kanban] fetchNodeKanban failed:', e.message);
    }
  }, []);

  // Poll kanban tasks from all online fleet nodes every 60s
  useEffect(() => {
    const poll = async () => {
      const online = fleetNodes.filter(n => n.lastSeen > Date.now() - 120000);
      await Promise.all(online.map(fetchNodeKanban));
    };
    poll();
    const iv = setInterval(poll, 60000);
    return () => clearInterval(iv);
  }, [fleetNodes, fetchNodeKanban]);

  // Load agents from Mosaic electron API
  useEffect(() => {
    const load = async () => {
      try {
        const raw = await window.electronAPI.aiAgents.get();
        const mapped: KanbanAgent[] = raw.map((a: any) => ({
          ...a,
          column: a.isActive ? 'ready' : 'backlog',
          status: a.isActive ? 'idle' : 'idle',
        }));
        setAgents(mapped);
      } catch (e) {
        console.error('[Kanban] load agents failed:', e);
      }
    };
    load();
  }, []);

  // Detect local AIMs via HyperCycle node API (8000/info) and direct health (9000/health)
  useEffect(() => {
    const probeLocalAIMs = async () => {
      let nodeInfo: any = null;

      // Route 1: HyperCycle node /info — canonical discovery, lists all AIM slots
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 3000);
        const resp = await fetch('http://127.0.0.1:8000/info', { signal: ctrl.signal });
        clearTimeout(to);
        if (resp.ok) nodeInfo = await resp.json();
      } catch { /* no local node on 8000 */ }

      // Route 2: Direct health on 9000 as fallback for standalone AIM (no node)
      let directHealth: any = null;
      if (!nodeInfo) {
        try {
          const ctrl = new AbortController();
          const to = setTimeout(() => ctrl.abort(), 3000);
          const resp = await fetch('http://127.0.0.1:9000/health', { signal: ctrl.signal });
          clearTimeout(to);
          if (resp.ok) directHealth = await resp.json();
        } catch { /* no direct AIM on 9000 */ }
      }

      const aims: any[] = nodeInfo?.aim?.aims || [];
      const hasDirectHealth = directHealth?.status?.status === 'ok'
                           || directHealth?.status?.status === 'alive'
                           || directHealth?.status === 'ok'
                           || directHealth?.status === 'alive';

      setAgents(prev => {
        const next = [...prev];
        const hasAimified = (id: string) => next.some(a => a.provider === 'hermes-aim' && a.id === id);

        // Inject from node /info aims
        aims.forEach((aim: any, idx: number) => {
          const id = `local-aim-${aim.slot ?? idx}`;
          if (hasAimified(id)) return;
          const port = aim.port || 9000 + (aim.slot ?? idx);
          const synthetic: KanbanAgent = {
            id,
            name: aim.image_name || `Local AIM (slot ${aim.slot ?? idx})`,
            provider: 'hermes-aim',
            apiKey: '',
            baseUrl: `http://127.0.0.1:${port}`,
            model: aim.model || 'custom',
            isActive: true,
            createdAt: Date.now(),
            column: 'aimified',
            status: 'aimified',
            aimIndex: aim.slot ?? idx,
            imageTag: aim.image_tag || aim.imageTag || 'latest',
          };
          next.push(synthetic);
        });

        // Fallback: inject from direct 9000/health if node /info missed it
        if (hasDirectHealth && !hasAimified('local-aim-9000')) {
          const info = directHealth;
          const synthetic: KanbanAgent = {
            id: 'local-aim-9000',
            name: info.name || 'Local AIM (localhost:9000)',
            provider: 'hermes-aim',
            apiKey: '',
            baseUrl: 'http://127.0.0.1:9000',
            model: info.model || info?.aim?.aims?.[0]?.model || 'custom',
            isActive: true,
            createdAt: Date.now(),
            column: 'aimified',
            status: 'aimified',
            aimIndex: 0,
            imageTag: info.version || info?.aim?.aims?.[0]?.imageTag || 'latest',
          };
          next.push(synthetic);
        }

        return next;
      });
    };
    probeLocalAIMs();
  }, []);

  // Load fleet nodes on mount and every 30s
  useEffect(() => {
    const loadFleet = async () => {
      setFleetLoading(true);
      const registry = await fleetDiscoveryService.loadFleetRegistry();
      const enriched = await fleetDiscoveryService.enrichWithHyperInsight(registry);
      // Poll live /api/info from each node for direct NM data (aims, hardware, name)
      const polled = await fleetDiscoveryService.pollFleetStatus(enriched);
      const merged = enriched.map((node) => {
        const status = polled.find((p) => p.node.nodeId === node.nodeId);
        if (status?.info) {
          return {
            ...node,
            hyperinsight: {
              ...(node.hyperinsight || {}),
              name: status.info.name || node.hyperinsight?.name || null,
              aimsCount: (status.info.aim?.aims?.length || node.hyperinsight?.aimsCount || 0),
              cpuCount: (status.info.hardware?.cpu_count || node.hyperinsight?.cpuCount || 0),
              ramBytes: (status.info.hardware?.memory || node.hyperinsight?.ramBytes || 0),
            } as any,
          };
        }
        return node;
      });
      const statusMap = new Map<string, FleetNodeStatus>();
      for (const s of polled) statusMap.set(s.node.nodeId, s);
      setFleetStatus(statusMap);
      setFleetNodes(merged);
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
    const selected = agents.filter(a => selectedIds.has(a.id) && (a.column === 'ready' || a.column === 'aimified'));
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
            } else if (agent.provider === 'hermes-aim') {
              const { AIService } = await import('../services/AIService');
              const msg = { id: '1', role: 'user' as const, content: globalPrompt, timestamp: Date.now(), agentId: agent.id };
              reply = await AIService.sendToHermesAIM(agent, [msg]);
            } else if (agent.provider === 'hypercycle') {
              const r = await fetch(`${agent.baseUrl}${agent.hypercycleBackend === 'basechain' ? '/api/aim/2/request' : '/api/aim/0/request'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: agent.model, messages: [{ role: 'user', content: globalPrompt }] }),
              });
              const j = await r.json();
              reply = j.content || JSON.stringify(j);
            } else {
              const r = await fetch(`${agent.baseUrl || PROVIDER_INFO[agent.provider]?.baseUrl || ""}/v1/chat/completions`, {
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
              column: agent.column,
            });

            setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'idle', column: agent.column } : a));
          } catch (err: any) {
            setAgents(prev => prev.map(a => a.id === agent.id ? { ...a, status: 'error', lastError: err.message, column: agent.column } : a));
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

    // ---------- 2. Dispatch to selected fleet nodes — now with AI inference ----------
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
              content: `Dispatching mission to ${node.name} (${node.apiHost}) via Tailscale mesh...`,
              status: 'success',
              timestamp: Date.now(),
            });

            const hermesResult = await hermesAgentOrchestrator.dispatchPrompt(
              node.nodeId,
              globalPrompt,
              'default',
            );

            addResponse({
              id: `node-${node.nodeId}-${startTime}-ok`,
              agentName: `Node ${node.name}`,
              agentId: node.nodeId,
              provider: 'hermes',
              content: `**${node.name}** responded via fleet mesh (${Date.now() - startTime}ms):

${hermesResult.response}`,
              status: 'success',
              timestamp: Date.now(),
            });
          } catch (err: any) {
            addResponse({
              id: `node-${node.nodeId}-${startTime}-err`,
              agentName: `Node ${node.name}`,
              agentId: node.nodeId,
              provider: 'hermes',
              content: `Fleet dispatch failed: ${err.message}`,
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
            onClick={() => setShowGenericAimPanel(true)}
            className="flex items-center gap-1 px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 rounded text-sm transition"
          >
            <Rocket size={14} /> Aimify
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
                        {(agent.provider === 'hermes' || agent.provider === 'hermes-aim' || agent.provider === 'hermes-api') && col.id !== 'aimified' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              // Open Aimify pipeline panel for this agent
                              setAimifyAgentId(agent.id);
                              setShowAimPanel(true);
                            }}
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
                    {fleetNodes.map((node) => {
                      const tasks = nodeKanban.get(node.nodeId) || [];
                      const readyCount = tasks.filter(t => t.status === 'ready').length;
                      const runCount   = tasks.filter(t => t.status === 'running' || t.status === 'pending').length;
                      const doneCount  = tasks.filter(t => t.status === 'done' || t.status === 'completed').length;
                      const blockCount = tasks.filter(t => t.status === 'blocked').length;
                      const isExpanded = expandedNodeId === node.nodeId;
                      return (
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
                            {(() => {
                              const status = fleetStatus.get(node.nodeId);
                              const isOnline = status?.online || false;
                              return isOnline ? (
                                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-800 text-emerald-200">
                                  <Wifi size={10} /> Online
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">
                                  <WifiOff size={10} /> Offline
                                </span>
                              );
                            })()}
                          </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <MapPin size={10} />
                          <span>{node.apiHost}:{node.apiPort}</span>
                          <span className="text-orange-400">{node.computeGrade}</span>
                        </div>
                        {node.hyperinsight && (
                          <div className="mt-1.5 space-y-0.5">
                            <div className="flex items-center gap-2 text-[10px] text-gray-300">
                              <span className="text-gray-500">ANFE:</span>
                              <span>{node.hyperinsight.name || 'Unnamed'}</span>
                              {node.hyperinsight.region && (
                                <span className="text-gray-500">· {node.hyperinsight.region}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px]">
                              <span className="text-emerald-400">
                                Uptime {(node.hyperinsight.uptimePercent * 100).toFixed(1)}%
                              </span>
                              {node.hyperinsight.gpuName && (
                                <span className="text-violet-400">· {node.hyperinsight.gpuName}</span>
                              )}
                              <span className="text-gray-500">
                                · {node.hyperinsight.aimsCount} AIMs
                              </span>
                            </div>
                          </div>
                        )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {readyCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300 border border-emerald-700">Ready {readyCount}</span>}
                            {runCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900 text-blue-300 border border-blue-700">Run {runCount}</span>}
                            {doneCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 border border-gray-600">Done {doneCount}</span>}
                            {blockCount > 0 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-900 text-red-300 border border-red-700">Block {blockCount}</span>}
                            {tasks.length > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setExpandedNodeId(isExpanded ? null : node.nodeId); }}
                                className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600"
                              >
                                {isExpanded ? '▲ Hide' : '▼ Tasks'}
                              </button>
                            )}
                          </div>
                          {isExpanded && (
                            <div className="mt-2 space-y-1 max-h-[140px] overflow-y-auto pr-1">
                              {tasks.map(t => (
                                <div key={t.id} className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-gray-900 border border-gray-800">
                                  <span className="truncate flex-1 text-gray-300">{t.id}</span>
                                  <span className={`shrink-0 ml-1 px-1 rounded ${
                                    t.status === 'ready' ? 'bg-emerald-900 text-emerald-300' :
                                    t.status === 'done' ? 'bg-gray-700 text-gray-300' :
                                    t.status === 'blocked' ? 'bg-red-900 text-red-300' :
                                    'bg-blue-900 text-blue-300'
                                  }`}>{t.status}</span>
                                  <span className="shrink-0 ml-1 text-gray-500 truncate max-w-[80px]">{t.assignee}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="mt-1 text-[10px] text-gray-500">
                            License: {node.anfeLicense?.slice(0, 12) || '—'}…
                            {node.hasHermes && <span className="text-violet-400 ml-1">● Hermes</span>}
                          </div>
                        </div>
                      );
                    })}
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
          <div className="bg-gray-900 border border-gray-700 rounded-lg w-[700px] max-h-[85vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Rocket size={18} className="text-violet-400" />
                {aimifyAgentId
                  ? `Aimify: ${agents.find(a => a.id === aimifyAgentId)?.name || 'Agent'}`
                  : 'Aimify Hermes Agent'
                }
              </h2>
              <button
                onClick={() => { setShowAimPanel(false); setAimifyAgentId(null); }}
                className="text-gray-400 hover:text-white"
              >×</button>
            </div>
            <HermesAimPanel
              agents={
                aimifyAgentId
                  ? agents.filter(a => a.id === aimifyAgentId)
                  : agents.filter(a => a.provider === 'hermes' || a.provider === 'hermes-aim' || a.provider === 'hermes-api')
              }
              onClose={() => { setShowAimPanel(false); setAimifyAgentId(null); }}
              onAimified={(agentId, imageTag) => {
                // Move agent to aimified column on success
                setAgents(prev => prev.map(a =>
                  a.id === agentId
                    ? { ...a, column: 'aimified' as KanbanColumn, status: 'aimified' as const, imageTag }
                    : a
                ));
                toast.success(`Agent aimified: ${imageTag}`);
              }}
            />
          </div>
        </div>
      )}

      {/* Generic Aimify Panel (modal) — package any AI model */}
      {showGenericAimPanel && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center">
          <div className="bg-gray-900 border border-gray-700 rounded-lg w-[800px] max-h-[90vh] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Rocket size={18} className="text-cyan-400" />
                Aimify Your Model
              </h2>
              <button
                onClick={() => setShowGenericAimPanel(false)}
                className="text-gray-400 hover:text-white"
              >×</button>
            </div>
            <GenericAimPanel
              onClose={() => setShowGenericAimPanel(false)}
              onAimified={(modelName, imageTag) => {
                toast.success(`Model ${modelName} aimified: ${imageTag}`);
              }}
            />
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
    aimified:   { text: 'AIM v2',  cls: 'bg-violet-700 text-violet-200' },
  };
  const s = map[status] || map.idle;
  return <span className={`text-[10px] px-1.5 py-0.5 rounded ${s.cls}`}>{s.text}</span>;
};

const ProviderIcon: React.FC<{ provider: AIProvider }> = ({ provider }) => {
  switch (provider) {
    case 'hermes':
    case 'hermes-aim':
      return <Anchor size={12} className="text-violet-400" />;
    case 'hypercycle':return <Cpu    size={12} className="text-cyan-400" />;
    case 'ollama':    return <Box    size={12} className="text-purple-400" />;
    case 'openai':    return <Globe  size={12} className="text-emerald-400" />;
    case 'claude':    return <Cpu    size={12} className="text-amber-400" />;
    case 'gemini':    return <Globe  size={12} className="text-blue-400" />;
    default:          return <Settings size={12} className="text-gray-400" />;
  }
};

export default KanbanDashboard;


