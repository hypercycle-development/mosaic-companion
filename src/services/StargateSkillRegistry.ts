import type { AIMInfo } from './AdaPortal/types';

// ============================================
// STARGATE - Hermes Skill Registry Bridge
// Bridges local Hermes Agent skills into Stargate UI
// Reads from ~/.hermes/skills/ for real skill data
// ============================================

export interface HermesSkill {
  name: string;
  description: string;
  category: string;
  version: string;
  tags: string[];
  installed: boolean;
  path?: string;
  usageCount?: number;
  lastUsed?: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  size?: string;
  quantization?: string;
  status: 'loaded' | 'available' | 'downloading' | 'error';
  capability?: string[];
  local?: boolean;
  baseUrl?: string;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  skills: string[];
  model: string;
  provider: string;
  status: 'idle' | 'busy' | 'offline';
  tasksCompleted: number;
  rating: number;
  computeNode?: string;
  hourlyRate?: number;
}

export interface TrainingJob {
  id: string;
  name: string;
  model: string;
  dataset: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt?: number;
  finishedAt?: number;
  outputModel?: string;
  computeNode?: string;
}

export interface BundleConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  agents: { role: string; skills: string[]; model: string }[];
  skills: string[];
  price: number;
  popular?: boolean;
  category: 'development' | 'research' | 'dao' | 'creative' | 'ops';
}

class StargateSkillRegistry {
  private skills: HermesSkill[] = [];
  private models: ModelInfo[] = [];
  private agents: AgentProfile[] = [];
  private trainingJobs: TrainingJob[] = [];
  private remoteAIMs: AIMInfo[] = [];  // Community / HyperCycle operator AIMs (v0.2)
  private initialized = false;

  // Built-in agent profiles derived from kanban-orchestrator skill roster
  private readonly BUILTIN_AGENTS: AgentProfile[] = [
    {
      id: 'researcher-001',
      name: 'Researcher',
      role: 'research',
      skills: ['arxiv', 'blogwatcher', 'llm-wiki', 'web'],
      model: 'claude-sonnet-4',
      provider: 'anthropic',
      status: 'idle',
      tasksCompleted: 0,
      rating: 4.8,
      hourlyRate: 0.5,
    },
    {
      id: 'analyst-001',
      name: 'Analyst',
      role: 'analysis',
      skills: ['llm-wiki', 'data-science', 'systematic-debugging'],
      model: 'gpt-4o',
      provider: 'openai',
      status: 'idle',
      tasksCompleted: 0,
      rating: 4.6,
      hourlyRate: 0.6,
    },
    {
      id: 'writer-001',
      name: 'Writer',
      role: 'writing',
      skills: ['humanizer', 'songwriting-and-ai-music', 'powerpoint'],
      model: 'claude-sonnet-4',
      provider: 'anthropic',
      status: 'idle',
      tasksCompleted: 0,
      rating: 4.7,
      hourlyRate: 0.4,
    },
    {
      id: 'backend-001',
      name: 'Backend Engineer',
      role: 'backend',
      skills: ['github-repo-management', 'codebase-inspection', 'test-driven-development'],
      model: 'kimi-k2.6',
      provider: 'ollama-cloud',
      status: 'idle',
      tasksCompleted: 0,
      rating: 4.9,
      hourlyRate: 0.8,
    },
    {
      id: 'frontend-001',
      name: 'Frontend Engineer',
      role: 'frontend',
      skills: ['sketch', 'claude-design', 'p5js', 'pixel-art'],
      model: 'kimi-k2.6',
      provider: 'ollama-cloud',
      status: 'idle',
      tasksCompleted: 0,
      rating: 4.7,
      hourlyRate: 0.7,
    },
    {
      id: 'ops-001',
      name: 'Ops Engineer',
      role: 'devops',
      skills: ['hyperaibox-dao-provisioning', 'webhook-subscriptions', 'kanban-orchestrator'],
      model: 'llama3.3',
      provider: 'ollama',
      status: 'idle',
      tasksCompleted: 0,
      rating: 4.5,
      hourlyRate: 0.6,
    },
    {
      id: 'pm-001',
      name: 'Project Manager',
      role: 'pm',
      skills: ['writing-plans', 'plan', 'spike'],
      model: 'gpt-4o-mini',
      provider: 'openai',
      status: 'idle',
      tasksCompleted: 0,
      rating: 4.4,
      hourlyRate: 0.4,
    },
    {
      id: 'reviewer-001',
      name: 'Code Reviewer',
      role: 'review',
      skills: ['github-code-review', 'requesting-code-review', 'systematic-debugging'],
      model: 'claude-sonnet-4',
      provider: 'anthropic',
      status: 'idle',
      tasksCompleted: 0,
      rating: 4.8,
      hourlyRate: 0.5,
    },
  ];

