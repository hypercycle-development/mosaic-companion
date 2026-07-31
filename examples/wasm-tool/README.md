# wasm-tool

A working sandboxed WASM tool: **text-stats**, which counts words, characters
and sentences in a string and estimates reading time.

Written in TypeScript and compiled to WebAssembly with
[`extism-js`](https://github.com/extism/js-pdk) — so you can write a tool
without a Rust or C toolchain.

## Files

| File | Purpose |
|------|---------|
| `src/index.ts` | The tool: a `mosaic_manifest()` export and one `analyze()` tool function |
| `text-stats.wasm` | The compiled artifact — what you actually install |
| `package.json` | The two-step build (`bundle` with esbuild, then `build` with extism-js) |

## Build

```sh
npm install
npm run bundle   # esbuild → dist/bundle.js — no extra toolchain needed
npm run build    # bundle, then extism-js → text-stats.wasm
```

`npm run build` needs the `extism-js` binary on your `PATH`
([install instructions](https://github.com/extism/js-pdk#installation)).
`npm run bundle` doesn't, so you can iterate on the TypeScript without it.

A prebuilt `text-stats.wasm` is committed, so you can install and try the tool
without building anything.

## Install

**Tool Sandbox → Install tool**, and select `text-stats.wasm`. Then call
`analyze` with `{ "text": "..." }`.

## How a tool is structured

Two exports, both communicating over Extism's host string I/O:

- **`mosaic_manifest()`** — returns the `ToolManifest` JSON: identity,
  permissions, resource limits, and the tools you expose with their input
  schemas. Mosaic calls this at install time to learn what your tool is.
- **`analyze()`** — one tool function. Reads its arguments with
  `Host.inputString()`, writes its result with `Host.outputString()`. Each
  entry under `tools` in the manifest maps to an export of the same name.

Note what this tool declares:

```json
"permissions": { "internet": false, "allowed_domains": [], "files": [], "services": [] },
"resources":   { "memory": "16m", "timeout": "10s" }
```

Everything is denied by default and the tool asks for nothing, because pure
computation needs nothing. The gatekeeper enforces this at the sandbox
boundary — undeclared access fails at runtime, it isn't merely discouraged.
Declare the minimum, and expect users to look.

## Reference

| Doc | What it covers |
|-----|----------------|
| [`manifest.md`](../../docs/architecture/manifest.md) | The full `ToolManifest` schema |
| [`tool-lifecycle.md`](../../docs/architecture/tool-lifecycle.md) | Install → launch → call → stop |
| [`gatekeeper.md`](../../docs/architecture/gatekeeper.md) | How permissions are enforced |
| [`tool-panels-ui.md`](../../docs/architecture/tool-panels-ui.md) | Optional custom UI panels |

For more tools in the same style, see [`../wasm/`](../wasm/) —
`cron-explain` and `checksum`.
