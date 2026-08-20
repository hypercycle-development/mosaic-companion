/**
 * Shared shapes for the addonAPI dispatcher and its namespace
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
   * (unprivileged) methods — the permission-gated methods live in wallet,
   * agents, mcp, nodes, and ui (`openExternal`). */
  permission?: string;
  handler: (ctx: AddonApiContext, ...args: unknown[]) => unknown | Promise<unknown>;
}

export type ApiNamespace = Record<string, ApiMethodSpec>;

/** Thrown by a handler to signal malformed arguments — the dispatcher maps
 * this to the `BAD_ARGS` error code instead of a generic `HANDLER_ERROR`. */
export class ApiValidationError extends Error {}

/**
 * Thrown by a handler whose permission requirement depends on its
 * *arguments* rather than being fixed per-method (events.ts's `subscribe`,
 * where the required permission depends on which channel was requested) —
 * the dispatcher maps this to `PERMISSION_DENIED`, same as the generic
 * method-level `spec.permission` check.
 */
export class ApiPermissionError extends Error {
  constructor(public readonly permission: string) {
    super(`Missing permission "${permission}"`);
  }
}

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
