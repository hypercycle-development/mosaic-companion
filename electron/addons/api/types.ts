/**
 * Shared shapes for the addonAPI dispatcher (§5.1) and its namespace
 * modules. Every `api/<namespace>.ts` file exports `methods: ApiNamespace`.
 */

export interface AddonApiContext {
  addonId: string;
  /** The calling webview's webContents.id — needed by events.ts to track
   * per-webContents subscriptions. */
  webContentsId: number;
}

export interface ApiMethodSpec {
  /** Permission required to call this method, if any. Omit for implicit
   * (unprivileged) methods — every Phase 2 namespace is implicit; Phase 3
   * adds the first permission-gated ones (wallet, agents, mcp, nodes). */
  permission?: string;
  handler: (ctx: AddonApiContext, ...args: unknown[]) => unknown | Promise<unknown>;
}

export type ApiNamespace = Record<string, ApiMethodSpec>;

/** Thrown by a handler to signal malformed arguments — the dispatcher maps
 * this to the `BAD_ARGS` error code instead of a generic `HANDLER_ERROR`. */
export class ApiValidationError extends Error {}

export function assertString(value: unknown, name: string): string {
  if (typeof value !== "string") throw new ApiValidationError(`${name} must be a string`);
  return value;
}

export function assertPlainObject(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiValidationError(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
}
