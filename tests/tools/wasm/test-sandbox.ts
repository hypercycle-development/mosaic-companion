/**
 * Test Script: WASM Sandbox Pipeline
 *
 * Tests the WasmLauncher + Gatekeeper flow directly, without Electron.
 * Run: npx tsx test-tool-wasm/test-sandbox.ts
 *
 * What it tests:
 * 1. WasmLauncher loads a .wasm file
 * 2. Calling an exported function returns results
 * 3. GatekeeperPolicy correctly allows/denies domains
 */

import { resolve } from "path";
import createPlugin from "@extism/extism";
import { ManifestGatekeeperPolicy } from "../../../electron/integrations/sandbox/gatekeeper";
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
// Run all tests
// =============================================================================

async function main() {
  console.log("🚀 MosAIc WASM Sandbox — Pipeline Test\n");
  console.log("=========================================");

  try {
    await testWasmDirect();
    testGatekeeper();

    console.log("\n=========================================");
    console.log("✅ All tests passed! Pipeline is working.");
    console.log("=========================================\n");
  } catch (err) {
    console.error("\n❌ TEST FAILED:", err);
    process.exit(1);
  }
}

main();
