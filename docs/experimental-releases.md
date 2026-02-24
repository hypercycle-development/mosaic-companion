# Experimental Releases Guide

This guide explains how to create and manage independent experimental releases for Mosaic Companion. Each experimental release lives in its own isolated S3 folder with its own versioning, update checking, and distribution.

## Overview

Experimental releases allow multiple developers to work on different features independently without interfering with the main release or each other's work. Each experiment:

- Has its own S3 folder: `/releases/experimental/{experiment-name}/`
- Has its own `latest.json` for version checking
- Has its own naming: `mosaic-companion-{experiment-name}`
- Can have its own custom install page
- Works completely independently from main releases

## Quick Start

### 1. Pull Latest Changes

First, make sure you have the latest experimental release infrastructure:

```bash
git checkout main
git pull origin main
```

### 2. Create Your Feature Branch

Create a new branch for your experiment:

```bash
git checkout -b Feature-{your-experiment}
```

**Examples:**

- `Feature-screenpipe`
- `Feature-gmail`

### 3. Update `package.json`

Change the `name` field to include your experiment name:

```json
{
  "name": "mosaic-companion-{your-experiment}",
  "version": "0.0.41",
  "description": "Mosaic Companion Application",
  ...
}
```

**Example for screenpipe:**

```json
{
  "name": "mosaic-companion-screenpipe",
  "version": "0.0.41",
  ...
}
```

### 4. Update `forge.config.js`

Update the `packagerConfig` section to match your experiment name:

```javascript
export default {
    packagerConfig: {
        appId: 'com.mosaic.companion',
        name: 'mosaic-companion-{your-experiment}',
        executableName: 'mosaic-companion-{your-experiment}',
        icon: 'assets/icon',
        ...
    },
    ...
}
```

**Example for screenpipe:**

```javascript
packagerConfig: {
    appId: 'com.mosaic.companion',
    name: 'mosaic-companion-screenpipe',
    executableName: 'mosaic-companion-screenpipe',
    ...
}
```

### 5. Build and Upload Your Release

Use the experimental release script:

```bash
./scripts/upload-experimental-release.sh {your-experiment} [patch|minor|major] [platform] [arch]
```

**Examples:**

```bash
# Linux x64 build
./scripts/upload-experimental-release.sh screenpipe patch linux x64

# Windows x64 build
./scripts/upload-experimental-release.sh gmail patch win32 x64

# macOS arm64 build
./scripts/upload-experimental-release.sh ai-assistant minor darwin arm64
```

**Arguments:**

- `{your-experiment}`: Your experiment name (required)
- `patch|minor|major`: Version bump type (default: patch)
- `platform`: Target platform - `linux`, `darwin`, or `win32` (default: current)
- `arch`: Architecture - `x64` or `arm64` (default: current)

### 6. Verify Your Upload

Check that your files were uploaded correctly:

```bash
aws s3 ls s3://mosaic-release/releases/experimental/{your-experiment}/ --recursive
```

You should see:

```
releases/experimental/{your-experiment}/latest.json
releases/experimental/{your-experiment}/linux/x64/mosaic-companion-{your-experiment}-0.0.41-x64.AppImage
releases/experimental/{your-experiment}/linux/x64/mosaic-companion-{your-experiment}_0.0.41_amd64.deb
...
```

## S3 Folder Structure

Your experimental release will have the following structure in S3:

```
s3://mosaic-release/
└── releases/
    ├── latest.json                    # Main release metadata
    ├── linux/                         # Main release artifacts
    ├── win32/
    ├── darwin/
    └── experimental/
        └── {your-experiment}/
            ├── latest.json            # Your experiment's metadata
            ├── index.html             # (Optional) Custom install page
            ├── style.css              # (Optional) Custom styles
            ├── linux/
            │   ├── x64/
            │   │   ├── mosaic-companion-{experiment}-{version}-x64.AppImage
            │   │   └── mosaic-companion-{experiment}_{version}_amd64.deb
            │   └── arm64/
            │       ├── mosaic-companion-{experiment}-{version}-arm64.AppImage
            │       └── mosaic-companion-{experiment}_{version}_arm64.deb
            ├── win32/
            │   └── x64/
            │       └── mosaic-companion-{experiment}-{version}-Setup.exe
            └── darwin/
                ├── x64/
                │   └── mosaic-companion-{experiment}-{version}-x64.dmg
                └── arm64/
                    └── mosaic-companion-{experiment}-{version}-arm64.dmg
```

