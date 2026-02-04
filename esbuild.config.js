// esbuild.config.js
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["electron/main.ts", "electron/preload.ts"],
  bundle: true,
  platform: "node",
  outdir: "dist_electron",
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
  ],

});

console.log("✅ Electron build complete");