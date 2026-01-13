# Release Process Documentation

This document describes how to build and publish releases for Mosaic Browser.

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
npm run build:win -- --publish always
npm run build:mac -- --publish always
npm run build:linux -- --publish always
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
- **MAJOR** (x.0.0): Breaking changes
- **MINOR** (0.x.0): New features, backwards compatible
- **PATCH** (0.0.x): Bug fixes

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
npm run build:win -- --publish always

# macOS
npm run build:mac -- --publish always

# Linux
npm run build:linux -- --publish always
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
├── Mosaic-Browser-1.2.3.exe      # Windows installer
├── Mosaic-Browser-1.2.3.AppImage # Linux installer
├── Mosaic-Browser-1.2.3.dmg      # macOS installer
└── ...
```

## Publish Options

| Flag | Behavior |
|------|----------|
| `--publish always` | Always publishes, fails if upload fails |
| `--publish onTag` | Only publishes when building from a git tag |
| `--publish onTagOrDraft` | Publishes on tag, or creates a draft |
| `--publish never` | Never publishes (build only) |

## Troubleshooting

### "Access Denied" Error

- Check that your IAM user has `s3:PutObject` permission
- Verify the bucket name in `package.json` matches your actual bucket

### Files Not Uploading

- Ensure `--publish always` flag is included
- Check AWS credentials are set correctly
- Verify internet connection

### Update Not Detected by App

- Confirm the `latest*.yml` file was uploaded
- Check that the version in `package.json` is higher than the installed version
- Verify the bucket/region in `package.json` matches the upload destination

## CI/CD Integration

For automated releases, set AWS credentials as secrets in your CI/CD system:

### GitHub Actions Example

```yaml
- name: Build and Publish
  env:
    AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
    AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
  run: npm run build:linux -- --publish always
```

### GitLab CI Example

```yaml
release:
  script:
    - npm run build:linux -- --publish always
  variables:
    AWS_ACCESS_KEY_ID: $AWS_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY: $AWS_SECRET_ACCESS_KEY
```
