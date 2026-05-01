// HTTP webhook channel: POST messages to an external endpoint.

import type { ChannelPlugin, ResolvedAccount } from "../types.js";

type HttpAccount = ResolvedAccount & { webhookUrl: string };
type HttpCfg = { channels?: { http?: { webhookUrl?: string; enabled?: boolean } } };

export const httpChannelPlugin: ChannelPlugin<HttpAccount, HttpCfg> = {
  id: "http",
  meta: { label: "HTTP Webhook", order: 10 },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: () => ["default"],
    defaultAccountId: () => "default",
    resolveAccount: (cfg, accountId = "default") => ({
      accountId,
      enabled: cfg.channels?.http?.enabled !== false,
      configured: Boolean(cfg.channels?.http?.webhookUrl),
      webhookUrl: cfg.channels?.http?.webhookUrl ?? "",
    }),
    isConfigured: (account) => account.enabled && Boolean(account.webhookUrl),
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4_000,
    chunkerMode: "plain",
    sendText: async ({ cfg, to, text }) => {
      const webhookUrl = cfg.channels?.http?.webhookUrl;
      if (!webhookUrl) throw new Error("http channel: webhookUrl not configured");
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text, ts: Date.now() }),
      });
      if (!res.ok) throw new Error(`http channel: POST failed ${res.status}`);
      const json = (await res.json().catch(() => ({}))) as { messageId?: string };
      return { channel: "http", messageId: json.messageId };
    },
  },
};
