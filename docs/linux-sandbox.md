# Linux Sandbox Security

This document explains the Chromium sandbox, why it may fail on certain Linux distributions, and how MosAIc Companion handles this automatically.

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

## How MosAIc Companion Handles This

MosAIc Companion **automatically detects** this kernel restriction and handles it:

1. **On launch**, the wrapper script checks `/proc/sys/kernel/apparmor_restrict_unprivileged_userns`
2. **If the restriction is enabled**, the app automatically starts with `--no-sandbox`
3. **A warning banner** appears in the app to inform you of reduced security

This is fully automatic - no user configuration needed.

## Security Implications

When running without the sandbox:

- **Still protected by**: Process isolation, seccomp-bpf filtering, site isolation
- **Not protected by**: SUID sandbox, user namespace sandbox
- **Risk level**: Low for normal browsing, but malicious web content has slightly more access

> ⚠️ **Recommendation**: If security is a priority, consider using the `.deb` package instead of AppImage. The `.deb` installation has full sandbox support.

## Alternative: Use .deb Package

The `.deb` package installs with proper permissions and has full sandbox support:

```bash
sudo dpkg -i mosaic-companion_*.deb
mosaic-companion
```

## Advanced: Disable AppArmor Restriction

> ⚠️ **Warning**: This changes system-wide security policy.

```bash
# Temporary (until reboot)
sudo sysctl -w kernel.apparmor_restrict_unprivileged_userns=0

# Permanent
echo 'kernel.apparmor_restrict_unprivileged_userns=0' | sudo tee /etc/sysctl.d/99-appimage-sandbox.conf
```

## Affected Distributions

- Ubuntu 24.04 and later
- Pop!_OS 24.04 and later
- Any distro with `kernel.apparmor_restrict_unprivileged_userns=1`

## Technical Details

The wrapper script inside the AppImage:

1. Checks `/proc/sys/kernel/apparmor_restrict_unprivileged_userns`
2. Checks `/proc/sys/kernel/unprivileged_userns_clone` (older restriction)
3. Sets `MOSAIC_SANDBOX_FALLBACK=1` if sandbox won't work
4. The main process reads this variable to show the warning banner

## Related Links

- [Electron Issue #42510](https://github.com/electron/electron/issues/42510)
- [Ubuntu Bug #2064672](https://bugs.launchpad.net/ubuntu/+source/apparmor/+bug/2064672)
