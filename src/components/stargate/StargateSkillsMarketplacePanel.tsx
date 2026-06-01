// ============================================================
// STARGATE SKILLS MARKETPLACE PANEL
// SkillsLLM.com-style marketplace integration for Stargate
// Connects to: http://localhost:3000/api
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  Search, Filter, Star, GitFork, ExternalLink, Heart, Bookmark,
  CheckCircle2, Download, Copy, ArrowLeft, Shield, Zap, Code,
  RefreshCw, ChevronDown, Tag, Eye, TrendingUp, Clock, AlertTriangle,
  XCircle, Loader, LayoutGrid, List, BookOpen
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────

interface Skill {
  id: string;
  slug: string;
  name: string;
  owner: string;
  description: string;
  stars: number;
  forks: number;
  language: string | null;
  categorySlug: string;
  tags: string[];
  githubUrl: string;
  riskScore: number;
  verified: boolean;
  published: boolean;
  upvotes: number;
  downvotes: number;
  votesScore: number;
  readmeUrl: string | null;
  license: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { votes: number; bookmarks: number };
}

interface Category {
  slug: string;
  name: string;
  description: string;
  _count?: { skills: number };
}

interface Pagination {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

interface ApiResponse<T> {
  data?: T;
  skills?: T[];
  categories?: T[];
  pagination?: Pagination;
  error?: string;
}

// ─── API Client ─────────────────────────────────────────────

const API_BASE = 'http://localhost:3000/api';

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ─── Helper Components ───────────────────────────────────────

const RiskBadge: React.FC<{ score: number; verified: boolean }> = ({ score, verified }) => {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
        <CheckCircle2 size={12} />
        Verified
      </span>
    );
  }
  if (score <= 20) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
        <Shield size={12} />
        Safe
      </span>
    );
  }
  if (score <= 50) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
        <AlertTriangle size={12} />
        Caution
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
      <XCircle size={12} />
      Risk {score}
    </span>
  );
};

