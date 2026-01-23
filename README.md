<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1G6opS0oqO9Ygn97nFvJGFQJakcx1piny

## Run Locally

**Prerequisites:** Node.js 20+

### Quick Start

Run the setup script to install dependencies:

```bash
./setup.sh
```

Or manually:

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production
- `npm run start` - Build and run the Electron app
- `npm run preview` - Preview the production build
- `npm run typecheck` - Run TypeScript type checking without building
- `npm run clean` - Remove build artifacts
- `npm run clean:all` - Remove build artifacts, node_modules, and lockfile

#### Build Scripts

| Script | Description |
|--------|-------------|
| `npm run build:linux` | Build Linux x64 + arm64 |
| `npm run build:linux:x64` | Build Linux x64 only |
| `npm run build:linux:arm64` | Build Linux arm64 only |
| `npm run build:mac` | Build macOS x64 + arm64 |
| `npm run build:mac:x64` | Build macOS x64 only |
| `npm run build:mac:arm64` | Build macOS arm64 only |
| `npm run build:win` | Build Windows x64 + arm64 |
| `npm run build:win:x64` | Build Windows x64 only |
| `npm run build:win:arm64` | Build Windows arm64 only |
| `npm run build:all` | Build all platforms, all architectures |

### Helper Scripts

- `./setup.sh` - Automated setup (installs dependencies, creates .env.local)
- `./start.sh` - Quick start script (installs dependencies if needed, then starts the app)