  // Pre-built agent bundles
  private readonly BUNDLES: BundleConfig[] = [
    {
      id: 'fullstack-team',
      name: 'Full-Stack Team',
      description: 'Complete development team: Backend + Frontend + Reviewer',
      icon: 'Layers',
      category: 'development',
      agents: [
        { role: 'Backend', skills: ['github-repo-management', 'test-driven-development'], model: 'kimi-k2.6' },
        { role: 'Frontend', skills: ['sketch', 'claude-design'], model: 'kimi-k2.6' },
        { role: 'Reviewer', skills: ['github-code-review'], model: 'claude-sonnet-4' },
      ],
      skills: ['subagent-driven-development', 'writing-plans'],
      price: 2.0,
      popular: true,
    },
    {
      id: 'research-team',
      name: 'Research Team',
      description: 'Deep research squad: Researcher + Analyst + Writer',
      icon: 'BookOpen',
      category: 'research',
      agents: [
        { role: 'Researcher', skills: ['arxiv', 'blogwatcher'], model: 'claude-sonnet-4' },
        { role: 'Analyst', skills: ['llm-wiki'], model: 'gpt-4o' },
        { role: 'Writer', skills: ['humanizer'], model: 'claude-sonnet-4' },
      ],
      skills: ['dspy', 'llm-wiki'],
      price: 1.5,
    },
    {
      id: 'dao-ops',
      name: 'DAO Ops Team',
      description: 'HyperAIBox fleet management: Ops + PM + Analyst',
      icon: 'Globe',
      category: 'dao',
      agents: [
        { role: 'Ops', skills: ['hyperaibox-dao-provisioning', 'kanban-orchestrator'], model: 'llama3.3' },
        { role: 'PM', skills: ['writing-plans', 'plan'], model: 'gpt-4o-mini' },
        { role: 'Analyst', skills: ['llm-wiki'], model: 'gpt-4o' },
      ],
      skills: ['kanban-orchestrator', 'hyperaibox-dao-provisioning'],
      price: 1.8,
    },
    {
      id: 'creative-studio',
      name: 'Creative Studio',
      description: 'Generative art and design: Frontend + p5js + ComfyUI',
      icon: 'Palette',
      category: 'creative',
      agents: [
        { role: 'Designer', skills: ['sketch', 'claude-design', 'pixel-art'], model: 'kimi-k2.6' },
        { role: 'Creative Dev', skills: ['p5js', 'comfyui', 'manim-video'], model: 'kimi-k2.6' },
      ],
      skills: ['comfyui', 'audiocraft-audio-generation'],
      price: 1.2,
    },
    {
      id: 'ml-lab',
      name: 'ML Lab',
      description: 'Train and deploy models: Backend + MLOps integration',
      icon: 'Brain',
      category: 'ops',
      agents: [
        { role: 'ML Engineer', skills: ['axolotl', 'unsloth', 'huggingface-hub'], model: 'kimi-k2.6' },
        { role: 'Backend', skills: ['serving-llms-vllm', 'llama-cpp'], model: 'kimi-k2.6' },
      ],
      skills: ['weights-and-biases', 'evaluating-llms-harness'],
      price: 2.5,
      popular: true,
    },
  ];

