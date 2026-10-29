/**
 * The published add-on surface — that the generator still reads the app, and
 * that what it emits is internally coherent. Run with:
 *
 *   node tests/addons/addon-surface.test.mjs
 *
 * Plain assertions, no test framework — same shape as withdrawal.test.ts.
 *
 * WHAT THIS IS GUARDING. `scripts/addon-surface.mjs` walks the TypeScript AST
 * of the preload, the api modules and manifest.ts. An AST walk does not fail
 * loudly when the code it reads is refactored: rename `const addonAPI`, move
 * the `methods` table behind a helper, and the walk finds nothing and emits a
 * perfectly well-formed surface describing an app with no API at all. The
 * catalogue would then gate every submission against an empty vocabulary and
 * block all of them for calling methods that "do not exist" — the exact
 * failure mode mosaic-open-platform#19 was written to prevent, arriving by a
 * new route. So the floors below are deliberate: they are low enough never to
 * need editing when an API is added, and high enough that a silent parse
 * failure cannot pass.
 */

import assert from "assert";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const GENERATOR = path.join(REPO, "scripts", "addon-surface.mjs");

let passed = 0;
function check(name, fn) {
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

function generate(args = []) {
  return JSON.parse(execFileSync("node", [GENERATOR, ...args], { encoding: "utf8", cwd: REPO }));
}

const surface = generate();

// ── the parse found a real app ──────────────────────────────────────────────

check("the surface describes a non-trivial API", () => {
  const namespaces = Object.keys(surface.api.namespaces);
  assert.ok(namespaces.length >= 8, `only ${namespaces.length} namespace(s) — did the preload parse?`);
  const methods = namespaces.flatMap((ns) => Object.keys(surface.api.namespaces[ns].methods));
  assert.ok(methods.length >= 25, `only ${methods.length} method(s) — did the preload parse?`);
});

check("the permission map was read, not just the method names", () => {
  const all = Object.values(surface.api.namespaces).flatMap((ns) => Object.values(ns.methods));
  assert.ok(
    all.some((m) => typeof m.permission === "string"),
    "no method carries a permission — the api/*.ts tables did not parse",
  );
  // And the other half: a namespace that gates nothing is a real, deliberate
  // part of this design (files, settings, system, events), so an all-gated
  // reading is as wrong as an all-ungated one.
  assert.ok(all.some((m) => m.permission === null), "every method is gated — that is not this app");
});

check("the vocabularies were read", () => {
  assert.ok(Object.keys(surface.permissions.grantable).length >= 5, "grantable vocabulary too small");
  assert.ok(surface.permissions.reserved.length >= 1, "reserved vocabulary empty");
  assert.ok(surface.reservedIpcNamespaces.length >= 10, "reserved IPC namespaces too few");
});

check("the manifest limits were read as numbers, not strings", () => {
  const r = surface.manifest;
  assert.strictEqual(r.manifestVersion, 1);
  for (const key of ["maxNameLength", "maxDescriptionLength", "maxTabLabelLength", "maxBucketsPublished"]) {
    assert.strictEqual(typeof r[key], "number", `${key} is ${typeof r[key]}`);
    assert.ok(r[key] > 0, `${key} is ${r[key]}`);
  }
  // Published without delimiters or flags so a consumer in another language
  // can compile it — an anchored pattern, not "/^…$/".
  assert.ok(/^\^.*\$$/.test(r.idPattern), `idPattern not anchored: ${r.idPattern}`);
});

// ── internal coherence ─────────────────────────────────────────────────────

check("every permission a method requires is in the vocabulary", () => {
  const known = new Set([...Object.keys(surface.permissions.grantable), ...surface.permissions.reserved]);
  const orphans = [];
  for (const [ns, spec] of Object.entries(surface.api.namespaces)) {
    for (const [method, m] of Object.entries(spec.methods)) {
      if (m.permission && !known.has(m.permission)) orphans.push(`${ns}.${method} → ${m.permission}`);
    }
  }
  assert.deepStrictEqual(orphans, [], "a method is gated on a permission no manifest can declare");
});

check("a reserved permission gates nothing callable", () => {
  // A reserved permission is one the app refuses at install time. If a live
  // method required one, no add-on could ever call it, which would be a defect
  // in the app rather than in a submission — worth knowing from here.
  const reserved = new Set(surface.permissions.reserved);
  const dead = [];
  for (const [ns, spec] of Object.entries(surface.api.namespaces)) {
    for (const [method, m] of Object.entries(spec.methods)) {
      if (m.permission && reserved.has(m.permission)) dead.push(`${ns}.${method} → ${m.permission}`);
    }
  }
  assert.deepStrictEqual(dead, []);
});

check("the tab icon fallback is itself a renderable name", () => {
  assert.ok(surface.tabIcons.names.length >= 10, `only ${surface.tabIcons.names.length} icon(s)`);
  assert.ok(
    surface.tabIcons.names.includes(surface.tabIcons.fallback),
    `fallback ${surface.tabIcons.fallback} is not in the published set`,
  );
});

check("no version appeared after the version being described", () => {
  const cmp = (a, b) => {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
  };
  const app = surface.app.version;
  const late = [];
  for (const [ns, spec] of Object.entries(surface.api.namespaces)) {
    for (const [method, m] of Object.entries(spec.methods)) {
      if (!m.since) late.push(`${ns}.${method} has no since`);
      else if (cmp(m.since, app) > 0) late.push(`${ns}.${method} since ${m.since} > app ${app}`);
      else if (cmp(m.since, surface.sinceHorizon) < 0) late.push(`${ns}.${method} since ${m.since} predates the horizon`);
    }
  }
  assert.deepStrictEqual(late, []);
});

check("the add-on bridge did not exist before the horizon", () => {
  // Not decoration. It is the floor every `minAppVersion` claim is measured
  // against: an add-on calling any addonAPI method at all cannot honestly
  // declare a minimum older than this.
  assert.ok(surface.sinceHorizon, "no horizon — the tag walk found no release with the bridge in it");
});

// ── the mode CI depends on ─────────────────────────────────────────────────

check("--check reports a stale file and an up-to-date one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "addon-surface-"));
  try {
    const file = path.join(dir, "surface.json");
    execFileSync("node", [GENERATOR, "--out", file], { cwd: REPO, stdio: "ignore" });
    execFileSync("node", [GENERATOR, "--check", file], { cwd: REPO, stdio: "ignore" });

    const stale = JSON.parse(fs.readFileSync(file, "utf8"));
    delete stale.api.namespaces.buckets;
    fs.writeFileSync(file, JSON.stringify(stale, null, 2));
    assert.throws(
      () => execFileSync("node", [GENERATOR, "--check", file], { cwd: REPO, stdio: "ignore" }),
      "a file missing a whole namespace was reported as up to date",
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

check("--check ignores the commit, which says nothing about the surface", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "addon-surface-"));
  try {
    const file = path.join(dir, "surface.json");
    execFileSync("node", [GENERATOR, "--out", file], { cwd: REPO, stdio: "ignore" });
    const copy = JSON.parse(fs.readFileSync(file, "utf8"));
    copy.app.commit = "0".repeat(40);
    copy.app.describe = "v0.0.0";
    fs.writeFileSync(file, JSON.stringify(copy, null, 2));
    // Must still pass: otherwise the vendored copy in mosaic-open-platform
    // goes stale on every unrelated commit and the signal is worthless.
    execFileSync("node", [GENERATOR, "--check", file], { cwd: REPO, stdio: "ignore" });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log(`\n${passed} passed\n`);
