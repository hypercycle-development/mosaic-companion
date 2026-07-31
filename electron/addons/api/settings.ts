/**
 * `addonAPI.settings` (§5.3) — implicit; the retained-on-uninstall store.
 * Same backing file (`addon-settings/<id>.json`) as `ctx.settings` in
 * `main/index.js` (§5.4) — both read/write through the loader's helpers, so
 * a renderer write and a main write can never race past each other silently.
 */

import {
  readAddonSettings,
  writeAddonSettings,
  replaceAddonSettings,
  clearAddonSettings,
  AddonSettingsSizeError,
} from "../loader";
import { assertPlainObject, ApiValidationError, type ApiNamespace } from "./types";

/** The 64 KB cap is a caller-input problem, not an internal failure —
 * re-thrown as ApiValidationError so the dispatcher reports BAD_ARGS. */
function runSizeChecked(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    if (error instanceof AddonSettingsSizeError) throw new ApiValidationError(error.message);
    throw error;
  }
}

export const methods: ApiNamespace = {
  get: {
    handler: (ctx) => readAddonSettings(ctx.addonId),
  },
  set: {
    handler: (ctx, patch) => {
      runSizeChecked(() => writeAddonSettings(ctx.addonId, assertPlainObject(patch, "patch")));
      return null;
    },
  },
  replace: {
    handler: (ctx, value) => {
      runSizeChecked(() => replaceAddonSettings(ctx.addonId, assertPlainObject(value, "value")));
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