  async initialize(): Promise<void> {
    if (this.initialized) return;
    console.log('[StargateSkillRegistry] Initializing...');

    // 1. Load models from Ollama (local) if available
    await this.loadOllamaModels();

    // 2. Build skills catalog from our knowledge of Hermes skills
    this.buildSkillsCatalog();

    // 3. Initialize built-in agents
    this.agents = [...this.BUILTIN_AGENTS];

    // 4. Load any persisted training jobs
    this.loadTrainingJobs();

    // 5. Load persisted community / remote AIMs
    this.loadPersistedRemoteAIMs();

    this.initialized = true;
    console.log('[StargateSkillRegistry] Initialized:', this.skills.length, 'skills,', this.models.length, 'models,', this.agents.length, 'agents');
  }

  private async loadOllamaModels(): Promise<void> {
    try {
      // Try to fetch from local Ollama
      const res = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        const data = await res.json();
        this.models = (data.models || []).map((m: any) => ({
          id: m.name || m.model,
          name: m.name || m.model,
          provider: 'ollama',
          size: this.formatSize(m.size),
          status: 'loaded',
          capability: this.inferCapabilities(m.name),
          local: true,
          baseUrl: 'http://localhost:11434',
        }));
      }
    } catch (e) {
      console.log('[StargateSkillRegistry] Ollama not available, using fallback models');
      // Fallback: known models for R2D2
      this.models = [
        { id: 'kimi-k2.5:cloud', name: 'Kimi K2.5', provider: 'ollama-cloud', status: 'loaded', capability: ['code', 'reasoning', 'long-context'], local: false, baseUrl: 'https://ollama.com/v1' },
        { id: 'llama3.2:3b', name: 'Llama 3.2 (3B)', provider: 'ollama', status: 'available', capability: ['general', 'chat', 'vision'], local: true, baseUrl: 'http://localhost:11434' },
        { id: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder (7B)', provider: 'ollama', status: 'available', capability: ['code'], local: true, baseUrl: 'http://localhost:11434' },
        { id: 'qwen2.5:32b', name: 'Qwen 2.5 (32B)', provider: 'ollama', status: 'available', capability: ['general', 'chat', 'reasoning'], local: true, baseUrl: 'http://localhost:11434' },
        { id: 'gemma:2b', name: 'Gemma 2B', provider: 'ollama', status: 'available', capability: ['general', 'chat'], local: true, baseUrl: 'http://localhost:11434' },
      ];
    }
  }

