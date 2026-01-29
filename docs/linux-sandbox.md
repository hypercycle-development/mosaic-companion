# Linux Sandbox Security

This document explains the Chromium sandbox, why it may fail on certain Linux distributions, and how Mosaic Companion handles this automatically.

## What is the Sandbox?

The Chromium sandbox is a security feature that isolates web content from your system. It uses Linux namespace and SUID sandbox mechanisms to prevent malicious web pages from accessing your files or system resources.

## The Ubuntu 24.04+ Issue

Starting with Ubuntu 24.04, stricter AppArmor policies prevent the Electron sandbox from working correctly in AppImage format:

```
FATAL:sandbox/linux/suid/client/setuid_sandbox_host.cc:166
The SUID sandbox helper binary was found, but is not configured correctly.
```

### Why This Happens

1. **AppImage runs from FUSE mount**: AppImages execute from `/tmp/.mount_*`, which is a read-only FUSE filesystem
2. **SUID cannot work on FUSE**: The SUID sandbox requires special file permissions that don't work on FUSE mounts
3. **Ubuntu 24.04 blocks fallback**: The kernel parameter `kernel.apparmor_restrict_unprivileged_userns=1` prevents the fallback user namespace sandbox

## How Mosaic Companion Handles This

Mosaic Companion includes **auto-detection** that handles this automatically:

1. **On launch**, the app tries to start with the sandbox enabled
2. **If the sandbox fails**, the app automatically restarts with `--no-sandbox`
3. **A warning banner** appears in the app to inform you of reduced security
4. **You can configure this** in Settings → Linux Sandbox Security

## Sandbox Mode Options

In the Settings page, you can choose between three modes:

| Mode | Description | Best For |
|------|-------------|----------|
| **Auto-detect** (default) | Tries sandbox, falls back if it fails | Most users |
| **Force Enabled** | Always use sandbox (may fail on Ubuntu 24.04+) | Older distros, .deb installs |
| **Force Disabled** | Never use sandbox | Maximum compatibility |

## Security Implications

When running without the sandbox:

- **Still protected by**: Process isolation, seccomp-bpf filtering, site isolation
- **Not protected by**: SUID sandbox, user namespace sandbox
- **Risk level**: Low for normal browsing, but malicious web content has slightly more access

> ⚠️ **Recommendation**: If security is a priority, consider using the `.deb` package instead of AppImage. The `.deb` installation has full sandbox support.

## Manual Workarounds

### Option 1: Run with Flag

If your AppImage doesn't auto-detect correctly, you can manually run:

```bash
./Mosaic-Companion-*.AppImage --no-sandbox
```

### Option 2: Use .deb Package

The `.deb` package installs with proper permissions:

```bash
sudo dpkg -i mosaic-companion_*.deb
mosaic-companion
```

### Option 3: Disable AppArmor Restriction (Advanced)

> ⚠️ **Warning**: This changes system-wide security policy.

```bash
# Temporary (until reboot)
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0

# Permanent
echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee -a /etc/sysctl.conf
```

## Affected Distributions

- Ubuntu 24.04 and later
- Pop!_OS 24.04 and later
- Any distro with `kernel.apparmor_restrict_unprivileged_userns=1`

## Technical Details

The wrapper script inside the AppImage:
- Reads your sandbox preference from `~/.config/mosaic-companion/app-settings.json`
- Tries launching with sandbox first (in auto mode)
- Sets `MOSAIC_SANDBOX_FALLBACK=1` environment variable when falling back
- The main process reads this variable to show the warning banner

## Related Links

- [Electron Issue #17972](https://github.com/electron/electron/issues/17972)
- [Electron Issue #42510](https://github.com/electron/electron/issues/42510)
- [Ubuntu Bug #2064672](https://bugs.launchpad.net/ubuntu/+source/apparmor/+bug/2064672)
