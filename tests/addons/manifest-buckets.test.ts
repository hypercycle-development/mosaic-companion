/**
 * Bucket declarations in the addon manifest — every way a malformed one must
 * fail to install, and the defaults a valid one gets. Run with:
 *
 *   npx esbuild tests/addons/manifest-buckets.test.ts --bundle --platform=node \
 *     --outfile=dist/manifest-buckets.test.cjs && node dist/manifest-buckets.test.cjs
 *
 * Plain assertions, no test framework — same shape as withdrawal.test.ts.
 *
 * The property under test: a manifest that declares buckets either validates
 * with defaults applied, or fails with a stated reason. Nothing in between —
 * in particular nothing is silently coerced, because a declaration that is
 * quietly widened is worse than one that is refused.
 *
 * Note what this file does NOT establish. A valid `buckets.reads` declaration
 * conveys no access: it only makes a connection proposable to the user. Read
 * access is a per-bucket grant, enforced main-side by `canRead` on every call,
 * and is tested in buckets.test.ts.
 */

import assert from "assert";
import {
  validateManifest,
  PERMISSION_VOCABULARY,
  RESERVED_PERMISSIONS,
  type ManifestValidationResult,
} from "../../electron/addons/manifest";

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

/** A manifest that is valid before anything bucket-shaped is added to it. */
function base(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    manifestVersion: 1,
    id: "demo-addon",
    version: "1.0.0",
    name: "Demo",
    description: "A demo addon.",
    ipcNamespace: "demo",
    mountPoint: "tab",
    tab: { label: "Demo", icon: "box" },
    renderer: { entry: "renderer/index.html" },
    ...extra,
  };
}

const validate = (m: Record<string, unknown>): ManifestValidationResult =>
  validateManifest(m, "demo-addon");

/** Assert invalid, and that some error mentions `fragment` — so a test cannot
 * pass because the manifest was rejected for an unrelated reason. */
function rejects(result: ManifestValidationResult, fragment: string): void {
  assert.strictEqual(result.valid, false, "expected the manifest to be rejected");
  const errors = result.errors.join(" | ");
  assert.ok(
    errors.toLowerCase().includes(fragment.toLowerCase()),
    `expected an error mentioning ${JSON.stringify(fragment)}, got: ${errors}`,
  );
}

function accepts(result: ManifestValidationResult) {
  assert.strictEqual(result.valid, true, `expected valid, got: ${result.errors.join(" | ")}`);
  assert.ok(result.valid);
  return result.manifest;
}

const publisher = (spec: Record<string, unknown>) =>
  base({ permissions: ["buckets:publish"], buckets: { publishes: [spec] } });

console.log("\nmanifest — bucket declarations\n");

// ── the happy paths, and the defaults ──────────────────────────────────────

check("a manifest with no buckets block validates and gets empty defaults", () => {
  const m = accepts(validate(base()));
  assert.deepStrictEqual(m.buckets, { publishes: [], reads: [] });
});

check("a valid publisher validates; history defaults to all and label to the id", () => {
  const m = accepts(validate(publisher({ id: "loop-drafts", kind: "loop-draft" })));
  assert.deepStrictEqual(m.buckets.publishes, [
    { id: "loop-drafts", kind: "loop-draft", history: "all", label: "loop-drafts" },
  ]);
});

check("an explicit history of all is accepted", () => {
  const m = accepts(validate(publisher({ id: "loop-drafts", kind: "loop-draft", history: "all" })));
  assert.strictEqual(m.buckets.publishes[0].history, "all");
});

check("an explicit label is kept", () => {
  const m = accepts(validate(publisher({ id: "loop-drafts", kind: "loop-draft", label: "Loop drafts" })));
  assert.strictEqual(m.buckets.publishes[0].label, "Loop drafts");
});

check("declaring reads needs no install-time permission, and grants nothing", () => {
  const m = accepts(validate(base({ buckets: { reads: ["loop-draft"] } })));
  assert.deepStrictEqual(m.buckets.reads, ["loop-draft"]);
  assert.deepStrictEqual(m.buckets.publishes, []);
});

check("an addon may publish a kind and read the same kind", () => {
  const m = accepts(validate(base({
    permissions: ["buckets:publish"],
    buckets: { publishes: [{ id: "notes", kind: "note" }], reads: ["note"] },
  })));
  assert.strictEqual(m.buckets.publishes[0].kind, "note");
  assert.deepStrictEqual(m.buckets.reads, ["note"]);
});

check("a publisher may declare several buckets of the same kind with different ids", () => {
  const m = accepts(validate(base({
    permissions: ["buckets:publish"],
    buckets: { publishes: [{ id: "drafts-a", kind: "note" }, { id: "drafts-b", kind: "note" }] },
  })));
  assert.strictEqual(m.buckets.publishes.length, 2);
});

// ── shape ──────────────────────────────────────────────────────────────────

check("buckets as an array is rejected", () => {
  rejects(validate(base({ buckets: [] })), '"buckets" must be an object');
});

