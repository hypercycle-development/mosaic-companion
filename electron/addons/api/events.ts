/**
 * `addonAPI.events` (§5.3) — implicit registration; per-channel permission.
 * Subscriptions are tracked per-webContents in `webviews.ts` so a broadcast
 * only ever reaches webContents that actually asked for that channel (§5.1's
 * "push filtering, no broadcast leaks").
 *
 * Phase 2 only wires the unprivileged channels: `theme:changed`,
 * `window:focus-changed`, and any `self:<name>` (an addon's own main pushing
 * to its own webview via `ctx.events.send`). `wallet:changed`,
 * `nodes:changed`, and `mcp:tools-changed` are permission-gated and arrive
 * in Phase 3 alongside their namespaces.
 */

import { subscribeChannel, unsubscribeChannel } from "../webviews";
import { assertString, type ApiNamespace } from "./types";

const UNPRIVILEGED_CHANNELS = new Set(["theme:changed", "window:focus-changed"]);

function isChannelAllowed(channel: string): boolean {
  return UNPRIVILEGED_CHANNELS.has(channel) || channel.startsWith("self:");
}

export const methods: ApiNamespace = {
  subscribe: {
    handler: (ctx, channel) => {
      const name = assertString(channel, "channel");
      if (!isChannelAllowed(name)) {
        throw new Error(`Channel "${name}" is not available in this app version`);
      }
      subscribeChannel(ctx.webContentsId, name);
      return { subscribed: name };
    },
  },
  unsubscribe: {
    handler: (ctx, channel) => {
      const name = assertString(channel, "channel");
      unsubscribeChannel(ctx.webContentsId, name);
      return { unsubscribed: name };
    },
  },
};