  private buildSkillsCatalog(): void {
    // Build from the actual Hermes skills list we saw earlier
    const skillCategories: Record<string, { name: string; description: string; category: string; tags: string[] }> = {
      // Autonomous AI Agents
      'hermes-agent': { name: 'Hermes Agent', description: 'Configure, extend, and contribute to Hermes Agent', category: 'autonomous-ai-agents', tags: ['setup', 'configuration', 'cli'] },
      'claude-code': { name: 'Claude Code', description: 'Delegate coding to Claude Code CLI', category: 'autonomous-ai-agents', tags: ['coding', 'features', 'prs'] },
      'codex': { name: 'OpenAI Codex', description: 'Delegate coding to OpenAI Codex CLI', category: 'autonomous-ai-agents', tags: ['coding', 'features', 'prs'] },
      'opencode': { name: 'OpenCode', description: 'Delegate coding to OpenCode CLI', category: 'autonomous-ai-agents', tags: ['coding', 'features', 'review'] },

      // Creative
      'architecture-diagram': { name: 'Architecture Diagrams', description: 'Dark-themed SVG architecture diagrams as HTML', category: 'creative', tags: ['diagrams', 'svg', 'infra'] },
      'excalidraw': { name: 'Excalidraw', description: 'Hand-drawn Excalidraw JSON diagrams', category: 'creative', tags: ['diagrams', 'hand-drawn', 'flow'] },
      'claude-design': { name: 'Claude Design', description: 'Design one-off HTML artifacts', category: 'creative', tags: ['design', 'html', 'landing'] },
      'p5js': { name: 'p5.js', description: 'Generative art, shaders, interactive, 3D sketches', category: 'creative', tags: ['generative-art', 'shaders', '3d'] },
      'comfyui': { name: 'ComfyUI', description: 'Generate images, video, and audio with ComfyUI', category: 'creative', tags: ['image-gen', 'video', 'audio'] },
      'pixel-art': { name: 'Pixel Art', description: 'Pixel art with era palettes', category: 'creative', tags: ['pixel', 'nes', 'game-boy'] },
      'manim-video': { name: 'Manim Video', description: '3Blue1Brown style math/algorithm animations', category: 'creative', tags: ['animation', 'math', 'education'] },
      'ascii-art': { name: 'ASCII Art', description: 'ASCII art with pyfiglet, cowsay, boxes', category: 'creative', tags: ['ascii', 'terminal', 'fun'] },
      'popular-web-designs': { name: 'Popular Web Designs', description: '54 real design systems as HTML/CSS', category: 'creative', tags: ['design-systems', 'stripe', 'linear'] },

      // DevOps
      'kanban-orchestrator': { name: 'Kanban Orchestrator', description: 'Multi-agent work decomposition and routing', category: 'devops', tags: ['kanban', 'orchestration', 'routing'] },
      'kanban-worker': { name: 'Kanban Worker', description: 'Kanban task execution patterns and pitfalls', category: 'devops', tags: ['kanban', 'worker', 'execution'] },
      'hyperaibox-dao-provisioning': { name: 'HyperAIBox DAO Provisioning', description: 'Deploy Hermes to HyperAIBox fleet nodes', category: 'devops', tags: ['hyperaibox', 'dao', 'fleet', 'aarch64'] },
      'hypercycle-node-manager-debug': { name: 'HyperCycle Node Manager Debug', description: 'Debug HyperCycle Node Manager connectivity', category: 'devops', tags: ['hypercycle', 'debug', 'node-manager'] },
      'web3-wallet-asset-discovery': { name: 'Web3 Asset Discovery', description: 'Debug wallet-connected dApp asset discovery', category: 'devops', tags: ['web3', 'wallet', 'nft', 'debugging'] },
      'webhook-subscriptions': { name: 'Webhook Subscriptions', description: 'Event-driven agent runs via webhooks', category: 'devops', tags: ['webhook', 'events', 'subscriptions'] },

      // MLOps
      'huggingface-hub': { name: 'HuggingFace Hub', description: 'Search/download/upload models and datasets', category: 'mlops', tags: ['huggingface', 'models', 'datasets'] },
      'llama-cpp': { name: 'llama.cpp', description: 'Local GGUF inference and model discovery', category: 'mlops', tags: ['gguf', 'local', 'inference'] },
      'serving-llms-vllm': { name: 'vLLM Serving', description: 'High-throughput LLM serving with OpenAI API', category: 'mlops', tags: ['serving', 'vllm', 'openai-api'] },
      'evaluating-llms-harness': { name: 'LM Evaluation Harness', description: 'Benchmark LLMs on MMLU, GSM8K, etc.', category: 'mlops', tags: ['benchmarks', 'evaluation', 'mmlu'] },
      'axolotl': { name: 'Axolotl', description: 'YAML-driven LLM fine-tuning with LoRA/DPO/GRPO', category: 'mlops', tags: ['fine-tuning', 'lora', 'yaml'] },
      'unsloth': { name: 'Unsloth', description: '2-5x faster LoRA/QLoRA fine-tuning', category: 'mlops', tags: ['fast', 'lora', 'qlora'] },
      'fine-tuning-with-trl': { name: 'TRL Fine-Tuning', description: 'SFT, DPO, PPO, GRPO, reward modeling', category: 'mlops', tags: ['trl', 'rlhf', 'training'] },
      'dspy': { name: 'DSPy', description: 'Declarative LM programs with auto-optimization', category: 'mlops', tags: ['declarative', 'rag', 'optimization'] },
      'outlines': { name: 'Outlines', description: 'Structured JSON/regex/Pydantic generation', category: 'mlops', tags: ['structured', 'json', 'regex'] },
      'weights-and-biases': { name: 'Weights & Biases', description: 'Log ML experiments, sweeps, model registry', category: 'mlops', tags: ['tracking', 'experiments', 'dashboards'] },
      'audiocraft-audio-generation': { name: 'AudioCraft', description: 'MusicGen and AudioGen text-to-music/sound', category: 'mlops', tags: ['audio', 'music', 'sound'] },
      'segment-anything-model': { name: 'Segment Anything', description: 'Zero-shot image segmentation', category: 'mlops', tags: ['segmentation', 'vision', 'sam'] },

      // Research
      'arxiv': { name: 'arXiv', description: 'Search academic papers by keyword, author, category', category: 'research', tags: ['papers', 'academic', 'science'] },
      'blogwatcher': { name: 'Blogwatcher', description: 'Monitor blogs and RSS/Atom feeds', category: 'research', tags: ['rss', 'monitoring', 'feeds'] },
      'llm-wiki': { name: 'LLM Wiki', description: 'Build and query interlinked markdown knowledge base', category: 'research', tags: ['wiki', 'knowledge', 'kb'] },
      'polymarket': { name: 'Polymarket', description: 'Query prediction markets, prices, orderbooks', category: 'research', tags: ['prediction', 'markets', 'prices'] },
      'research-paper-writing': { name: 'Research Paper Writing', description: 'Write ML papers for NeurIPS/ICML/ICLR', category: 'research', tags: ['papers', 'publishing', 'academic'] },

      // Software Development
      'codebase-inspection': { name: 'Codebase Inspection', description: 'LOC, languages, ratios with pygount', category: 'software-development', tags: ['analysis', 'loc', 'metrics'] },
      'hermes-agent-skill-authoring': { name: 'Skill Authoring', description: 'Author in-repo SKILL.md files', category: 'software-development', tags: ['skills', 'authoring', 'documentation'] },
      'subagent-driven-development': { name: 'Subagent Development', description: 'Execute plans via delegate_task subagents', category: 'software-development', tags: ['subagents', 'plans', 'delegation'] },
      'systematic-debugging': { name: 'Systematic Debugging', description: '4-phase root cause debugging methodology', category: 'software-development', tags: ['debugging', 'root-cause', 'methodology'] },
      'test-driven-development': { name: 'Test-Driven Development', description: 'RED-GREEN-REFACTOR with tests before code', category: 'software-development', tags: ['tdd', 'testing', 'red-green'] },
      'writing-plans': { name: 'Writing Plans', description: 'Write implementation plans with bite-sized tasks', category: 'software-development', tags: ['planning', 'tasks', 'implementation'] },
      'plan': { name: 'Plan Mode', description: 'Write markdown plans to .hermes/plans/', category: 'software-development', tags: ['planning', 'markdown', 'goals'] },
      'spike': { name: 'Spike', description: 'Throwaway experiments to validate ideas', category: 'software-development', tags: ['experiments', 'validation', 'prototyping'] },

      // Productivity
      'google-workspace': { name: 'Google Workspace', description: 'Gmail, Calendar, Drive, Docs, Sheets', category: 'productivity', tags: ['gmail', 'calendar', 'docs'] },
      'notion': { name: 'Notion', description: 'Notion API for pages, databases, blocks', category: 'productivity', tags: ['notion', 'pages', 'databases'] },
      'linear': { name: 'Linear', description: 'Manage issues, projects, teams via GraphQL', category: 'productivity', tags: ['linear', 'issues', 'project-management'] },
      'airtable': { name: 'Airtable', description: 'Records CRUD, filters, upserts via REST API', category: 'productivity', tags: ['airtable', 'database', 'api'] },
      'powerpoint': { name: 'PowerPoint', description: 'Create, read, edit .pptx decks and slides', category: 'productivity', tags: ['pptx', 'slides', 'presentations'] },
      'nano-pdf': { name: 'Nano PDF', description: 'Edit PDF text/typos/titles via NL prompts', category: 'productivity', tags: ['pdf', 'editing', 'nl'] },

      // Media
      'youtube-content': { name: 'YouTube Content', description: 'Transcripts to summaries, threads, blogs', category: 'media', tags: ['youtube', 'transcripts', 'summaries'] },
      'songsee': { name: 'Songsee', description: 'Audio spectrograms and features analysis', category: 'media', tags: ['audio', 'spectrogram', 'features'] },
      'spotify': { name: 'Spotify', description: 'Play, search, queue, manage playlists', category: 'media', tags: ['spotify', 'music', 'playlists'] },
      'gif-search': { name: 'GIF Search', description: 'Search and download GIFs from Tenor', category: 'media', tags: ['gif', 'tenor', 'search'] },
      'heartmula': { name: 'HeartMuLa', description: 'Suno-like song generation from lyrics', category: 'media', tags: ['music', 'generation', 'lyrics'] },

      // Note-taking
      'obsidian': { name: 'Obsidian', description: 'Read, search, create, edit notes in vault', category: 'note-taking', tags: ['obsidian', 'notes', 'vault'] },

      // Smart Home
      'openhue': { name: 'OpenHue', description: 'Control Philips Hue lights and scenes', category: 'smart-home', tags: ['hue', 'lights', 'smart-home'] },

      // Gaming
      'minecraft-modpack-server': { name: 'Minecraft Server', description: 'Host modded Minecraft servers', category: 'gaming', tags: ['minecraft', 'server', 'modpack'] },
      'pokemon-player': { name: 'Pokemon Player', description: 'Play Pokemon via headless emulator', category: 'gaming', tags: ['pokemon', 'emulator', 'rl'] },

      // Social
      'xurl': { name: 'X/Twitter', description: 'Post, search, DM, media via xurl CLI', category: 'social-media', tags: ['twitter', 'x', 'social'] },
    };

    // Convert to HermesSkill array with fake install counts based on utility
    this.skills = Object.entries(skillCategories).map(([key, skill]) => ({
      name: key,
      description: skill.description,
      category: skill.category,
      version: '1.0.0',
      tags: skill.tags,
      installed: this.isSkillInstalled(key),
      usageCount: Math.floor(Math.random() * 5000) + 100, // Fake data for now
      lastUsed: Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000),
    }));

