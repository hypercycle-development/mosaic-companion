// ─────────────────────────────────────────────────────────────────────────────
// Channel adapter interfaces
// Mirrors src/channels/plugins/types.adapters.ts + types.plugin.ts from OpenMosaic
// ─────────────────────────────────────────────────────────────────────────────

export type ChannelCapabilities = {
  chatTypes: ("direct" | "channel" | "thread")[];
  media?: boolean;
  polls?: boolean;
  threads?: boolean;
  reactions?: boolean;
  nativeCommands?: boolean;
};

export type ChannelMeta = {
  label: string;
  order?: number;
};

// Each channel defines its own resolved account shape via the generic
export type ResolvedAccount = {
  accountId: string;
  enabled: boolean;
  configured: boolean;
};

// ── Outbound ──────────────────────────────────────────────────────────────────

export type SendTextParams<Cfg = unknown> = {
  cfg: Cfg;
  to: string;
  text: string;
  accountId?: string;
  threadId?: string;
  replyToId?: string;
};

export type SendMediaParams<Cfg = unknown> = SendTextParams<Cfg> & {
  mediaUrl: string;
};

export type SendPollParams<Cfg = unknown> = {
  cfg: Cfg;
  to: string;
  accountId?: string;
  poll: { question: string; options: string[]; maxSelections?: number };
};

export type SendResult = {
  channel: string;
  messageId?: string;
  threadId?: string;
};

export type ChannelOutboundAdapter<Cfg = unknown> = {
  deliveryMode: "direct" | "gateway" | "hybrid";
  textChunkLimit?: number;
  chunkerMode?: "plain" | "markdown";
  sendText(params: SendTextParams<Cfg>): Promise<SendResult>;
  sendMedia?(params: SendMediaParams<Cfg>): Promise<SendResult>;
  sendPoll?(params: SendPollParams<Cfg>): Promise<SendResult>;
};

// ── Config ────────────────────────────────────────────────────────────────────

export type ChannelConfigAdapter<
  A extends ResolvedAccount = ResolvedAccount,
  Cfg = unknown,
> = {
  listAccountIds(cfg: Cfg): string[];
  resolveAccount(cfg: Cfg, accountId?: string): A;
  defaultAccountId(cfg: Cfg): string;
  isConfigured(account: A, cfg: Cfg): boolean;
};

// ── Security ──────────────────────────────────────────────────────────────────

export type DmPolicy = "open" | "pairing" | "allowlist";

export type ChannelSecurityAdapter<
  A extends ResolvedAccount = ResolvedAccount,
  Cfg = unknown,
> = {
  resolveDmPolicy(params: { cfg: Cfg; account: A; accountId?: string }): {
    policy: DmPolicy;
    allowFrom: string[];
  };
};

// ── Full Plugin ───────────────────────────────────────────────────────────────

export type ChannelPlugin<
  A extends ResolvedAccount = ResolvedAccount,
  Cfg = unknown,
> = {
  id: string;
  meta: ChannelMeta;
  capabilities: ChannelCapabilities;
  config: ChannelConfigAdapter<A, Cfg>;
  outbound?: ChannelOutboundAdapter<Cfg>;
  security?: ChannelSecurityAdapter<A, Cfg>;
};

// ── Lightweight dock (shared code without full plugin import) ─────────────────

export type ChannelDock = {
  id: string;
  capabilities: ChannelCapabilities;
  outbound?: Pick<ChannelOutboundAdapter, "textChunkLimit" | "chunkerMode">;
};
