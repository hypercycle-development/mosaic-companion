// ============================================
// Stargate Unique Features - UI Enhancement Module
// Patches AdaPortalPanel with skill-powered tab content
// ============================================

import { stargateRegistry, type HermesSkill, type ModelInfo, type AgentProfile, type BundleConfig, type TrainingJob } from '../services/StargateSkillRegistry';

// Re-export for use in AdaPortalPanel
export { stargateRegistry };
export type { HermesSkill, ModelInfo, AgentProfile, BundleConfig, TrainingJob };

// Category color mapping for UI
export const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  'autonomous-ai-agents': { bg: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30', icon: 'Bot' },
  'creative': { bg: 'bg-pink-500/20', text: 'text-pink-400', border: 'border-pink-500/30', icon: 'Palette' },
  'devops': { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30', icon: 'Server' },
  'mlops': { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30', icon: 'Brain' },
  'research': { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: 'BookOpen' },
  'software-development': { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', icon: 'Code' },
  'productivity': { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30', icon: 'Zap' },
  'media': { bg: 'bg-rose-500/20', text: 'text-rose-400', border: 'border-rose-500/30', icon: 'Music' },
  'note-taking': { bg: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', icon: 'FileText' },
  'smart-home': { bg: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30', icon: 'Home' },
  'gaming': { bg: 'bg-fuchsia-500/20', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', icon: 'Gamepad2' },
  'social-media': { bg: 'bg-sky-500/20', text: 'text-sky-400', border: 'border-sky-500/30', icon: 'MessageCircle' },
};

export const getCategoryColor = (category: string) => {
  return CATEGORY_COLORS[category] || { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30', icon: 'Zap' };
};

// Model provider icon mapping
export const PROVIDER_ICONS: Record<string, { color: string; label: string }> = {
  'ollama': { color: 'text-amber-400', label: 'Local Ollama' },
  'ollama-cloud': { color: 'text-cyan-400', label: 'Ollama Cloud' },
  'anthropic': { color: 'text-orange-400', label: 'Anthropic' },
  'openai': { color: 'text-green-400', label: 'OpenAI' },
  'huggingface': { color: 'text-yellow-400', label: 'HuggingFace' },
};

// Bundle category configs
export const BUNDLE_CATEGORIES: Record<string, { color: string; gradient: string; icon: string }> = {
  'development': { color: 'text-blue-400', gradient: 'from-blue-900/50 to-indigo-900/50', icon: 'Code' },
  'research': { color: 'text-emerald-400', gradient: 'from-emerald-900/50 to-teal-900/50', icon: 'BookOpen' },
  'dao': { color: 'text-orange-400', gradient: 'from-orange-900/50 to-amber-900/50', icon: 'Globe' },
  'creative': { color: 'text-pink-400', gradient: 'from-pink-900/50 to-rose-900/50', icon: 'Palette' },
  'ops': { color: 'text-purple-400', gradient: 'from-purple-900/50 to-violet-900/50', icon: 'Cpu' },
};

// Agent status badge config
export const AGENT_STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  'idle': { color: 'text-green-400', bg: 'bg-green-500/20', label: 'Available' },
  'busy': { color: 'text-amber-400', bg: 'bg-amber-500/20', label: 'Busy' },
  'offline': { color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Offline' },
};

// Training job status config
export const TRAINING_STATUS_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  'queued': { color: 'text-gray-400', bg: 'bg-gray-500/20', icon: 'Clock' },
  'running': { color: 'text-cyan-400', bg: 'bg-cyan-500/20', icon: 'Loader2' },
  'completed': { color: 'text-green-400', bg: 'bg-green-500/20', icon: 'CheckCircle' },
  'failed': { color: 'text-red-400', bg: 'bg-red-500/20', icon: 'XCircle' },
};

// Rankings data generators
export const generateRankings = () => {
  const skillStats = stargateRegistry.getSkillStats();
  const agentStats = stargateRegistry.getAgentStats();
  const modelStats = stargateRegistry.getModelStats();

  return {
    skills: skillStats.topSkills.map((s, i) => ({
      rank: i + 1,
      name: s.name,
      category: s.category,
      score: s.usageCount || 0,
      trend: Math.random() > 0.5 ? 'up' : 'down',
      trendValue: Math.floor(Math.random() * 20) + 1,
      icon: getCategoryColor(s.category).icon,
    })),
    agents: agentStats.topRated.map((a, i) => ({
      rank: i + 1,
      name: a.name,
      role: a.role,
      score: Math.round(a.rating * 100),
      tasks: a.tasksCompleted,
      trend: a.status === 'idle' ? 'up' : 'stable',
      model: a.model,
      provider: a.provider,
    })),
    models: stargateRegistry.getModels().map((m, i) => ({
      rank: i + 1,
      name: m.name,
      provider: m.provider,
      status: m.status,
      local: m.local,
      score: m.status === 'loaded' ? 100 : m.status === 'available' ? 80 : 50,
    })),
  };
};
