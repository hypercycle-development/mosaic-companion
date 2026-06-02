/**
 * Internal Marketplace Service — zero-dependency HTTP server
 *
 * Mirrors the standalone stargate-marketplace REST API but runs inside
 * Mosaic Companion's main process. Data is persisted to a JSON file in
 * the user's app data directory and loaded into memory on startup.
 *
 * Routes:
 *   GET  /api/categories          → list categories with skill counts
 *   GET  /api/skills              → list skills (pagination, search, category, sort)
 *   GET  /api/skills/:slug        → single skill detail
 *   GET  /api/search?query=...    → search skills by name/description/tags
 *   GET  /api/health              → service status
 *
 * Port: 13000 (override via STARGATE_INTERNAL_MARKETPLACE_PORT env var)
 */

import { app } from "electron";
import * as http from "node:http";
import * as fs from "node:fs";
import * as path from "node:path";

// ── Types ──────────────────────────────────────────────────────────────────

interface Category {
  slug: string;
  name: string;
  description: string;
  icon?: string;
}

interface Skill {
  id: number;
  slug: string;
  name: string;
  owner: string;
  description: string;
  readme?: string;
  stars: number;
  forks: number;
  language?: string;
  categorySlug?: string;
  tags: string[];
  githubUrl: string;
  verified: boolean;
  riskScore: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
  votesScore?: number;
  upvotes?: number;
  downvotes?: number;
  _count?: { votes: number; bookmarks: number };
}

interface MarketplaceData {
  categories: Category[];
  skills: Skill[];
  nextId: number;
}

interface PaginationInfo {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ── Persistence ──────────────────────────────────────────────────────────────

const DATA_FILE = path.join(
  app?.getPath?.("userData") || require("node:os").tmpdir(),
  "stargate-marketplace.json",
);

let inMemory: MarketplaceData = { categories: [], skills: [], nextId: 1 };

function loadData(): MarketplaceData {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.categories) && Array.isArray(parsed.skills)) {
        return parsed as MarketplaceData;
      }
    }
  } catch {
    // corrupted or missing — seed fresh
  }
  return seedData();
}

function saveData(): void {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(inMemory, null, 2), "utf-8");
  } catch (err) {
    console.error("[MarketplaceService] Failed to persist data:", err);
  }
}

// ── Seed Data (same as standalone backend) ─────────────────────────────────

