#!/usr/bin/env node
// ============================================================================
// addon-surface.mjs — publish a machine-readable description of this app's
// add-on surface, so the catalogue's adjudicator can gate a submission against
// the application rather than against a copy of it.
//
// WHY THIS EXISTS. mosaic-open-platform's `scripts/adjudicate/policy.mjs`
// mirrors this app's permission vocabulary and reserved sets by hand, and the
// supplementary checks that matter most — does every `addonAPI` call name a
// method that exists; is `minAppVersion` consistent with the APIs called; will
// `tab.icon` render — need to know what the app offers at a named version.
// Four review rounds measured what happens when a gate guesses instead: three
// of four gate failures on the final round were defects in our checking, not
// in the submission, and a contributor can neither see nor fix those. See
// mosaic-open-platform#19.
//
// HOW IT READS THE APP. Through the TypeScript AST, never a regex over source
// text. Two of the three false blocks that round came from a scan reading a
// comment as code — one add-on was failed for "needing mcp:call" on the
// strength of a comment explaining why it deliberately does not call it. The
// AST has no comments in it, so that whole defect class is unreachable here.
// Nothing is executed and nothing is bundled: these files import the main
// process, and a generator with side effects is a generator nobody runs.
//
// Usage:
//   node scripts/addon-surface.mjs                 # print to stdout
//   node scripts/addon-surface.mjs --out <file>    # write
//   node scripts/addon-surface.mjs --ref v0.1.13   # describe a release, not
//                                                  # the working tree
//   node scripts/addon-surface.mjs --no-history    # skip the per-tag walk
//   node scripts/addon-surface.mjs --check <file>  # exit 1 if <file> is stale
//
// `--ref` is how the catalogue gets a surface it can vendor: the file it
// commits must describe a build that exists, and "whatever was in a working
// tree that day" is not one.
// ============================================================================

import ts from "typescript";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SRC = {
  preload: "electron/addon-preload.ts",
  manifest: "electron/addons/manifest.ts",
  apiDir: "electron/addons/api",
  icons: "src/components/addonIcons.tsx",
  sidebar: "src/components/Sidebar.tsx",
  pkg: "package.json",
};

// ── reading a file, either from the working tree or from a git ref ──────────
function git(args) {
  // stderr is discarded because the history walk asks every tag for files that
  // predate them, and `fatal: path … does not exist` is the expected answer.
  return execFileSync("git", ["-C", REPO, ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "ignore"],
  });
}

/** File contents at `ref` (null = the working tree), or null if absent. */
function readAt(rel, ref) {
  try {
    if (!ref) return fs.readFileSync(path.join(REPO, rel), "utf8");
    return git(["show", `${ref}:${rel}`]);
  } catch {
    return null;
  }
}

