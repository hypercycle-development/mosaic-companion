// ─────────────────────────────────────────────────────────────────────────────
// Mosaic Wiki — Persistent markdown knowledge base
// Adapted from Hermes llm-wiki skill (PR #5100, Karpathy pattern)
//
// Three-layer architecture:
//   Layer 1 (raw/): Immutable source material (chat logs, code, docs)
//   Layer 2 (entities/, concepts/, comparisons/, queries/): Agent-owned pages
//   Layer 3 (SCHEMA.md): Conventions, structure, domain config
//
// Operations: init, ingest, query, lint
// ─────────────────────────────────────────────────────────────────────────────

import path from "node:path";
import fs from "node:fs";

// ── Config ──────────────────────────────────────────────────────────────────

export const WIKI_DIR = path.join(
  process.env.MOSAIC_WIKI_PATH || "",
  process.env.MOSAIC_WIKI_PATH ? "" : path.join(".", "wiki")
);

// Resolve relative to mosaicbot data dir when env not set
export function resolveWikiDir(mosaicBotDir: string): string {
  if (process.env.MOSAIC_WIKI_PATH) return process.env.MOSAIC_WIKI_PATH;
  return path.join(mosaicBotDir, "wiki");
}

// ── Initialization ──────────────────────────────────────────────────────────

export function initWiki(wikiDir: string): void {
  if (fs.existsSync(path.join(wikiDir, "SCHEMA.md"))) return; // already initialized

  fs.mkdirSync(wikiDir, { recursive: true });

  const dirs = [
    "raw/sessions",
    "raw/code",
    "raw/docs",
    "entities/hypercycle",
    "entities/midnight",
    "entities/mosaic",
    "concepts/blockchain",
    "concepts/ai-agency",
    "concepts/devops",
    "comparisons",
    "queries",
  ];
  for (const d of dirs) {
    fs.mkdirSync(path.join(wikiDir, d), { recursive: true });
  }

  fs.writeFileSync(path.join(wikiDir, "SCHEMA.md"), buildSchemaMd(), "utf-8");
  fs.writeFileSync(path.join(wikiDir, "index.md"), buildIndexMd(), "utf-8");
  fs.writeFileSync(path.join(wikiDir, "log.md"), buildLogMd(), "utf-8");

  console.log(`[MosaicWiki] Initialized at ${wikiDir}`);
}

// ── Core Operations ─────────────────────────────────────────────────────────

/** Ingest a source into the wiki */
export function ingestSource(
  wikiDir: string,
  source: {
    type: "session" | "code" | "doc";
    title: string;
    content: string;
    entities?: string[]; // entity slugs to cross-reference
    concepts?: string[]; // concept slugs to cross-reference
  },
): void {
  const date = new Date().toISOString().split("T")[0];
  const slug = slugify(source.title);

  // 1. Save raw source
  const rawDir = path.join(wikiDir, "raw", source.type + "s");
  fs.mkdirSync(rawDir, { recursive: true });
  const rawPath = path.join(rawDir, `${date}-${slug}.md`);
  fs.writeFileSync(rawPath, source.content, "utf-8");

  // 2. Update log
  appendLog(wikiDir, `${date} | ingest | ${source.type} | ${source.title}`);

  // 3. Cross-reference: update entity pages
  for (const entity of source.entities || []) {
    touchEntityPage(wikiDir, entity, { backlink: slug, date });
  }

  // 4. Cross-reference: update concept pages
  for (const concept of source.concepts || []) {
    touchConceptPage(wikiDir, concept, { backlink: slug, date });
  }
}

/** Query the wiki for relevant pages */
export function queryWiki(wikiDir: string, query: string): WikiPage[] {
  const idx = readIndex(wikiDir);
  const results: WikiPage[] = [];

  // Simple keyword match (can be enhanced with FTS)
  const terms = query.toLowerCase().split(/\s+/);
  for (const page of idx.pages) {
    const text = `${page.title} ${page.summary} ${page.tags.join(" ")}`.toLowerCase();
    const score = terms.filter((t) => text.includes(t)).length;
    if (score > 0) results.push({ ...page, _score: score });
  }

  return results.sort((a, b) => (b._score || 0) - (a._score || 0));
}

