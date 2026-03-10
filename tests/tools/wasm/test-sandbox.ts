/**
 * Test Script: WASM Sandbox Pipeline
 *
 * Tests the WasmLauncher + Gatekeeper + Chronicle flow directly, without Electron.
 * Run: npx tsx tests/tools/wasm/test-sandbox.ts
 *
 * What it tests:
 * 1. WasmLauncher loads a .wasm file and calls an exported function
 * 2. GatekeeperPolicy correctly allows/denies domains, files, and services
 * 3. Chronicle writes append-only JSONL entries and supports filtered reads
 *
 * TODO(testing): Migrate to Vitest.
 * Vitest is the right fit — the project already uses Vite, so config is shared,
 * ESNext modules work natively, and `vi.mock("electron", ...)` cleanly replaces
 * the current setChronicleInstance() workaround for Electron deps.
 *
 * Migration steps:
 *   1. `npm install -D vitest` (devDependency only, never bundled)
 *   2. Add `vitest.config.ts` at project root with `environment: "node"`
 *      and `exclude: ["electron/**", "src/**"]`
 *   3. Rename this file to `test-sandbox.test.ts`
 *   4. Replace manual `if/throw` assertions with `expect()` from "vitest"
 *   5. Add `"test": "vitest run"` and `"test:watch": "vitest"` to package.json scripts
 */

