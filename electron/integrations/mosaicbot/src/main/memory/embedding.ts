// ─────────────────────────────────────────────────────────────────────────────
// Embedding provider implementations
// Mirrors src/memory/embeddings.ts from OpenMosaic
//
// Supported providers:
//   openai  → api.openai.com (or custom baseUrl, e.g. Azure)
//   ollama  → localhost:11434 (local models via Ollama)
//   none    → FTS-only mode, no embeddings
// ─────────────────────────────────────────────────────────────────────────────

import type { EmbeddingConfig, EmbeddingProvider } from "./types.js";

export async function createEmbeddingProvider(
  cfg: EmbeddingConfig | undefined,
): Promise<EmbeddingProvider> {
  if (!cfg || cfg.provider === "none") return NULL_PROVIDER;

  if (cfg.provider === "openai") {
    const model = cfg.model ?? "text-embedding-3-small";
    const dims = cfg.dimensions ?? 1536;
    const baseUrl = (cfg.baseUrl ?? "https://api.openai.com/v1").replace(
      /\/$/,
      "",
    );
    return {
      id: "openai",
      model,
      dimensions: dims,
      embed: async (texts) =>
        embedOpenAI(baseUrl, cfg.apiKey, model, dims, texts),
    };
  }

  if (cfg.provider === "ollama") {
    const model = cfg.model ?? "nomic-embed-text";
    const baseUrl = (cfg.baseUrl ?? "http://localhost:11434").replace(
      /\/$/,
      "",
    );
    // Probe dimensions on first use if not specified
    let dims = cfg.dimensions ?? 0;
    if (!dims) {
      const probe = await embedOllama(baseUrl, model, [" "]);
      dims = probe[0]?.length ?? 0;
    }
    return {
      id: "ollama",
      model,
      dimensions: dims,
      embed: (texts) => embedOllama(baseUrl, model, texts),
    };
  }

  return NULL_PROVIDER;
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

async function embedOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  dimensions: number,
  texts: string[],
): Promise<number[][]> {
  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input: texts, model, dimensions }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`OpenAI embeddings ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { data: Array<{ embedding: number[] }> };
  return json.data.map((d) => d.embedding);
}

// ── Ollama ────────────────────────────────────────────────────────────────────

async function embedOllama(
  baseUrl: string,
  model: string,
  texts: string[],
): Promise<number[][]> {
  // Ollama /api/embeddings takes one prompt at a time
  const results: number[][] = [];
  for (const text of texts) {
    const res = await fetch(`${baseUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Ollama embeddings ${res.status}: ${body.slice(0, 200)}`);
    }
    const json = (await res.json()) as { embedding: number[] };
    results.push(json.embedding);
  }
  return results;
}

// ── Null provider (FTS-only) ──────────────────────────────────────────────────

export const NULL_PROVIDER: EmbeddingProvider = {
  id: "none",
  model: "none",
  dimensions: 0,
  embed: async () => [],
};
