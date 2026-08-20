/**
 * `addonAPI.nodes` (§5.3) — `nodes:read`. The user's local node registry and
 * locally cached AIM data — unrelated to and unaffected by the HyperInsight
 * split (§9.1/§9.2). No write surface in v1.
 */

import { getNodes } from "../../settings";
import { loadSavedAims } from "../../../plugins/aim-nodes/main/index.js";
import { ApiValidationError, type ApiNamespace } from "./types";

export const methods: ApiNamespace = {
  list: {
    permission: "nodes:read",
    handler: () => getNodes(),
  },
  getSavedAims: {
    permission: "nodes:read",
    handler: (_ctx, license) => {
      if (license !== undefined && typeof license !== "string") {
        throw new ApiValidationError("license must be a string if present");
      }
      const licenseKey = typeof license === "string" ? license : undefined;
      const savedData = loadSavedAims() as Record<string, unknown>;
      if (licenseKey) return savedData[licenseKey] ?? null;
      return savedData;
    },
  },
};
