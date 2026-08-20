/**
 * Theme push for addon webviews. Reads the same token maps the
 * renderer uses (`shared/theme-tokens.ts`) and broadcasts `theme:changed` to
 * every registered addon webContents whenever `themes:set` runs in
 * `main.ts`. `cssVars` is the theme's raw, un-prefixed token map (matching
 * `Theme.colors` exactly) — the addon preload prefixes each key with `--`
 * itself, mirroring `ThemeProvider.tsx`'s `applyThemeToDocument`.
 */

import { findThemeTokens, type ThemeKey } from "../../shared/theme-tokens";
import { broadcastAddonEvent } from "./webviews";

export interface ThemePayload {
  themeKey: ThemeKey;
  cssVars: Record<string, string>;
}

export function getThemePayload(themeKey: string): ThemePayload {
  const tokens = findThemeTokens(themeKey);
  return { themeKey: tokens.key, cssVars: tokens.colors };
}

/** Push the active theme to every addon webview subscribed to `theme:changed`. */
export function broadcastThemeToAddons(themeKey: string): void {
  broadcastAddonEvent("theme:changed", getThemePayload(themeKey));
}
