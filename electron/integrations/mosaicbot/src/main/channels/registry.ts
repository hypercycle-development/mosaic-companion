// Mirrors src/channels/plugins/index.ts + load.ts from OpenMosaic

import type {
  ChannelPlugin,
  ChannelOutboundAdapter,
  ResolvedAccount,
} from "./types.js";

type Registration = { plugin: ChannelPlugin };

const registrations = new Map<string, Registration>();
const outboundCache = new Map<string, ChannelOutboundAdapter>();

export function registerChannel(plugin: ChannelPlugin): void {
  registrations.set(plugin.id, { plugin });
  outboundCache.delete(plugin.id);
}

export function listChannelPlugins(): ChannelPlugin[] {
  return [...registrations.values()]
    .map((r) => r.plugin)
    .sort((a, b) => (a.meta.order ?? 999) - (b.meta.order ?? 999));
}

export function getChannelPlugin(id: string): ChannelPlugin | undefined {
  return registrations.get(id)?.plugin;
}

// Cached outbound adapter lookup — same pattern as loadChannelOutboundAdapter() in OpenMosaic
export function loadChannelOutboundAdapter(
  id: string,
): ChannelOutboundAdapter | undefined {
  const cached = outboundCache.get(id);
  if (cached) return cached;
  const adapter = registrations.get(id)?.plugin.outbound;
  if (adapter) outboundCache.set(id, adapter);
  return adapter;
}

export function isChannelConfigured<Cfg>(
  plugin: ChannelPlugin<ResolvedAccount, Cfg>,
  cfg: Cfg,
): boolean {
  const accountId = plugin.config.defaultAccountId(cfg);
  const account = plugin.config.resolveAccount(cfg, accountId);
  return plugin.config.isConfigured(account, cfg);
}
