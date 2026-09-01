# Build an extension

There are two ways to extend MosAIc.

An **add-on** puts a new page inside it, and it is the kind that goes into the
[`mosaic-addons`](https://github.com/hypercycle-development/mosaic-addons)
catalogue — submitted as a pull request, read by a person, signed, and then
installable by anyone.

**Plugins** — MCP servers and WASM tools — extend the copy of MosAIc you run
yourself.

**This guide is about add-ons:** what to build, how to submit it, and what
happens after you do.

---

## 1. Two kinds of extension

They are not interchangeable, and the difference decides both what your code can
do and how it reaches anyone.

| Kind | What it is | How it reaches people | Start from |
| --- | --- | --- | --- |
| **Add-on** | A new page inside MosAIc, in an isolated webview | The `mosaic-addons` catalogue — pull request, human review, signed release | [`examples/tab-plugin/`](../examples/tab-plugin/README.md) |
| **Plugin**<br>*MCP server or WASM tool* | Tools for the assistant, or sandboxed computation an agent can invoke | You add it to your own MosAIc. There is no catalogue for these | [`examples/mcp/mcp-hello/`](../examples/mcp/mcp-hello/)<br>[`examples/wasm-tool/`](../examples/wasm-tool/README.md) |

**The rest of this page is about add-ons** — the kind that reaches other people,
and the only kind with a submission process. Plugins are how you extend the
MosAIc you run: an MCP server is its own OS process in any language and nothing
about it is MosAIc-specific, so if you already have one it works here; a WASM
tool runs in a sandbox when an agent invokes it. Both are documented with the
examples above.

> **Nothing you build gets Node.js or `window.electronAPI`.**
> That bridge belongs to the application's own renderer. Code copied out of it
> will not work unchanged in an add-on or a plugin.

## 2. What an add-on actually is

A directory. It holds a manifest, a licence, and your source. MosAIc loads it
into an isolated webview and gives it exactly one way to talk to the
application: `window.addonAPI`. Calls that reach the wallet, agents, MCP,
nodes or the OS browser are checked in the main process against the permissions
you declared. The rest of the surface is scoped to your add-on — its own
settings store, its own data directory, its own events — plus read-only
information about the app, such as the current theme.

```
my-addon/
├── manifest.json      what you are and what you are asking for
├── LICENSE            your licence, your copyright
└── renderer/
    └── index.html     the page itself — plain HTML and JS, no bundler required
```

No build step is required **for an add-on with no dependencies**. The moment
you add one you need a `package.json` beside your manifest, and that changes
what publication expects of you:

- The catalogue's packaging step runs `npm install` and then **`npm run build`**.
  If a `package.json` is present without a working `build` script, publication
  fails — after review, after merge.
- `node_modules` is **not** shipped. Only `manifest.json`, `main/`, `renderer/`,
  `LICENSE` and `NOTICE` are packaged, so your build must put everything the page
  needs inside `renderer/`.

See [what review looks at](#7-what-review-looks-at) before you reach for a
bundler.

## 3. The manifest

Validated at install. If it fails, the add-on does not load.

```json
{
  "manifestVersion": 1,
  "id": "my-addon",
  "name": "My Add-on",
  "version": "1.0.0",
  "description": "One line on what it does and why someone would want it.",
  "author": "Your Name",
  "homepage": "https://example.com",
  "mountPoint": "tab",
  "ipcNamespace": "my-addon",
  "tab": {
    "label": "My Add-on",
    "icon": "Star",
    "order": 100
  },
  "permissions": ["nodes:read"],
  "renderer": { "entry": "renderer/index.html" }
}
```

| Field | Rule |
| --- | --- |
| `manifestVersion` | **Required, and must be `1`.** Nothing else is accepted. Omitting it is the most common reason a first manifest fails to load. |
| `mountPoint` | **Required.** `"tab"` is the only value this version accepts. |
| `renderer.entry` | **Required.** Path to your page, relative to the add-on directory. |
| `id` | Lowercase, starts with a letter, 2–41 chars of `a–z 0–9 -`. **Must equal your directory name.** |
| `version` | Valid semver. |
| `name` | 1–40 characters. |
| `description` | 1–200 characters. |
| `ipcNamespace` | Same pattern as `id`. Must not collide with a namespace **the application** reserves — and that list covers the whole app, not just the add-on system. Ordinary-sounding names including `chat`, `vault`, `nodes`, `mcp`, `tools`, `media`, `window` and `themes` are all taken. Prefix it with your `id` and you are very unlikely to collide. |
| `tab.label` | 1–24 characters. Required. |
| `tab.icon` | **Required.** A [Lucide](https://lucide.dev/icons/) icon name in PascalCase — `Star`, `LayoutGrid`, `Sparkles`. Only a curated set is available, and an unrecognised name falls back to a default **without an error**, so check yours renders. |
| `tab.order` | Integer, optional. Lower sorts higher; the default is 100. |
| `author`, `homepage`, `minAppVersion` | Optional. `minAppVersion` must be valid semver if present. |

> **Main-process code is not available to you.**
> A `main.entry` block loads unsandboxed, outside the permission model entirely.
> It is restricted to a one-entry allowlist, and a new add-on will not be granted
> it. HyperInsight declares one because it holds that single first-party slot —
> read it for the renderer side, and do not copy that part.

## 4. Permissions

Ask for the minimum. Every permission is something a reviewer has to justify to
users, and something a user sees before they install.

**Available:** `wallet:read` · `agents:read` · `agents:write` · `mcp:read` ·
`mcp:call` · `nodes:read` · `shell:open-external`

**Reserved — rejected at install:** `wallet:sign` · `agents:delete` ·
`vault:read` · `vault:write` · `notifications`

> **These are not permissions you can request and be refused.**
> They are refused outright at install time. An add-on cannot sign with the
> user's wallet and cannot read their Vault — not by policy, but because the
> request is rejected before anything runs. The names exist so they stay stable
> if they ever ship.

## 5. Build it and run it

You do not need the catalogue, or our permission, to develop. The Dev corner
loads an unpacked add-on straight from a directory.

1. **Open the Dev corner.** *Configuration → Addons → Dev corner → Load unpacked
   addon…* and point it at your directory. (The tab is labelled Configuration,
   not Settings.)

2. **If the button refuses you.** Dev install is gated to development builds. A
   packaged build — the one you downloaded — refuses it unless you start the app
   with the environment variable set:

   ```sh
   MOSAIC_ADDON_DEV=1 open -a "MosAIc Companion"
   ```

3. **Iterate.** This route stays open permanently and is the right one for
   anything you only want to run on your own machine. Nothing you load this way
   is reviewed, signed, or seen by anyone else.

## 6. Submit it

To reach other people, open a pull request against
[`mosaic-addons`](https://github.com/hypercycle-development/mosaic-addons)
adding `addons/<your-id>/`.

```
addons/my-addon/
├── manifest.json
├── LICENSE
└── renderer/…        everything your add-on is, readable
```

> **Check that `git add` actually took `renderer/`.** `mosaic-addons`
> git-ignores `addons/*/renderer/`, because for an add-on built from a `src/`
> directory that path is build output the release pipeline regenerates. If your
> add-on has no build step — the shape above, and the shape
> [`examples/tab-plugin`](../examples/tab-plugin/) uses — then `renderer/` is
> your source, and `git add addons/my-addon/` skips it without a word. The
> submission still passes every automated check, because a manifest and a
> licence is all it is asked for; it just contains no add-on.
>
> Run `git status --ignored addons/my-addon/` before you push. If your renderer
> is source rather than output, add it with
> `git add -f addons/my-addon/renderer/` and say so in the pull request.

### Rules that will bounce a submission

| Rule | Why |
| --- | --- |
| Everything inside `addons/<your-id>/` | A submission that reaches outside its own directory is not reviewable in isolation. |
| Dependencies resolve to public npm, as a plain version range | A `user/repo` shorthand resolves to a mutable branch tarball, and an `npm:` alias installs something other than what it names. Both defeat reviewing the source you submitted. |
| No `main.entry` | See [the manifest](#3-the-manifest). It runs outside the permission model. |
| No install lifecycle scripts | A `postinstall` (or `preinstall`, `prepare`) in your `package.json` is arbitrary code execution at install time. Hard failure. |
| No symlinks or submodules | Neither can be reviewed by reading the files you submitted. |
| One logical commit | A submission is reviewed as a whole, not as a history to reconstruct. |

> **Sign your commits off.**
> Every commit needs a `Signed-off-by` line — `git commit -s`. That is the
> [Developer Certificate of Origin](https://developercertificate.org/): an
> assertion that you have the right to submit the work. **You keep your
> copyright. There is no CLA.**

> **Say which licence you chose, in the pull request.**
> A `LICENSE` file in `addons/<your-id>/` and a line in the pull request are the
> whole record — the manifest has no `license` field, so there is nothing to put
> one in. See
> [LICENSING.md](https://github.com/hypercycle-development/mosaic-addons/blob/main/LICENSING.md)
> for which licences are accepted. Copyleft is unanalysed, including copyleft
> *dependencies* inlined by your build: expect such a submission to be **held
> rather than refused**.

> **A version range is accepted as written.**
> Nothing pins it for you. Pinning comes from your committed lockfile, not from a
> gate — so commit one.

## 7. What review looks at

> **We review the source you submit, not a build of it.**
> A submission is assessed from **the files in your pull request** — the ones a
> reviewer can open and read — rather than from running the add-on. So everything
> your add-on does should be readable in those files. A minified or obfuscated
> bundle cannot be reviewed, and will not be.

Before a human looks, automated checks read the submitted files for scope
containment, dependency shape, the `main.entry` restriction, path traversal and
executable bits. Then a person reads it, and the submission is built and
installed in isolation before anything is published.

> **A clean automated result means nothing matched the patterns that are
> checked.** It does not mean a submission is safe, and it is not an approval. A
> human decides.

### What helps

- **Ask for fewer permissions.** Each one is a question you are asking a
  reviewer to answer on a user's behalf.
- **Write it to be read.** Small files, obvious names, no generated code checked
  in without its source.
- **Say what you tested.** There is no conformance suite yet; the honest
  substitute is describing what you exercised and what you did not.
- **Open an issue first** for anything substantial, rather than arriving with a
  large pull request nobody expected.

## 8. Signing and publication

Merging is not publishing. Entries reach users through a signed catalogue
release.

1. **Your entry is packaged.** Built into a tarball, with a checksum recorded in
   the registry.
2. **The whole catalogue is signed.** One signature over the registry. The key
   is generated in an offline ceremony — nothing in the catalogue repository or
   its CI can produce key material, and CI only ever *uses* a key that already
   exists. The signing step reads it as a secret scoped to a protected release
   environment.
3. **The application verifies before it installs.** MosAIc carries one pinned
   publisher key and refuses any registry it cannot verify against it. There is
   no "install anyway". A registry carrying a sequence number lower than the
   highest already seen is rejected, so an old catalogue cannot be replayed at
   you.

> **A signature establishes who published something.**
> It never establishes that the thing is safe. Review addresses the second, and
> review is a person reading your code.

## 9. After you are live

Three things can happen to a published add-on, and they are different.

| Action | Effect |
| --- | --- |
| **Delisting** | Removed from the registry. Stops new installs. Copies already installed keep running. |
| **Withdrawal — advisory** | Carried as a signed record. The add-on keeps running. **There is no user-facing surface for this yet** — treat it as a publisher-side marker, not as a way to reach anyone. |
| **Withdrawal — security** | Deactivated in place on the next catalogue sync, and refused reactivation. No application update needed. |

Withdrawals ride the same signed registry and the same monotonic sequence, which
is what stops one being erased by replaying an older release.

### Updating

Bump `version` in your manifest and open another pull request. The same review
applies — a published add-on does not get a fast path.

## 10. Before you open the pull request

- `manifestVersion` is `1`
- `id` matches the directory name exactly
- `version` is valid semver, and higher than the last one if this is an update
- `description` is under 200 characters and says what it does
- Every permission you list is one you actually use
- No `main.entry`
- Every dependency is a plain version range on public npm, with a committed
  lockfile
- `ipcNamespace` does not collide with an application namespace
- `tab.icon` is a real Lucide name in PascalCase, and you have seen it render
- If you have a `package.json`: no install lifecycle scripts, and `npm run build`
  works and puts everything the page needs into `renderer/`
- Nothing reaches outside `addons/<your-id>/`
- A `LICENSE` file is present — see
  [LICENSING.md](https://github.com/hypercycle-development/mosaic-addons/blob/main/LICENSING.md)
  for what is accepted — and state your licence in the pull request
- Source is readable; nothing minified or generated without its source
- Every commit carries `Signed-off-by`
- You have loaded it through the Dev corner and it works
- `git show --stat HEAD` lists your `renderer/` files — see the warning in
  [Submit it](#6-submit-it); a no-build add-on loses them to `.gitignore`
  silently

> **Still to come.**
> A conformance suite and broader SDK coverage do not exist yet, and the
> catalogue accepts open source only today. Two things stand in the way of closed
> and mixed source, and **only one of them is engineering**: every check in the
> pipeline reads your source and a binary defeats all of them at once, so it needs
> a review that observes what software does rather than reads what it says.
>
> The load-bearing one is legal. Every licence accepted today already permits
> redistribution; a proprietary licence does not, so accepting one without **a
> submission agreement granting distribution rights** would leave nothing to
> distribute it under. What that agreement requires has not been decided. See
> [LICENSING.md](https://github.com/hypercycle-development/mosaic-addons/blob/main/LICENSING.md),
> which is the authoritative account — this is a sequencing decision, not a
> position.

---

Questions belong in an issue on
[mosaic-companion](https://github.com/hypercycle-development/mosaic-companion)
(the application) or
[mosaic-addons](https://github.com/hypercycle-development/mosaic-addons) (the
catalogue). Security reports go privately through GitHub advisories — see
[SECURITY.md](../SECURITY.md).
