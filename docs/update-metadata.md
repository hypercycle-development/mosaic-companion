# Update Metadata

A `latest.json` file is published alongside each release so the app can detect
new versions without a native update feed.

## Why this is needed

Windows uses a Squirrel feed. macOS and Linux do not: Linux has no native
auto-update at all, and macOS auto-update needs code-signed builds, which do not
exist yet (#111). Both therefore use the manual check in
`electron/updater.ts` — fetch a small JSON, compare versions, and point the user
at the download page. `usesManualJsonCheck` is simply `platform !== 'win32'`.
Fetching one file is also much cheaper than enumerating a release's assets.

## Where it lives

`latest.json` is served from GitHub Pages:

**URL**: `https://releases.hyperpg.site/mosaic/latest.json`

It is also attached to every GitHub release as an asset, which the app uses as a
fallback when Pages or its DNS is unavailable:

**Fallback**: `https://github.com/hypercycle-development/mosaic-companion/releases/latest/download/latest.json`

Both are read-only and public. There is no separate metadata file per platform.

## Content format

```json
{
  "version": "0.0.30",
  "releaseDate": "2026-01-24",
  "downloadUrl": "https://releases.hyperpg.site/mosaic/"
}
```

The real file also carries a `downloads` map of per-platform, per-architecture
release URLs, used by the download page. The app itself reads only `version`.

The file is generated from the template at `static/install-page/latest.template.json`.

## How it gets updated

The `release.yml` workflow publishes it automatically as part of a release: it
attaches `latest.json` to the GitHub release and updates the copy on the
`gh-pages` branch. See [Release Process](release-process.md).

There is no supported manual route. If `latest.json` is wrong, re-run the
release workflow rather than editing the published file, so the two copies do
not disagree.

## Update logic

1. App starts, or the user clicks "Check for Updates".
2. App fetches `latest.json` — Pages first, then the release-asset fallback.
3. App compares the running version against the version in the JSON.
4. If the published version is newer, it shows a notification and offers to open
   the download page.

Updates are manual from that point on macOS and Linux: the app does not download
or install anything itself.
