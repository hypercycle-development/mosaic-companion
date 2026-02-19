// Electron-native channel: deliver messages to all renderer windows via IPC.

import { BrowserWindow } from "electron";
import type { ChannelPlugin, ResolvedAccount } from "../types.js";

type IpcCfg = { channels?: { ipc?: { enabled?: boolean } } };
type IpcAccount = ResolvedAccount;

export const ipcChannelPlugin: ChannelPlugin<IpcAccount, IpcCfg> = {
  id: "ipc",
  meta: { label: "In-App (IPC)", order: 0 },
  capabilities: { chatTypes: ["direct"] },
  config: {
    listAccountIds: () => ["default"],
    defaultAccountId: () => "default",
    resolveAccount: (cfg, accountId = "default") => ({
      accountId,
      enabled: cfg.channels?.ipc?.enabled !== false,
      configured: true,
    }),
    isConfigured: (account) => account.enabled,
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 65_536,
    chunkerMode: "markdown",
    sendText: async ({ to, text }) => {
      const messageId = `ipc-${Date.now()}`;
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send("agent:message", { to, text, channel: "ipc", messageId });
        }
      }
      return { channel: "ipc", messageId };
    },
  },
};
