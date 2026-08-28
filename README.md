# MosAIc Companion

MosAIc Companion is an open-source AI companion browser by [HyperCycle](https://www.hypercycle.ai/). It lets you chat with AI agents from multiple providers — Claude, OpenAI, Gemini, Ollama, and HyperCycle — inside a familiar browser-style, tabbed desktop app.

It is also a runtime for extending what those agents can do: sandboxed WebAssembly tools, Model Context Protocol connections, permissioned add-ons, local data controls, Web3 capabilities, and a built-in development environment, all in one workspace.

MosAIc Companion is pre-1.0 and under active development. Interfaces, security boundaries, packaging, and extension APIs are still being stabilised, and they may change between releases. Read the extension and trust model below before using MosAIc with sensitive data or funds.

## Download & Install

The easiest way to get MosAIc Companion is the download home:

- **<https://releases.hyperpg.site/mosaic/>** — pick the installer for your platform
- Alternatively, grab installers from the [GitHub releases page](https://github.com/hypercycle-development/mosaic-companion/releases)

Installers cover all three platforms, but support differs:

| Platform | Format | Status |
| -------- | ------ | ------ |
| **macOS** | `.dmg` | Works. macOS blocks the app the first time you open it. The [install page](https://releases.hyperpg.site/mosaic/) has the one-time step. |
| **Windows** | `Setup.exe` | Works. SmartScreen warns on first run. The [install page](https://releases.hyperpg.site/mosaic/) has the step. |
| **Linux** | `.deb`, AppImage | Published, but not in a known-good state. Expect problems, and [report what you hit](https://github.com/hypercycle-development/mosaic-companion/issues). |

Releases aren't code-signed or notarized. The first-run warnings on macOS and
Windows come from that, not from a problem with the download.

For a full non-technical walkthrough — install, first launch, connecting your first AI provider — see the [Getting Started guide](./docs/getting-started.md).

## What MosAIc does

AI agents become more useful when they can safely use tools, data, services, and other agents. MosAIc is a desktop environment in which those capabilities can be installed, inspected, permissioned, and operated.

- Multiple AI agents using Claude, OpenAI, Gemini, Ollama, HyperCycle, or custom endpoints.
- Conversations with persistent history and tool use.
- MosaicBot background assistance with skills, memory, and scheduled heartbeats.
- MCP server connections over local process or HTTP transports.
- Sandboxed WASM tools with declared permissions and per-tool activity logs.
- Permissioned renderer add-ons with a constrained host API.
- Multi-user chat rooms with AI agent participants.
- Local Vault boxes with agent-level access controls.
- Web3 wallet, address-book, balance, token, and transaction functions.
- HyperInsight network and AIM analytics.
- A built-in code editor, project explorer, AI assistance, and terminal.

Maturity varies by subsystem. See the [roadmap](ROADMAP.md) and the [implementation status](docs/architecture/implementation-status.md) before treating any of it as production-ready.

## Extension and trust model

MosAIc supports more than one kind of extension, and they do not have the same security properties.

| Extension type | Execution model | Trust expectation |
| --- | --- | --- |
| Sandboxed tool | WebAssembly through Extism | Lowest privilege. Network and filesystem denied by default; requested capabilities are declared in the tool manifest |
| MCP integration | Local child process or remote HTTP service | Semi-trusted. What it can reach depends on the server and the transport |
| Renderer add-on | Isolated Electron webview using `window.addonAPI` | Permissioned host API; no Node.js access for third-party add-ons |
| Bundled or privileged component | Ships with the app, or runs in the main process | Highest privilege, equivalent to core code, and reviewed to that standard |

Add-ons that supply main-process code fall into the last row rather than the third: main entries load unsandboxed, and the permission model covers only the renderer. Third-party main entries are therefore refused — the allowlist has one first-party entry — so every other add-on is renderer-only today.

The architectural goal is that boundary crossings are explicit, mediated by the core, and logged, and that the core itself stays as small as the product allows. How much belongs in the core rather than in an extension is an open question.

For detail, see the [architecture overview](docs/architecture/overview.md), the [permissions model](docs/architecture/permissions.md), and the [tool lifecycle](docs/architecture/tool-lifecycle.md). That documentation set has known divergences from the implementation — [`docs/architecture/STATUS.md`](docs/architecture/STATUS.md) records which parts are current and which are superseded.

### Important data note

Agent API keys, wallet keys, and sandbox tool secrets use Electron `safeStorage` where the platform provides it.

The Vault is an early component. **In the current published release (v0.1.12), box contents are stored as local JSON, unencrypted at rest**, and the Vault page says so — anyone who can read your files, or a backup of them, can read your boxes. Encryption at rest using the operating system's secure storage is built and enabled on `main`, so a build from source encrypts and its Vault page reports which protection is actually in effect; it is **not yet in any published release**. The per-agent access controls are enforced within the application and are separate from encryption; they do not protect the files on disk.

## Run from source

For contributors and anyone who wants to build the app themselves.

**Prerequisites:** Node.js 22, as pinned in `.nvmrc` — 20 or later works, and CI builds on 22. npm 9+, git, and platform build tools if you intend to package.

```bash
git clone https://github.com/hypercycle-development/mosaic-companion.git
cd mosaic-companion
nvm use
npm install

# Renderer-only dev server (Vite, hot reload)
npm run dev

# Full Electron app (via Electron Forge)
npm start
```

Or run `./setup.sh` for an automated setup, or `./start.sh` to install dependencies if needed and launch the app.

There is no API-key file to set up: AI provider keys are configured inside the app, either through the onboarding wizard on first launch or later under **Configuration → AI Agents**.

Packaging expects a Gmail credentials file to exist even when Gmail is not being used:

```bash
cp config/gmail-credentials.example.json config/gmail-credentials.json
```

### Available Scripts

- `npm run dev` - Start the Vite renderer dev server with hot reload
- `npm run build` - Build the application for production
- `npm start` - Start the Electron app via Forge
- `npm run preview` - Preview the production build
- `npm run typecheck` - Run TypeScript type checking without building
- `npm run test:e2e` - Run the Playwright end-to-end tests
- `npm run clean` - Remove build artifacts

#### Build & Package Scripts (Electron Forge)

| Script | Description |
| -------- | ------------- |
| `npm run make` | Build for current platform/arch |
| `npm run make:linux` | Build Linux (native arch) |
| `npm run make:linux:x64` | Build Linux x64 |
| `npm run make:linux:arm64` | Build Linux arm64 |
| `npm run make:mac` | Build macOS (native arch) |
| `npm run make:mac:x64` | Build macOS x64 |
| `npm run make:mac:arm64` | Build macOS arm64 |
| `npm run make:win` | Build Windows (native arch) |
| `npm run make:win:x64` | Build Windows x64 |
| `npm run make:win:arm64` | Build Windows arm64 |
| `npm run deploy` | Publish a release (maintainers: see [docs/release-process.md](./docs/release-process.md)) |
| `npm run deploy:x64` | Publish x64 (maintainers: see [docs/release-process.md](./docs/release-process.md)) |
| `npm run deploy:arm64` | Publish arm64 (maintainers: see [docs/release-process.md](./docs/release-process.md)) |

See [docs/build.md](docs/build.md) for platform-specific packaging instructions.

## Build an extension

**[Build an extension](docs/build-an-extension.md)** is the full guide: the two
kinds of extension, the manifest, permissions, how to run one locally, and what
happens when you submit one.

- Start with the [minimal renderer add-on](examples/tab-plugin/README.md).
- Start with the [minimal WASM tool](examples/wasm-tool/README.md).
- Read the [tool manifest specification](docs/architecture/manifest.md).
- Read the [tool UI documentation](docs/architecture/tool-ui.md).
- Review the [MCP integration patterns](electron/integrations/mcp/readme.md).

### Publishing an add-on

Add-ons reach other people through [`mosaic-addons`](https://github.com/hypercycle-development/mosaic-addons), a reviewed catalogue. Open a pull request adding `addons/<your-id>/` with a manifest, a licence, and your source. We review the source you submit, not a build of it: a submission is assessed from the files in your pull request — the ones a reviewer can open and read — rather than from running the add-on, so everything an add-on does should be readable in those files. Its [CONTRIBUTING guide](https://github.com/hypercycle-development/mosaic-addons/blob/main/CONTRIBUTING.md) sets out what a submission must contain, and what it cannot ask for.

Catalogue releases are signed, and the application verifies them against a pinned publisher key before installing anything. A signature establishes who published an add-on, never that the add-on is safe — review addresses the second, and review is human.

You need none of that to build one. The Dev corner in Settings loads an unpacked add-on from a local directory — the fastest way to develop, and the right route for anything you only want to run yourself. It is gated to development builds: a packaged build refuses a dev-install unless it is started with `MOSAIC_ADDON_DEV=1`.

A conformance suite and broader SDK coverage are still outstanding. For significant extension work, open a public issue before investing heavily in it.

## Contributing

Contributions of code, integrations, documentation, testing, design, security research, network capabilities, and use cases are welcome.

Before contributing:

1. Read [CONTRIBUTING.md](CONTRIBUTING.md).
2. Review the [roadmap](ROADMAP.md).
3. Report vulnerabilities privately according to [SECURITY.md](SECURITY.md).
4. Follow the [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
5. See [GOVERNANCE.md](GOVERNANCE.md) for how decisions are made.

For substantial features, or changes to manifests, permissions, host functions, extension APIs, or security boundaries, begin with an issue before opening a large pull request. This applies to maintainers as well as to outside contributors.

For questions rather than contributions, [SUPPORT.md](SUPPORT.md) explains where to ask.

## Governance

Technical authority in MosAIc Companion is earned through sustained contribution and sound judgment. Company membership and financial sponsorship do not carry merge authority, and review rights are held by individuals rather than by the organisations they work for.

[GOVERNANCE.md](GOVERNANCE.md) describes how decisions are made and [MAINTAINERS.md](MAINTAINERS.md) records who makes them. Significant changes are proposed as issues before implementation, and every commit carries a Developer Certificate of Origin sign-off, which is an enforced check.

The project has three maintainers, all affiliated with HyperCycle. Decisions are made by majority, so no single maintainer can block a change; there is still no independent removal process, and a maintainer can merge their own change without a second review. Those are limits of the current size rather than settled positions, and growing past them is a goal.

## Security

Do not report suspected vulnerabilities through a public issue. Follow [SECURITY.md](SECURITY.md) for private reporting and coordinated disclosure.

## License

MosAIc Companion is licensed under the [Apache License 2.0](./LICENSE). See [NOTICE](./NOTICE) for attribution details. Bundled dependencies and contributed extensions may use their own compatible licences and should declare them clearly.

## Project links

- [Releases](https://github.com/hypercycle-development/mosaic-companion/releases)
- [Issues](https://github.com/hypercycle-development/mosaic-companion/issues)
- [Pull requests](https://github.com/hypercycle-development/mosaic-companion/pulls)
- [Architecture documentation](docs/architecture/README.md)
- [Agent-system documentation](docs/agents.md)
