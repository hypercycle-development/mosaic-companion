/**
 * The `addonAPI` dispatcher (§5.1) — the security core of the whole addon
 * system. Every `window.addonAPI` call, from any addon, funnels through the
 * single `addon-api:invoke` channel registered here.
 *
 * Identity resolution happens entirely in this file, from `event.sender.id`
 * looked up in `webviews.ts`'s map (populated only at `did-attach-webview`
 * time, driven by a main-process-validated `mosaic-addon://` URL — see
 * `webviews.ts`). The renderer payload never states which addon it is; there
 * is nothing in `{ ns, method, args }` for a compromised addon webview to
 * forge its way into another addon's identity with.
 *
 * Dispatch order (exactly as specified): resolve sender → check activated →
 * look up method → check permission → run handler. `ns === "invoke"` is the
 * one special case — it's not a static namespace module, it routes straight
 * into the calling addon's *own* `ctx.ipc.handle`-registered method (§5.3/§5.4).
 */

import { app, ipcMain, type IpcMainInvokeEvent } from "electron";
import { getErrorMessage } from "../../utils";
import { readThemeSettings } from "../../settings";
import { getAddonIdForSender } from "../webviews";
import { isAddonActivated, getLiveManifest, getGrantedPermissions, getAddonOwnHandler } from "../loader";
import { getThemePayload } from "../theme";
import { ApiValidationError, type ApiNamespace, type AddonApiContext } from "./types";
import { methods as systemMethods } from "./system";
import { methods as settingsMethods } from "./settings";
import { methods as filesMethods } from "./files";
import { methods as eventsMethods } from "./events";
import { methods as uiMethods } from "./ui";

// Phase 2: only the unprivileged namespaces. Phase 3 adds wallet/agents/mcp/nodes.
const NAMESPACES: Record<string, ApiNamespace> = {
  system: systemMethods,
  settings: settingsMethods,
  files: filesMethods,
  events: eventsMethods,
  ui: uiMethods,
};

interface InvokePayload {
  ns: string;
  method: string;
  args: unknown[];
}

interface ErrorResponse {
  ok: false;
  code: string;
  message: string;
}
interface SuccessResponse {
  ok: true;
  data: unknown;
}

function errorResponse(code: string, message: string): ErrorResponse {
  return { ok: false, code, message };
}

export function registerAddonApi(): void {
  ipcMain.handle(
    "addon-api:invoke",
    async (event: IpcMainInvokeEvent, payload: InvokePayload): Promise<SuccessResponse | ErrorResponse> => {
      const addonId = getAddonIdForSender(event.sender.id);
      if (!addonId) return errorResponse("ADDON_UNKNOWN_SENDER", "Sender is not a registered addon webview");
      if (!isAddonActivated(addonId)) return errorResponse("ADDON_NOT_ACTIVE", `Addon "${addonId}" is not active`);

      if (
        !payload ||
        typeof payload.ns !== "string" ||
        typeof payload.method !== "string" ||
        !Array.isArray(payload.args)
      ) {
        return errorResponse("BAD_ARGS", "Malformed invoke payload");
      }
      const { ns, method, args } = payload;
      const ctx: AddonApiContext = { addonId, webContentsId: event.sender.id };

      // Addon-main bridge (§5.3): route to the handler the addon's own
      // main/index.js registered via ctx.ipc.handle. The target namespace is
      // resolved from the already-verified addonId — never from anything the
      // renderer supplied — so one addon can never reach another's handlers.
      if (ns === "invoke") {
        const fn = getAddonOwnHandler(addonId, method);
        if (!fn) return errorResponse("UNKNOWN_METHOD", `No handler "${method}" registered by this addon's main`);
        try {
          const data = await fn(...args);
          return { ok: true, data };
        } catch (error) {
          return errorResponse("HANDLER_ERROR", getErrorMessage(error));
        }
      }

      const namespace = NAMESPACES[ns];
      const spec = namespace?.[method];
      if (!spec) return errorResponse("UNKNOWN_METHOD", `Unknown method "${ns}.${method}"`);

      if (spec.permission && !getGrantedPermissions(addonId).has(spec.permission)) {
        return errorResponse("PERMISSION_DENIED", `Missing permission "${spec.permission}"`);
      }

      try {
        const data = await spec.handler(ctx, ...args);
        return { ok: true, data };
      } catch (error) {
        if (error instanceof ApiValidationError) return errorResponse("BAD_ARGS", error.message);
        return errorResponse("HANDLER_ERROR", getErrorMessage(error));
      }
    },
  );

  ipcMain.handle("addon-api:init", (event: IpcMainInvokeEvent) => {
    const addonId = getAddonIdForSender(event.sender.id);
    if (!addonId) return null;
    const manifest = getLiveManifest(addonId);
    if (!manifest) return null;
    return {
      addonId,
      manifest,
      theme: getThemePayload(readThemeSettings().activeTheme),
      platform: process.platform,
      appVersion: app.getVersion(),
      locale: app.getLocale(),
    };
  });
}
