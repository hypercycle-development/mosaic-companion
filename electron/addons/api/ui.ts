/**
 * `addonAPI.ui` (§5.3) — Phase 2 ships only `setTitle` (implicit). `openExternal`
 * requires `shell:open-external`, which needs the permission-enforcement work
 * landing in Phase 3 alongside the other privileged namespaces — deliberately
 * not implemented here yet.
 */

import { BrowserWindow } from "electron";
import { assertString, type ApiNamespace } from "./types";

export const methods: ApiNamespace = {
  setTitle: {
    handler: (ctx, title) => {
      const value = assertString(title, "title");
      // Targets the main app renderer (Sidebar/AddonHostView), not other
      // addon webviews — mirrors how core pages call onUpdateTab.
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("addons:title-changed", { addonId: ctx.addonId, title: value });
      }
      return null;
    },
  },
};
