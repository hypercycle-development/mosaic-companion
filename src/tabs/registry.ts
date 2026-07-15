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
  INTERNAL_HYPERINSIGHT_URL,
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
}

export const CORE_TABS: CoreTabDef[] = [
  { id: "home", label: "Home", icon: "Home", url: INTERNAL_HOME_URL, toggleable: false, order: 0 },
  { id: "chat", label: "AI Chat", icon: "Bot", url: INTERNAL_CHAT_URL, toggleable: false, order: 10 },
  { id: "mosaicbot", label: "Mosaic Bot", icon: "BrainCircuit", url: INTERNAL_MOSAICBOT_URL, toggleable: false, order: 20 },
  { id: "mcp", label: "MCP Servers", icon: "Plug", url: INTERNAL_MCP_URL, toggleable: false, order: 30 },
  { id: "multi-chat", label: "Chat Rooms", icon: "MessageSquare", url: INTERNAL_MULTI_CHAT_URL, toggleable: false, order: 40 },
  { id: "web3", label: "Web3", icon: "Eth", url: INTERNAL_WEB3_URL, toggleable: false, order: 50 },
  { id: "vault", label: "Vault", icon: "Lock", url: INTERNAL_VAULT_URL, toggleable: false, order: 60 },
  { id: "hyperinsight", label: "HyperInsight", icon: "Activity", url: INTERNAL_HYPERINSIGHT_URL, toggleable: false, order: 70 },
  { id: "ide", label: "IDE", icon: "Code2", url: INTERNAL_IDE_URL, toggleable: false, order: 80 },
  { id: "sandbox", label: "Tool Sandbox", icon: "Cpu", url: INTERNAL_SANDBOX_URL, toggleable: false, order: 90 },
  { id: "settings", label: "Configuration", icon: "Settings", url: INTERNAL_SETTINGS_URL, toggleable: false, order: 100 },
];

/** The set of tab ids that may legitimately carry a visibility flag. */
export function isToggleableTab(tabId: string): boolean {
  return CORE_TABS.some((tab) => tab.id === tabId && tab.toggleable);
}