/** Names directly inside `dir` at `ref`, or [] if the directory is absent. */
function listAt(dir, ref) {
  try {
    if (!ref) return fs.readdirSync(path.join(REPO, dir));
    return git(["ls-tree", "--name-only", `${ref}:${dir}`]).split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

// ── AST helpers ─────────────────────────────────────────────────────────────
function parse(rel, text) {
  return ts.createSourceFile(
    rel,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    rel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

/** Walk every node in a source file. */
function walk(node, visit) {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/** The initializer of `const <name> = …`, anywhere in the file. */
function constInit(sf, name) {
  let found = null;
  walk(sf, (node) => {
    if (found) return;
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      found = node.initializer ?? null;
    }
  });
  return found;
}

/** Strip the wrappers that carry no value: `as const`, parentheses, `satisfies`. */
function unwrap(node) {
  while (
    node &&
    (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression?.(node))
  ) {
    node = node.expression;
  }
  return node;
}

/** A literal's value, or undefined for anything that is not one. */
function literal(node) {
  node = unwrap(node);
  if (!node) return undefined;
  if (ts.isStringLiteralLike(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const inner = literal(node.operand);
    return typeof inner === "number" ? -inner : undefined;
  }
  // A regex is published as its pattern, without delimiters or flags, so a
  // consumer in another language can compile it.
  if (node.kind === ts.SyntaxKind.RegularExpressionLiteral) {
    const m = /^\/([\s\S]*)\/([a-z]*)$/.exec(node.getText());
    return m ? m[1] : undefined;
  }
  if (ts.isArrayLiteralExpression(node)) {
    const out = node.elements.map(literal);
    return out.some((v) => v === undefined) ? undefined : out;
  }
  return undefined;
}

/**
 * Property name → initializer, for an object literal.
 *
 * REFUSES WHAT IT CANNOT READ, rather than skipping it. This used to `continue`
 * past any property with no readable name, which is every spread — a
 * `SpreadAssignment` has no `.name` at all. The failure that produced is the
 * worst one this generator has, because every part of it looks healthy:
 *
 *   files: { ...fileMethods, readBinary }   →   files: ["readBinary"]
 *
 * The emitted surface is well-formed, the tests pass (their floors are "at
 * least 8 namespaces, at least 25 methods", and this loses a handful), the
 * release attaches it, and then the catalogue blocks every submission calling
 * `files.read` for naming "no such method". A wrong surface is worse than no
 * surface: it refuses correct add-ons with a confident reason. Measured
 * 2026-11-27 by running these same AST readers over a preload refactored that
 * way.
 *
 * A computed key (`[KEY]: …`) is refused for the same reason — the name is not
 * knowable from the syntax, so silently dropping it would understate the
 * surface in exactly the same direction.
 *
 * Throwing is right here and not merely loud. This runs in `release.yml`, which
 * will not publish without the artifact, so a crash stops a release and a
 * silent omission ships one.
 */
function props(node) {
  node = unwrap(node);
  const out = new Map();
  if (!node || !ts.isObjectLiteralExpression(node)) return out;
  for (const p of node.properties) {
    const name = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteralLike(p.name)) ? p.name.text : null;
    if (!name) {
      const sf = p.getSourceFile();
      const { line } = sf.getLineAndCharacterOfPosition(p.getStart());
      // `readAt` can name a source file by a path outside this checkout — it
      // reads at a git ref — so only use the relative form when it stays inside.
      const relToRepo = path.relative(REPO, sf.fileName);
      const where = relToRepo.startsWith("..") ? sf.fileName : relToRepo;
      const what = ts.isSpreadAssignment(p)
        ? "a spread"
        : p.name
          ? "a computed property name"
          : ts.SyntaxKind[p.kind];
      throw new Error(
        `addon-surface: cannot read ${what} in an object literal at ` +
          `${where}:${line + 1} — ${p.getText().slice(0, 80)}\n` +
          `  This generator describes the add-on surface the catalogue gates against, so a member ` +
          `it cannot name would be silently MISSING from that description, and every submission ` +
          `using it would then be refused for calling a method that "does not exist".\n` +
          `  Fix the generator to understand this construct, or write the object literal out.`,
      );
    }
    if (ts.isPropertyAssignment(p)) out.set(name, p.initializer);
    else if (ts.isShorthandPropertyAssignment(p) || ts.isMethodDeclaration(p)) out.set(name, null);
  }
  return out;
}

// ── the four things the app knows and the catalogue needs ───────────────────

/**
 * `window.addonAPI` exactly as the preload exposes it — the real contract.
 *
 * Derived from the preload and NOT from `addons/api/*.ts`, because a namespace
 * that gates nothing has no `permission:` line anywhere and so is invisible to
 * anything reading the api modules for method names. That is what failed an
 * add-on for calling `addonAPI.events.on`, which exists, and which our own
 * review had told the contributor to use. `files`, `settings`, `system` and
 * `events` are all in that position.
 */
function exposedSurface(ref) {
  const text = readAt(SRC.preload, ref);
  if (!text) return null;
  const sf = parse(SRC.preload, text);
  const api = constInit(sf, "addonAPI");
  if (!api) return null;

  const namespaces = {}; // ns -> Set(method)
  const members = new Set(); // addonAPI.<member>, not a namespace
  for (const [name, init] of props(api)) {
    const value = unwrap(init);
    if (value && ts.isObjectLiteralExpression(value)) {
      namespaces[name] = new Set(props(value).keys());
    } else {
      members.add(name);
    }
  }
  return { namespaces, members };
}

/**
 * method → the permission the dispatcher requires for it, from each api
 * module's own `methods` table. A method with no `permission` property is
 * ungated by design, which is a fact about the app worth publishing: the
 * absence of a permission has been mistaken for a gap more than once.
 */
function permissionMap(ref) {
  const out = {}; // "ns.method" -> permission | null
  for (const file of listAt(SRC.apiDir, ref)) {
    if (!file.endsWith(".ts") || file === "index.ts" || file === "types.ts") continue;
    const ns = file.replace(/\.ts$/, "");
    const text = readAt(`${SRC.apiDir}/${file}`, ref);
    if (!text) continue;
    const table = constInit(parse(file, text), "methods");
    if (!table) continue;
    for (const [method, init] of props(table)) {
      const perm = literal(props(init).get("permission"));
      out[`${ns}.${method}`] = typeof perm === "string" ? perm : null;
    }
  }
  return out;
}

/** The hand-maintained vocabularies and limits in manifest.ts. */
function manifestPolicy(ref) {
  const text = readAt(SRC.manifest, ref);
  if (!text) return null;
  const sf = parse(SRC.manifest, text);
  const value = (name) => literal(constInit(sf, name));

  return {
    permissions: {
      grantable: value("PERMISSION_VOCABULARY") ?? [],
      // Named so the strings are stable when they ship, and refused today.
      reserved: value("RESERVED_PERMISSIONS") ?? [],
    },
    reservedIpcNamespaces: value("RESERVED_IPC_NAMESPACES") ?? [],
    // Not a permission and not a gradient: main-process code is imported with
    // full Node access and the permission model does not reach it at all, so
    // this allowlist is the real privilege boundary. Published because an
    // adjudicator that treats a `main.entry` from anyone else as merely
    // interesting is more permissive than the app, which refuses the install.
    mainEntryAllowlist: value("MAIN_ENTRY_ALLOWLIST") ?? [],
    rules: {
      manifestVersion: 1,
      mountPoints: ["tab"],
      idPattern: value("ID_PATTERN"),
      ipcNamespacePattern: value("IPC_NAMESPACE_PATTERN"),
      maxNameLength: value("MAX_NAME_LENGTH"),
      maxDescriptionLength: value("MAX_DESCRIPTION_LENGTH"),
      maxTabLabelLength: value("MAX_TAB_LABEL_LENGTH"),
      defaultTabOrder: value("DEFAULT_TAB_ORDER"),
      bucketIdPattern: value("BUCKET_ID_PATTERN"),
      bucketKindPattern: value("BUCKET_KIND_PATTERN"),
      maxBucketsPublished: value("MAX_BUCKETS_PUBLISHED"),
      maxBucketKindsRead: value("MAX_BUCKET_KINDS_READ"),
      maxBucketLabelLength: value("MAX_BUCKET_LABEL_LENGTH"),
      bucketHistoryValues: value("BUCKET_HISTORY_VALUES") ?? [],
    },
  };
}

/**
 * The `tab.icon` values the sidebar can actually draw.
 *
 * `addonIcons.tsx` is the single source and the compiler holds its two halves
 * together (`Record<AddonIconName, …>`). Before it existed the set was split
 * between an object literal and a `switch`, which is why a published list
 * could not be trusted — and why two add-ons shipped with the fallback icon
 * and nobody noticed until after merge. The `switch` scan below is for older
 * refs only, where that split was still the arrangement.
 */
function tabIcons(ref) {
  const iconsText = readAt(SRC.icons, ref);
  const names = new Set();
  let fallback = null;

  if (iconsText) {
    const sf = parse(SRC.icons, iconsText);
    for (const n of literal(constInit(sf, "ADDON_ICON_NAMES")) ?? []) names.add(n);
    fallback = literal(constInit(sf, "ADDON_ICON_FALLBACK")) ?? null;
  }

  const sidebarText = readAt(SRC.sidebar, ref);
  if (sidebarText) {
    const sf = parse(SRC.sidebar, sidebarText);
    for (const n of props(constInit(sf, "ADDON_ICON_MAP")).keys()) names.add(n);
    // A `case "Lock":` inside renderNavIcon renders too, so it is part of the
    // set even though it never reaches the map.
    walk(sf, (node) => {
      if (!ts.isVariableDeclaration(node) || !ts.isIdentifier(node.name)) return;
      if (node.name.text !== "renderNavIcon") return;
      walk(node, (inner) => {
        if (ts.isCaseClause(inner)) {
          const v = literal(inner.expression);
          if (typeof v === "string") names.add(v);
        }
      });
    });
  }

  return { names: [...names].sort(), fallback };
}

// ── version history: when did each method and permission appear? ───────────
// The field that makes the `minAppVersion` check possible at all. An add-on
// declaring 0.1.7 while calling `addonAPI.buckets` is asserting something
// false, and nothing could tell until the app said when buckets arrived.
function releaseTags() {
  return git(["tag", "--list", "v[0-9]*"])
    .split("\n")
    .map((t) => t.trim())
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t)) // no -experimental refs
    .map((t) => ({ tag: t, parts: t.slice(1).split(".").map(Number) }))
    .sort((a, b) => a.parts[0] - b.parts[0] || a.parts[1] - b.parts[1] || a.parts[2] - b.parts[2])
    .map((t) => t.tag);
}

function history() {
  const firstSeen = { method: new Map(), permission: new Map() };
  let horizon = null;

  for (const tag of releaseTags()) {
    const surface = exposedSurface(tag);
    if (!surface) continue; // predates the add-on bridge entirely
    const version = tag.slice(1);
    if (!horizon) horizon = version;

    for (const [ns, methods] of Object.entries(surface.namespaces)) {
      for (const m of methods) {
        const key = `${ns}.${m}`;
        if (!firstSeen.method.has(key)) firstSeen.method.set(key, version);
      }
    }
    for (const m of surface.members) {
      if (!firstSeen.method.has(m)) firstSeen.method.set(m, version);
    }
    const policy = manifestPolicy(tag);
    for (const p of policy?.permissions.grantable ?? []) {
      if (!firstSeen.permission.has(p)) firstSeen.permission.set(p, version);
    }
  }
  return { ...firstSeen, horizon };
}

// ── assemble ────────────────────────────────────────────────────────────────
function build({ withHistory, ref = null }) {
  const surface = exposedSurface(ref);
  if (!surface) throw new Error(`could not read the addonAPI object from ${SRC.preload}`);
  const perms = permissionMap(ref);
  const policy = manifestPolicy(ref);
  if (!policy) throw new Error(`could not read ${SRC.manifest}`);
  const icons = tabIcons(ref);
  const pkg = JSON.parse(readAt(SRC.pkg, ref));

  const hist = withHistory ? history() : { method: new Map(), permission: new Map(), horizon: null };
  const since = (key) => hist.method.get(key) ?? null;

  const namespaces = {};
  for (const [ns, methods] of Object.entries(surface.namespaces)) {
    namespaces[ns] = { methods: {} };
    for (const m of [...methods].sort()) {
      const key = `${ns}.${m}`;
      namespaces[ns].methods[m] = {
        permission: key in perms ? perms[key] : null,
        since: since(key),
      };
    }
  }

  // An api method the preload does not expose is not callable from an add-on.
  // Recorded apart rather than merged, so a consumer cannot accidentally treat
  // `events.subscribe` — which the preload calls on the add-on's behalf — as
  // part of the public surface.
  const internal = {};
  for (const [key, permission] of Object.entries(perms)) {
    const [ns, m] = key.split(".");
    if (surface.namespaces[ns]?.has(m)) continue;
    internal[key] = { permission };
  }

  const grantable = {};
  for (const p of policy.permissions.grantable) {
    grantable[p] = { since: hist.permission.get(p) ?? null };
  }

  return {
    schema: 1,
    app: {
      name: pkg.name,
      version: pkg.version,
      commit: git(["rev-parse", ref ?? "HEAD"]).trim(),
      describe: ref ?? git(["describe", "--tags", "--always", "--dirty"]).trim(),
    },
    // `since` can only be as old as the oldest release this walk could read.
    // A method whose `since` equals the horizon appeared AT OR BEFORE it —
    // treat it as a floor, not a birthday.
    sinceHorizon: hist.horizon,
    api: {
      namespaces,
      // addonAPI.<member>: `init`, `invoke`, `parseError`. Callable, not a
      // namespace, and nothing a permission applies to.
      members: Object.fromEntries([...surface.members].sort().map((m) => [m, { since: since(m) }])),
      internal,
    },
    permissions: { grantable, reserved: policy.permissions.reserved },
    reservedIpcNamespaces: policy.reservedIpcNamespaces,
    mainEntryAllowlist: policy.mainEntryAllowlist,
    tabIcons: icons,
    manifest: policy.rules,
  };
}

// ── cli ─────────────────────────────────────────────────────────────────────
function main(argv) {
  const opts = { withHistory: true };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") opts.out = argv[++i];
    else if (argv[i] === "--check") opts.check = argv[++i];
    else if (argv[i] === "--ref") opts.ref = argv[++i];
    else if (argv[i] === "--no-history") opts.withHistory = false;
    else if (argv[i] === "--help" || argv[i] === "-h") {
      console.log("usage: addon-surface.mjs [--out <file>] [--ref <git-ref>] [--check <file>] [--no-history]");
      return 0;
    } else {
      console.error(`unknown argument: ${argv[i]}`);
      return 2;
    }
  }

  const surface = build(opts);
  const text = JSON.stringify(surface, null, 2) + "\n";

  if (opts.check) {
    // `app.commit`/`describe` move with every commit and say nothing about the
    // surface, so comparing them would make this check fire constantly and
    // mean nothing. Compare the surface itself.
    const strip = (o) => JSON.stringify({ ...o, app: { ...o.app, commit: null, describe: null } });
    const existing = fs.existsSync(opts.check) ? JSON.parse(fs.readFileSync(opts.check, "utf8")) : null;
    if (existing && strip(existing) === strip(surface)) {
      console.log(`${opts.check}: up to date`);
      return 0;
    }
    console.error(`${opts.check}: STALE — regenerate with \`node scripts/addon-surface.mjs --out ${opts.check}\``);
    return 1;
  }

  if (opts.out) {
    fs.writeFileSync(opts.out, text);
    const n = Object.values(surface.api.namespaces).reduce((a, ns) => a + Object.keys(ns.methods).length, 0);
    console.error(
      `${opts.out}: ${n} method(s) across ${Object.keys(surface.api.namespaces).length} namespace(s), ` +
        `${Object.keys(surface.permissions.grantable).length} grantable permission(s), ` +
        `${surface.tabIcons.names.length} tab icon(s) — app ${surface.app.version}`,
    );
  } else {
    process.stdout.write(text);
  }
  return 0;
}

process.exit(main(process.argv.slice(2)));
