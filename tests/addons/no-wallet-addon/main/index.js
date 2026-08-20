/**
 * Test fixture — declares zero permissions. Its own main doesn't
 * need to do anything; the point of this fixture is entirely in what its
 * *renderer* is denied.
 */
export async function activate(ctx) {
  ctx.log("activating no-wallet-addon fixture");
}

export async function deactivate() {}
