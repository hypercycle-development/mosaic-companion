# Contributing to MosAIc Companion

Thank you for helping build MosAIc. Contributions may include code, tools, add-ons, MCP integrations, network services, documentation, testing, design, accessibility, security improvements, translations, or reproducible use cases.

This document describes the expected contribution workflow. For how decisions are made, see [Roles and decisions](#roles-and-decisions).

## Before you begin

- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).
- Search existing issues and pull requests before creating a duplicate.
- Report suspected vulnerabilities privately according to [SECURITY.md](SECURITY.md).
- For substantial work, open an issue before implementation. This applies to
  maintainers as well — significant changes to manifests, permissions, host
  functions, extension APIs, security boundaries, persistent data formats, or
  compatibility are proposed as issues whoever is making them.
- Do not include credentials, personal data, proprietary customer data, or unlicensed material in issues, tests, examples, logs, or commits.

## Ways to contribute

### Core platform

Core, renderer, Electron integration, accessibility, performance, packaging, release engineering, security, documentation, or test coverage.

### Sandboxed tools

WASM tools using the manifest, Gatekeeper, Chronicle, and structured UI contracts.

### Add-ons and MCP

Renderer add-ons using the permissioned add-on API, MCP integrations, or interoperability improvements.

### Network capabilities

HyperCycle AIM services, node tooling, wallet and payment interoperability, observability, or protocol documentation.

### Use cases

Reproducible workflows, deployment guides, reference architectures, user research, or measured pilots that can inform the public roadmap.

## Choose the correct proposal path

Open a normal issue for:

- Reproducible bugs.
- Small, localized improvements.
- Documentation corrections.
- Clearly bounded test work.

Open an integration proposal for:

- A new add-on, WASM tool, MCP server, or network service.
- A new external service dependency.
- An integration requiring new permissions.

Maintainers may ask that a large pull request be paused until its proposal has been discussed.

## Development setup

Use Node.js 22 through `.nvmrc`; Node 20-22 is the currently documented build range.

```bash
git clone https://github.com/hypercycle-development/mosaic-companion.git
cd mosaic-companion
nvm use
npm ci
cp config/gmail-credentials.example.json config/gmail-credentials.json
npm start
```

The example Gmail file is sufficient for packaging but not for exercising Gmail functionality.

## Quality checks

Run checks relevant to your change before requesting review:

```bash
npm run typecheck
npm run build
npm run test:e2e
```

If your change affects packaging, build the relevant target with `npm run make` or the applicable platform-specific command.

Changes to tools, manifests, permissions, add-ons, Vault, wallet handling, MCP, release workflows, or IPC boundaries must include focused tests or a documented reason why automated coverage is not yet possible.

## Pull-request expectations

A pull request should:

- Address one coherent problem.
- Explain the user or contributor impact.
- Link its issue when applicable.
- Include a practical test plan and results.
- Update documentation and examples when behavior changes.
- Identify compatibility, migration, permission, privacy, and security effects.
- Avoid unrelated formatting or refactoring.
- Avoid generated artifacts unless the repository intentionally tracks them.
- Pass required automated checks.
- Contain DCO sign-offs on all commits.

Screenshots or short recordings are encouraged for visible interface changes.

## Commit messages

Prefer concise, imperative commit messages. The existing history commonly uses prefixes such as `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, and `chore:`. Use a scope when it improves clarity, for example:

```text
feat(addons): validate publisher permissions
fix(vault): prevent plaintext fallback on migration
docs(security): record the add-on trust boundary
```

## Developer Certificate of Origin

MosAIc uses the Developer Certificate of Origin, Version 1.1. Sign off each commit to certify that you have the right to submit the contribution under the project's license:

```bash
git commit -s -m "feat: describe the change"
```

This adds a line like:

```text
Signed-off-by: Your Name <your.email@example.com>
```

The authoritative DCO text is available at <https://developercertificate.org/>.

Do not sign off for another person unless you are legally authorized to do so.

## Licensing and third-party material

- Contributions to the MosAIc repository are submitted under Apache-2.0 unless a file clearly states otherwise.
- Record the license and source of copied or adapted material.
- Do not add a dependency without explaining why it is needed and reviewing its license and maintenance posture.
- Generated or AI-assisted contributions remain the contributor's responsibility. Verify originality, licensing, security, and correctness before submission.

## Review process

Reviews consider correctness, security, compatibility, maintainability, user experience, tests, documentation, and alignment with the public roadmap.

MosAIc Companion is currently maintained by a very small team. We do not publish response-time targets, because we would rather set targets when we can meet them than publish numbers we cannot. Expect responses to be best-effort and sometimes slow. Growing the project to the point where it can state service objectives and meet them is a goal, not a present commitment.

Security and release incidents are prioritized over ordinary review.

## Roles and decisions

Technical decisions rest with the maintainers — the people with merge access to the repository. There is no formal role structure, decision procedure or appeals process. If a decision affects you and you think it is wrong, say so in the issue or pull request where it was made.

## Becoming a reviewer or maintainer

Leadership is earned through sustained contribution. There is no contributor ladder or nomination process to apply through; if you are contributing regularly and want more responsibility, say so in an issue or to a maintainer directly.

Review and merge authority is held by individuals, not by the organisations they work for.

## Getting help

See [SUPPORT.md](SUPPORT.md) for the correct channel. Ask publicly when the topic is not sensitive so the answer can help future contributors.