const CategoryBadge: React.FC<{ slug: string }> = ({ slug }) => {
  const colors: Record<string, string> = {
    'cli-tools': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    'ide-extensions': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    'devops': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    'ai-agents': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    'testing': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    'mcp-servers': 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    'data-processing': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${colors[slug] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
      {slug}
    </span>
  );
};

// ─── Skill Card ─────────────────────────────────────────────

const SkillCard: React.FC<{
  skill: Skill;
  onSelect: (s: Skill) => void;
  compact?: boolean;
}> = ({ skill, onSelect, compact }) => {
  if (compact) {
    return (
      <div
        onClick={() => onSelect(skill)}
        className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700 hover:border-cyan-500/40 cursor-pointer transition-all hover:bg-gray-800/70"
      >
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
          <Code size={18} className="text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white truncate">{skill.name}</p>
            {skill.verified && <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />}
          </div>
          <p className="text-xs text-gray-400 truncate">{skill.owner} • {skill.language || 'Unknown'}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="flex items-center gap-1 text-xs text-yellow-400">
            <Star size={12} fill="currentColor" />
            {skill.stars.toLocaleString()}
          </div>
          <RiskBadge score={skill.riskScore} verified={skill.verified} />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelect(skill)}
      className="bg-gray-800/50 rounded-xl border border-gray-700 hover:border-cyan-500/40 cursor-pointer transition-all hover:bg-gray-800/70 hover:shadow-lg hover:shadow-cyan-500/5 overflow-hidden"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center flex-shrink-0">
              <Code size={22} className="text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white">{skill.name}</h3>
                {skill.verified && <CheckCircle2 size={16} className="text-green-400" />}
              </div>
              <p className="text-xs text-gray-400">{skill.owner}</p>
            </div>
          </div>
          <RiskBadge score={skill.riskScore} verified={skill.verified} />
        </div>

        <p className="text-sm text-gray-300 mb-3 line-clamp-2">{skill.description}</p>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <CategoryBadge slug={skill.categorySlug} />
          {skill.tags.slice(0, 4).map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full text-xs bg-gray-700/50 text-gray-400 border border-gray-600/30">
              {tag}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Star size={14} className="text-yellow-400" fill="currentColor" />
              {skill.stars.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <GitFork size={14} />
              {skill.forks.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Eye size={14} />
              {skill.votesScore || 0}
            </span>
          </div>
          <span className="text-xs text-gray-500">{skill.language || '—'}</span>
        </div>
      </div>
    </div>
  );
};

// ─── Skill Detail ───────────────────────────────────────────

const SkillDetail: React.FC<{
  skill: Skill;
  onBack: () => void;
  onAttachSkill?: (skill: Skill) => void;
}> = ({ skill, onBack, onAttachSkill }) => {
  const [readme, setReadme] = useState<string>('Loading README...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (skill.readmeUrl) {
      fetch(skill.readmeUrl)
        .then((r) => r.ok ? r.text() : Promise.reject('Failed'))
        .then((text) => setReadme(text.slice(0, 3000)))
        .catch(() => setReadme('README not available'))
        .finally(() => setLoading(false));
    } else {
      setReadme('No README available for this skill.');
      setLoading(false);
    }
  }, [skill]);

  const copyClone = () => {
    const cmd = `git clone ${skill.githubUrl}`;
    navigator.clipboard.writeText(cmd);
  };

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to marketplace
      </button>

      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
              <Code size={32} className="text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-xl font-bold text-white">{skill.name}</h2>
                <RiskBadge score={skill.riskScore} verified={skill.verified} />
              </div>
              <p className="text-sm text-gray-400">{skill.owner} • {skill.language || 'Unknown language'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onAttachSkill && (
              <button
                onClick={() => onAttachSkill(skill)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Zap size={16} />
                Attach to My Agent
              </button>
            )}
            <button
              onClick={copyClone}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Copy size={16} />
              Copy Clone
            </button>
            <a
              href={skill.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <ExternalLink size={16} />
              GitHub
            </a>
          </div>
        </div>

        <p className="text-sm text-gray-300 mb-4">{skill.description}</p>

        <div className="flex flex-wrap gap-2 mb-4">
          <CategoryBadge slug={skill.categorySlug} />
          {skill.tags.map((tag) => (
            <span key={tag} className="px-2.5 py-1 rounded-full text-xs bg-gray-700/50 text-gray-400 border border-gray-600/30">
              {tag}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="bg-gray-900/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-yellow-400 mb-1">
              <Star size={16} fill="currentColor" />
              <span className="font-semibold text-white">{skill.stars.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-500">Stars</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
              <GitFork size={16} />
              <span className="font-semibold text-white">{skill.forks.toLocaleString()}</span>
            </div>
            <p className="text-xs text-gray-500">Forks</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-cyan-400 mb-1">
              <Heart size={16} />
              <span className="font-semibold text-white">{skill.upvotes}</span>
            </div>
            <p className="text-xs text-gray-500">Upvotes</p>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3 text-center">
            <div className="flex items-center justify-center gap-1 text-purple-400 mb-1">
              <Shield size={16} />
              <span className="font-semibold text-white">{skill.riskScore}</span>
            </div>
            <p className="text-xs text-gray-500">Risk Score</p>
          </div>
        </div>
      </div>

      {/* README */}
      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-6">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <BookOpen size={16} className="text-cyan-400" />
          README
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader size={16} className="animate-spin" />
            Loading...
          </div>
        ) : (
          <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{readme}</pre>
        )}
      </div>
    </div>
  );
};

// ─── Main Panel ─────────────────────────────────────────────

const StargateSkillsMarketplacePanel: React.FC<{
  onAttachSkill?: (skill: any) => void;
}> = ({ onAttachSkill }) => {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'stars' | 'votes' | 'recent'>('stars');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const perPage = 12;

  const fetchSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/skills?page=${page}&perPage=${perPage}`;
      if (selectedCategory !== 'all') url += `&category=${selectedCategory}`;
      if (searchQuery) url = `/search?query=${encodeURIComponent(searchQuery)}&page=${page}&perPage=${perPage}`;

      const data = await apiGet<any>(url);
      const skillList = data.skills || data.data || [];
      const pag = data.pagination || { page: 1, perPage, total: skillList.length, totalPages: 1, hasNext: false, hasPrev: false };

      setSkills(skillList);
      setPagination(pag);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, selectedCategory, searchQuery]);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await apiGet<any>('/categories');
      setCategories(data.categories || data.data || []);
    } catch (e) {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchCategories();
    fetchSkills();
  }, [fetchSkills, fetchCategories]);

  // Sort skills client-side
  const sortedSkills = [...skills].sort((a, b) => {
    if (sortBy === 'stars') return b.stars - a.stars;
    if (sortBy === 'votes') return (b.votesScore || 0) - (a.votesScore || 0);
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  if (selectedSkill) {
    return (
      <div className="h-full overflow-y-auto p-4">
        <SkillDetail skill={selectedSkill} onBack={() => setSelectedSkill(null)} onAttachSkill={onAttachSkill} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center">
            <Zap size={18} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">Skills Marketplace</h2>
            <p className="text-xs text-gray-500">{pagination?.total || 0} skills indexed</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchSkills()}
            disabled={loading}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={`text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="px-4 py-3 border-b border-gray-700/50 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category filter */}
          <div className="flex items-center gap-1 overflow-x-auto">
            <button
              onClick={() => { setSelectedCategory('all'); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.slug}
                onClick={() => { setSelectedCategory(cat.slug); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedCategory === cat.slug
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 focus:outline-none"
          >
            <option value="stars">Most Stars</option>
            <option value="votes">Most Votes</option>
            <option value="recent">Recently Updated</option>
          </select>

          {/* View toggle */}
          <div className="flex items-center bg-gray-800 rounded-lg border border-gray-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-l-lg transition-colors ${viewMode === 'grid' ? 'bg-cyan-600/30 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-r-lg transition-colors ${viewMode === 'list' ? 'bg-cyan-600/30 text-cyan-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Skills Grid/List */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader size={24} className="text-cyan-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertTriangle size={32} className="text-red-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{error}</p>
              <button
                onClick={fetchSkills}
                className="mt-3 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm rounded-lg"
              >
                Retry
              </button>
            </div>
          </div>
        ) : sortedSkills.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-gray-500">No skills found</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {sortedSkills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} onSelect={setSelectedSkill} />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {sortedSkills.map((skill) => (
              <SkillCard key={skill.id} skill={skill} onSelect={setSelectedSkill} compact />
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination && (
        <div className="px-4 py-3 border-t border-gray-700/50 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Page {pagination.page} of {pagination.totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={!pagination.hasPrev}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!pagination.hasNext}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-lg transition-colors disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StargateSkillsMarketplacePanel;
