# Release Process Documentation

This document describes how to build and publish releases for Mosaic Companion using **Electron Forge**.

## Prerequisites

1. **AWS Credentials** - You need access keys for the S3 release bucket:

    - `AWS_ACCESS_KEY_ID`
    - `AWS_SECRET_ACCESS_KEY`

2. **S3 Bucket** - Must be configured with public read access.

## Building and Publishing Releases

### Quick Start (CI/CD Recommended)

The easiest way to release is via GitHub Actions:

```bash
git commit -m "Your changes [DEPLOY]"        # Patch version
git commit -m "Your changes [DEPLOY] [MINOR]" # Minor version
git commit -m "Your changes [DEPLOY] [MAJOR]" # Major version
git push
```

This will automatically:

1. Bump the version
2. Build for all platforms and architectures
3. Upload to S3
4. Create a git tag

### Manual Build and Publish

```bash
# Set AWS credentials
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"

# Build and publish for current platform
npm run deploy

# Or build specific architectures
npm run deploy:x64
npm run deploy:arm64
```

### Using the Release Script

For a more guided release process with version bumping, git tagging, and multi-platform support, use the `upload-release.sh` script:

```bash
# Basic usage (builds for current platform)
./scripts/upload-release.sh patch

# Specify platform and architecture
./scripts/upload-release.sh patch linux x64
./scripts/upload-release.sh patch linux arm64
./scripts/upload-release.sh patch win32 x64
./scripts/upload-release.sh patch darwin x64
```

**What the script does:**

1. **Builds and uploads** - Uses Electron Forge to build and publish to S3
2. **Docker support** - Automatically offers Docker for Windows builds on Linux
3. **Updates static page** - Replaces `{{VERSION}}` in `index.template.html` and uploads to S3
4. **Updates metadata** - Optionally updates `latest.json` for version checking
5. **Creates git tags** - Tags the release with download links
6. **Pushes to GitHub** - Optionally pushes the tag to origin

**Docker for Windows builds (Linux only):**

When building Windows releases from Linux, the script will detect this and offer to use Docker:

```bash
./scripts/upload-release.sh patch win32 x64
# Will prompt: "Use Docker for Windows build? (Recommended) [y/N]:"
```

This uses the `electronuserland/builder:wine-mono` image and automatically:

- Installs dependencies inside the container
- Builds the Windows installer
- Uploads to S3
- Fixes file ownership after the build

**Requirements for Docker builds:**

- Docker installed and running
- `.env.local` file with AWS credentials (passed to container)
- Sufficient disk space (~2GB for Docker image)

**Typical multi-platform release workflow:**

```bash
# 1. Bump version first
npm version patch --no-git-tag-version

# 2. Build Linux x64
./scripts/upload-release.sh patch linux x64

# 3. Build Linux arm64
./scripts/upload-release.sh patch linux arm64

# 4. Build Windows x64 (uses Docker automatically)
./scripts/upload-release.sh patch win32 x64

# 5. On the last build, create git tag when prompted
#    Answer "yes" to "Is this the final platform build?"
```

### Build Without Publishing

```bash
# Build for current platform/architecture
npm run make

# Platform-specific (native arch)
npm run make:linux
npm run make:mac
npm run make:win

# Specific architecture
npm run make:linux:x64
npm run make:linux:arm64
npm run make:mac:x64
npm run make:mac:arm64
npm run make:win:x64
npm run make:win:arm64
```

## Output Directory

Electron Forge outputs to `out/make/` (not `release/`):

```bash
out/make/
├── deb/
│   └── x64/
│       └── mosaic-companion_1.2.3_amd64.deb
├── zip/
│   └── linux/
│       └── x64/
│           └── mosaic-companion-linux-x64-1.2.3.zip
├── squirrel.windows/
│   └── x64/
│       └── MosaicCompanion-1.2.3-Setup.exe
└── ...
```

## S3 Bucket Structure

Electron Forge publishes to organized folders:

```bash
s3://mosaic-release/releases/
├── linux/
│   ├── x64/
│   │   ├── mosaic-companion_1.2.3_amd64.deb
│   │   └── mosaic-companion-linux-x64-1.2.3.zip
│   └── arm64/
│       └── ...
├── darwin/
│   ├── x64/
│   │   ├── mosaic-companion-1.2.3-x64.dmg
│   │   └── mosaic-companion-darwin-x64-1.2.3.zip
│   └── arm64/
│       └── ...
└── win32/
    ├── x64/
    │   └── MosaicCompanion-1.2.3-Setup.exe
    └── arm64/
        └── ...
```

## Version Management

Before building a new release, update the version in `package.json`:

```json
{
    "version": "1.2.3"
}
```

Use semantic versioning:

- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features, backwards compatible
- **PATCH** (0.0.x): Bug fixes

> 💡 **Note:** When a release is triggered via CI/CD with `[DEPLOY]`, the version is bumped automatically and a git tag is created.

## Troubleshooting

### "Access Denied" Error

- Check that your IAM user has `s3:PutObject` permission
- Verify AWS credentials are set correctly

### Cross-Compilation Limitations

| Building On | Linux | Windows | macOS |
| ------------- | ------- | --------- | ------- |
| **Linux** | ✅ Yes | ✅ Docker | ❌ No |
| **macOS** | ✅ Yes | ⚠️ Wine+Mono | ✅ Yes |
| **Windows** | ❌ No | ✅ Yes | ❌ No |

> ✅ **Docker support:** The `upload-release.sh` script automatically uses Docker for Windows builds on Linux.
>
> ⚠️ **Recommended:** Use CI/CD (GitHub Actions) to build for all platforms - each runs on its native OS.

### Update Not Detected by App

- Confirm files were uploaded to the correct S3 path
- Check that the version in `package.json` is higher than the installed version
- Verify the app can reach the S3 bucket (check network/firewall)

## CI/CD Integration

GitHub Actions is configured in `.github/workflows/release.yml`. It uses a matrix strategy to build all 6 platform/arch combinations in parallel:

- Linux x64, Linux arm64
- macOS x64, macOS arm64
- Windows x64, Windows arm64

Secrets required:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
