/**
 * Test fixture — the addon-main contract's failure path.
 * `activate()` throws synchronously; the loader must catch this, record
 * `lastError` in addon-state.json, and leave the rest of the app (including
 * other addons) unaffected.
 */
export async function activate(_ctx) {
  throw new Error("boom — intentional crash-addon fixture failure");
}

export async function deactivate() {}