/** Read a wiki page */
export function readWikiPage(wikiDir: string, pagePath: string): string | null {
  const abs = path.join(wikiDir, pagePath);
  if (!fs.existsSync(abs)) return null;
  return fs.readFileSync(abs, "utf-8");
}

/** Build context string from query results for LLM injection */
export function buildWikiContext(wikiDir: string, query: string, maxPages = 3): string {
  const pages = queryWiki(wikiDir, query).slice(0, maxPages);
  if (pages.length === 0) return "";

  const lines = ["## Mosaic Wiki Knowledge", ""];
  for (const p of pages) {
    const content = readWikiPage(wikiDir, p.path);
    if (!content) continue;
    // Strip YAML frontmatter for injection
    const body = content.replace(/^---\n[\s\S]*?\n---\n*/, "").slice(0, 800);
    lines.push(`### ${p.title}`);
    lines.push(body);
    lines.push("");
  }
  return lines.join("\n");
}

// ── Internal helpers ────────────────────────────────────────────────────────

function buildSchemaMd(): string {
  return `---
title: Mosaic Wiki Schema
created: ${new Date().toISOString().split("T")[0]}
type: schema
---

# Mosaic Wiki Schema

## Domain
AI/ML research, HyperCycle node operations, Midnight blockchain development,
Mosaic Companion ecosystem intelligence.

## Conventions
- File names: lowercase, hyphens, no spaces (e.g., \`hypercycle-node-factory.md\`)
- Every wiki page starts with YAML frontmatter block:
  \`\`\`yaml
  ---
  title: Page Title
  created: YYYY-MM-DD
  updated: YYYY-MM-DD
  type: entity | concept | comparison | query | summary
  tags: [tag1, tag2]
  sources: [raw/sessions/2026-07-09-discussion.md]
  ---
  \`\`\`
- Use \`[[wikilinks]]\` to link between pages
- When updating a page, always bump the \`updated\` date
- Every new page must be added to \`index.md\`
- Every action must be appended to \`log.md\`

## Entity Pages
One page per notable entity (person, company, model, node, box). Include:
- Overview / what it is
- Key facts and dates
- Relationships to other entities
- Source references

## Concept Pages
One page per concept or topic. Include:
- Definition / explanation
- Current state of knowledge
- Open questions or debates
- Related concepts (wikilinks)

## Comparison Pages
Side-by-side analyses. Include:
- What is being compared and why
- Dimensions of comparison (table format preferred)
- Verdict or synthesis
- Sources
`;
}

function buildIndexMd(): string {
  return `---
title: Mosaic Wiki Index
created: ${new Date().toISOString().split("T")[0]}
updated: ${new Date().toISOString().split("T")[0]}
type: index
---

# Mosaic Wiki Index

> Content catalog. Every wiki page with a one-line summary.
> Read this first to find relevant files for any query.

## Entities
<!-- entity pages listed here -->

## Concepts
<!-- concept pages listed here -->

## Comparisons
<!-- comparison pages listed here -->

## Queries
<!-- filed query results listed here -->
`;
}

function buildLogMd(): string {
  return `---
title: Mosaic Wiki Log
created: ${new Date().toISOString().split("T")[0]}
type: log
---

# Mosaic Wiki Log

> Chronological record of all wiki actions. Append-only.
> Format: \`YYYY-MM-DD | action | type | subject\`
> Actions: ingest, update, query, lint, create, delete

${new Date().toISOString().split("T")[0]} | create | wiki | Mosaic Wiki initialized
`;
}

function appendLog(wikiDir: string, entry: string): void {
  const logPath = path.join(wikiDir, "log.md");
  fs.appendFileSync(logPath, `\n${entry}\n`, "utf-8");
}

