# Mosaic Companion

Mosaic Companion is an open-source AI companion browser by [HyperCycle](https://www.hypercycle.ai/). It lets you chat with AI agents from multiple providers — Claude, OpenAI, Gemini, Ollama, and HyperCycle — inside a familiar browser-style, tabbed desktop app.

Beyond chat, Mosaic includes an encrypted Vault for secrets, support for MCP tool servers, a sandboxed WASM tool runtime, Web3 wallet features, and a built-in IDE.

## Download & Install

The easiest way to get Mosaic Companion is the new download home:

- **<https://releases.hyperpg.site/mosaic/>** — pick the installer for your platform
- Alternatively, grab installers from the [GitHub releases page](https://github.com/hypercycle-development/mosaic-companion/releases)

Installers are available for:

- **Linux** — `.deb` and AppImage
- **macOS** — `.dmg`
- **Windows** — `Setup.exe`

For a full non-technical walkthrough (install, first launch, connecting your first AI provider), see the [Getting Started guide](./docs/getting-started.md).

## Run from Source

For contributors and anyone who wants to build the app themselves.

**Prerequisites:** Node.js 20+ and npm 9+

```bash
npm install

# Renderer-only dev server (Vite, hot reload)
npm run dev

# Full Electron app (via Electron Forge)
npm start
```

Or run `./setup.sh` for an automated setup, or `./start.sh` to install dependencies (if needed) and launch the app.

There is no API-key file to set up: AI provider keys are configured inside the app, either through the onboarding wizard on first launch or later under **Configuration → AI Agents**.

### Available Scripts

- `npm run dev` - Start the Vite renderer dev server with hot reload
- `npm run build` - Build the application for production
- `npm start` - Start the Electron app via Forge
- `npm run preview` - Preview the production build
- `npm run typecheck` - Run TypeScript type checking without building
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

## License

Mosaic Companion is open source — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE) for details.
