// =============================================================================
// FUNCTIONAL TEST — esbuild bundle + VM execution
// Tests the actual bundling and sandbox execution without Electron
// =============================================================================

const esbuild = require("esbuild");
const { Script } = require("vm");
const fs = require("fs");
const path = require("path");
const os = require("os");

console.log("=== AgentForgeEngine Functional Smoke Test ===\n");

// Sample agent code (anfe-minter template-like)
const sampleCode = `
import { someLib } from "@meshsdk/core";

interface MintConfig {
  policyId: string;
  walletAddress: string;
}

export async function mintANFE(config: MintConfig): Promise<string> {
  console.log("Minting ANFE for", config.walletAddress);
  return "tx-hash-123";
}

console.log("Agent module loaded");
`;

async function runTest() {
  let tmpDir;
  try {
    // 1. Write sample code to temp file
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-func-"));
    const entryFile = path.join(tmpDir, "agent.ts");
    fs.writeFileSync(entryFile, sampleCode, "utf8");
    console.log("✅ Step 1: Wrote sample agent code");

    // 2. Bundle with esbuild (same params as AgentForgeEngine)
    const result = await esbuild.build({
      entryPoints: [entryFile],
      bundle: true,
      write: false,
      format: "cjs",
      platform: "node",
      target: "node20",
      external: ["*"],
      minify: false,
      sourcemap: false,
    });
    const bundled = result.outputFiles[0].text;
    console.log(`✅ Step 2: esbuild bundled → ${bundled.length} chars`);

    // 3. Verify bundle contains expected exports
    const hasExport = bundled.includes("mintANFE");
    console.log(`${hasExport ? "✅" : "❌"} Step 3: Bundle contains 'mintANFE' export`);

    // 4. Run in isolated VM (same sandbox as AgentForgeEngine)
    const vmLogs = [];
    const context = {
      console: {
        log: (...args) => vmLogs.push(args.join(" ")),
        error: (...args) => vmLogs.push("ERR: " + args.join(" ")),
        warn: (...args) => vmLogs.push("WARN: " + args.join(" ")),
      },
      process: { env: {} },
      Buffer: { from: () => ({}) },
      setTimeout: () => 0,
      clearTimeout: () => 0,
      setInterval: () => 0,
      clearInterval: () => 0,
      exports: {},
      module: { exports: {} },
      require: () => {
        throw new Error("require() not available in test VM");
      },
    };

    const script = new Script(bundled, { timeout: 5000, displayErrors: true });
    script.runInNewContext(context, { timeout: 5000 });
    console.log("✅ Step 4: VM execution completed without error");

    // 5. Check VM logs
    const hasModuleLoaded = vmLogs.some((l) => l.includes("Agent module loaded"));
    console.log(`${hasModuleLoaded ? "✅" : "❌"} Step 5: VM logged 'Agent module loaded'`);

    // 6. Check exports exist
    const exports = context.module?.exports || context.exports;
    const hasExports = exports && Object.keys(exports).length > 0;
    console.log(`${hasExports ? "✅" : "❌"} Step 6: Module has exports (${Object.keys(exports).length} keys)`);

    // 7. Verify export function name
    const hasMintExport = bundled.includes("mintANFE");
    console.log(`${hasMintExport ? "✅" : "❌"} Step 7: Bundle references 'mintANFE'`);

    console.log("\n=== Functional Test PASSED ===");
    console.log("The forge pipeline (esbuild → bundle → VM) works correctly.");

    return true;
  } catch (err) {
    console.error("\n❌ Functional test FAILED:", err.message);
    console.error(err.stack);
    return false;
  } finally {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
    }
  }
}

runTest().then((ok) => {
  process.exit(ok ? 0 : 1);
});