function seedData(): MarketplaceData {
  const categories: Category[] = [
    { slug: "ai-agents", name: "AI Agents", description: "Autonomous AI agent skills and frameworks", icon: "bot" },
    { slug: "mcp-servers", name: "MCP Servers", description: "Model Context Protocol server implementations", icon: "server" },
    { slug: "cli-tools", name: "CLI Tools", description: "Command-line interface tools and utilities", icon: "terminal" },
    { slug: "ide-extensions", name: "IDE Extensions", description: "IDE plugins and editor extensions", icon: "code" },
    { slug: "devops", name: "DevOps", description: "Deployment, CI/CD, and infrastructure tools", icon: "cloud" },
    { slug: "testing", name: "Testing", description: "Test frameworks, assertions, and QA tools", icon: "check-circle" },
    { slug: "data-processing", name: "Data Processing", description: "ETL, data transformation, and analytics skills", icon: "database" },
    { slug: "documentation", name: "Documentation", description: "Docs generation, parsing, and formatting tools", icon: "file-text" },
    { slug: "code-generation", name: "Code Generation", description: "Code generation, scaffolding, and boilerplate", icon: "zap" },
    { slug: "api-integration", name: "API Integration", description: "API clients, SDKs, and integration tools", icon: "plug" },
  ];

  const skills: Skill[] = [
    { id: 1, slug: "hermes-agent", name: "Hermes Agent", owner: "NousResearch", description: "Advanced AI agent with tool-calling capabilities and flexible skill system.", stars: 2450, forks: 312, language: "TypeScript", categorySlug: "ai-agents", tags: ["agent", "tools", "typescript"], githubUrl: "https://github.com/NousResearch/Hermes-Agent", verified: true, riskScore: 12, published: true, createdAt: "2024-01-15T00:00:00Z", updatedAt: "2024-06-01T00:00:00Z", upvotes: 245, downvotes: 3, votesScore: 242 },
    { id: 2, slug: "stargate-mcp", name: "Stargate MCP", owner: "MosaicLabs", description: "MCP server for Stargate dashboard integration with agent orchestration.", stars: 892, forks: 145, language: "Python", categorySlug: "mcp-servers", tags: ["mcp", "server", "python"], githubUrl: "https://github.com/MosaicLabs/stargate-mcp", verified: true, riskScore: 8, published: true, createdAt: "2024-02-20T00:00:00Z", updatedAt: "2024-05-15T00:00:00Z", upvotes: 89, downvotes: 1, votesScore: 88 },
    { id: 3, slug: "codex-cli", name: "Codex CLI", owner: "OpenAI", description: "AI-powered coding assistant for the terminal.", stars: 15200, forks: 890, language: "TypeScript", categorySlug: "cli-tools", tags: ["cli", "coding", "openai"], githubUrl: "https://github.com/openai/codex", verified: true, riskScore: 15, published: true, createdAt: "2024-01-10T00:00:00Z", updatedAt: "2024-06-10T00:00:00Z", upvotes: 1520, downvotes: 10, votesScore: 1510 },
    { id: 4, slug: "claude-code", name: "Claude Code", owner: "Anthropic", description: "Agentic coding tool that lives in your terminal.", stars: 18700, forks: 1200, language: "TypeScript", categorySlug: "cli-tools", tags: ["cli", "agentic", "anthropic"], githubUrl: "https://github.com/anthropics/claude-code", verified: true, riskScore: 10, published: true, createdAt: "2024-01-05T00:00:00Z", updatedAt: "2024-06-12T00:00:00Z", upvotes: 1870, downvotes: 5, votesScore: 1865 },
    { id: 5, slug: "vscode-ai", name: "VS Code AI", owner: "Microsoft", description: "AI extensions for Visual Studio Code.", stars: 5600, forks: 430, language: "TypeScript", categorySlug: "ide-extensions", tags: ["vscode", "editor", "microsoft"], githubUrl: "https://github.com/microsoft/vscode-ai", verified: false, riskScore: 35, published: true, createdAt: "2024-03-01T00:00:00Z", updatedAt: "2024-05-20T00:00:00Z", upvotes: 560, downvotes: 20, votesScore: 540 },
    { id: 6, slug: "docker-deploy", name: "Docker Deploy", owner: "Docker", description: "Automated container deployment skills for Stargate.", stars: 3400, forks: 210, language: "Go", categorySlug: "devops", tags: ["docker", "deploy", "go"], githubUrl: "https://github.com/docker/deploy", verified: true, riskScore: 5, published: true, createdAt: "2024-02-01T00:00:00Z", updatedAt: "2024-05-25T00:00:00Z", upvotes: 340, downvotes: 2, votesScore: 338 },
    { id: 7, slug: "pytest-ai", name: "Pytest AI", owner: "pytest-dev", description: "AI-enhanced testing framework with intelligent test generation.", stars: 1200, forks: 89, language: "Python", categorySlug: "testing", tags: ["pytest", "testing", "python"], githubUrl: "https://github.com/pytest-dev/pytest-ai", verified: false, riskScore: 42, published: true, createdAt: "2024-03-15T00:00:00Z", updatedAt: "2024-05-10T00:00:00Z", upvotes: 120, downvotes: 8, votesScore: 112 },
    { id: 8, slug: "json-etl", name: "JSON ETL", owner: "data-labs", description: "Lightweight ETL pipeline for JSON data transformation.", stars: 780, forks: 56, language: "JavaScript", categorySlug: "data-processing", tags: ["etl", "json", "javascript"], githubUrl: "https://github.com/data-labs/json-etl", verified: true, riskScore: 18, published: true, createdAt: "2024-04-01T00:00:00Z", updatedAt: "2024-05-30T00:00:00Z", upvotes: 78, downvotes: 2, votesScore: 76 },
  ];

  const data: MarketplaceData = { categories, skills, nextId: skills.length + 1 };
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    // best effort
  }
  return data;
}

// ── Request Helpers ────────────────────────────────────────────────────────

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function parseQuery(url: string): Record<string, string> {
  const q: Record<string, string> = {};
  const idx = url.indexOf("?");
  if (idx === -1) return q;
  const params = new URLSearchParams(url.slice(idx + 1));
  params.forEach((v, k) => { q[k] = v; });
  return q;
}

// ── Route Handlers ─────────────────────────────────────────────────────────

