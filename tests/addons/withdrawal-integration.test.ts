/**
 * Integration check: drives the real decision logic over real signed
 * registries produced by mosaic-addons' publish pipeline, in the order a
 * client would meet them — v1, then v2 carrying a withdrawal, then an attacker
 * replaying v1.
 *
 * Point it at a directory holding v1/ and v2/ (each with addon-registry.json):
 *   node dist/withdrawal-integration.test.cjs <dir>
 *
 * This models `fetchCatalogue`'s state machine rather than calling it, because
 * that function is bound to Electron's `app` for its userData path. The
 * decisions under test — freshness gate, reconcile, precedence, activation
 * refusal — all live in withdrawal.ts and are exercised directly.
 */

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  isRegistryFresh,
  readSequence,
  normalizeWithdrawals,
  findIn,
  type WithdrawalRecord,
} from "../../electron/addons/withdrawal";

const dir = process.argv[2];
if (!dir) {
  console.error("usage: node withdrawal-integration.test.cjs <dir containing v1/ and v2/>");
  process.exit(2);
}

/** The persisted client state this feature adds to addon-state.json. */
interface ClientState {
  highestSequence: number;
  withdrawals: Record<string, WithdrawalRecord>;
}

const client: ClientState = { highestSequence: 0, withdrawals: {} };

/** Mirrors fetchCatalogue: freshness gate, then reconcile, then precedence. */
function applyRegistry(file: string): { accepted: boolean; offered: string[]; reason?: string } {
  const registry = JSON.parse(fs.readFileSync(file, "utf8"));
  const sequence = readSequence(registry.sequence);
  if (!isRegistryFresh(sequence, client.highestSequence)) {
    return { accepted: false, offered: [], reason: `sequence ${sequence} < ${client.highestSequence}` };
  }
  client.withdrawals = normalizeWithdrawals(registry.withdrawn, sequence);
  client.highestSequence = sequence;
  const offered = (registry.addons as Array<{ id: string; version: string }>)
    .filter((a) => !findIn(client.withdrawals, a.id, a.version))
    .map((a) => a.id);
  return { accepted: true, offered };
}

/** Mirrors activateAddon's guard — persisted state only, no network. */
function canActivate(id: string, version: string, source: "registry" | "dev"): boolean {
  if (source === "dev") return true;
  const record = findIn(client.withdrawals, id, version);
  return !(record && record.severity === "security");
}

let passed = 0;
function check(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (error) {
    console.error(`  FAIL ${name}\n       ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

console.log("\n1. Client fetches catalogue-v1");
const v1 = applyRegistry(path.join(dir, "v1", "addon-registry.json"));
check("v1 accepted", () => assert.equal(v1.accepted, true));
check("both addons offered", () => assert.deepEqual(v1.offered.sort(), ["hyperinsight", "stargate"]));
check("stargate activates", () => assert.equal(canActivate("stargate", "1.0.0", "registry"), true));

console.log("\n2. Publisher withdraws stargate; client fetches catalogue-v2");
const v2 = applyRegistry(path.join(dir, "v2", "addon-registry.json"));
check("v2 accepted", () => assert.equal(v2.accepted, true));
check("stargate no longer offered for install", () => assert.deepEqual(v2.offered, ["hyperinsight"]));
check("stargate is REFUSED activation, offline, from persisted state", () =>
  assert.equal(canActivate("stargate", "1.0.0", "registry"), false));
check("hyperinsight is unaffected", () => assert.equal(canActivate("hyperinsight", "1.0.0", "registry"), true));
check("the withdrawal reason is available to show the user", () => {
  const record = findIn(client.withdrawals, "stargate", "1.0.0");
  assert.ok(record && record.reason.length > 0);
});
check("a dev install of the same id still activates (author can fix it)", () =>
  assert.equal(canActivate("stargate", "1.0.0", "dev"), true));

console.log("\n3. Attacker replays catalogue-v1 — the validly-signed pre-withdrawal registry");
const replay = applyRegistry(path.join(dir, "v1", "addon-registry.json"));
check("replay is REJECTED on sequence", () => assert.equal(replay.accepted, false));
check("the withdrawal survives the replay attempt", () =>
  assert.equal(canActivate("stargate", "1.0.0", "registry"), false));
check("the replay could not re-offer stargate for install", () => assert.deepEqual(replay.offered, []));

console.log("\n4. Publisher lifts the withdrawal in a fresher registry (v3)");
const v3Path = path.join(dir, "v3-lift.json");
fs.writeFileSync(
  v3Path,
  JSON.stringify({
    schemaVersion: 1,
    sequence: 3,
    addons: [
      { id: "hyperinsight", version: "1.0.0" },
      { id: "stargate", version: "1.0.1" },
    ],
    withdrawn: [],
  }),
);
const v3 = applyRegistry(v3Path);
check("v3 accepted", () => assert.equal(v3.accepted, true));
check("the withdrawal is lifted", () => assert.equal(canActivate("stargate", "1.0.1", "registry"), true));
check("stargate is offered again", () => assert.deepEqual(v3.offered.sort(), ["hyperinsight", "stargate"]));

console.log("\n5. Replaying v2 after the lift cannot re-withdraw");
const replay2 = applyRegistry(path.join(dir, "v2", "addon-registry.json"));
check("v2 replay rejected (sequence 2 < 3)", () => assert.equal(replay2.accepted, false));
check("stargate stays activatable", () => assert.equal(canActivate("stargate", "1.0.1", "registry"), true));

console.log(`\n${passed} passed${process.exitCode ? ", WITH FAILURES" : ""}\n`);
