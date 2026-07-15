/**
 * `addonAPI.settings` (§5.3) — implicit; the retained-on-uninstall store.
 * Same backing file (`addon-settings/<id>.json`) as `ctx.settings` in
 * `main/index.js` (§5.4) — both read/write through the loader's helpers, so
 * a renderer write and a main write can never race past each other silently.
 */

import { readAddonSettings, writeAddonSettings, replaceAddonSettings, clearAddonSettings } from "../loader";
import { assertPlainObject, type ApiNamespace } from "./types";

export const methods: ApiNamespace = {
  get: {
    handler: (ctx) => readAddonSettings(ctx.addonId),
  },
  set: {
    handler: (ctx, patch) => {
      writeAddonSettings(ctx.addonId, assertPlainObject(patch, "patch"));
      return null;
    },
  },
  replace: {
    handler: (ctx, value) => {
      replaceAddonSettings(ctx.addonId, assertPlainObject(value, "value"));
      return null;
    },
  },
  clear: {
    handler: (ctx) => {
      clearAddonSettings(ctx.addonId);
      return null;
    },
  },
};
