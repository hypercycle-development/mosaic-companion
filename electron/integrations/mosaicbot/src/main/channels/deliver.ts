// Mirrors src/infra/outbound/deliver.ts from OpenClaw

import type { SendResult } from "./types.js";
import { loadChannelOutboundAdapter } from "./registry.js";

export type DeliverParams<Cfg = unknown> = {
  cfg: Cfg;
  channel: string;
  to: string;
  text: string;
  accountId?: string;
  threadId?: string;
  mediaUrl?: string;
};

/**
 * Deliver a message to a channel, chunking text to the adapter's limit.
 * Tries paragraph-boundary splits before hard truncation.
 */
export async function deliverMessage<Cfg>(params: DeliverParams<Cfg>): Promise<SendResult[]> {
  const adapter = loadChannelOutboundAdapter(params.channel);
  if (!adapter) throw new Error(`No outbound adapter for channel: "${params.channel}"`);

  const chunks = chunkText(params.text, adapter.textChunkLimit ?? 4_000);
  const results: SendResult[] = [];

  for (const chunk of chunks) {
    const base = {
      cfg: params.cfg,
      to: params.to,
      text: chunk,
      accountId: params.accountId,
      threadId: params.threadId,
    };
    const result =
      params.mediaUrl && adapter.sendMedia
        ? await adapter.sendMedia({ ...base, mediaUrl: params.mediaUrl })
        : await adapter.sendText(base);
    results.push(result);
  }

  return results;
}

// Split at paragraph boundaries where possible, then hard-cut at limit
function chunkText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    let cut = limit;
    const para = rest.lastIndexOf("\n\n", limit);
    if (para > limit / 2) cut = para;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  return chunks;
}
