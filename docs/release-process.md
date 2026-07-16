# Release Process Documentation

Mosaic Companion releases are published to **GitHub Releases** (binaries) and
**GitHub Pages** (download page + `latest.json`, served at
`https://releases.hyperpg.site/mosaic/`).

> **Legacy note:** releases up to and including v0.1.7 were hosted on an S3
> bucket (`mosaic-release`). Installs of those versions check S3 for updates,
> so the release workflow can optionally dual-publish to S3 (see
> `also_publish_s3` below) until that fleet has migrated. The S3 channel and
> the `scripts/upload-release.sh` / `scripts/upload-experimental-release.sh`
> tooling are deprecated.

## How updates reach users

| Platform | Mechanism |
| -------- | --------- |
| Windows  | Squirrel auto-update via `https://update.electronjs.org/hypercycle-development/mosaic-companion/win32-x64/{version}` (serves the feed from our GitHub Releases) |
| macOS    | Manual check: the app fetches `latest.json` and offers the download page. Native auto-update requires code-signed builds, which we don't have yet. |
| Linux    | Manual check: same `latest.json` + download-page flow. |

The app fetches `latest.json` from `https://releases.hyperpg.site/mosaic/latest.json`,
falling back to the copy attached to the latest GitHub release
(`releases/latest/download/latest.json`) if Pages is unreachable.

## Cutting a release

1. **Bump the version via a PR.** Update `version` in `package.json` (and
   `package-lock.json` — `npm version patch --no-git-tag-version` does both)
   and merge to `main`. The workflow refuses to run if the version isn't
   greater than the latest `v*` tag.
2. **(First time / after credential changes) dry-run the workflow.** Actions →
   *Release* → *Run workflow* with **dry_run** ticked. This validates the
   `GITHUB_TOKEN` release permissions and the legacy AWS credentials without
   building anything.
3. **Run the release.** Actions → *Release* → *Run workflow* (leave dry_run
   unticked). Tick **also_publish_s3** if pre-0.1.8 installs should still be
   notified through the legacy S3 channel.

The workflow then:

1. Validates the version and pre-creates a **draft** GitHub release targeting
   the released commit.
2. Builds all platforms in parallel (Linux x64/arm64, macOS x64/arm64,
   Windows x64) and uploads the artifacts to the draft release
   (plus S3 when `also_publish_s3` is set).
3. **Finalize:** verifies the complete asset set (including the Squirrel
   `RELEASES` file and `.nupkg` — required for Windows auto-update), attaches
   `latest.json`, publishes the release (this creates the `v{version}` git
   tag), and updates the download page + `latest.json` on the `gh-pages`
   branch.

If any platform build fails, the release stays in draft and nothing is
published — fix the problem and re-run the workflow.

### Important: "latest" semantics

Windows updates and the `latest.json` fallback both use GitHub's
`releases/latest` pointer. **Any non-app release created on this repo must be
marked as a pre-release**, or it will hijack the update feed.

## Required repository secrets

| Secret | Used for |
| ------ | -------- |
| `GITHUB_TOKEN` | (automatic) creating releases, uploading assets, pushing `gh-pages` |
| `GMAIL_CREDENTIALS` | bundled Gmail OAuth client config |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | legacy S3 dual-publish only |

## Local builds (no publishing)

```bash
npm run make            # current platform/arch
npm run make:linux:x64  # explicit platform/arch (see package.json for all)
```

Artifacts land in `out/make/`. Note `npm run make`/`package` expects
`config/gmail-credentials.json` to exist — copy
`config/gmail-credentials.example.json` and fill it in (Gmail features only).

Manual publishing from a workstation (`npm run deploy`) is possible with the
right env vars but discouraged — use the workflow so the asset verification
and Pages update always happen.

## The download page

Source of truth: `static/install-page/index.template.html` (+ `style.css`,
`latest.template.json`). `{{VERSION}}` and `{{RELEASE_DATE}}` are substituted
at release time. The rendered page is committed to the `gh-pages` branch under
`mosaic/` by the workflow — never edit `gh-pages` content by hand, it will be
overwritten on the next release. The `CNAME` and `.nojekyll` files on
`gh-pages` are load-bearing (custom domain + raw serving); the workflow
preserves them.

## Related documentation

- [Experimental Releases](./experimental-releases.md) — **deprecated** (S3-based)
- [Linux Update Metadata](./linux-update-metadata.md) — legacy S3 details
- [macOS Update Verification](./mac_update_verification.md) — applies once code signing lands
