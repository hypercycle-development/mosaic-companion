// =============================================================================
// STARGATE FLEET PANEL — Discover, hire, and deploy to DAO fleet nodes
// =============================================================================
// Tailwind + lucide-react version. No MUI.
// =============================================================================

import React, { useEffect, useState } from 'react';
import {
  RefreshCw,
  Server,
  Rocket,
  GraduationCap,
  Cpu,
  CheckCircle2,
  XCircle,
  X,
} from 'lucide-react';
import { fleetDiscoveryService, FleetNode, FleetNodeStatus } from '../../services/stargate/FleetDiscoveryService';
import { hermesAgentOrchestrator, HireAgentParams, BookTrainingParams } from '../../services/stargate/HermesAgentOrchestrator';

const ROLES = ['developer', 'marketing', 'growth', 'uiux', 'data_analyst'] as const;
const TIERS = ['standard', 'high_performance', 'dedicated'] as const;

const StargateFleetPanel: React.FC = () => {
  const [nodes, setNodes] = useState<FleetNode[]>([]);
  const [statuses, setStatuses] = useState<Map<string, FleetNodeStatus>>(new Map());
  const [loading, setLoading] = useState(true);
  const [hireOpen, setHireOpen] = useState(false);
  const [trainOpen, setTrainOpen] = useState(false);
  const [selectedNode, setSelectedNode] = useState<FleetNode | null>(null);
  const [hireForm, setHireForm] = useState<Partial<HireAgentParams>>({ role: 'developer', computeTier: 'standard', skills: [] });
  const [trainForm, setTrainForm] = useState<Partial<BookTrainingParams>>({ skillName: '' });

  useEffect(() => {
    loadFleet();
  }, []);

  const loadFleet = async () => {
    setLoading(true);
    const fleet = await fleetDiscoveryService.loadFleetRegistry();
    setNodes(fleet);
    const polled = await fleetDiscoveryService.pollFleetStatus(fleet);
    const map = new Map<string, FleetNodeStatus>();
    for (const s of polled) map.set(s.node.nodeId, s);
    setStatuses(map);
    setLoading(false);
  };

  const handleHire = async () => {
    if (!hireForm.agentName || !hireForm.role) return;
    const task = await hermesAgentOrchestrator.hireAgent({
      agentName: hireForm.agentName,
      role: hireForm.role,
      skills: hireForm.skills || [],
      computeTier: hireForm.computeTier || 'standard',
      targetNodeId: selectedNode?.nodeId,
    });
    console.log('[Fleet] Hired:', task.taskId);
    setHireOpen(false);
    setHireForm({ role: 'developer', computeTier: 'standard', skills: [] });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-cyan-400">Fleet</h2>
        <button
          onClick={loadFleet}
          className="px-3 py-1.5 rounded-lg border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 transition-colors flex items-center gap-2 text-sm"
        >
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading && nodes.length === 0 && (
        <div className="h-1 w-full bg-gray-900 rounded overflow-hidden">
          <div className="h-full bg-cyan-400 animate-pulse w-2/3" />
        </div>
      )}

      {nodes.length === 0 && !loading && (
        <div className="p-8 text-center space-y-3 rounded-xl border border-gray-800 bg-gray-900/30">
          <Server size={48} className="mx-auto text-gray-700" />
          <h3 className="text-lg font-medium text-gray-500">No Fleet Nodes</h3>
          <p className="text-sm text-gray-600">Set a fleet registry URL in Settings to discover DAO nodes.</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {nodes.map((node) => {
          const s = statuses.get(node.nodeId);
          const isOnline = s?.online || false;
          return (
            <div
              key={node.nodeId}
              className="rounded-xl border p-4 space-y-3 transition-colors"
              style={{
                background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 100%)',
                borderColor: isOnline ? '#00f0ff40' : '#ff2e6340',
              }}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isOnline ? 'bg-cyan-400/20 text-cyan-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {isOnline ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-200">{node.name}</h4>
                  <p className="text-xs text-gray-500">{node.nodeId.slice(0, 12)}...</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs border ${node.computeGrade === 'dedicated' ? 'border-purple-400/40 text-purple-300 bg-purple-400/10' : 'border-gray-600 text-gray-400'}`}>
                  {node.computeGrade}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs border border-gray-600 text-gray-400">
                  {node.hasHermes ? 'Hermes ✓' : 'No Hermes'}
                </span>
                {isOnline && (
                  <span className="px-2 py-0.5 rounded-full text-xs border border-green-400/40 text-green-300 bg-green-400/10">
                    {s?.latencyMs}ms
                  </span>
                )}
              </div>

              <div className="text-sm text-gray-500">
                {node.apiHost}:{node.apiPort}
              </div>
              <div className="text-xs text-gray-600">
                License: {node.anfeLicense.slice(0, 16)}...
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => { setSelectedNode(node); setHireOpen(true); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-cyan-400 hover:bg-cyan-400/10 border border-cyan-400/30 flex items-center gap-1.5 transition-colors"
                >
                  <Rocket size={14} /> Hire Agent
                </button>
                <button
                  onClick={() => { setSelectedNode(node); setTrainOpen(true); }}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:bg-gray-800 border border-gray-600/30 flex items-center gap-1.5 transition-colors"
                >
                  <GraduationCap size={14} /> Train
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hire Dialog */}
      {hireOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-[#0f0f23] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-cyan-400">Hire Agent @ {selectedNode?.name}</h3>
              <button onClick={() => setHireOpen(false)} className="text-gray-500 hover:text-gray-300">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Agent Name</label>
                <input
                  className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-400/50"
                  value={hireForm.agentName || ''}
                  onChange={(e) => setHireForm({ ...hireForm, agentName: e.target.value })}
                  placeholder="e.g., GrowthBot-1"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Role</label>
                <select
                  className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-400/50"
                  value={hireForm.role}
                  onChange={(e) => setHireForm({ ...hireForm, role: e.target.value as any })}
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Compute Tier</label>
                <select
                  className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-400/50"
                  value={hireForm.computeTier}
                  onChange={(e) => setHireForm({ ...hireForm, computeTier: e.target.value as any })}
                >
                  {TIERS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Skills (comma separated)</label>
                <input
                  className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-400/50"
                  value={hireForm.skills?.join(', ') || ''}
                  onChange={(e) => setHireForm({ ...hireForm, skills: e.target.value.split(',').map(s => s.trim()) })}
                  placeholder="react, copywriting, data-analysis"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setHireOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300">Cancel</button>
              <button onClick={handleHire} className="px-4 py-2 rounded-lg text-sm bg-cyan-400 text-[#0f0f23] font-semibold hover:bg-cyan-300 transition-colors">Dispatch</button>
            </div>
          </div>
        </div>
      )}

      {/* Train Dialog */}
      {trainOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-700 bg-[#0f0f23] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-cyan-400">Book Training @ {selectedNode?.name}</h3>
              <button onClick={() => setTrainOpen(false)} className="text-gray-500 hover:text-gray-300">
                <X size={18} />
              </button>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Skill to Train</label>
              <input
                className="w-full rounded-lg border border-gray-700 bg-gray-900/50 px-3 py-2 text-sm text-gray-200 outline-none focus:border-cyan-400/50"
                value={trainForm.skillName || ''}
                onChange={(e) => setTrainForm({ ...trainForm, skillName: e.target.value })}
                placeholder="e.g., TypeScript advanced"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button onClick={() => setTrainOpen(false)} className="px-4 py-2 rounded-lg text-sm text-gray-500 hover:text-gray-300">Cancel</button>
              <button
                onClick={async () => {
                  if (!trainForm.skillName || !selectedNode) return;
                  const task = await hermesAgentOrchestrator.bookTraining({
                    skillName: trainForm.skillName,
                    trainerNodeId: selectedNode.nodeId,
                  });
                  console.log('[Fleet] Training booked:', task.taskId);
                  setTrainOpen(false);
                  setTrainForm({ skillName: '' });
                }}
                className="px-4 py-2 rounded-lg text-sm bg-cyan-400 text-[#0f0f23] font-semibold hover:bg-cyan-300 transition-colors"
              >
                Book
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StargateFleetPanel;
