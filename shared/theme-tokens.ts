/**
 * Theme token maps — the single source of truth for every theme's color
 * palette. Extracted out of `src/themes.ts` (§4.3) so BOTH the renderer
 * (`src/themes.ts` → `ThemeProvider.tsx`) and the main process
 * (`electron/addons/theme.ts`, which pushes `theme:changed` into addon
 * webviews) read the same data without the main process importing anything
 * React/renderer-shaped. esbuild already bundles the main process from TS,
 * so a shared plain-TS module costs nothing.
 *
 * No React, DOM, or Electron imports here — this file must be safely
 * importable from both worlds.
 */

export type ThemeKey = "light" | "dark" | "blue" | "solarized";

export interface ThemeTokens {
  key: ThemeKey;
  name: string;
  description: string;
  colors: Record<string, string>;
}

export const DEFAULT_THEMES: ThemeTokens[] = [
  {
    key: "dark",
    name: "Obsidian Dark",
    description: "Deep contrast with electric accents.",
    colors: {
      background: "#0b1220",
      surface: "#0f172a",
      surfaceAlt: "#111827",
      overlay: "rgba(11, 18, 32, 0.75)",
      border: "#1f2937",
      borderMuted: "#1f2937",
      text: "#e6eef8",
      textMuted: "#94a3b8",
      primary: "#60a5fa",
      primaryStrong: "#3b82f6",
      accent: "#7c3aed",
      accentSoft: "rgba(124, 58, 237, 0.2)",
      muted: "#475569",
      success: "#22c55e",
      warning: "#f59e0b",
      danger: "#ef4444",
      highlight: "rgba(96,165,250,0.12)",
      selection: "rgba(99,102,241,0.3)",
      code: "#cbd5f5",
      shadow: "rgba(0,0,0,0.35)",
    },
  },
  {
    key: "light",
    name: "Daylight",
    description: "Clean and crisp with bright primaries.",
    colors: {
      background: "#ffffff",
      surface: "#f8fafc",
      surfaceAlt: "#edf2f7",
      overlay: "rgba(248, 250, 252, 0.75)",
      border: "#e2e8f0",
      borderMuted: "#cbd5e1",
      text: "#0f172a",
      textMuted: "#475569",
      primary: "#2563eb",
      primaryStrong: "#1d4ed8",
      accent: "#0ea5e9",
      accentSoft: "rgba(14,165,233,0.16)",
      muted: "#64748b",
      success: "#16a34a",
      warning: "#d97706",
      danger: "#dc2626",
      highlight: "rgba(37,99,235,0.1)",
      selection: "rgba(37,99,235,0.16)",
      code: "#0f172a",
      shadow: "rgba(15, 23, 42, 0.15)",
    },
  },
  {
    key: "blue",
    name: "Ice Blue",
    description: "Cool blues with crisp edges.",
    colors: {
      background: "#eaf2ff",
      surface: "#dceeff",
      surfaceAlt: "#cfe0fa",
      overlay: "rgba(218, 234, 255, 0.8)",
      border: "#b6c8e8",
      borderMuted: "#aac0e3",
      text: "#0b2238",
      textMuted: "#3b556d",
      primary: "#1e90ff",
      primaryStrong: "#1c7ed6",
      accent: "#0ea5e9",
      accentSoft: "rgba(14,165,233,0.2)",
      muted: "#5b7c99",
      success: "#199473",
      warning: "#d28f2c",
      danger: "#d64545",
      highlight: "rgba(30,144,255,0.12)",
      selection: "rgba(30,144,255,0.2)",
      code: "#0b2238",
      shadow: "rgba(15, 23, 42, 0.2)",
    },
  },
  {
    key: "solarized",
    name: "Solar Wind",
    description: "Solarized-inspired warmth with teal accents.",
    colors: {
      background: "#fdf6e3",
      surface: "#f5e8d0",
      surfaceAlt: "#eedfbe",
      overlay: "rgba(253, 246, 227, 0.85)",
      border: "#e6d8b8",
      borderMuted: "#ddcda6",
      text: "#073642",
      textMuted: "#586e75",
      primary: "#268bd2",
      primaryStrong: "#1f74ad",
      accent: "#2aa198",
      accentSoft: "rgba(42,161,152,0.2)",
      muted: "#657b83",
      success: "#2aa198",
      warning: "#b58900",
      danger: "#d33682",
      highlight: "rgba(38,139,210,0.14)",
      selection: "rgba(38,139,210,0.18)",
      code: "#073642",
      shadow: "rgba(7, 54, 66, 0.25)",
    },
  },
];

export function findThemeTokens(key: ThemeKey | string | null | undefined): ThemeTokens {
  const fallback = DEFAULT_THEMES[0];
  if (!key) return fallback;
  return DEFAULT_THEMES.find((t) => t.key === key) || fallback;
}
