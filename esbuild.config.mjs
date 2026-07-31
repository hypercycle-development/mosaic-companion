// esbuild.config.mjs
//
// The ONLY esbuild config. `forge.config.js`'s generateAssets hook and
// `npm run build:electron` must both run this file.
//
// There used to be a second, older `esbuild.config.js` that the Forge hook
// ran instead. It listed only main.ts + preload.ts, so every release built by
// CI (where `dist/` starts empty) silently shipped an asar with NO
// `addon-preload.js` and NO `secure-wallet-import-preload.js` — which broke
// every addon in v0.1.10, because `ADDON_PRELOAD_PATH` pointed at a file that
// wasn't there and `window.addonAPI` came out undefined. It went unnoticed
// locally because a stale `dist/main/addon-preload.js` from an earlier manual
// `build:electron` run was still sitting on disk. Keep this file as the single
// source of truth; do not reintroduce a second config.
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: [
    "electron/main.ts",
    "electron/preload.ts",
    "electron/secure-wallet-import-preload.ts",
    "electron/addon-preload.ts",
  ],
  bundle: true,
  platform: "node",
  outdir: "dist/main",
  format: "cjs",  // Changed from "esm" to "cjs" for better compatibility
  external: [
    // Electron
    "electron",
    "electron-updater",
    // Node.js built-ins that googleapis uses dynamically
    "child_process",
    "fs",
    "path",
    "os",
    "crypto",
    "http",
    "https",
    "net",
    "tls",
    "stream",
    "zlib",
    "events",
    "util",
    "url",
    "querystring",
    "buffer",
    // Google APIs - they have dynamic requires that break ESM bundling
    "googleapis",
    "google-auth-library",
    "googleapis-common",
    // Native modules
    "onnxruntime-node",
    "sharp",
    "better-sqlite3",
    "sqlite-vec",
    "chokidar",
    "node-pty",
    // Other unresolved dependencies
    "xtend",
    "encode-utf8",
  ],

});

// Build the standalone MCP server script for plugins. This was only ever in
// the old `esbuild.config.js`, so it has to live here now that that file is
// gone — without it, `dist/main/mcp-server.js` is never emitted.
await esbuild.build({
  entryPoints: ["plugins/aim-nodes/main/mcp-server.js"],
  bundle: true,
  platform: "node",
  outfile: "dist/main/mcp-server.js",
  format: "cjs",
  external: [
    // Don't bundle electron or heavy natives
    "electron",
  ],
});

console.log("✅ Electron build complete");