import { resolve } from "path";
import { mkdtempSync, rmSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import createPlugin from "@extism/extism";
import { ManifestGatekeeperPolicy } from "../../../electron/integrations/sandbox/gatekeeper";
import { Chronicle, setChronicleInstance } from "../../../electron/integrations/sandbox/chronicle";
import type { ToolManifest } from "../../../electron/integrations/sandbox/types";

// =============================================================================
// Test the WASM module directly (simplest possible test)
// =============================================================================

async function testWasmDirect() {
  console.log("\n=== Test 1: Direct WASM load via Extism ===\n");

  const wasmPath = resolve(__dirname, "count_vowels.wasm");
  console.log(`Loading WASM from: ${wasmPath}`);

  const plugin = await createPlugin(wasmPath, { useWasi: true });
  console.log("✅ Plugin loaded successfully");

  const result = await plugin.call("count_vowels", "Hello World from MosAIc!");
  const output = result?.json();
  console.log(`Input:  "Hello World from MosAIc!"`);
  console.log(`Output: ${JSON.stringify(output)}`);
  console.log(`✅ count_vowels returned: ${output.count} vowels`);

  await plugin.close();
  console.log("✅ Plugin closed");
}

// =============================================================================
// Test the GatekeeperPolicy
// =============================================================================

function testGatekeeper() {
  console.log("\n=== Test 2: GatekeeperPolicy allow/deny ===\n");

  const policy = new ManifestGatekeeperPolicy();

  // Register a test tool with specific permissions
  const manifest: ToolManifest = {
    manifestVersion: "1.0.0",
    id: "test-tool",
    version: "1.0.0",
    displayName: "Test Tool",
    description: "A test tool",
    runtime: { type: "wasm", entry: "test.wasm" },
    permissions: {
      internet: true,
      allowed_domains: ["api.openai.com", "httpbin.org"],
      files: ["/tmp/mosaic/"],
      services: ["elasticsearch"],
    },
    resources: { memory: "64m", timeout: "30s" },
    tools: {
      test: { description: "A test function" },
    },
  };

  policy.registerTool(manifest);

  // Test domain checks
  const tests = [
    { domain: "api.openai.com", expected: true },
    { domain: "httpbin.org", expected: true },
    { domain: "evil.com", expected: false },
    { domain: "google.com", expected: false },
  ];

  for (const t of tests) {
    const result = policy.checkDomain("test-tool", t.domain);
    const icon = result.allowed === t.expected ? "✅" : "❌";
    console.log(
      `${icon} checkDomain("${t.domain}") → ${result.allowed ? "ALLOW" : "DENY"}` +
        (result.reason ? ` (${result.reason})` : ""),
    );
    if (result.allowed !== t.expected) {
      throw new Error(`Expected ${t.expected} but got ${result.allowed}`);
    }
  }

  // Test file path checks
  const fileTests = [
    { path: "/tmp/mosaic/data.csv", expected: true },
    { path: "/tmp/mosaic/subdir/file.txt", expected: true },
    { path: "/etc/passwd", expected: false },
    { path: "/home/user/.ssh/id_rsa", expected: false },
  ];

  console.log("");
  for (const t of fileTests) {
    const result = policy.checkFilePath("test-tool", t.path);
    const icon = result.allowed === t.expected ? "✅" : "❌";
    console.log(
      `${icon} checkFilePath("${t.path}") → ${result.allowed ? "ALLOW" : "DENY"}` +
        (result.reason ? ` (${result.reason})` : ""),
    );
    if (result.allowed !== t.expected) {
      throw new Error(`Expected ${t.expected} but got ${result.allowed}`);
    }
  }

  // Test service checks
  const serviceTests = [
    { service: "elasticsearch", expected: true },
    { service: "postgresql", expected: false },
  ];

  console.log("");
  for (const t of serviceTests) {
    const result = policy.checkService("test-tool", t.service);
    const icon = result.allowed === t.expected ? "✅" : "❌";
    console.log(
      `${icon} checkService("${t.service}") → ${result.allowed ? "ALLOW" : "DENY"}`,
    );
    if (result.allowed !== t.expected) {
      throw new Error(`Expected ${t.expected} but got ${result.allowed}`);
    }
  }

  // Test tool with NO internet permission
  const noInternetManifest: ToolManifest = {
    ...manifest,
    id: "no-internet-tool",
    permissions: { ...manifest.permissions, internet: false },
  };
  policy.registerTool(noInternetManifest);

  const noInternetResult = policy.checkDomain("no-internet-tool", "api.openai.com");
  const icon = !noInternetResult.allowed ? "✅" : "❌";
  console.log(
    `\n${icon} Tool without internet: checkDomain("api.openai.com") → ${noInternetResult.allowed ? "ALLOW" : "DENY"} (${noInternetResult.reason})`,
  );

  // Check audit log
  const auditLog = policy.getAuditLog();
  console.log(`\n📋 Audit log: ${auditLog.length} entries recorded`);

  policy.unregisterTool("test-tool");
  policy.unregisterTool("no-internet-tool");
  console.log("✅ All Gatekeeper tests passed!");
}

// =============================================================================
// Test the Chronicle module
// =============================================================================

function testChronicle() {
  console.log("\n=== Test 3: Chronicle — append-only JSONL log ===\n");

  // Use a temp directory so the test is self-contained
  const tmpDir = mkdtempSync(join(tmpdir(), "mosaic-chronicle-test-"));
  const c = new Chronicle(tmpDir);

  // Inject as singleton so gatekeeper host functions write here too
  setChronicleInstance(c);

  try {
    const toolId = "test-chronicle-tool";

    // --- Write entries ---
    c.logLifecycle(toolId, "launched", { version: "1.0.0" });
    c.logTool(toolId, "Starting analysis...");
    c.writeOutput(toolId, { result: "42 vowels found", confidence: 0.99 });
    c.logAudit(toolId, "api.openai.com", "ALLOW", "domain");
    c.logAudit(toolId, "evil.com", "DENY", "domain", "Not in allowlist");
    c.logLifecycle(toolId, "stopped");

    console.log(`✅ Wrote 6 entries to: ${c.getPath(toolId)}`);

    // --- Verify the JSONL file exists and has 6 lines ---
    const raw = readFileSync(c.getPath(toolId), "utf-8");
    const lines = raw.split("\n").filter((l) => l.trim().length > 0);
    if (lines.length !== 6) throw new Error(`Expected 6 lines, got ${lines.length}`);
    console.log(`✅ JSONL file has 6 lines`);

    // --- Verify each line is valid JSON ---
    const entries = lines.map((l) => JSON.parse(l));
    console.log(`✅ All lines are valid JSON`);

    // --- Verify entry structure ---
    const first = entries[0];
    if (!first.id || !first.timestamp || !first.source || !first.type || !first.data) {
      throw new Error("Entry missing required fields");
    }
    console.log(`✅ Entry structure valid: { id, timestamp, source, type, data }`);

    // --- Verify sources ---
    const sources = entries.map((e: {source: string}) => e.source);
    if (!sources.includes("core")) throw new Error("Missing core source");
    if (!sources.includes("tool")) throw new Error("Missing tool source");
    if (!sources.includes("gatekeeper")) throw new Error("Missing gatekeeper source");
    console.log(`✅ All three sources present: core, tool, gatekeeper`);

    // --- Read with filters ---
    const all = c.read(toolId);
    if (all.length !== 6) throw new Error(`read() returned ${all.length}, expected 6`);
    console.log(`✅ read() returns all 6 entries`);

    const auditOnly = c.read(toolId, { type: "audit" });
    if (auditOnly.length !== 2) throw new Error(`Expected 2 audit entries, got ${auditOnly.length}`);
    console.log(`✅ read({ type: "audit" }) returns 2 entries`);

    const gatekeeperOnly = c.read(toolId, { source: "gatekeeper" });
    if (gatekeeperOnly.length !== 2) throw new Error(`Expected 2 gatekeeper entries`);
    console.log(`✅ read({ source: "gatekeeper" }) returns 2 entries`);

    const limited = c.read(toolId, { limit: 2 });
    if (limited.length !== 2) throw new Error(`limit: 2 returned ${limited.length}`);
    console.log(`✅ read({ limit: 2 }) respects limit`);

    // --- hasEntries ---
    if (!c.hasEntries(toolId)) throw new Error("hasEntries() returned false");
    if (c.hasEntries("nonexistent-tool")) throw new Error("hasEntries() should return false for unknown tool");
    console.log(`✅ hasEntries() works correctly`);

    // --- Verify gatekeeper logDecision() auto-writes via setChronicleInstance ---
    const policy = new ManifestGatekeeperPolicy();
    const manifest: ToolManifest = {
      manifestVersion: "1.0.0",
      id: "gatekeeper-chronicle-tool",
      version: "1.0.0",
      displayName: "GK Chronicle Test",
      description: "Tests gatekeeper → chronicle wiring",
      runtime: { type: "wasm", entry: "test.wasm" },
      permissions: {
        internet: true,
        allowed_domains: ["httpbin.org"],
        files: [],
        services: [],
      },
      resources: { memory: "64m", timeout: "10s" },
      tools: {},
    };
    policy.registerTool(manifest);

    // logDecision() is what the http_request host function calls after checkDomain.
    // Test that it auto-persists to Chronicle.
    policy.logDecision({
      timestamp: new Date().toISOString(),
      toolId: "gatekeeper-chronicle-tool",
      resource: "httpbin.org",
      action: "ALLOW",
      type: "domain",
    });
    policy.logDecision({
      timestamp: new Date().toISOString(),
      toolId: "gatekeeper-chronicle-tool",
      resource: "evil.com",
      action: "DENY",
      reason: "Not in allowlist",
      type: "domain",
    });

    const gkEntries = c.read("gatekeeper-chronicle-tool", { source: "gatekeeper" });
    if (gkEntries.length !== 2) {
      throw new Error(`Expected gatekeeper to write 2 audit entries, got ${gkEntries.length}`);
    }
    const allow = gkEntries.find((e) => (e.data as {action: string}).action === "ALLOW");
    const deny = gkEntries.find((e) => (e.data as {action: string}).action === "DENY");
    if (!allow || !deny) throw new Error("Missing ALLOW or DENY entry");
    console.log(`✅ Gatekeeper auto-writes to Chronicle on domain decisions`);
    console.log(`   ALLOW: ${(allow.data as {resource: string}).resource}`);
    console.log(`   DENY:  ${(deny.data as {resource: string}).resource} — ${(deny.data as {reason: string}).reason}`);

    console.log("\n✅ All Chronicle tests passed!");
  } finally {
    // Cleanup temp dir
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

// =============================================================================
// Run all tests
// =============================================================================

async function main() {
  console.log("🚀 MosAIc WASM Sandbox — Pipeline Test\n");
  console.log("=========================================");

  try {
    await testWasmDirect();
    testGatekeeper();
    testChronicle();

    console.log("\n=========================================");
    console.log("✅ All tests passed! Pipeline is working.");
    console.log("=========================================\n");
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  }
}

main();