function touchEntityPage(
  wikiDir: string,
  slug: string,
  opts: { backlink: string; date: string },
): void {
  // Try hypercycle first, then midnight, then mosaic
  const dirs = ["entities/hypercycle", "entities/midnight", "entities/mosaic"];
  let existing: string | null = null;
  for (const d of dirs) {
    const p = path.join(wikiDir, d, `${slug}.md`);
    if (fs.existsSync(p)) { existing = p; break; }
  }

  if (existing) {
    // Append backlink
    fs.appendFileSync(existing, `\n- Referenced by: [[${opts.backlink}]] (${opts.date})\n`, "utf-8");
  } else {
    // Create new entity page in mosaic folder by default
    const p = path.join(wikiDir, "entities/mosaic", `${slug}.md`);
    fs.writeFileSync(
      p,
      `---\ntitle: ${slug.replace(/-/g, " ")}\ncreated: ${opts.date}\nupdated: ${opts.date}\ntype: entity\ntags: []\nsources: []\n---\n\n# ${slug.replace(/-/g, " ")}\n\n_Entity page auto-created from ingestion._\n\n- Referenced by: [[${opts.backlink}]] (${opts.date})\n`,
      "utf-8",
    );
    // Update index
    appendToIndex(wikiDir, "Entities", slug, p.replace(wikiDir + path.sep, ""));
  }
}

function touchConceptPage(
  wikiDir: string,
  slug: string,
  opts: { backlink: string; date: string },
): void {
  const dirs = ["concepts/blockchain", "concepts/ai-agency", "concepts/devops"];
  let existing: string | null = null;
  for (const d of dirs) {
    const p = path.join(wikiDir, d, `${slug}.md`);
    if (fs.existsSync(p)) { existing = p; break; }
  }

  if (existing) {
    fs.appendFileSync(existing, `\n- Referenced by: [[${opts.backlink}]] (${opts.date})\n`, "utf-8");
  } else {
    const p = path.join(wikiDir, "concepts/ai-agency", `${slug}.md`);
    fs.writeFileSync(
      p,
      `---\ntitle: ${slug.replace(/-/g, " ")}\ncreated: ${opts.date}\nupdated: ${opts.date}\ntype: concept\ntags: []\nsources: []\n---\n\n# ${slug.replace(/-/g, " ")}\n\n_Concept page auto-created from ingestion._\n\n- Referenced by: [[${opts.backlink}]] (${opts.date})\n`,
      "utf-8",
    );
    appendToIndex(wikiDir, "Concepts", slug, p.replace(wikiDir + path.sep, ""));
  }
}

function appendToIndex(wikiDir: string, section: string, slug: string, pagePath: string): void {
  const idxPath = path.join(wikiDir, "index.md");
  let content = fs.readFileSync(idxPath, "utf-8");
  const marker = `## ${section}`;
  const entry = `- [${slug}](${pagePath}) — _auto-created entity page_`;
  if (content.includes(entry)) return;
  content = content.replace(marker, `${marker}\n${entry}`);
  fs.writeFileSync(idxPath, content, "utf-8");
}

function readIndex(wikiDir: string): { pages: WikiPage[] } {
  const idxPath = path.join(wikiDir, "index.md");
  if (!fs.existsSync(idxPath)) return { pages: [] };

  const content = fs.readFileSync(idxPath, "utf-8");
  const pages: WikiPage[] = [];

  // Parse markdown links: - [title](path) — summary
  const linkRe = /^- \[([^\]]+)\]\(([^)]+)\)\s*(?:—\s*(.*))?$/gm;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(content)) !== null) {
    pages.push({ title: m[1], path: m[2], summary: m[3] || "", tags: [] });
  }
  return { pages };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Types ───────────────────────────────────────────────────────────────────

type WikiPage = {
  title: string;
  path: string;
  summary: string;
  tags: string[];
  _score?: number;
};
