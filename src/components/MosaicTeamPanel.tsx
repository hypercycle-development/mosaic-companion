/**
 * Mosaic Team Panel — Multi-Agent Sales Team Orchestration
 *
 * Features:
 * - Team roster with role badges, model info, status indicators
 * - Mission pipeline (kanban: lead → qualified → proposal → active)
 * - Quick vault access (Palm Economy knowledge base)
 * - Handoff log with audit trail
 * - Team activation / deactivation controls
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Users,
  Bot,
  Zap,
  CheckCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Database,
  Send,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Target,
  TrendingUp,
  Globe,
  BookOpen,
  MessageSquare,
  Play,
  Square,
  Plus,
  Filter,
  Search,
  X,
  MoreHorizontal,
  Handshake,
  Layers,
  Shield,
  Sparkles,
} from "lucide-react";
import { AIAgentConfig, PROVIDER_INFO } from "../types/ai";
import { INTERNAL_VAULT_URL, INTERNAL_CHAT_URL } from "../types/types";

// ── Types ────────────────────────────────────────────────────────────────────

interface TeamAgent extends AIAgentConfig {
  teamRole?: string;
  pipelineStage?: PipelineStage;
  missionCount?: number;
  lastHandoff?: string;
}

type PipelineStage = "lead" | "qualified" | "proposal" | "active" | "closed";

interface Mission {
  id: string;
  title: string;
  stage: PipelineStage;
  assignee?: string;
  vertical: string;
  priority: "low" | "medium" | "high" | "urgent";
  createdAt: number;
  updatedAt: number;
  notes?: string;
}

interface HandoffRecord {
  id: string;
  fromAgent: string;
  toAgent: string;
  missionId: string;
  reason: string;
  timestamp: number;
  context: Record<string, unknown>;
}

interface VaultBox {
  id: string;
  name: string;
  description: string;
  entryCount?: number;
}

// ── Pipeline Config ──────────────────────────────────────────────────────────

const PIPELINE_STAGES: { id: PipelineStage; label: string; color: string }[] = [
  { id: "lead", label: "Lead", color: "#6366f1" },
  { id: "qualified", label: "Qualified", color: "#8b5cf6" },
  { id: "proposal", label: "Proposal", color: "#ec4899" },
  { id: "active", label: "Active", color: "#10b981" },
  { id: "closed", label: "Closed", color: "#6b7280" },
];

const ROLE_BADGES: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  scout: { icon: <Search size={12} />, color: "#6366f1", label: "Scout" },
  educator: { icon: <BookOpen size={12} />, color: "#8b5cf6", label: "Educator" },
  analyst: { icon: <TrendingUp size={12} />, color: "#f59e0b", label: "Analyst" },
  closer: { icon: <Handshake size={12} />, color: "#ec4899", label: "Closer" },
  success: { icon: <Shield size={12} />, color: "#10b981", label: "Success" },
  default: { icon: <Bot size={12} />, color: "#6b7280", label: "Agent" },
};

// ── Component ────────────────────────────────────────────────────────────────

export const MosaicTeamPanel: React.FC<{ onNavigate?: (url: string) => void }> = ({
  onNavigate,
}) => {
  // ── State ──
  const [agents, setAgents] = useState<TeamAgent[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [handoffs, setHandoffs] = useState<HandoffRecord[]>([]);
  const [vaultBoxes, setVaultBoxes] = useState<VaultBox[]>([]);
  const [activeTab, setActiveTab] = useState<"roster" | "pipeline" | "handoffs" | "vault" | "chat">("roster");
  const [loading, setLoading] = useState(true);
  const [selectedVertical, setSelectedVertical] = useState<string>("palm-economy");
  const [showNewMissionModal, setShowNewMissionModal] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // ── Load Data ──
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Load agents
      const allAgents: AIAgentConfig[] = await window.electronAPI.aiAgents.get();
      const active = allAgents.filter((a) => a.isActive);

      // Map to team agents with inferred roles
      const teamAgents: TeamAgent[] = active.map((a, i) => {
        const roleOrder = ["scout", "educator", "analyst", "closer", "success"];
        const role = roleOrder[i % roleOrder.length];
        return {
          ...a,
          teamRole: role,
          missionCount: Math.floor(Math.random() * 5), // Placeholder until real data
          lastHandoff: i > 0 ? `From ${active[i - 1].name}` : undefined,
        };
      });
      setAgents(teamAgents);

      // Load vault boxes
      const boxes = await window.electronAPI.vault.getBoxes();
      setVaultBoxes(
        boxes.map((b: any) => ({
          id: b.id,
          name: b.name,
          description: b.description,
          entryCount: b.entryCount || 0,
        }))
      );

      // Load demo missions (will be replaced with real storage later)
      const demoMissions: Mission[] = [
        {
          id: "m-1",
          title: "FedeCacao Colombia outreach",
          stage: "qualified",
          assignee: active[0]?.id,
          vertical: "palm-economy",
          priority: "high",
          createdAt: Date.now() - 86400000,
          updatedAt: Date.now() - 3600000,
          notes: "Contacted via LinkedIn. Interested in traceability pilot.",
        },
        {
          id: "m-2",
          title: "APICAR Ecuador honey export",
          stage: "proposal",
          assignee: active[1]?.id,
          vertical: "palm-economy",
          priority: "urgent",
          createdAt: Date.now() - 172800000,
          updatedAt: Date.now() - 7200000,
          notes: "Proposal sent. Awaiting compliance review.",
        },
        {
          id: "m-3",
          title: "Cargill LATAM RFP response",
          stage: "lead",
          assignee: active[2]?.id,
          vertical: "palm-economy",
          priority: "medium",
          createdAt: Date.now() - 43200000,
          updatedAt: Date.now() - 43200000,
          notes: "Initial discovery call scheduled.",
        },
      ];
      setMissions(demoMissions);

      // Demo handoffs
      const demoHandoffs: HandoffRecord[] = [
        {
          id: "h-1",
          fromAgent: active[0]?.name || "Scout",
          toAgent: active[1]?.name || "Educator",
          missionId: "m-1",
          reason: "Lead qualified — needs product education",
          timestamp: Date.now() - 3600000,
          context: { leadScore: 85, vertical: "cacao" },
        },
      ];
      setHandoffs(demoHandoffs);
    } catch (e) {
      console.error("[MosaicTeam] Load error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Actions ──
  const activateTeam = async () => {
    // In a real implementation, this would activate the team via IPC
    console.log("[MosaicTeam] Activating team for vertical:", selectedVertical);
    // Show a toast or status update
  };

  const assignMission = (missionId: string, agentId: string) => {
    setMissions((prev) =>
      prev.map((m) => (m.id === missionId ? { ...m, assignee: agentId, updatedAt: Date.now() } : m))
    );
  };

  const moveMission = (missionId: string, newStage: PipelineStage) => {
    setMissions((prev) =>
      prev.map((m) => (m.id === missionId ? { ...m, stage: newStage, updatedAt: Date.now() } : m))
    );
  };

  const openVaultBox = (boxId: string) => {
    onNavigate?.(`${INTERNAL_VAULT_URL}?box=${boxId}`);
  };

  const startChatWithAgent = (agentId: string) => {
    onNavigate?.(INTERNAL_CHAT_URL);
  };

  // ── Render Helpers ──
  const getRoleBadge = (role?: string) => {
    const badge = ROLE_BADGES[role || "default"] || ROLE_BADGES.default;
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
        style={{ backgroundColor: `${badge.color}20`, color: badge.color, border: `1px solid ${badge.color}40` }}
      >
        {badge.icon}
        {badge.label}
      </span>
    );
  };

  const getProviderDot = (provider: string) => {
    const color = PROVIDER_INFO[provider]?.color || "#6b7280";
    return (
      <div
        className="w-2 h-2 rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      />
    );
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: "#6b7280",
      medium: "#f59e0b",
      high: "#ef4444",
      urgent: "#dc2626",
    };
    const color = colors[priority] || "#6b7280";
    return (
      <span
        className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {priority}
      </span>
    );
  };

  // ── Tabs ──
  const tabs = [
    { id: "roster" as const, label: "Team Roster", icon: Users },
    { id: "chat" as const, label: "Team Chat", icon: MessageSquare },
    { id: "pipeline" as const, label: "Pipeline", icon: Layers },
    { id: "handoffs" as const, label: "Handoffs", icon: ArrowRight },
    { id: "vault" as const, label: "Knowledge", icon: Database },
  ];

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-950">
        <RefreshCw size={32} className="animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-950 text-gray-100 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
              <Users size={20} className="text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Mosaic Team</h1>
              <p className="text-xs text-gray-500">
                {agents.length} active agents · {missions.length} missions · {selectedVertical}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedVertical}
              onChange={(e) => setSelectedVertical(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="palm-economy">Palm Economy</option>
              <option value="generic">Generic Team</option>
              <option value="midnight">Midnight Network</option>
              <option value="stargate">Stargate</option>
            </select>
            <button
              onClick={activateTeam}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <Play size={14} />
              Activate Team
            </button>
          </div>
        </div>

        {/* Tab Strip */}
        <div className="flex gap-1 mt-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    : "text-gray-500 hover:text-gray-300 hover:bg-gray-900"
                }`}
              >
                <Icon size={14} />
                {tab.label}
                {tab.id === "pipeline" && missions.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px]">
                    {missions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* ── ROSTER TAB ── */}
        {activeTab === "roster" && (
          <div className="space-y-4">
            {/* Stats Bar */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Active Agents", value: agents.length, icon: Bot, color: "indigo" },
                { label: "Open Missions", value: missions.filter((m) => m.stage !== "closed").length, icon: Target, color: "emerald" },
                { label: "In Pipeline", value: missions.length, icon: Layers, color: "violet" },
                { label: "Handoffs Today", value: handoffs.filter((h) => h.timestamp > Date.now() - 86400000).length, icon: ArrowRight, color: "amber" },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className="bg-gray-900/50 border border-gray-800 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={14} className={`text-${stat.color}-400`} />
                      <span className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</span>
                    </div>
                    <span className="text-2xl font-bold text-white">{stat.value}</span>
                  </div>
                );
              })}
            </div>

            {/* Agent Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden hover:border-gray-700 transition-colors"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        {getProviderDot(agent.provider)}
                        <div>
                          <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                          <p className="text-xs text-gray-500">{agent.model}</p>
                        </div>
                      </div>
                      {getRoleBadge(agent.teamRole)}
                    </div>

                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                      <span className="flex items-center gap-1">
                        <Zap size={12} />
                        {agent.provider}
                      </span>
                      <span className="flex items-center gap-1">
                        <Target size={12} />
                        {agent.missionCount} missions
                      </span>
                      {agent.lastHandoff && (
                        <span className="flex items-center gap-1">
                          <ArrowRight size={12} />
                          {agent.lastHandoff}
                        </span>
                      )}
                    </div>

                    {/* Skills */}
                    {agent.skills && agent.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {agent.skills.slice(0, 5).map((skill) => (
                          <span
                            key={skill}
                            className="px-2 py-0.5 bg-gray-800 rounded text-[10px] text-gray-400 border border-gray-700"
                          >
                            {skill}
                          </span>
                        ))}
                        {agent.skills.length > 5 && (
                          <span className="px-2 py-0.5 text-[10px] text-gray-600">
                            +{agent.skills.length - 5}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Box Access */}
                    {agent.boxAccess && agent.boxAccess.length > 0 && (
                      <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
                        <Database size={12} />
                        <span>{agent.boxAccess.length} vault boxes</span>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => startChatWithAgent(agent.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                      >
                        <MessageSquare size={12} />
                        Chat
                      </button>
                      <button
                        onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
                        className="px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                      >
                        {expandedAgent === agent.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedAgent === agent.id && (
                    <div className="px-4 pb-4 border-t border-gray-800/50 pt-3">
                      <div className="space-y-2 text-xs text-gray-500">
                        <div className="flex justify-between">
                          <span>ID:</span>
                          <span className="font-mono text-gray-400">{agent.id}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Max Tokens:</span>
                          <span className="text-gray-400">{agent.maxTokens}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Temperature:</span>
                          <span className="text-gray-400">{agent.temperature}</span>
                        </div>
                        {agent.baseUrl && (
                          <div className="flex justify-between">
                            <span>Base URL:</span>
                            <span className="font-mono text-gray-400">{agent.baseUrl}</span>
                          </div>
                        )}
                        {agent.soulId && (
                          <div className="flex justify-between">
                            <span>Soul:</span>
                            <span className="text-indigo-400">{agent.soulId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {agents.length === 0 && (
              <div className="text-center py-12">
                <AlertTriangle size={48} className="mx-auto text-gray-600 mb-4" />
                <p className="text-gray-500">No active agents found.</p>
                <p className="text-sm text-gray-600 mt-2">
                  Activate agents in Settings to build your team.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ═══ TEAM CHAT TAB ═══ */}
        {activeTab === "chat" && (
          <TeamChatThread
            agents={agents}
            onNavigate={onNavigate}
            selectedVertical={selectedVertical}
          />
        )}

        {/* ── PIPELINE TAB ── */}
        {activeTab === "pipeline" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">Sales Pipeline</h2>
              <button
                onClick={() => setShowNewMissionModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium transition-colors"
              >
                <Plus size={12} />
                New Mission
              </button>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {PIPELINE_STAGES.map((stage) => {
                const stageMissions = missions.filter((m) => m.stage === stage.id);
                return (
                  <div key={stage.id} className="bg-gray-900/30 border border-gray-800 rounded-xl p-3 min-h-[200px]">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color }}
                        />
                        <span className="text-xs font-semibold text-gray-400 uppercase">{stage.label}</span>
                      </div>
                      <span className="text-xs text-gray-600">{stageMissions.length}</span>
                    </div>

                    <div className="space-y-2">
                      {stageMissions.map((mission) => {
                        const assignee = agents.find((a) => a.id === mission.assignee);
                        return (
                          <div
                            key={mission.id}
                            className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 hover:border-gray-600 transition-colors"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="text-xs font-medium text-white">{mission.title}</h4>
                              {getPriorityBadge(mission.priority)}
                            </div>
                            {assignee && (
                              <div className="flex items-center gap-1.5 mb-2">
                                {getProviderDot(assignee.provider)}
                                <span className="text-[10px] text-gray-500">{assignee.name}</span>
                              </div>
                            )}
                            {mission.notes && (
                              <p className="text-[10px] text-gray-600 mb-2 line-clamp-2">{mission.notes}</p>
                            )}
                            <div className="flex gap-1">
                              {stage.id !== "lead" && (
                                <button
                                  onClick={() => moveMission(mission.id, getPrevStage(stage.id)!)}
                                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-[10px] text-gray-400 transition-colors"
                                >
                                  ← Back
                                </button>
                              )}
                              {stage.id !== "closed" && (
                                <button
                                  onClick={() => moveMission(mission.id, getNextStage(stage.id)!)}
                                  className="px-2 py-1 bg-indigo-900/30 hover:bg-indigo-900/50 border border-indigo-500/20 rounded text-[10px] text-indigo-400 transition-colors"
                                >
                                  Advance →
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── HANDOFFS TAB ── */}
        {activeTab === "handoffs" && (
          <div className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-300">Agent Handoff Log</h2>
            <div className="bg-gray-900/30 border border-gray-800 rounded-xl overflow-hidden">
              <div className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-gray-800 text-xs font-medium text-gray-500 uppercase">
                <span>From → To</span>
                <span>Mission</span>
                <span>Reason</span>
                <span>Context</span>
                <span>Time</span>
              </div>
              {handoffs.map((h) => (
                <div
                  key={h.id}
                  className="grid grid-cols-5 gap-4 px-4 py-3 border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{h.fromAgent}</span>
                    <ArrowRight size={12} className="text-gray-600" />
                    <span className="text-xs text-indigo-400">{h.toAgent}</span>
                  </div>
                  <span className="text-xs text-gray-500 truncate">
                    {missions.find((m) => m.id === h.missionId)?.title || h.missionId}
                  </span>
                  <span className="text-xs text-gray-500">{h.reason}</span>
                  <span className="text-xs text-gray-600 font-mono truncate">
                    {JSON.stringify(h.context).slice(0, 40)}...
                  </span>
                  <span className="text-xs text-gray-600">{new Date(h.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
              {handoffs.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-600">
                  No handoffs recorded yet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── VAULT TAB ── */}
        {activeTab === "vault" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-300">Knowledge Base</h2>
              <button
                onClick={() => onNavigate?.(INTERNAL_VAULT_URL)}
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Open Vault →
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {vaultBoxes.map((box) => (
                <button
                  key={box.id}
                  onClick={() => openVaultBox(box.id)}
                  className="text-left bg-gray-900/50 border border-gray-800 rounded-xl p-4 hover:border-indigo-500/30 hover:bg-gray-800/50 transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <Database size={16} className="text-indigo-400" />
                    <span className="text-[10px] text-gray-600">{box.entryCount || 0} entries</span>
                  </div>
                  <h3 className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors">
                    {box.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2">{box.description}</p>
                </button>
              ))}
            </div>

            {/* Palm Economy Quick Links */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Palm Economy Quick Access
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Products", icon: BookOpen, entry: "entry-products" },
                  { label: "LATAM Playbook", icon: Globe, entry: "entry-eudr-guide" },
                  { label: "Sales Pitches", icon: MessageSquare, entry: "entry-sales-pitch" },
                  { label: "Objections", icon: Shield, entry: "entry-objection-handling" },
                ].map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.entry}
                      onClick={() => onNavigate?.(`${INTERNAL_VAULT_URL}?box=box-palm-economy&entry=${link.entry}`)}
                      className="flex items-center gap-3 px-4 py-3 bg-gray-900/50 border border-gray-800 rounded-xl hover:border-indigo-500/30 hover:bg-gray-800/50 transition-all"
                    >
                      <Icon size={16} className="text-indigo-400" />
                      <span className="text-sm text-gray-300">{link.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getNextStage(current: PipelineStage): PipelineStage | undefined {
  const order: PipelineStage[] = ["lead", "qualified", "proposal", "active", "closed"];
  const idx = order.indexOf(current);
  return order[idx + 1];
}

function getPrevStage(current: PipelineStage): PipelineStage | undefined {
  const order: PipelineStage[] = ["lead", "qualified", "proposal", "active", "closed"];
  const idx = order.indexOf(current);
  return order[idx - 1];
}

// ════════════════════════════════════════════════════════════════════════════
// TEAM CHAT THREAD — Parallel agent dispatch + streaming responses
// ════════════════════════════════════════════════════════════════════════════

interface TeamChatMessage {
  id: string;
  role: "user" | "agent" | "system";
  agentId?: string;
  agentName?: string;
  teamRole?: string;
  content: string;
  status: "sending" | "streaming" | "complete" | "error";
  timestamp: number;
  missionId?: string;
}

const TeamChatThread: React.FC<{
  agents: TeamAgent[];
  onNavigate?: (url: string) => void;
  selectedVertical: string;
}> = ({ agents, onNavigate, selectedVertical }) => {
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(
    () => new Set(agents.map((a) => a.id))
  );
  const [isDispatching, setIsDispatching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Listen for bottom-bar messages
  useEffect(() => {
    const handleTeamMessage = async (e: CustomEvent) => {
      const { text } = e.detail;
      if (!text?.trim()) return;

      const userMsg: TeamChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        status: "complete",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      await dispatchToAgents(text);
    };

    window.addEventListener("team-message", handleTeamMessage as any);
    return () => window.removeEventListener("team-message", handleTeamMessage as any);
  }, [selectedAgentIds, agents]);

  const dispatchToAgents = async (text: string) => {
    const targetAgents = agents.filter((a) => selectedAgentIds.has(a.id));
    if (targetAgents.length === 0) return;

    setIsDispatching(true);

    const pendingMsgs: TeamChatMessage[] = targetAgents.map((agent) => ({
      id: `a-${agent.id}-${Date.now()}`,
      role: "agent",
      agentId: agent.id,
      agentName: agent.name,
      teamRole: agent.teamRole,
      content: "",
      status: "sending",
      timestamp: Date.now(),
    }));

    setMessages((prev) => [...prev, ...pendingMsgs]);

    await Promise.all(
      targetAgents.map(async (agent, idx) => {
        const pendingId = pendingMsgs[idx].id;
        try {
          setMessages((prev) =>
            prev.map((m) => m.id === pendingId ? { ...m, status: "streaming" } : m)
          );

          // Build role-aware system prompt with skills + vertical context
          const rolePrompts: Record<string, string> = {
            scout: `You are a LATAM market scout for the Palm Economy sales team. Your job is to find and qualify leads. You have access to these skills: web_search, browser_navigate, search_files. When you find leads, provide: company name, website URL, contact email or LinkedIn, and a brief qualification note.\n\nVertical: ${selectedVertical}\nTeam: Palm Economy Multi-Agent Sales\n\nUser request: ${text}`,
            educator: `You are a Palmyra product educator for the Palm Economy sales team. You explain traceability, EUDR compliance, and the value of Palmyra's ecosystem. You have access to these skills: skill_view (for palm-economy skill), web_search. Cite specific products (zenGate, Xpress, Pro) and use concrete examples.\n\nVertical: ${selectedVertical}\nTeam: Palm Economy Multi-Agent Sales\n\nUser request: ${text}`,
            analyst: `You are a commodity analyst for the Palm Economy sales team. You research market data, pricing trends, and competitive landscapes. You have access to these skills: web_search, search_files, browser_navigate. Provide numbers, sources, and risk assessments.\n\nVertical: ${selectedVertical}\nTeam: Palm Economy Multi-Agent Sales\n\nUser request: ${text}`,
            closer: `You are a deal closer for the Palm Economy sales team. You negotiate terms, draft proposals, and recommend pricing packages. You have access to these skills: skill_view (for palm-economy pricing). Be specific about ROI and next steps.\n\nVertical: ${selectedVertical}\nTeam: Palm Economy Multi-Agent Sales\n\nUser request: ${text}`,
            default: `You are ${agent.name}, an AI agent on the Palm Economy sales team. Respond helpfully and concisely.\n\nVertical: ${selectedVertical}\nTeam: Palm Economy Multi-Agent Sales\n\nUser request: ${text}`,
          };

          const systemPrompt = rolePrompts[agent.teamRole || "default"] || rolePrompts.default;

          // Call actual LLM via IPC
          const result = await window.agent?.teamDispatch?.(agent.id, text, systemPrompt);

          if (result?.type === "reply") {
            setMessages((prev) =>
              prev.map((m) => m.id === pendingId ? { ...m, content: result.text, status: "complete" } : m)
            );
          } else if (result?.type === "error") {
            setMessages((prev) =>
              prev.map((m) => m.id === pendingId ? { ...m, content: `⚠️ ${result.text}`, status: "error" } : m)
            );
          } else {
            setMessages((prev) =>
              prev.map((m) => m.id === pendingId ? { ...m, content: "No response from agent.", status: "error" } : m)
            );
          }
        } catch (err: any) {
          setMessages((prev) =>
            prev.map((m) => m.id === pendingId ? { ...m, content: `❌ Error: ${err.message}`, status: "error" } : m)
          );
        }
      })
    );

    setIsDispatching(false);
  };

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handoffTo = (fromAgentId: string, toAgentId: string, context: string) => {
    const fromAgent = agents.find((a) => a.id === fromAgentId);
    const toAgent = agents.find((a) => a.id === toAgentId);
    if (!fromAgent || !toAgent) return;

    const handoffMsg: TeamChatMessage = {
      id: `h-${Date.now()}`,
      role: "system",
      content: `🔄 **Handoff**: ${fromAgent.name} → ${toAgent.name}\n\n**Context**: ${context}`,
      status: "complete",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, handoffMsg]);
  };

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500">
        <Users size={48} className="mb-4 opacity-30" />
        <p>No active agents to form a team.</p>
        <p className="text-sm mt-2">Activate agents in Settings → AI Agents.</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Agent selector */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-800/50">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider shrink-0">Dispatch to:</span>
          {agents.map((agent) => {
            const isSelected = selectedAgentIds.has(agent.id);
            const badge = ROLE_BADGES[agent.teamRole || "default"] || ROLE_BADGES.default;
            return (
              <button
                key={agent.id}
                onClick={() => toggleAgent(agent.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                  isSelected
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                    : "bg-gray-900 border-gray-800 text-gray-600 opacity-60"
                }`}
                title={`${agent.name} · ${agent.model}`}
              >
                <div
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: isSelected ? badge.color : "#6b7280",
                    boxShadow: isSelected ? `0 0 4px ${badge.color}` : "none",
                  }}
                />
                {agent.name}
              </button>
            );
          })}
          {isDispatching && (
            <span className="text-[10px] text-indigo-400 animate-pulse">Working...</span>
          )}
        </div>
      </div>

      {/* Chat thread */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            <MessageSquare size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Type a mission in the bottom bar and hit Enter</p>
            <p className="text-xs mt-1">All selected agents will respond in parallel</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "agent" && (
              <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
                style={{
                  backgroundColor: `${ROLE_BADGES[msg.teamRole || "default"]?.color || "#6b7280"}20`,
                  border: `1px solid ${ROLE_BADGES[msg.teamRole || "default"]?.color || "#6b7280"}40`,
                }}
              >
                {ROLE_BADGES[msg.teamRole || "default"]?.icon || <Bot size={12} />}
              </div>
            )}

            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white rounded-br-sm"
                  : msg.role === "system"
                  ? "bg-gray-800/50 border border-gray-700/50 text-gray-400 text-xs"
                  : "bg-gray-900 border border-gray-800 text-gray-200 rounded-bl-sm"
              }`}
            >
              {msg.role === "agent" && msg.agentName && (
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-semibold" style={{ color: ROLE_BADGES[msg.teamRole || "default"]?.color }}>
                    {msg.agentName}
                  </span>
                  <span className="text-[9px] text-gray-600">
                    {msg.status === "sending" && "⏳"}
                    {msg.status === "streaming" && "✍️"}
                    {msg.status === "complete" && "✓"}
                    {msg.status === "error" && "⚠️"}
                  </span>
                </div>
              )}

              <div className="whitespace-pre-wrap">{msg.content || (msg.status === "sending" ? "Thinking..." : "")}</div>

              {msg.role === "agent" && msg.status === "complete" && (
                <div className="flex gap-2 mt-2 pt-2 border-t border-gray-800/50">
                  <button
                    onClick={() => {
                      const nextRole = getNextTeamRole(msg.teamRole);
                      const nextAgent = agents.find((a) => a.teamRole === nextRole);
                      if (nextAgent) handoffTo(msg.agentId!, nextAgent.id, msg.content);
                    }}
                    className="text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
                  >
                    🔄 Escalate
                  </button>
                  <button
                    onClick={() => onNavigate?.(INTERNAL_CHAT_URL)}
                    className="text-[10px] px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
                  >
                    💬 Chat 1:1
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

function getNextTeamRole(current?: string): string {
  const order = ["scout", "educator", "analyst", "closer"];
  const idx = order.indexOf(current || "");
  return order[idx + 1] || "closer";
}
