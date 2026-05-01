# Linux Update Metadata (S3)

To allow the Mosaic Companion application on Linux to detect new versions, a `latest.json` file must exist in the appropriate folder in the S3 bucket.

## Why is this needed?

Unlike Windows and macOS which use "Squirrel" feeds, Linux updates are handled by a custom check in `updater.js`. This check looks for a central metadata file to compare versions because:

1. Electron Forge does not generate auto-update metadata for Linux by default.
2. It's much faster to fetch a tiny JSON than to query the entire bucket.

## File Locations

### Main Releases
**URL**: `https://mosaic-release.s3.us-east-2.amazonaws.com/releases/latest.json`
**Bucket Path**: `s3://mosaic-release/releases/latest.json`

### Experimental Releases
Each experimental release has its own `latest.json`:
**URL**: `https://mosaic-release.s3.us-east-2.amazonaws.com/releases/experimental/{experiment}/latest.json`
**Bucket Path**: `s3://mosaic-release/releases/experimental/{experiment}/latest.json`

Example for screenpipe experiment:
`https://mosaic-release.s3.us-east-2.amazonaws.com/releases/experimental/screenpipe/latest.json`

## Content Format

```json
{
  "version": "0.0.30",
  "releaseDate": "2026-01-24",
  "downloadUrl": "https://mosaic-release.s3.us-east-2.amazonaws.com/index.html"
}
```

### How to update it?

The `latest.json` file is generated from a **template** located at `static/install-page/latest.template.json`.

You can update this file in three ways:

### 1. Automated (Recommended)

Run the release script. It detects your platform and only prompts to update `latest.json` if you are on Linux:

```bash
# Main release
./scripts/upload-release.sh

# Experimental release
./scripts/upload-experimental-release.sh screenpipe patch linux x64
```

If you are on macOS or Windows, the script will skip the `latest.json` update by default to avoid accidental notifications for Linux users.

### 2. CI/CD (GitHub Actions)

The `release.yml` workflow is configured to upload this file automatically every time a new version is built and published.

### 3. Manual

If you need to manually override the version:

1. Create the `latest.json` file.
2. Upload it to the appropriate folder:

```bash
# Main release
aws s3 cp latest.json s3://mosaic-release/releases/latest.json --content-type "application/json"

# Experimental release
aws s3 cp latest.json s3://mosaic-release/releases/experimental/screenpipe/latest.json --content-type "application/json"
```

## Update Logic Flow

1. App starts or user clicks "Check for Updates".
2. App fetches `latest.json` from S3.
3. App compares current version (from `package.json`) with the version in the JSON.
4. If JSON version > Local version:
   - Show notification.
   - Redirect user to the installation page.
