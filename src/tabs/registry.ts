/**
 * Tab registry — single source of truth for the app's core sidebar tabs.
 *
 * This replaces the hardcoded `navItems` array that used to live inline in
 * `Sidebar.tsx`. Every tab carries a generic `toggleable` flag: when `false`
 * (the launch state for every core tab) the tab is always shown and cannot be
 * hidden from Settings; flipping a single entry to `toggleable: true` is all it
 * takes to make that tab hideable via the "Sidebar Tabs" settings section.
 *
 * The map is consumed on the renderer side by `Sidebar.tsx` (to build the nav)
 * and by `SettingsPage.tsx` (to render per-tab visibility toggles), and on the
 * main side by `electron/settings.ts` (to reject visibility writes for tabs
 * that are not toggleable). Keep it free of React/DOM dependencies so the main
 * process can import it without pulling in renderer-only code.
 */

import {
  INTERNAL_HOME_URL,
  INTERNAL_CHAT_URL,
  INTERNAL_MOSAICBOT_URL,
  INTERNAL_MCP_URL,
  INTERNAL_MULTI_CHAT_URL,
  INTERNAL_WEB3_URL,
  INTERNAL_VAULT_URL,
  INTERNAL_IDE_URL,
  INTERNAL_SANDBOX_URL,
  INTERNAL_SETTINGS_URL,
} from "../types/types";

export interface CoreTabDef {
  id: string;
  label: string;
  /** Icon name resolved by `Sidebar.tsx`'s `renderNavIcon`. */
  icon: string;
  url: string;
  /**
   * Whether this tab can be hidden from the sidebar. `false` for every core
   * tab at launch — a one-line flip to `true` makes it appear in the Settings
   * "Sidebar Tabs" section and become hide/show-able. Addon tabs (added in a
   * later phase) are always `toggleable: true`.
   */
  toggleable: boolean;
  /** Sort key within the sidebar. */
  order: number;
  /** One-line tooltip explaining what this page is for (shown on hover). */
  description: string;
}

export const CORE_TABS: CoreTabDef[] = [
  { id: "home", label: "Home", icon: "Home", url: INTERNAL_HOME_URL, toggleable: false, order: 0, description: "Your start page with quick access to everything" },
  { id: "chat", label: "AI Chat", icon: "Bot", url: INTERNAL_CHAT_URL, toggleable: false, order: 10, description: "Chat one-on-one with your AI agents" },
  { id: "mosaicbot", label: "Mosaic Bot", icon: "BrainCircuit", url: INTERNAL_MOSAICBOT_URL, toggleable: false, order: 20, description: "Built-in background assistant with memory and skills" },
  { id: "mcp", label: "MCP Servers", icon: "Plug", url: INTERNAL_MCP_URL, toggleable: false, order: 30, description: "Connect external tool servers (Model Context Protocol) for your agents" },
  { id: "multi-chat", label: "Chat Rooms", icon: "MessageSquare", url: INTERNAL_MULTI_CHAT_URL, toggleable: false, order: 40, description: "Multi-user rooms — invite agents with @mentions" },
  { id: "web3", label: "Web3", icon: "Eth", url: INTERNAL_WEB3_URL, toggleable: false, order: 50, description: "Built-in Web3 wallet for on-chain interactions" },
  { id: "vault", label: "Vault", icon: "Lock", url: INTERNAL_VAULT_URL, toggleable: false, order: 60, description: "Encrypted boxes for secrets — you choose which agents can read them" },
  // §9.2/Phase 7: HyperInsight is no longer a core tab — it's an addon tab
  // now (mosaic-addons/addons/hyperinsight, mounted via the generic addon
  // tab mechanism, §6.3). See ContentArea.tsx for the old
  // browser://hyperinsight URL's redirect handling.
  { id: "ide", label: "IDE", icon: "Code2", url: INTERNAL_IDE_URL, toggleable: false, order: 80, description: "Built-in code editor with an integrated terminal" },
  { id: "sandbox", label: "Tool Sandbox", icon: "Cpu", url: INTERNAL_SANDBOX_URL, toggleable: false, order: 90, description: "Install and run sandboxed WASM tools" },
  { id: "settings", label: "Configuration", icon: "Settings", url: INTERNAL_SETTINGS_URL, toggleable: false, order: 100, description: "App settings — AI agents, nodes, appearance, and more" },
];

/**
 * Tab-id prefix for addon-contributed tabs (§1, §3.3): `addon:<addonId>`.
 * Distinct from `ADDON_URL_PREFIX` ("addon://", the navigation URL scheme in
 * `types.ts`) — this is the key shape used in the `tabVisibility` map and by
 * `electron/settings.ts`'s toggleability check below.
 */
export const ADDON_TAB_ID_PREFIX = "addon:";

/**
 * The set of tab ids that may legitimately carry a visibility flag. Addon
 * tabs are always toggleable (fixed decision, §3.3: "Addon tabs are appended
 * from the addon manifest list with toggleable: true always") — every core
 * tab's toggleability is governed by its own `CORE_TABS` entry instead.
 */
export function isToggleableTab(tabId: string): boolean {
  if (tabId.startsWith(ADDON_TAB_ID_PREFIX)) return true;
  return CORE_TABS.some((tab) => tab.id === tabId && tab.toggleable);
}
