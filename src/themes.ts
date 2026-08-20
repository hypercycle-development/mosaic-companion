/**
 * Renderer-side theme API. The actual token data now lives in
 * `shared/theme-tokens.ts` (§4.3) so the main process can push the same
 * palettes into addon webviews without importing anything renderer-shaped —
 * this file just re-exports it under the names the rest of the renderer
 * already imports, so nothing else in `src/` needs to change.
 */
export type { ThemeKey, ThemeTokens as Theme } from "../shared/theme-tokens";
export { DEFAULT_THEMES, findThemeTokens as findTheme } from "../shared/theme-tokens";

export const THEME_LOCAL_STORAGE_KEY = "browser_theme_key";
