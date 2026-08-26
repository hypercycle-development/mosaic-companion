/**
 * Withdrawal decision logic — the rules a replay attack or a publisher typo
 * would exploit. Run with:
 *
 *   npx esbuild tests/addons/withdrawal.test.ts --bundle --platform=node \
 *     --outfile=dist/withdrawal.test.cjs && node dist/withdrawal.test.cjs
 *
 * Plain assertions, no test framework — the repo has only Playwright e2e,
 * which needs a built app and a display, and this logic deserves a check that
 * runs in a second.
 */

import assert from "assert";
import {
  isRegistryFresh,
  readSequence,
  normalizeWithdrawals,
  matchesVersion,
  findIn,
  DEFAULT_WITHDRAWAL_REASON,
  MAX_WITHDRAWAL_REASON,
  isCatalogueStale,
  CATALOGUE_STALE_AFTER_DAYS,
  type WithdrawalRecord,
} from "../../electron/addons/withdrawal";

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

console.log("\nFreshness / rollback");

check("accepts a newer registry", () => assert.equal(isRegistryFresh(43, 42), true));
check("accepts the same registry re-fetched", () => assert.equal(isRegistryFresh(42, 42), true));
check("REJECTS an older registry (the replay attack)", () => assert.equal(isRegistryFresh(41, 42), false));
check("rejects an unsequenced registry once a sequence has been seen", () =>
  assert.equal(isRegistryFresh(readSequence(undefined), 42), false));
check("accepts an unsequenced registry on a fresh profile", () =>
  assert.equal(isRegistryFresh(readSequence(undefined), 0), true));
check("readSequence rejects junk, zero and negatives", () => {
  assert.equal(readSequence("7"), 0);
  assert.equal(readSequence(0), 0);
  assert.equal(readSequence(-5), 0);
  assert.equal(readSequence(NaN), 0);
  assert.equal(readSequence(Infinity), 0);
  assert.equal(readSequence(7), 7);
});

console.log("\nNormalisation — fail closed, never downgrade");

check("severity defaults to security when absent", () => {
  const out = normalizeWithdrawals([{ id: "a" }], 1);
  assert.equal(out.a.severity, "security");
});
check("an unrecognised severity does NOT downgrade to advisory", () => {
  const out = normalizeWithdrawals([{ id: "a", severity: "meh" }], 1);
  assert.equal(out.a.severity, "security");
});
check("advisory is honoured when stated exactly", () => {
  const out = normalizeWithdrawals([{ id: "a", severity: "advisory" }], 1);
  assert.equal(out.a.severity, "advisory");
});
check("versions defaults to * (all versions)", () => {
  const out = normalizeWithdrawals([{ id: "a" }], 1);
  assert.equal(out.a.versions, "*");
});
check("a malformed entry is skipped without discarding its neighbours", () => {
  const out = normalizeWithdrawals([{ id: "a" }, null, 42, { noId: true }, { id: "" }, { id: "b" }], 1);
  assert.deepEqual(Object.keys(out).sort(), ["a", "b"]);
});
check("non-array input yields no withdrawals", () => {
  assert.deepEqual(normalizeWithdrawals(undefined, 1), {});
  assert.deepEqual(normalizeWithdrawals("nope", 1), {});
});
check("reason is length-capped", () => {
  const out = normalizeWithdrawals([{ id: "a", reason: "x".repeat(5000) }], 1);
  assert.equal(out.a.reason.length, MAX_WITHDRAWAL_REASON);
});
check("missing reason gets a default rather than undefined", () => {
  const out = normalizeWithdrawals([{ id: "a" }], 1);
  assert.equal(out.a.reason, DEFAULT_WITHDRAWAL_REASON);
});

console.log("\nVersion matching");

const rec = (versions: string): WithdrawalRecord => ({
  versions,
  reason: "r",
  severity: "security",
  withdrawnAt: "2026-08-21T00:00:00Z",
  sequence: 1,
});

check('"*" matches every version', () => {
  assert.equal(matchesVersion(rec("*"), "1.0.0"), true);
  assert.equal(matchesVersion(rec("*"), "99.99.99"), true);
});
check("a range matches only inside it", () => {
  assert.equal(matchesVersion(rec("<1.3.0"), "1.2.0"), true);
  assert.equal(matchesVersion(rec("<1.3.0"), "1.3.0"), false);
});
check("an unparseable range FAILS CLOSED (still withdrawn)", () =>
  assert.equal(matchesVersion(rec("not-a-range"), "1.0.0"), true));
check("an unparseable version FAILS CLOSED", () =>
  assert.equal(matchesVersion(rec("<1.3.0"), "banana"), true));

console.log("\nLookup");

const set = {
  gone: rec("*"),
  partial: rec("<2.0.0"),
};
check("finds a matching withdrawal", () => assert.ok(findIn(set, "gone", "1.0.0")));
check("returns nothing for an unlisted id", () => assert.equal(findIn(set, "other", "1.0.0"), undefined));
check("returns nothing for a version outside the range", () =>
  assert.equal(findIn(set, "partial", "2.1.0"), undefined));
check("returns the record for a version inside the range", () => assert.ok(findIn(set, "partial", "1.9.0")));

console.log("\nLift semantics (reconcile, do not accumulate)");

check("a later registry omitting an entry lifts it", () => {
  const first = normalizeWithdrawals([{ id: "a" }, { id: "b" }], 10);
  assert.deepEqual(Object.keys(first).sort(), ["a", "b"]);
  // The client replaces wholesale rather than merging, so "b" disappearing
  // from a fresher registry is a lift.
  const second = normalizeWithdrawals([{ id: "a" }], 11);
  assert.deepEqual(Object.keys(second), ["a"]);
  assert.equal(findIn(second, "b", "1.0.0"), undefined);
});
check("an OLDER registry cannot forge a lift — it never passes the gate", () => {
  assert.equal(isRegistryFresh(9, 11), false);
});

console.log("\nCatalogue staleness");

check("a never-fetched catalogue does NOT warn", () => {
  // Until the first catalogue is published this is every user alive. Warning
  // here would put a security banner in front of the whole install base on day
  // one, about something none of them can do anything about.
  assert.equal(isCatalogueStale(null), false);
});

check("a recent fetch does not warn", () => {
  assert.equal(isCatalogueStale(0), false);
  assert.equal(isCatalogueStale(CATALOGUE_STALE_AFTER_DAYS - 1), false);
});

check("the threshold itself warns", () => {
  assert.equal(isCatalogueStale(CATALOGUE_STALE_AFTER_DAYS), true);
});

check("well past the threshold warns", () => {
  assert.equal(isCatalogueStale(CATALOGUE_STALE_AFTER_DAYS + 90), true);
});

console.log(`\n${passed} passed${process.exitCode ? ", WITH FAILURES" : ""}\n`);
