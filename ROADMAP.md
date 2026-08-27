# Roadmap

Last updated: 2026-08-27.

This describes direction, not delivery commitments. MosAIc Companion is
maintained by a very small team; what gets done is bounded by that more than by
what is planned here. Priorities change when security findings, contributor
capacity, or real integration work say they should.

Significant changes — to manifests, permissions, host functions, extension
APIs, or security boundaries — are proposed as issues before implementation.
Routine fixes go straight to a pull request. This applies to maintainers as
well as to outside contributors.

## Direction

MosAIc Companion is a desktop runtime for AI agents, tools, and integrations.
The aim is that capabilities can be installed, inspected, permissioned, and
operated with the boundaries between them explicit and enforced.

The near-term work is mostly about making that true rather than extending it:
closing the gap between what the extension system promises and what it enforces,
and between what the documentation says and what the code does.

## Recently delivered

### Publisher signing and a reviewed catalogue ([#103](https://github.com/hypercycle-development/mosaic-companion/issues/103))

Add-ons are distributed from
[`mosaic-addons`](https://github.com/hypercycle-development/mosaic-addons) as a
signed catalogue, verified against a pinned publisher key. Withdrawal is carried
by the same signed registry: delisting stops new installs, and a withdrawal
entry acts on an add-on already installed without needing an application update.

This is what makes a reviewed, revocable add-on distinguishable from a folder
someone sent you, and it is the prerequisite for moving existing integration
work out of the core application and into add-ons. Loading an unpacked add-on
from a local directory remains available for development and for anything you
only want to run yourself.

## Now

### Extension API

These come from real integrations hitting real limits rather than from
planning. Two unrelated contributors needed the same things, independently:

- **Secure storage for add-on secrets** ([#104](https://github.com/hypercycle-development/mosaic-companion/issues/104))**.** Add-on settings are plaintext JSON
  today, so a renderer-only add-on holding a long-lived credential has to hold
  it in the clear.
- **Contained background execution** ([#105](https://github.com/hypercycle-development/mosaic-companion/issues/105))**.** Add-on main modules currently load
  unsandboxed into the Electron main process, so third-party main entries are
  gated to a one-entry allowlist. A contained worker with a network permission
  would open this up without opening the main process.
- **Host-mediated network access** ([#106](https://github.com/hypercycle-development/mosaic-companion/issues/106)), permission-gated and host-scoped.
- **Add-on-contributed agent tools** ([#107](https://github.com/hypercycle-development/mosaic-companion/issues/107))**.** The tool registry is static; only WASM
  sandbox tools are dynamic. An add-on cannot currently give an agent a tool.
- **Wallet signing** ([#108](https://github.com/hypercycle-development/mosaic-companion/issues/108))**.** `addonAPI.wallet` is read-only by design in v1. Extending
  it needs a credential model, not just an API.

### Enforcing what is already declared

- **WASM execution timeouts** ([#109](https://github.com/hypercycle-development/mosaic-companion/issues/109))**.** A timeout is parsed from the tool manifest and
  stored, but nothing reads it — a tool that loops forever is not interrupted.
- **Vault encryption where no secure-storage backend exists**
  ([#110](https://github.com/hypercycle-development/mosaic-companion/issues/110))**.** Encryption at rest is built and enabled on
  `main`, and is not yet in a published release. Where no backend is available —
  or on a Linux `basic_text` fallback — contents are plaintext or merely
  obfuscated; that build's Vault page says which, but a portable fallback does
  not exist yet.

### Accuracy

- **Reconcile `docs/architecture/` with the implementation** ([#102](https://github.com/hypercycle-development/mosaic-companion/issues/102))**.** The set describes
  a Docker runtime that was never built, and omits the add-on system entirely.
  Marked stale in the interim.
- **De-duplicate the getting-started guide** ([#101](https://github.com/hypercycle-development/mosaic-companion/issues/101)), which exists in two formats that
  have already drifted.

### Release integrity

- **Code signing and notarization** ([#111](https://github.com/hypercycle-development/mosaic-companion/issues/111))**.** Releases are unsigned on every platform, so
  macOS and Windows warn on first run.
- **Linux builds** ([#112](https://github.com/hypercycle-development/mosaic-companion/issues/112))**.** Published, but broken on arm64.

## Next

- **Catalogue metadata** — provenance, review state, and compatibility surfaced
  alongside each entry, building on the signing and withdrawal chain now in
  place.
- **A threat model** covering the core, the sandbox, add-ons, MCP, the Vault,
  the wallet, and updates.
- **A published host ABI and compatibility policy**, versioned separately from
  the application.
- **An extension conformance suite and starter scaffold**, so an extension
  author can tell whether their work is correct without asking.
- **Independent review of the highest-risk boundaries**, after the threat model
  exists to scope it.
- **Supply-chain controls** — SBOMs, provenance, automated repository checks.

## Later

- Additional SDK languages, chosen on demonstrated demand rather than in advance.
- Metered settlement, evaluated against legal, accounting, fraud and support
  questions before any implementation.
- Stronger tamper-evidence for the Chronicle, where audit use cases justify it.
- Neutral stewardship of the extension specifications, if and when there are
  independent implementations to steward.

## Not promised

Stating these plainly is more useful than leaving them ambiguous:

- A general paid-tool marketplace.
- Autonomous tool installation without explicit user approval.
- Tamper-proof local audit logs.
- Sandboxing of every existing MCP server.
- Production support for every language Extism supports.
- Production suitability for high-value secrets or funds.
- Any delivery date.

## Proposing work

Open an issue. Explain the problem, who has it, and what evidence supports it.

The issue-first rule above is not a gatekeeping step — those changes are
expensive to get wrong and cheap to discuss first, and the discussion is how
anyone outside the project can see a decision being made and take part in it.

Appearing on this roadmap is not a commitment that something will be built.
