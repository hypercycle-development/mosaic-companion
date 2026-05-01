// ─────────────────────────────────────────────────────────────────────────────
// Hybrid search scoring: vector + BM25 merge, temporal decay, MMR re-ranking
// Mirrors src/memory/hybrid.ts + temporal-decay.ts + mmr.ts from OpenMosaic
// ─────────────────────────────────────────────────────────────────────────────

// ── FTS helpers ───────────────────────────────────────────────────────────────

/**
 * Convert BM25 rank (negative, lower=better) to a score in (0, 1].
 * Mirrors bm25RankToScore() in hybrid.ts.
 */
export function bm25RankToScore(rank: number): number {
  const normalized = Number.isFinite(rank) ? Math.max(0, -rank) : 0;
  return 1 / (1 + normalized);
}

/**
 * Build an FTS5 MATCH query from a natural-language string.
 * Tokens are Unicode word characters joined with AND.
 * Mirrors buildFtsQuery() in manager-search.ts.
 */
export function buildFtsQuery(raw: string): string | null {
  const tokens =
    raw
      .match(/[\p{L}\p{N}_]+/gu)
      ?.map((t) => t.trim())
      .filter(Boolean) ?? [];
  if (tokens.length === 0) return null;
  return tokens.map((t) => `"${t.replaceAll('"', "")}"`).join(" AND ");
}

// ── Merge ─────────────────────────────────────────────────────────────────────

export type VectorRow = {
  id: string;
  path: string;
  source: string;
  startLine: number;
  endLine: number;
  text: string;
  score: number; // cosine similarity, 0–1
};

export type KeywordRow = {
  id: string;
  path: string;
  source: string;
  startLine: number;
  endLine: number;
  text: string;
  rank: number; // BM25 rank (negative)
};

export type ScoredChunk = VectorRow & {
  vectorScore: number;
  textScore: number;
  finalScore: number;
};

/**
 * Merge vector and keyword results into a single ranked list.
 * finalScore = vectorWeight * vectorScore + textWeight * textScore
 * Mirrors mergeHybridResults() in hybrid.ts.
 */
export function mergeResults(
  vector: VectorRow[],
  keyword: KeywordRow[],
  weights: { vector: number; text: number },
): ScoredChunk[] {
  const byId = new Map<string, ScoredChunk>();

  for (const r of vector) {
    byId.set(r.id, {
      ...r,
      vectorScore: r.score,
      textScore: 0,
      finalScore: weights.vector * r.score,
    });
  }

  for (const r of keyword) {
    const ts = bm25RankToScore(r.rank);
    const existing = byId.get(r.id);
    if (existing) {
      existing.textScore = ts;
      existing.finalScore =
        weights.vector * existing.vectorScore + weights.text * ts;
    } else {
      byId.set(r.id, {
        ...r,
        score: 0,
        vectorScore: 0,
        textScore: ts,
        finalScore: weights.text * ts,
      });
    }
  }

  return [...byId.values()].sort((a, b) => b.finalScore - a.finalScore);
}

// ── Temporal decay ────────────────────────────────────────────────────────────

/**
 * Apply exponential decay to scores based on file age.
 * decayedScore = score × e^(-λ × ageInDays),  λ = ln(2) / halfLifeDays
 *
 * Only dated files (memory/YYYY-MM-DD.md) decay.
 * Evergreen files (MEMORY.md, undated memory/*.md) are unchanged.
 *
 * Mirrors calculateTemporalDecayMultiplier() in temporal-decay.ts.
 */
export function applyTemporalDecay(
  chunks: ScoredChunk[],
  halfLifeDays: number,
  nowMs: number = Date.now(),
): ScoredChunk[] {
  const lambda = Math.LN2 / halfLifeDays;

  return chunks
    .map((c) => {
      const date = extractDateFromPath(c.path);
      if (!date) return c; // evergreen — no decay
      const ageInDays = (nowMs - date.getTime()) / 86_400_000;
      const multiplier = Math.exp(-lambda * Math.max(0, ageInDays));
      return { ...c, finalScore: c.finalScore * multiplier };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

// Extracts date from paths like "memory/2024-12-25.md"
function extractDateFromPath(filePath: string): Date | null {
  const m = filePath.match(/(\d{4}-\d{2}-\d{2})\.md$/);
  if (!m) return null;
  const d = new Date(`${m[1]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── MMR (Maximal Marginal Relevance) ──────────────────────────────────────────

/**
 * Re-rank chunks to balance relevance vs diversity.
 *   mmrScore = λ × relevance − (1−λ) × maxSimilarity
 * where similarity = Jaccard on alphanumeric tokens.
 *
 * λ=1.0 → pure relevance, λ=0.0 → pure diversity.
 * Mirrors applyMMR() in mmr.ts.
 */
export function applyMMR(
  chunks: ScoredChunk[],
  lambda: number,
  maxResults: number,
): ScoredChunk[] {
  if (chunks.length <= 1) return chunks.slice(0, maxResults);

  // Normalise scores to [0, 1] for fair MMR comparison
  const scores = chunks.map((c) => c.finalScore);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const normed = chunks.map((c, i) => ({
    chunk: c,
    norm: (scores[i] - min) / range,
  }));

  const tokenSets = chunks.map((c) => tokenize(c.text));
  const selected: number[] = []; // indices into normed/tokenSets
  const remaining = new Set(normed.map((_, i) => i));

  while (selected.length < maxResults && remaining.size > 0) {
    let bestIdx = -1;
    let bestScore = -Infinity;

    for (const i of remaining) {
      const relevance = normed[i].norm;
      const maxSim =
        selected.length === 0
          ? 0
          : Math.max(
              ...selected.map((s) => jaccard(tokenSets[i], tokenSets[s])),
            );
      const mmrScore = lambda * relevance - (1 - lambda) * maxSim;

      if (
        mmrScore > bestScore ||
        (mmrScore === bestScore &&
          chunks[i].finalScore > chunks[bestIdx]?.finalScore)
      ) {
        bestScore = mmrScore;
        bestIdx = i;
      }
    }

    if (bestIdx < 0) break;
    selected.push(bestIdx);
    remaining.delete(bestIdx);
  }

  return selected.map((i) => chunks[i]);
}

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9_]+/g) ?? []);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  return intersection / (a.size + b.size - intersection);
}