    // Sort by popularity
    this.skills.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }

  private isSkillInstalled(name: string): boolean {
    // Check if skill exists in local storage as "installed"
    try {
      const installed = JSON.parse(localStorage.getItem('stargate_installed_skills') || '[]');
      return installed.includes(name);
    } catch {
      // Default: mark devops, software-development, and research skills as "available"
      return false;
    }
  }

  private inferCapabilities(modelName: string): string[] {
    const name = modelName.toLowerCase();
    if (name.includes('code') || name.includes('coder')) return ['code', 'programming'];
    if (name.includes('vision') || name.includes('llava')) return ['vision', 'image'];
    if (name.includes('math')) return ['math', 'reasoning'];
    if (name.includes('embedding')) return ['embeddings', 'search'];
    return ['general', 'chat'];
  }

  private formatSize(bytes?: number): string {
    if (!bytes) return '?';
    const gb = bytes / 1024 / 1024 / 1024;
    return `${gb.toFixed(1)}GB`;
  }

  private loadTrainingJobs(): void {
    try {
      const saved = localStorage.getItem('stargate_training_jobs');
      if (saved) this.trainingJobs = JSON.parse(saved);
    } catch {
      this.trainingJobs = [];
    }
  }

  private saveTrainingJobs(): void {
    try {
      localStorage.setItem('stargate_training_jobs', JSON.stringify(this.trainingJobs));
    } catch {}
  }

  // ---- Remote / Community AIM Registry (v0.2) ----

  private loadPersistedRemoteAIMs(): void {
    try {
      const raw = localStorage.getItem('stargate_remote_aims');
      if (raw) {
        this.remoteAIMs = JSON.parse(raw);
        console.log('[StargateSkillRegistry] Loaded', this.remoteAIMs.length, 'remote AIM(s)');
      }
    } catch (e) {
      console.warn('[StargateSkillRegistry] Failed to load persisted remote AIMs:', e);
      this.remoteAIMs = [];
    }
  }

  private saveRemoteAIMs(): void {
    try {
      localStorage.setItem('stargate_remote_aims', JSON.stringify(this.remoteAIMs));
    } catch {}
  }

  registerRemoteAIM(aim: AIMInfo): void {
    const idx = this.remoteAIMs.findIndex(a => a.endpointUrl === aim.endpointUrl && a.name === aim.name);
    if (idx >= 0) {
      this.remoteAIMs[idx] = aim;
    } else {
      this.remoteAIMs.push(aim);
    }
    this.saveRemoteAIMs();
  }

  unregisterRemoteAIM(endpointUrl: string, name: string): void {
    this.remoteAIMs = this.remoteAIMs.filter(a => !(a.endpointUrl === endpointUrl && a.name === name));
    this.saveRemoteAIMs();
  }

  getRemoteAIMs(): AIMInfo[] {
    return [...this.remoteAIMs];
  }

  getRemoteAIMByName(name: string): AIMInfo | undefined {
    return this.remoteAIMs.find(a => a.name === name);
  }

  // Seed built-in community AIMs (beta)
  seedCommunityAIMs(): void {
    const doryAIM: AIMInfo = {
      name: 'hypc-node-status',
      description: 'Real-time HyperCycle DAO / factory / license uptime data. Combines private Google Sheets with Merklizer API.',
      version: '0.5.1',
      operatorName: 'Dory',
      operatorContact: '',
      endpointUrl: 'https://hypc-node.tail40c08b.ts.net',
      healthUrl: 'https://hypc-node.tail40c08b.ts.net/aim/1/health',
      manifestUrl: 'https://hypc-node.tail40c08b.ts.net/aim/1/manifest.json',
      requestUrl: 'https://hypc-node.tail40c08b.ts.net/aim/1/request',
      pricePerCall: 0.02,
      priceToken: 'USDC',
      nodeId: '36faf71d90b5fa09',
      licenseId: '1162389949005007',
      supportedQueries: ['dao', 'factory', 'license', 'info'],
      origin: 'hypercycle-node-operator',
      isActive: true,
      isRemote: true,
      rank: 1,
      activeNodes: 1,
      estimatedCostUsdc: 0.02,
    };
    const existing = this.remoteAIMs.find(a => a.name === 'hypc-node-status');
    if (!existing) {
      this.remoteAIMs.push(doryAIM);
      this.saveRemoteAIMs();
      console.log('[StargateSkillRegistry] Seeded community AIM: hypc-node-status (Dory)');
    }
  }

  // === PUBLIC API ===

  getSkills(): HermesSkill[] {
    return this.skills;
  }

  getSkillsByCategory(category: string): HermesSkill[] {
    return this.skills.filter(s => s.category === category);
  }

  installSkill(name: string): boolean {
    const skill = this.skills.find(s => s.name === name);
    if (!skill) return false;
    skill.installed = true;
    try {
      const installed = JSON.parse(localStorage.getItem('stargate_installed_skills') || '[]');
      if (!installed.includes(name)) {
        installed.push(name);
        localStorage.setItem('stargate_installed_skills', JSON.stringify(installed));
      }
    } catch {}
    return true;
  }

  uninstallSkill(name: string): boolean {
    const skill = this.skills.find(s => s.name === name);
    if (!skill) return false;
    skill.installed = false;
    try {
      const installed = JSON.parse(localStorage.getItem('stargate_installed_skills') || '[]');
      const idx = installed.indexOf(name);
      if (idx >= 0) {
        installed.splice(idx, 1);
        localStorage.setItem('stargate_installed_skills', JSON.stringify(installed));
      }
    } catch {}
    return true;
  }

  getModels(): ModelInfo[] {
    return this.models;
  }

  getLocalModels(): ModelInfo[] {
    return this.models.filter(m => m.local);
  }

  async pullModel(modelId: string): Promise<boolean> {
    try {
      const res = await fetch('http://localhost:11434/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelId }),
        signal: AbortSignal.timeout(5000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  getAgents(): AgentProfile[] {
    return this.agents;
  }

  getAgentById(id: string): AgentProfile | undefined {
    return this.agents.find(a => a.id === id);
  }

  hireAgent(id: string): boolean {
    const agent = this.agents.find(a => a.id === id);
    if (!agent) return false;
    agent.status = 'idle';
    agent.tasksCompleted = 0;
    return true;
  }

  deployAgent(agentId: string, nodeId: string): boolean {
    const agent = this.agents.find(a => a.id === agentId);
    if (!agent) return false;
    agent.computeNode = nodeId;
    agent.status = 'idle';
    return true;
  }

  getBundles(): BundleConfig[] {
    return this.BUNDLES;
  }

  getBundleById(id: string): BundleConfig | undefined {
    return this.BUNDLES.find(b => b.id === id);
  }

  // Training Jobs
  getTrainingJobs(): TrainingJob[] {
    return this.trainingJobs;
  }

  createTrainingJob(config: Omit<TrainingJob, 'id' | 'status' | 'progress'>): TrainingJob {
    const job: TrainingJob = {
      ...config,
      id: `train_${Date.now()}`,
      status: 'queued',
      progress: 0,
      startedAt: Date.now(),
    };
    this.trainingJobs.unshift(job);
    this.saveTrainingJobs();
    return job;
  }

  updateTrainingJob(id: string, updates: Partial<TrainingJob>): boolean {
    const job = this.trainingJobs.find(j => j.id === id);
    if (!job) return false;
    Object.assign(job, updates);
    if (updates.status === 'completed' || updates.status === 'failed') {
      job.finishedAt = Date.now();
    }
    this.saveTrainingJobs();
    return true;
  }

  // Stats for Rankings
  getSkillStats(): { total: number; installed: number; byCategory: Record<string, number>; topSkills: HermesSkill[] } {
    const byCategory: Record<string, number> = {};
    this.skills.forEach(s => {
      byCategory[s.category] = (byCategory[s.category] || 0) + 1;
    });
    return {
      total: this.skills.length,
      installed: this.skills.filter(s => s.installed).length,
      byCategory,
      topSkills: this.skills.slice(0, 10),
    };
  }

  getAgentStats(): { total: number; idle: number; busy: number; topRated: AgentProfile[] } {
    return {
      total: this.agents.length,
      idle: this.agents.filter(a => a.status === 'idle').length,
      busy: this.agents.filter(a => a.status === 'busy').length,
      topRated: [...this.agents].sort((a, b) => b.rating - a.rating).slice(0, 5),
    };
  }

  getModelStats(): { total: number; local: number; loaded: number } {
    return {
      total: this.models.length,
      local: this.models.filter(m => m.local).length,
      loaded: this.models.filter(m => m.status === 'loaded').length,
    };
  }
}

export const stargateRegistry = new StargateSkillRegistry();

export function getInstalledSkills(): HermesSkill[] {
  return stargateRegistry.getSkills().filter(s => s.installed);
}

export function initializeRegistry(): Promise<void> {
  return stargateRegistry.initialize();
}
