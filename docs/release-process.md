# Release Process Documentation

This document describes how to build and publish releases for Mosaic Companion.

## Prerequisites

1. **AWS Credentials** - You need access keys for the S3 release bucket:

    - `AWS_ACCESS_KEY_ID`
    - `AWS_SECRET_ACCESS_KEY`

2. **S3 Bucket** - Must be configured with public read access.

## Building and Publishing Releases

### Quick Start

```bash
# Set AWS credentials
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"

# Build and publish for each platform
bun run build:win -- --publish always
bun run build:mac -- --publish always
bun run build:linux -- --publish always
```

### Step-by-Step Process

#### 1. Update Version Number

Before building a new release, update the version in `package.json`:

```json
{
    "version": "1.2.3"
}
```

Use semantic versioning:

-   **MAJOR** (x.0.0): Breaking changes
-   **MINOR** (0.x.0): New features, backwards compatible
-   **PATCH** (0.0.x): Bug fixes

#### 2. Set AWS Credentials

Set the environment variables for S3 access:

```bash
# Linux/macOS
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."

# Windows (PowerShell)
$env:AWS_ACCESS_KEY_ID = "AKIA..."
$env:AWS_SECRET_ACCESS_KEY = "..."

# Windows (CMD)
set AWS_ACCESS_KEY_ID=AKIA...
set AWS_SECRET_ACCESS_KEY=...
```

> ⚠️ **Never commit credentials to the repository!**

#### 3. Build and Publish

Run the build command with `--publish always` flag:

```bash
# Windows
bun run build:win -- --publish always

# macOS
bun run build:mac -- --publish always

# Linux
bun run build:linux -- --publish always
```

This will:

1. Build the application
2. Generate installer files
3. Create the `latest*.yml` manifest
4. Upload everything to S3

#### 4. Verify Upload

Check the S3 bucket to confirm files were uploaded:

```
s3://BUCKET_NAME/releases/
├── latest.yml                    # Windows manifest
├── latest-linux.yml              # Linux manifest
├── latest-mac.yml                # macOS manifest
├── Mosaic-Companion-1.2.3.exe      # Windows installer
├── Mosaic-Companion-1.2.3.AppImage # Linux installer
├── Mosaic-Companion-1.2.3.pkg      # macOS installer
└── ...
```

## Publish Options

| Flag                     | Behavior                                    |
| ------------------------ | ------------------------------------------- |
| `--publish always`       | Always publishes, fails if upload fails     |
| `--publish onTag`        | Only publishes when building from a git tag |
| `--publish onTagOrDraft` | Publishes on tag, or creates a draft        |
| `--publish never`        | Never publishes (build only)                |

## Troubleshooting

### "Access Denied" Error

-   Check that your IAM user has `s3:PutObject` permission
-   Verify the bucket name in `package.json` matches your actual bucket

### Files Not Uploading

-   Ensure `--publish always` flag is included
-   Check AWS credentials are set correctly
-   Verify internet connection

### Update Not Detected by App

-   Confirm the `latest*.yml` file was uploaded
-   Check that the version in `package.json` is higher than the installed version
-   Verify the bucket/region in `package.json` matches the upload destination

## CI/CD Integration

For automated releases, set AWS credentials as secrets in your CI/CD system:

### GitHub Actions Example

```yaml
- name: Build and Publish
  env:
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  run: bun run build:linux -- --publish always
```

### GitLab CI Example

```yaml
release:
    script:
        - bun run build:linux -- --publish always
    variables:
        AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
        AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
```

## Manual Build and Upload (Fallback)

Use this when CI is unavailable (e.g., rate-limited, offline).

### 1. Clean and Build

```bash
# Clean previous builds
rm -rf release/

# Build the web app
npm run build

# Build Electron for your platform (with both architectures)
npx electron-builder --linux --x64 --arm64   # Linux
npx electron-builder --mac --x64 --arm64     # macOS (requires Mac)
npx electron-builder --win --x64 --arm64     # Windows (requires Windows)
```

### 2. Configure AWS CLI

```bash
# One-time setup
aws configure
# Enter: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, region (us-east-2)
```

### 3. Upload to S3

```bash
cd release

# Linux
aws s3 cp . s3://mosaic-release/releases/ --recursive --exclude "*" \
  --include "*.AppImage" \
  --include "*.deb" \
  --include "latest-linux*.yml"

# macOS
aws s3 cp . s3://mosaic-release/releases/ --recursive --exclude "*" \
  --include "*.dmg" \
  --include "*.zip" \
  --include "latest-mac*.yml"

# Windows
aws s3 cp . s3://mosaic-release/releases/ --recursive --exclude "*" \
  --include "*.exe" \
  --include "latest*.yml"
```

### 4. Verify Upload

```bash
aws s3 ls s3://mosaic-release/releases/ | head -20
```

### Platform Requirements

| Build Target | Requires |
|--------------|----------|
| Linux x64/arm64 | Linux machine |
| macOS x64/arm64 | macOS machine |
| Windows x64/arm64 | Windows machine |

> ⚠️ **Note:** You cannot cross-compile Electron apps. Each target platform must be built on that platform.

