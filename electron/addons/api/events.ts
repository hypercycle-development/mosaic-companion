/**
 * `addonAPI.events` (§5.3) — implicit registration; per-channel permission.
 * Subscriptions are tracked per-webContents in `webviews.ts` so a broadcast
 * only ever reaches webContents that actually asked for that channel (§5.1's
 * "push filtering, no broadcast leaks").
 *
 * The permission requirement here depends on the *argument* (which channel),
 * not the method itself — `subscribe`/`unsubscribe` are always callable, but
 * a privileged channel still requires its permission, checked here via
 * `ApiPermissionError` rather than the dispatcher's generic per-method
 * `spec.permission` check (which only covers fixed, method-wide permissions).
 */

import { getGrantedPermissions } from "../loader";
import { subscribeChannel, unsubscribeChannel } from "../webviews";
import { assertString, ApiPermissionError, type ApiNamespace } from "./types";

/** null = unprivileged (§5.2's "implicit" row: theme:changed, window:focus-changed). */
const CHANNEL_PERMISSIONS: Record<string, string | null> = {
  "theme:changed": null,
  "window:focus-changed": null,
  "wallet:changed": "wallet:read",
  "nodes:changed": "nodes:read",
  "mcp:tools-changed": "mcp:read",
};

function isChannelKnown(channel: string): boolean {
  return channel in CHANNEL_PERMISSIONS || channel.startsWith("self:");
}

/** `self:<name>` (an addon's own main pushing to its own webview via
 * ctx.events.send) never requires a permission — it's always the addon's own traffic. */
function requiredPermissionFor(channel: string): string | null {
  if (channel.startsWith("self:")) return null;
  return CHANNEL_PERMISSIONS[channel] ?? null;
}

export const methods: ApiNamespace = {
  subscribe: {
    handler: (ctx, channel) => {
      const name = assertString(channel, "channel");
      if (!isChannelKnown(name)) {
        throw new Error(`Channel "${name}" is not available in this app version`);
      }
      const requiredPermission = requiredPermissionFor(name);
      if (requiredPermission && !getGrantedPermissions(ctx.addonId).has(requiredPermission)) {
        throw new ApiPermissionError(requiredPermission);
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
