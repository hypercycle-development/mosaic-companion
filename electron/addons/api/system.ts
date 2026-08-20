/**
 * `addonAPI.system` (§5.3) — implicit (no permission required).
 */

import { app } from "electron";
import { readThemeSettings } from "../../settings";
import { getLiveManifest } from "../loader";
import { getThemePayload } from "../theme";
import type { ApiNamespace } from "./types";

export const methods: ApiNamespace = {
  getManifest: {
    handler: (ctx) => getLiveManifest(ctx.addonId) ?? null,
  },
  getAppInfo: {
    handler: () => ({
      appVersion: app.getVersion(),
      platform: process.platform,
      locale: app.getLocale(),
    }),
  },
  getTheme: {
    handler: () => getThemePayload(readThemeSettings().activeTheme),
  },
};