check("publishes as a non-array is rejected", () => {
  rejects(validate(base({ permissions: ["buckets:publish"], buckets: { publishes: {} } })),
    "buckets.publishes must be an array");
});

check("nine published buckets are rejected", () => {
  const nine = Array.from({ length: 9 }, (_, i) => ({ id: `bucket-${i}`, kind: "note" }));
  rejects(validate(base({ permissions: ["buckets:publish"], buckets: { publishes: nine } })),
    "at most 8 buckets");
});

check("a non-object entry in publishes is rejected", () => {
  rejects(validate(base({ permissions: ["buckets:publish"], buckets: { publishes: ["loop-drafts"] } })),
    "must be an object");
});

// ── ids and kinds ──────────────────────────────────────────────────────────

for (const [label, id] of [
  ["an uppercase letter", "Loop-Drafts"],
  ["a slash", "loop/drafts"],
  ["a traversal segment", ".."],
  ["a leading digit", "1drafts"],
  ["42 characters", "a".repeat(42)],
] as const) {
  check(`a bucket id with ${label} is rejected`, () => {
    rejects(validate(publisher({ id, kind: "loop-draft" })), "buckets.publishes[0].id");
  });
}

check("two buckets with the same id are rejected even with different kinds", () => {
  rejects(validate(base({
    permissions: ["buckets:publish"],
    buckets: { publishes: [{ id: "drafts", kind: "note" }, { id: "drafts", kind: "loop-draft" }] },
  })), "duplicate bucket id");
});

check("a kind containing a space is rejected", () => {
  rejects(validate(publisher({ id: "drafts", kind: "loop draft" })), "buckets.publishes[0].kind");
});

check("a missing kind is rejected", () => {
  rejects(validate(publisher({ id: "drafts" })), "buckets.publishes[0].kind");
});

// ── history: the security-relevant one ─────────────────────────────────────

check("history of since-grant is rejected, not silently widened to all", () => {
  const result = validate(publisher({ id: "drafts", kind: "note", history: "since-grant" }));
  rejects(result, "unknown buckets.publishes[0].history");
  // The point of the rule: asking for a narrower exposure must never yield the
  // wider one. Assert it did not validate at all rather than trusting the text.
  assert.strictEqual(result.valid, false);
});

check("a non-string history is rejected", () => {
  rejects(validate(publisher({ id: "drafts", kind: "note", history: 1 })), "history");
});

// ── labels ─────────────────────────────────────────────────────────────────

check("a label of 41 characters is rejected", () => {
  rejects(validate(publisher({ id: "drafts", kind: "note", label: "a".repeat(41) })), "label");
});

check("an empty label is rejected", () => {
  rejects(validate(publisher({ id: "drafts", kind: "note", label: "" })), "label");
});

// ── reads ──────────────────────────────────────────────────────────────────

check("reads containing a non-string is rejected", () => {
  rejects(validate(base({ buckets: { reads: ["note", 7] } })), "buckets.reads must be an array of strings");
});

check("a duplicated kind in reads is rejected", () => {
  rejects(validate(base({ buckets: { reads: ["note", "note"] } })), "duplicate bucket kind");
});

check("nine read kinds are rejected", () => {
  const nine = Array.from({ length: 9 }, (_, i) => `kind-${i}`);
  rejects(validate(base({ buckets: { reads: nine } })), "at most 8 kinds");
});

check("a malformed kind in reads is rejected", () => {
  rejects(validate(base({ buckets: { reads: ["Loop Draft"] } })), "buckets.reads[0]");
});

// ── permission coherence, both directions ──────────────────────────────────

check("publishing without the buckets:publish permission is rejected", () => {
  rejects(validate(base({ buckets: { publishes: [{ id: "drafts", kind: "note" }] } })),
    'requires the "buckets:publish" permission');
});

check("buckets:publish with no published buckets is rejected", () => {
  rejects(validate(base({ permissions: ["buckets:publish"] })),
    '"buckets:publish" is declared but buckets.publishes is empty');
});

check("buckets:publish with an empty publishes array is rejected", () => {
  rejects(validate(base({ permissions: ["buckets:publish"], buckets: { publishes: [] } })),
    "is empty");
});

check("declaring a kind to read is not itself access to anything", () => {
  // `reads` only makes a connection PROPOSABLE. Actual access is a per-bucket
  // grant the user makes later, checked main-side on every call (canRead).
  // Nothing here should be read as "this addon may now read that kind".
  const m = accepts(validate(base({ buckets: { reads: ["note"] } })));
  assert.deepStrictEqual(m.buckets.reads, ["note"]);
  assert.deepStrictEqual(m.buckets.publishes, []);
});

// ── the vocabulary itself ──────────────────────────────────────────────────

check("buckets:publish is grantable and not reserved", () => {
  assert.ok(PERMISSION_VOCABULARY.includes("buckets:publish"), "should be in the vocabulary");
  assert.ok(!RESERVED_PERMISSIONS.includes("buckets:publish"), "should not be reserved");
});

console.log(`\n${passed} passed\n`);
