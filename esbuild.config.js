import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["electron/main.ts", "electron/preload.ts"],
  bundle: true,
  platform: "node",
  outdir: "dist_electron",
  external: ["electron", "electron-updater"],
  format: "esm",
});

console.log("Electron build complete");
