// esbuild.config.js
import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["electron/main.ts", "electron/preload.ts"],
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

// Build the standalone MCP server script for plugins
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
