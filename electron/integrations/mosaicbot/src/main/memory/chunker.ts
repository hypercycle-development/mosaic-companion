// ─────────────────────────────────────────────────────────────────────────────
// Markdown text chunker
// Mirrors src/memory/embedding-chunk-limits.ts from OpenMosaic
//
// Algorithm:
//   - Split content by newlines; split any line exceeding maxBytes into segments
//   - Accumulate segments until currentBytes > maxBytes (≈ tokens * 4)
//   - Flush: emit chunk with startLine/endLine and sha256(text) as id
//   - Carry over last overlapBytes of previous chunk as context prefix
// ─────────────────────────────────────────────────────────────────────────────

import crypto from "node:crypto";
import type { MemoryChunk, MemorySource } from "./types.js";

export type ChunkingConfig = {
  tokens: number; // target chunk size (~4 UTF-8 bytes per token)
  overlap: number; // overlap with previous chunk in tokens
};

const DEFAULTS: ChunkingConfig = { tokens: 400, overlap: 80 };

export function chunkText(
  content: string,
  filePath: string,
  source: MemorySource,
  cfg: Partial<ChunkingConfig> = {},
): MemoryChunk[] {
  const { tokens, overlap } = { ...DEFAULTS, ...cfg };
  const maxBytes = Math.max(32, tokens * 4);
  const overlapBytes = Math.max(0, overlap * 4);

  // Normalise to split-safe lines
  const rawLines = content.split("\n");
  const lines: string[] = [];
  for (const line of rawLines) {
    if (Buffer.byteLength(line, "utf8") <= maxBytes) {
      lines.push(line);
    } else {
      lines.push(...splitToByteLimit(line, maxBytes));
    }
  }

  const chunks: MemoryChunk[] = [];
  let current: string[] = [];
  let currentBytes = 0;
  let startLine = 1; // 1-indexed

  const flush = (endLine: number) => {
    const text = current.join("\n").trim();
    if (!text) return;
    const textHash = sha256(text);
    const id = sha256(`${filePath}:${startLine}:${endLine}:${textHash}`);
    chunks.push({
      id,
      path: filePath,
      source,
      startLine,
      endLine,
      hash: textHash,
      text,
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineBytes = Buffer.byteLength(line, "utf8") + 1; // +1 for '\n'

    if (currentBytes + lineBytes > maxBytes && current.length > 0) {
      flush(startLine + current.length - 1);

      // Carry forward last overlapBytes as context
      let overlapLines: string[] = [];
      let overlapAcc = 0;
      for (let j = current.length - 1; j >= 0; j--) {
        const lb = Buffer.byteLength(current[j], "utf8") + 1;
        if (overlapAcc + lb > overlapBytes) break;
        overlapLines.unshift(current[j]);
        overlapAcc += lb;
      }

      startLine = startLine + current.length - overlapLines.length;
      current = overlapLines;
      currentBytes = overlapAcc;
    }

    current.push(line);
    currentBytes += lineBytes;
  }

  if (current.length > 0) {
    flush(startLine + current.length - 1);
  }

  return chunks;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Split a line that exceeds maxBytes into segments, respecting UTF-8 boundaries.
function splitToByteLimit(text: string, maxBytes: number): string[] {
  const segments: string[] = [];
  let rest = text;
  while (Buffer.byteLength(rest, "utf8") > maxBytes) {
    // Binary search for the largest safe prefix
    let lo = 0;
    let hi = rest.length;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      Buffer.byteLength(rest.slice(0, mid), "utf8") <= maxBytes
        ? (lo = mid)
        : (hi = mid);
    }
    segments.push(rest.slice(0, lo));
    rest = rest.slice(lo);
  }
  if (rest) segments.push(rest);
  return segments;
}

export function sha256(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex");
}