## Automatic Update Checking

The update checker in `updater.js` automatically detects which `latest.json` to check based on the app name:

| App Name                      | Update Check URL                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------ |
| `mosaic-companion`            | `https://mosaic-release.s3.us-east-2.amazonaws.com/releases/latest.json`                         |
| `mosaic-companion-screenpipe` | `https://mosaic-release.s3.us-east-2.amazonaws.com/releases/experimental/screenpipe/latest.json` |
| `mosaic-companion-gmail`      | `https://mosaic-release.s3.us-east-2.amazonaws.com/releases/experimental/gmail/latest.json`      |

**You don't need to configure anything** - it works automatically based on your `package.json` name!

## Custom Install Page (Optional)

You can create a custom install page for your experiment to showcase your features and available platforms.

### 1. Create Your Install Page Directory

```bash
mkdir -p static/experimental/{your-experiment}
```

### 2. Copy the Template

```bash
cp static/install-page/index.template.html static/experimental/{your-experiment}/index.html
cp static/install-page/style.css static/experimental/{your-experiment}/style.css
```

### 3. Customize Your Page

Edit `static/experimental/{your-experiment}/index.html` to:

- Highlight your experimental features
- Show only the platforms you've built
- Add screenshots or demos
- Include installation instructions

### 4. Upload Your Custom Page

The upload script will automatically detect and upload your custom install page if it exists:

```bash
./scripts/upload-experimental-release.sh {your-experiment} patch linux x64
```

When prompted, confirm the upload of your custom install page.

### 5. Access Your Install Page

Your custom page will be available at:

```
https://mosaic-release.s3.us-east-2.amazonaws.com/releases/experimental/{your-experiment}/index.html
```

## The `latest.json` File

Each experimental release has its own `latest.json` file that contains version metadata and download links.

### Format

```json
{
  "version": "0.0.41",
  "releaseDate": "2026-01-30",
  "experiment": "screenpipe",
  "appName": "mosaic-companion-screenpipe",
  "downloadUrl": "https://mosaic-release.s3.us-east-2.amazonaws.com/releases/experimental/screenpipe/linux/x64/mosaic-companion-screenpipe-0.0.41-x64.AppImage",
  "downloads": {
    "linux": {
      "x64": {
        "appimage": "https://mosaic-release.s3.us-east-2.amazonaws.com/releases/experimental/screenpipe/linux/x64/mosaic-companion-screenpipe-0.0.41-x64.AppImage",
        "deb": "https://mosaic-release.s3.us-east-2.amazonaws.com/releases/experimental/screenpipe/linux/x64/mosaic-companion-screenpipe_0.0.41_amd64.deb"
      },
      "arm64": { ... }
    },
    "win32": { ... },
    "darwin": { ... }
  }
}
```

This file is automatically generated and uploaded by the `upload-experimental-release.sh` script.

## Git Tagging (Optional)

The upload script can optionally create git tags for your experimental releases:

```
v0.0.41-experimental-screenpipe
v0.0.42-experimental-gmail
```

These tags help track which commits correspond to which experimental releases.

## Building for Multiple Platforms

You can build for different platforms from the same branch:

```bash
# Build for Linux x64
./scripts/upload-experimental-release.sh screenpipe patch linux x64

# Build for Linux arm64
./scripts/upload-experimental-release.sh screenpipe patch linux arm64

# Build for Windows x64 (uses Docker on Linux)
./scripts/upload-experimental-release.sh screenpipe patch win32 x64

# Build for macOS x64
./scripts/upload-experimental-release.sh screenpipe patch darwin x64

# Build for macOS arm64
./scripts/upload-experimental-release.sh screenpipe patch darwin arm64
```

