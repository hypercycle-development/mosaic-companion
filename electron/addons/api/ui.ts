/**
 * `addonAPI.ui` — `setTitle` is implicit; `openExternal` requires
 * `shell:open-external`. https/http/mailto only, main-side validated, then
 * delegates to `shell.openExternal` — never lets the addon open an
 * arbitrary URL scheme (e.g. `file:`) via this path.
 */

import { BrowserWindow, shell } from "electron";
import { assertString, ApiValidationError, type ApiNamespace } from "./types";

const ALLOWED_EXTERNAL_SCHEMES = /^(https?:|mailto:)/i;

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
  openExternal: {
    permission: "shell:open-external",
    handler: async (_ctx, url) => {
      const value = assertString(url, "url");
      if (!ALLOWED_EXTERNAL_SCHEMES.test(value)) {
        throw new ApiValidationError("url must start with http:, https:, or mailto:");
      }
      await shell.openExternal(value);
      return null;
    },
  },
};
