/**
 * Phase 3 test fixture — declares the full v1 permission set. Its own main
 * doesn't need to do anything; this fixture is driven from the test harness
 * via direct executeJavaScript calls against its renderer's addonAPI.
 */
export async function activate(ctx) {
  ctx.log("activating privileged-addon fixture");
}

export async function deactivate() {}
