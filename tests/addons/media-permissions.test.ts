/**
 * Camera/microphone for addons — the manifest half. Run with:
 *
 *   npx esbuild tests/addons/media-permissions.test.ts --bundle --platform=node \
 *     --outfile=dist/media-permissions.test.cjs && node dist/media-permissions.test.cjs
 *
 * Plain assertions, no test framework — same shape as withdrawal.test.ts.
 *
 * The property under test: a capture request is allowed only if the addon was
 * granted a permission for every kind of capture it asks for. Asking for more
 * than was granted, or for nothing recognisable, is refused outright.
 *
 * Not covered here: the per-launch prompt and the Electron session handlers in
 * `electron/permissions.ts`, which need a running app.
 */

import assert from "assert";
import { grantsMedia, validateManifest, PERMISSION_VOCABULARY } from "../../electron/addons/manifest";

let passed = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

const both = new Set(["media:camera", "media:microphone"]);
const cameraOnly = new Set(["media:camera"]);

console.log("\nmedia permissions\n");

check("both granted allows camera, microphone, or both", () => {
  assert.ok(grantsMedia(both, ["video"]));
  assert.ok(grantsMedia(both, ["audio"]));
  assert.ok(grantsMedia(both, ["video", "audio"]));
});

check("asking for more than was granted is refused", () => {
  assert.ok(grantsMedia(cameraOnly, ["video"]));
  assert.ok(!grantsMedia(cameraOnly, ["audio"]));
  assert.ok(!grantsMedia(cameraOnly, ["video", "audio"]));
});

check("nothing granted refuses everything", () => {
  assert.ok(!grantsMedia(new Set(), ["video"]));
  assert.ok(!grantsMedia(new Set(["shell:open-external"]), ["audio"]));
});

check("an empty or unrecognised request is refused", () => {
  assert.ok(!grantsMedia(both, []));
  assert.ok(!grantsMedia(both, ["unknown"]));
  assert.ok(!grantsMedia(both, ["video", "unknown"]));
});

check("a manifest may declare both", () => {
  assert.ok(PERMISSION_VOCABULARY.includes("media:camera"));
  assert.ok(PERMISSION_VOCABULARY.includes("media:microphone"));
  const result = validateManifest(
    {
      manifestVersion: 1,
      id: "demo-addon",
      version: "1.0.0",
      name: "Demo",
      description: "A demo addon.",
      ipcNamespace: "demo",
      mountPoint: "tab",
      tab: { label: "Demo", icon: "Video" },
      renderer: { entry: "renderer/index.html" },
      permissions: ["media:camera", "media:microphone"],
    },
    "demo-addon",
  );
  assert.strictEqual(result.valid, true, result.valid ? "" : result.errors.join(" | "));
});

console.log(`\n${passed} passed\n`);
