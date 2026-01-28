# Building Mosaic Companion

This guide explains how to build Mosaic Companion for different platforms and architectures using Electron Forge.

## Overview

Mosaic Companion uses **Electron Forge** to create distributable packages for Linux, macOS, and Windows. The build process varies depending on your host platform due to platform-specific tooling requirements and maker limitations.

## Quick Reference

| Host Platform | Can Build For | Notes |
| :------------ | :------------- | :---- |
| **Linux** | Linux (x64, arm64)<br>Windows (x64, arm64)* | *Windows builds require Wine/Mono or Docker |
| **macOS** | macOS (x64, arm64)<br>Linux (x64, arm64)**<br>Windows (x64, arm64)* | **Linux .deb requires `fakeroot` and `dpkg`<br>*Windows builds require Wine/Mono |
| **Windows** | Windows (x64, arm64)<br>Linux (x64, arm64)***<br>macOS (limited)*** | ***Cross-platform builds not recommended on Windows |

> **Best Practice:** Use CI/CD with platform-specific runners for reliable cross-platform builds. See `.github/workflows/release.yml`.

---

## Building on Linux

### Prerequisites

- Node.js 18+ and npm
- Docker (recommended for Windows builds)
- `fakeroot` and `dpkg` (if building Linux .deb packages on non-Debian systems)

### Linux Builds

Linux can natively build for both x64 and arm64 architectures:

```bash
# Build for current platform (default architecture)
npm run make:linux

# Build for specific architecture
npm run make:linux:x64
npm run make:linux:arm64
```

**Output formats:**
- `.AppImage` (portable, runs on most distributions)
- `.deb` package (Debian/Ubuntu)
- `.zip` archive (fallback)

**Output location:** `out/make/`

### Windows Builds from Linux

#### Option 1: Docker (Recommended)

Use the official `electronuserland/builder:wine` Docker image to avoid installing Wine/Mono locally:

```bash
docker run --rm -ti \
  --env-file .env.local \
  -v ${PWD}:/project \
  -v ~/.cache/electron:/root/.cache/electron \
  -v ~/.cache/electron-builder:/root/.cache/electron-builder \
  electronuserland/builder:wine-mono \
  /bin/bash -c "apt-get update && apt-get install -y zip && npm install && npm run make:win:x64"
```

**What this does:**

- `--env-file .env.local`: Passes AWS credentials for S3 publishing
- `-v ${PWD}:/project`: Mounts your project directory
- `-v ~/.cache/...`: Caches Electron binaries (speeds up subsequent builds)
- `electronuserland/builder:wine-mono`: Pre-configured image with Wine and **Mono** (required by Squirrel.Windows)
- `apt-get install -y zip`: Installs the `zip` utility, which is required by Electron Forge's ZIP maker but missing from the base image.

**Benefits:**
- No Wine/Mono installation needed on your system
- Clean, isolated build environment
- Reproducible builds

