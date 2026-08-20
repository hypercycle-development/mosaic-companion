/**
 * Phase 1 test fixture — the addon-main contract's happy path (§5.4).
 * Registers a single `ping` handler (channel `addon:ping-addon:ping`) that
 * verifies ctx wiring end to end: ipc registration, settings round-trip, and
 * teardown on deactivate.
 */
export async function activate(ctx) {
  ctx.log("activating ping-addon fixture");
  ctx.ipc.handle("ping", () => ({
    ok: true,
    pong: Date.now(),
    manifestId: ctx.manifest.id,
  }));
}

export async function deactivate() {
  // Nothing to clean up beyond the ipc handler, which the loader tears down
  // automatically after this returns.
}
