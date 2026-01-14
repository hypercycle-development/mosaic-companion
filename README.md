<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1G6opS0oqO9Ygn97nFvJGFQJakcx1piny

## Run Locally

**Prerequisites:** Bun

### Quick Start

Run the setup script to install Bun (if needed) and dependencies:

```bash
./setup.sh
```

Or manually:

1. Install dependencies:
   `bun install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `bun run dev`

### Available Scripts

-   `bun run dev` - Start development server with hot reload
-   `bun run build` - Build the application for production
-   `bun run start` - Build and run the Electron app
-   `bun run preview` - Preview the production build
-   `bun run typecheck` - Run TypeScript type checking without building
-   `bun run clean` - Remove build artifacts
-   `bun run clean:all` - Remove build artifacts, node_modules, and lockfile
-   `bun run build:win` - Build Windows installer
-   `bun run build:mac` - Build macOS installer
-   `bun run build:linux` - Build Linux installer
-   `bun run build:all` - Build installers for all platforms

### Helper Scripts

-   `./setup.sh` - Automated setup (installs Bun if needed, dependencies, creates .env.local)
-   `./start.sh` - Quick start script (installs dependencies if needed, then starts the app)
