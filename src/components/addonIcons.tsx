/**
 * The icon vocabulary an addon may name in `manifest.json` → `tab.icon`.
 *
 * Lucide PascalCase names, curated rather than a passthrough to the whole of
 * lucide-react, so the renderer bundle stays small. Anything not named here
 * falls back to `LayoutGrid`, which is why a typo in a manifest is invisible
 * at runtime: the tab renders, just with the wrong icon. Two add-ons shipped
 * with placeholder icons for exactly that reason and it was found after merge.
 *
 * `ADDON_ICON_NAMES` is the published half — `scripts/addon-surface.mjs` reads
 * it into the surface artifact the catalogue's adjudicator gates against — and
 * `Record<AddonIconName, …>` makes the compiler enforce that the map and the
 * list hold exactly the same names, in both directions. That is the whole
 * reason this lives in its own module: before it, the renderable set was split
 * across an object literal and a `switch` in `Sidebar.tsx`, and no published
 * list could be trusted to match what the sidebar would actually draw.
 */

import React from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Box,
  Boxes,
  BrainCircuit,
  Clock,
  Code2,
  Cpu,
  Database,
  Globe,
  Hash,
  Home,
  Layers,
  LayoutGrid,
  Lock,
  MessageSquare,
  Network,
  Plug,
  Power,
  Rocket,
  Server,
  Settings,
  Shield,
  Sparkles,
  Star,
  Store,
  Telescope,
  Trophy,
  Video,
  Wallet,
  Zap,
} from "lucide-react";

/** Ethereum mark — not a lucide glyph, so it is drawn here. */
const Eth: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 256 417"
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M127.961 0L125.166 9.5V285.168L127.961 287.958L255.923 212.32L127.961 0Z" opacity="0.8" />
    <path d="M127.962 0L0 212.32L127.962 287.959V154.158V0Z" />
    <path
      d="M127.961 312.187L126.386 314.107V412.306L127.961 416.905L255.999 236.587L127.961 312.187Z"
      opacity="0.8"
    />
    <path d="M127.962 416.905V312.187L0 236.587L127.962 416.905Z" />
  </svg>
);

/**
 * Every `tab.icon` value the sidebar can render. Sorted, because it is
 * published and a stable order keeps the artifact's diffs readable.
 */
export const ADDON_ICON_NAMES = [
  "Activity",
  "BarChart3",
  "Bot",
  "Box",
  "Boxes",
  "BrainCircuit",
  "Clock",
  "Code2",
  "Cpu",
  "Database",
  "Eth",
  "Globe",
  "Hash",
  "Home",
  "Layers",
  "LayoutGrid",
  "Lock",
  "MessageSquare",
  "Network",
  "Plug",
  "Power",
  "Rocket",
  "Server",
  "Settings",
  "Shield",
  "Sparkles",
  "Star",
  "Store",
  "Telescope",
  "Trophy",
  "Video",
  "Wallet",
  "Zap",
] as const;

export type AddonIconName = (typeof ADDON_ICON_NAMES)[number];

/** The fallback for an unrecognised name. Published, so a gate can say so. */
export const ADDON_ICON_FALLBACK: AddonIconName = "LayoutGrid";

/**
 * Exactly the names in `ADDON_ICON_NAMES` — a missing key and a surplus key
 * are both compile errors, so the published list cannot drift from what the
 * sidebar draws.
 */
export const ADDON_ICON_MAP: Record<AddonIconName, React.FC<{ className?: string }>> = {
  Activity,
  BarChart3,
  Bot,
  Box,
  Boxes,
  BrainCircuit,
  Clock,
  Code2,
  Cpu,
  Database,
  Eth,
  Globe,
  Hash,
  Home,
  Layers,
  LayoutGrid,
  Lock,
  MessageSquare,
  Network,
  Plug,
  Power,
  Rocket,
  Server,
  Settings,
  Shield,
  Sparkles,
  Star,
  Store,
  Telescope,
  Trophy,
  Video,
  Wallet,
  Zap,
};

/** Resolve a manifest icon name, falling back as the sidebar always has. */
export function addonIconFor(name: string): React.FC<{ className?: string }> {
  return ADDON_ICON_MAP[name as AddonIconName] ?? ADDON_ICON_MAP[ADDON_ICON_FALLBACK];
}