**Note:** Windows builds on Linux require Docker. The script will prompt you to use Docker automatically.

## Troubleshooting

### App Name Mismatch Warning

If you see this warning:

```
⚠️  Warning: package.json name is 'mosaic-companion'
   For experiment 'screenpipe', expected name: 'mosaic-companion-screenpipe'
```

**Solution:** Update both `package.json` and `forge.config.js` as described in steps 3 and 4.

### AWS Credentials Not Found

If you see:

```
Warning: AWS credentials not found in .env.local or environment.
```

**Solution:** Create a `.env.local` file with your AWS credentials:

```bash
AWS_ACCESS_KEY_ID=your_access_key_here
AWS_SECRET_ACCESS_KEY=your_secret_key_here
```

### Files Not Uploading to Correct Path

**Solution:** Make sure you set the `EXPERIMENTAL_S3_PATH` environment variable. The script does this automatically, but if you're running `electron-forge publish` manually, you need to export it:

```bash
export EXPERIMENTAL_S3_PATH="releases/experimental/screenpipe"
npm run deploy:x64
```

### Update Checker Not Finding New Version

**Checklist:**

1. ✅ Is `latest.json` uploaded to the correct path?
2. ✅ Does the app name in `package.json` match the experiment name?
3. ✅ Is the version in `latest.json` higher than the current app version?
4. ✅ Can you access the `latest.json` URL in a browser?

## Best Practices

### 1. Use Descriptive Experiment Names

- ✅ Good: `screenpipe`, `gmail-integration`, `ai-assistant`
- ❌ Bad: `test`, `feature1`, `new-stuff`

### 2. Keep Your Branch Updated

Regularly merge from main to get infrastructure updates:

```bash
git checkout Feature-screenpipe
git merge main
```

### 3. Version Bumping

- Use `patch` for bug fixes and minor changes
- Use `minor` for new features
- Use `major` for breaking changes

### 4. Test Before Uploading

Always test your build locally before uploading:

```bash
npm run make:linux:x64
# Test the build in out/make/
```

### 5. Document Your Features

If you create a custom install page, clearly document:

- What your experiment does
- Which platforms are supported
- Any special installation requirements
- Known issues or limitations

## Merging to Main

When your experimental feature is ready to merge into the main release:

### 1. Revert Naming Changes

Change `package.json` and `forge.config.js` back to:

```json
"name": "mosaic-companion"
```

### 2. Create a Pull Request

```bash
git checkout Feature-screenpipe
git push origin Feature-screenpipe
# Create PR on GitHub
```

### 3. Clean Up Experimental Artifacts (Optional)

After merging, you can optionally remove your experimental S3 folder:

```bash
aws s3 rm s3://mosaic-release/releases/experimental/screenpipe/ --recursive
```

## FAQ

**Q: Can I have multiple experiments in the same branch?**
A: No, each branch should only have one experiment name configured.

**Q: Will my experimental release interfere with the main release?**
A: No, they are completely isolated in separate S3 folders.

**Q: Can users auto-update experimental releases?**
A: On Linux, users will be notified of updates and directed to the download page. Windows and macOS auto-updates are not currently supported for experimental releases.

**Q: How do I share my experimental release with testers?**
A: Share the install page URL:

```
https://mosaic-release.s3.us-east-2.amazonaws.com/releases/experimental/{your-experiment}/index.html
```

Or share direct download links from the `latest.json` file.

**Q: Can I delete an old experimental release?**
A: Yes, use the AWS CLI:

```bash
aws s3 rm s3://mosaic-release/releases/experimental/{experiment}/ --recursive
```

## Related Documentation

- [Main Release Process](./release-process.md)
- [Linux Update Metadata](./linux-update-metadata.md)
- [Docker Windows Builds](./release-process.md#docker-windows-builds)