> 💡 **Tip:** The `scripts/upload-release.sh` script automates this Docker workflow and handles building, uploading to S3, and creating git tags. See [Release Process](release-process.md#using-the-release-script) for details.

**Limitations:**
- First run downloads ~1-2GB Docker image
- Generated files may be owned by root (fix: `sudo chown -R $USER:$USER out/`)

#### Option 2: Native Wine/Mono

Install Wine 2.0+ and Mono 4.2+ on your Linux system, then run:

```bash
npm run make:win:x64
npm run make:win:arm64
```

**Output formats:**
- Squirrel installer (`.exe` with auto-update support)

**Output location:** `out/make/squirrel.windows/`

---

## Building on macOS

### Prerequisites

- Node.js 18+ and npm
- Xcode Command Line Tools (`xcode-select --install`)

### macOS Builds

macOS can build for x64 (Intel), arm64 (Apple Silicon), or both:

```bash
# Build for current architecture
npm run make:mac

# Build for specific architecture
npm run make:mac:x64
npm run make:mac:arm64
```

**Output formats:**
- `.dmg` installer (drag-and-drop installation)
- `.zip` archive (required for auto-updates)

**Output location:** `out/make/`

**Note:** Code signing is disabled (`identity: "-"`) in `forge.config.js`. For distribution outside development, you'll need to configure proper code signing.

### Cross-Platform Builds from macOS

macOS can build for Linux and Windows, but with caveats:

```bash
# Build for Linux (requires fakeroot and dpkg for .deb)
npm run make:linux:x64
npm run make:linux:arm64

# Build for Windows (requires Wine/Mono)
npm run make:win:x64
npm run make:win:arm64
```

**Requirements for cross-platform builds:**
- **Linux .deb packages:** Install `fakeroot` and `dpkg` via Homebrew
- **Windows builds:** Install Wine and Mono (or use Docker as shown in Linux section)

**Recommendation:** Use CI/CD instead of local cross-platform builds for reliability.

---

## Building on Windows

### Prerequisites

- Node.js 18+ and npm
- Windows 10/11

### Windows Builds

Windows can natively build for both x64 and arm64 architectures:

```bash
# Build for current architecture
npm run make:win

# Build for specific architecture
npm run make:win:x64
npm run make:win:arm64
```

**Output formats:**
- Squirrel installer (`.exe` with auto-update support)
- `.zip` archive

**Output location:** `out/make/squirrel.windows/` and `out/make/zip/`

### Cross-Platform Builds from Windows

While technically possible, cross-platform builds from Windows are **not recommended**:
- Linux builds require WSL or complex tooling
- macOS builds cannot be code-signed (requires macOS)

**Recommendation:** Use CI/CD with platform-specific runners instead.

---

## Output Directory Structure

After running `npm run make`, your builds will be in the `out/` directory:

```
out/
├── make/
│   ├── deb/                    # Linux .deb packages
│   ├── appimage/               # Linux AppImage
│   ├── zip/                    # ZIP archives (all platforms)
│   ├── dmg/                    # macOS .dmg installers
│   └── squirrel.windows/       # Windows Squirrel installers
└── mosaic-companion-<platform>-<arch>/  # Packaged app (pre-make)
```

---

## Native Modules

Mosaic Companion uses native modules that must be compiled for each platform:
- `onnxruntime-node` (AI/ML inference)
- `sharp` (image processing)

**How Electron Forge handles this:**
- Automatically rebuilds native modules for the target platform during `make`
- `asarUnpack` in `forge.config.js` ensures native modules are extracted from the ASAR archive
- The `generateAssets` hook runs `npm run build` to compile the Vite frontend before packaging

**Important:** Always run `npm install` before building to ensure dependencies are correctly installed.

---

## Publishing to S3

Mosaic Companion is configured to publish releases to AWS S3:

```bash
# Publish for current platform and architecture
npm run deploy

# Publish for specific architecture
npm run deploy:x64
npm run deploy:arm64
```

**Requirements:**
Ensure your `.env.local` contains AWS credentials:

```env
AWS_ACCESS_KEY_ID="your-id"
AWS_SECRET_ACCESS_KEY="your-key"
```

**S3 Configuration** (from `forge.config.js`):
- **Bucket:** `mosaic-release`
- **Region:** `us-east-2`
- **Path structure:** `releases/<platform>/<arch>/<filename>`

**Example paths:**
- `releases/linux/x64/mosaic-companion_0.0.31_amd64.deb`
- `releases/darwin/arm64/mosaic-companion-0.0.31-arm64.dmg`
- `releases/win32/x64/mosaic-companion-0.0.31-Setup.exe`

---

## CI/CD Builds

For production releases, use the automated GitHub Actions workflow instead of local builds.

**Workflow file:** `.github/workflows/release.yml`

**Platform runners:**
- **Ubuntu** → Linux builds (x64, arm64)
- **macOS** → macOS builds (x64, arm64)
- **Windows** → Windows builds (x64, arm64)

**Benefits:**
- Native builds on each platform (no Wine/Docker complexity)
- Parallel builds across all platforms
- Automatic S3 publishing
- Consistent, reproducible builds

**Trigger a release:**
```bash
git tag v0.0.32
git push origin v0.0.32
```

---

## Troubleshooting

### Build fails with "permission denied" (EACCES)
This usually happens after running a Docker build. Docker runs as root and can leave root-owned files in your cache or output folders. Fix it by running:

```bash
sudo chown -R $USER:$USER ~/.cache/electron ~/.cache/electron-builder ./out
```

### Build fails with "native module" errors
```bash
npm run clean:all
npm install
```

### Docker build files owned by root
```bash
sudo chown -R $USER:$USER out/
```

### Windows builds fail on Linux without Docker
Install Wine 2.0+ and Mono 4.2+, or use the Docker method (recommended).

### macOS .deb build fails
Install required tools:
```bash
brew install fakeroot dpkg
```

### "Cannot find module" errors during make
Ensure the frontend is built first:
```bash
npm run build
npm run make
```

The `generateAssets` hook in `forge.config.js` should handle this automatically, but manual builds may be needed if the hook fails.

### Squirrel installer doesn't support auto-updates
Uncomment the `remoteReleases` configuration in `forge.config.js` for the Squirrel maker and point it to your S3 bucket URL.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run make` | Build for current platform (default arch) |
| `npm run make:linux` | Build Linux (x64 + arm64) |
| `npm run make:linux:x64` | Build Linux x64 only |
| `npm run make:linux:arm64` | Build Linux arm64 only |
| `npm run make:mac` | Build macOS (current arch) |
| `npm run make:mac:x64` | Build macOS x64 only |
| `npm run make:mac:arm64` | Build macOS arm64 only |
| `npm run make:win` | Build Windows (current arch) |
| `npm run make:win:x64` | Build Windows x64 only |
| `npm run make:win:arm64` | Build Windows arm64 only |
| `npm run deploy` | Publish to S3 (current platform/arch) |
| `npm run deploy:x64` | Publish x64 build to S3 |
| `npm run deploy:arm64` | Publish arm64 build to S3 |
| `npm run package` | Package app without creating installers |
| `npm run clean` | Remove build artifacts |
| `npm run clean:all` | Remove all build artifacts and dependencies |