function handleCategories(res: http.ServerResponse): void {
  const categories = inMemory.categories.map((c) => ({
    ...c,
    _count: { skills: inMemory.skills.filter((s) => s.categorySlug === c.slug && s.published).length },
  }));
  sendJson(res, 200, { categories });
}

function handleSkillsList(res: http.ServerResponse, query: Record<string, string>): void {
  const page = Math.max(1, parseInt(query.page || "1", 10));
  const perPage = Math.max(1, Math.min(100, parseInt(query.perPage || query.limit || "12", 10)));
  const category = query.category || query.categorySlug;
  const search = (query.search || query.query || "").toLowerCase();
  const sort = query.sort || "stars";
  const order = query.order || "desc";

  let filtered = inMemory.skills.filter((s) => s.published);
  if (category) filtered = filtered.filter((s) => s.categorySlug === category);
  if (search) {
    filtered = filtered.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.description.toLowerCase().includes(search) ||
        s.tags.some((t) => t.toLowerCase().includes(search)),
    );
  }

  filtered.sort((a, b) => {
    let cmp = 0;
    if (sort === "stars") cmp = a.stars - b.stars;
    else if (sort === "recent") cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    else if (sort === "name") cmp = a.name.localeCompare(b.name);
    else if (sort === "votes") cmp = (a.votesScore || 0) - (b.votesScore || 0);
    else cmp = a.stars - b.stars;
    return order === "asc" ? cmp : -cmp;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const offset = (page - 1) * perPage;
  const pageSkills = filtered.slice(offset, offset + perPage);

  const pagination: PaginationInfo = {
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };

  sendJson(res, 200, { skills: pageSkills, pagination });
}

function handleSkillDetail(res: http.ServerResponse, slug: string): void {
  const skill = inMemory.skills.find((s) => s.slug === slug);
  if (!skill) {
    sendJson(res, 404, { error: "Skill not found" });
    return;
  }
  sendJson(res, 200, skill);
}

function handleSearch(res: http.ServerResponse, query: Record<string, string>): void {
  // search endpoint uses same logic as skills list with query param
  handleSkillsList(res, query);
}

function handleHealth(res: http.ServerResponse): void {
  sendJson(res, 200, {
    status: "ok",
    service: "stargate-marketplace-internal",
    skills: inMemory.skills.length,
    categories: inMemory.categories.length,
  });
}

// ── Server Factory ─────────────────────────────────────────────────────────

export function createMarketplaceServer(port?: number): http.Server {
  inMemory = loadData();

  const server = http.createServer((req, res) => {
    // CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = req.url || "/";
    const query = parseQuery(url);

    // Route matching (simple prefix)
    if (url.startsWith("/api/categories")) {
      handleCategories(res);
      return;
    }
    if (url.startsWith("/api/search")) {
      handleSearch(res, query);
      return;
    }
    if (url.startsWith("/api/skills/")) {
      const slug = url.replace("/api/skills/", "").split("?")[0];
      handleSkillDetail(res, slug);
      return;
    }
    if (url.startsWith("/api/skills")) {
      handleSkillsList(res, query);
      return;
    }
    if (url === "/api/health" || url === "/health") {
      handleHealth(res);
      return;
    }

    sendJson(res, 404, { error: "Not found", path: url });
  });

  const listenPort = port || parseInt(process.env.STARGATE_INTERNAL_MARKETPLACE_PORT || "13000", 10);
  server.listen(listenPort, "127.0.0.1", () => {
    console.log(`[MarketplaceService] Running on http://127.0.0.1:${listenPort}/api`);
  });

  return server;
}

// ── Lifecycle ──────────────────────────────────────────────────────────────

let activeServer: http.Server | null = null;

export function startMarketplaceService(port?: number): http.Server {
  if (activeServer) {
    console.warn("[MarketplaceService] Already running; returning existing server");
    return activeServer;
  }
  activeServer = createMarketplaceServer(port);
  return activeServer;
}

export function stopMarketplaceService(): void {
  if (activeServer) {
    activeServer.close(() => {
      console.log("[MarketplaceService] Stopped");
    });
    activeServer = null;
  }
}

export function getMarketplaceBaseUrl(): string {
  const port = parseInt(process.env.STARGATE_INTERNAL_MARKETPLACE_PORT || "13000", 10);
  return `http://127.0.0.1:${port}/api`;
}
