// ─────────────────────────────────────────────────────────────────────────────
// Codebase Memory Bridge — Connects Mosaic Bot to the codebase-memory MCP
// Queries the knowledge graph for project context, session history, and skills.
// ─────────────────────────────────────────────────────────────────────────────

import { app } from "electron";
import fs from "node:fs";
import path from "node:path";

// ── Config ──────────────────────────────────────────────────────────────────

const MCP_SOCKET_PATH = process.env.MCP_SOCKET_PATH || "/tmp/codebase-memory-mcp.sock";
const MCP_HTTP_URL = process.env.MCP_HTTP_URL || "http://localhost:8765";

// Fallback: direct Neo4j bolt if MCP unavailable
const NEO4J_URI = process.env.NEO4J_URI || "bolt://localhost:7687";
const NEO4J_USER = process.env.NEO4J_USER || "neo4j";
const NEO4J_PASS = process.env.NEO4J_PASS || "";

// ── Types ───────────────────────────────────────────────────────────────────

interface GraphQueryResult {
  qualified_name: string;
  name: string;
  label: string;
  file: string;
  score?: number;
}

interface SessionContext {
  recentSkills: string[];
  recentProjects: string[];
  activeBoxes: string[];
  recentTasks: string[];
  patterns: string[];
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Query the knowledge graph for relevant context about the current project.
 */
export async function queryProjectContext(
  projectName: string,
  query: string,
  limit = 10,
): Promise<GraphQueryResult[]> {
  try {
    const results = await mcpQuery(projectName, query, limit);
    if (results.length > 0) return results;
  } catch (e) {
    console.warn("[MemoryBridge] MCP query failed:", e);
  }

  // Fallback: read from indexed file cache
  return await fileCacheQuery(projectName, query, limit);
}

/**
 * Get recent session context — skills touched, projects worked on.
 */
export async function getRecentSessionContext(userId = "mauricio"): Promise<SessionContext> {
  const context: SessionContext = {
    recentSkills: [],
    recentProjects: [],
    activeBoxes: [],
    recentTasks: [],
    patterns: [],
  };

  try {
    // Query for recently modified skills (from .hermes index)
    const skillResults = await mcpCypherQuery(`
      MATCH (s:Skill)
      WHERE s.last_accessed > datetime() - duration('P7D')
      RETURN s.name AS name, s.category AS category
      ORDER BY s.last_accessed DESC
      LIMIT 20
    `);
    context.recentSkills = skillResults.map((r) => r.name).filter(Boolean);

    // Query for active projects
    const projectResults = await mcpCypherQuery(`
      MATCH (p:Project)
      WHERE p.last_accessed > datetime() - duration('P30D')
      RETURN p.name AS name
      ORDER BY p.last_accessed DESC
      LIMIT 10
    `);
    context.recentProjects = projectResults.map((r) => r.name).filter(Boolean);

    // Load learned patterns from bot storage
    const patternsFile = path.join(app.getPath("userData"), "mosaicbot", "learned-patterns.json");
    if (fs.existsSync(patternsFile)) {
      context.patterns = JSON.parse(fs.readFileSync(patternsFile, "utf-8"));
    }
  } catch (e) {
    console.warn("[MemoryBridge] Failed to query session context:", e);
  }

  return context;
}

/**
 * Index a Hermes session summary into the knowledge graph.
 */
export async function indexSessionSummary(
  sessionId: string,
  summary: string,
  skillsCreated: string[],
  projectsTouched: string[],
): Promise<void> {
  // 1. Save to local vault for immediate bot access
  const vaultEntry = {
    id: `session-${sessionId}`,
    label: "Session Summary",
    content: summary,
    metadata: {
      skillsCreated,
      projectsTouched,
      indexedAt: Date.now(),
    },
  };

  const vaultDir = path.join(app.getPath("userData"), "mosaicbot", "session-vault");
  fs.mkdirSync(vaultDir, { recursive: true });
  fs.writeFileSync(
    path.join(vaultDir, `${sessionId}.json`),
    JSON.stringify(vaultEntry, null, 2),
  );

  // 2. Try to index into codebase-memory MCP (best effort)
  try {
    await mcpIngestTraces([{
      project: "home-mauricio-.hermes",
      events: [
        {
          type: "session",
          name: sessionId,
          description: summary,
          timestamp: new Date().toISOString(),
          skills: skillsCreated,
          projects: projectsTouched,
        },
      ],
    }]);
  } catch (e) {
    console.warn("[MemoryBridge] Failed to index into MCP:", e);
  }

  console.log(`[MemoryBridge] Indexed session ${sessionId} — ${skillsCreated.length} skills, ${projectsTouched.length} projects`);
}

/**
 * Get all skills from the knowledge graph (for auto-import).
 */
export async function getAllSkillsFromGraph(): Promise<
  { name: string; category: string; description: string; path: string }[]
> {
  try {
    const results = await mcpCypherQuery(`
      MATCH (s:Skill)
      RETURN s.name AS name, s.category AS category,
             s.description AS description, s.file AS path
      ORDER BY s.category, s.name
    `);
    return (results as any[]).filter((r) => r?.name).map((r) => ({
      name: r.name || "",
      category: r.category || "",
      description: r.description || "",
      path: r.path || "",
    }));
  } catch (e) {
    console.warn("[MemoryBridge] Failed to query skills:", e);
    return [];
  }
}

// ── Internal — MCP Communication ──────────────────────────────────────────────

async function mcpQuery(
  project: string,
  query: string,
  limit: number,
): Promise<GraphQueryResult[]> {
  // Try HTTP first, then socket
  const urls = [
    `${MCP_HTTP_URL}/query`,
    `http://localhost:8765/query`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, query, limit }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        return data.results || [];
      }
    } catch { /* try next */ }
  }

  return [];
}

async function mcpCypherQuery(cypher: string): Promise<any[]> {
  const urls = [
    `${MCP_HTTP_URL}/query`,
    `http://localhost:8765/query`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cypher }),
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        return data.results || [];
      }
    } catch { /* try next */ }
  }

  return [];
}

async function mcpIngestTraces(traces: any[]): Promise<void> {
  const urls = [
    `${MCP_HTTP_URL}/ingest`,
    `http://localhost:8765/ingest`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ traces }),
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return;
    } catch { /* try next */ }
  }

  throw new Error("All MCP endpoints unavailable");
}

// ── Internal — File Cache Fallback ────────────────────────────────────────────

async function fileCacheQuery(
  project: string,
  query: string,
  limit: number,
): Promise<GraphQueryResult[]> {
  // Read from local session vault
  const vaultDir = path.join(app.getPath("userData"), "mosaicbot", "session-vault");
  if (!fs.existsSync(vaultDir)) return [];

  const files = fs.readdirSync(vaultDir).filter((f) => f.endsWith(".json"));
  const results: GraphQueryResult[] = [];

  for (const file of files.slice(-limit)) {
    try {
      const entry = JSON.parse(fs.readFileSync(path.join(vaultDir, file), "utf-8"));
      if (entry.content.toLowerCase().includes(query.toLowerCase())) {
        results.push({
          qualified_name: entry.id,
          name: entry.label,
          label: "Session",
          file: file,
          score: 0.5,
        });
      }
    } catch { /* ignore */ }
  }

  return results;
}
