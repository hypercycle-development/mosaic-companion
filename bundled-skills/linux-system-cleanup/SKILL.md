---
name: linux-system-cleanup
description: "Use when a Linux host is low on disk space and the user wants safe triage and cleanup without touching project code, containers, or service data. Investigates /var, logs, caches, and rotation; reclaim"
version: 1.0.0
author: Hermes Agent
category: devops
source: hermes-converted
converted_at: 2026-07-02T21:03:36.287306
---

# Linux System Cleanup — Safe Disk-Space Triage

## Overview

A Linux host running out of disk space is usually caused by a small number of large, fast-growing targets. This skill provides a safe, repeatable workflow to identify the culprit, sample it, reclaim space, and prevent recurrence — while preserving user project directories, container/service data, and anything that is not clearly safe log/cache data.

## When to Use

- `df -h` shows a filesystem at or near 100% usage
- A monitoring alert reports low disk space
- A user asks you to “analyze this disk-usage graph” or “clean up disk space”
- Log files, caches, or rotation failures are suspected

## Don't Use For

- Filesystem corruption or hardware failure (use `fsck`, backup first)
- Shrinking live database data files or container volumes
- Anything where the user has not confirmed which directories are safe to touch

## Safety Rules (Non-Negotiable)

1. **Never delete or truncate project source directories, repos, or work trees** unless explicitly told to.
2. **Never purge Docker/Podman/containerd images, volumes, or running container filesystems** unless explicitly told to.
3. **Always sample the head/tail of large logs** before truncation so a post-mortem is possible.
4. **Prefer rotation + truncation over `rm`** for active logs so services keep writing.
5. **Do not compress multi-hundred-gigabyte files inline** — it is too slow and can block the filesystem. Truncate after sampling if the content is expendable.
6. **Confirm disk usage before and after** each cleanup step with `df -h`.

## Core Workflow

### 1. Establish baseline
```bash
hostname && df -h /
```

### 2. Drill into the largest directories
```bash
sudo du -h --max-depth=1 /var | sort -hr
sudo du -h --max-depth=1 /home | sort -hr
sudo du -h --max-depth=1 /opt  | sort -hr
```
Use `--max-depth=1` first; only descend once you know which subtree dominates.

### 3. Inspect /var/log when it dominates
```bash
sudo ls -lhS /var/log | head -30
sudo du -h --max-depth=1 /var/log | sort -hr | head -20
```

### 4. Identify the log spam source
```bash
sudo awk '{print $5}' /var/log/syslog | sort | uniq -c | sort -nr | head -20
```
Look for repeated units or services generating noise. Common offenders:
- `tailscaled` with verbose WireGuard messages
- Failing systemd units looping with `status=.../CHDIR`
- Applications left in debug logging mode

### 5. Sample before touching
```bash
sudo tail -n 500 /var/log/syslog  > /tmp/syslog-tail-sample.$(date +%Y%m%d%H%M%S).log
sudo tail -n 500 /var/log/auth.log > /tmp/auth-tail-sample.$(date +%Y%m%d%H%M%S).log
```

### 6. Rotate live logs safely
```bash
sudo mv /var/log/syslog /var/log/syslog.monster.$(date +%Y%m%d%H%M%S)
sudo mv /var/log/auth.log /var/log/auth.log.monster.$(date +%Y%m%d%H%M%S)
sudo touch /var/log/syslog /var/log/auth.log
sudo chmod 640 /var/log/syslog /var/log/auth.log
sudo chown syslog:adm /var/log/syslog /var/log/auth.log
sudo systemctl restart rsyslog
```

### 7. Reclaim space by truncating the rotated monsters
```bash
sudo truncate -s 0 /var/log/syslog.monster.* /var/log/auth.log.monster.*
# or, if the user prefers full removal after sampling:
sudo rm -f /var/log/syslog.monster.* /var/log/auth.log.monster.*
```

Do **not** try to `gzip` hundreds of gigabytes inline — it will time out and leave the disk full.

### 8. Verify recovery
```bash
df -h /
ls -lh /var/log/syslog /var/log/auth.log
```

### 9. Check logrotate status and config
```bash
systemctl status logrotate.timer
cat /etc/logrotate.d/rsyslog
sudo logrotate --debug /etc/logrotate.d/rsyslog 2>&1 | head -30
```

### 10. Add a size guard (optional, with user consent)
Edit `/etc/logrotate.d/rsyslog` to include a size threshold:
```
size 500M
```
This prevents a log from growing to hundreds of gigabytes before the daily/weekly rotation triggers.

## Project and Service Boundaries

When a user names project directories or services that must not be touched, treat them as off-limits for the entire session. Examples from this user’s environment:
- `mosaic-companion` repo (`/home/mauricio/mosaic-companion`)
- Stargate-related files and services
- HyperCycle Node Manager files and services

Confirm the list at the start of cleanup. Err on the side of asking if a directory is project-related before purging it.

## Common Pitfalls

1. **Deleting `/var/log/*.log` without rotating first.** Services may keep an open file handle to the deleted inode, eating disk space invisibly. Rotate + restart the logging daemon instead.

2. **Compressing 100+ GB files to free space.** Compression writes a new copy, can take hours, and may fail with permission or timeout issues. Truncate after sampling is usually the correct reclaim path.

3. **Running `du` without `sudo` and ignoring permission errors.** Many heavy directories (`/var/lib/docker`, `/var/log`, `/var/lib/mongodb`) are root-only. Missing them leads to wrong conclusions.

4. **Cleaning `/var/lib/docker` first.** Docker images, volumes, and build cache can be large, but they are also project data. Leave them alone unless explicitly asked.

5. **Assuming logrotate is broken when logs are huge.** Logrotate may be working correctly but on a weekly schedule while a noisy service creates gigabytes per hour. Add a size guard rather than just “fixing” logrotate.

6. **Forgetting to measure growth rate after cleanup.** A still-noisy service will refill the disk. Check rate with:
   ```bash
   start=$(stat -c %s /var/log/syslog); sleep 60; end=$(stat -c %s /var/log/syslog); echo $((end - start)) bytes/min
   ```

## One-Shot Recipes

### Recipe A: Runaway syslog/auth.log cleanup
```bash
# 1. Baseline
df -h /

# 2. Sample
sudo tail -n 500 /var/log/syslog  > /tmp/syslog-tail-sample.$(date +%Y%m%d%H%M%S).log
sudo tail -n 500 /var/log/auth.log > /tmp/auth-tail-sample.$(date +%Y%m%d%H%M%S).log

# 3. Rotate
sudo mv /var/log/syslog /var/log/syslog.monster.$(date +%Y%m%d%H%M%S)
sudo mv /var/log/auth.log /var/log/auth.log.monster.$(date +%Y%m%d%H%M%S)
sudo touch /var/log/syslog /var/log/auth.log
sudo chmod 640 /var/log/syslog /var/log/auth.log
sudo chown syslog:adm /var/log/syslog /var/log/auth.log
sudo systemctl restart rsyslog

# 4. Reclaim
sudo truncate -s 0 /var/log/syslog.monster.* /var/log/auth.log.monster.*
sudo rm -f /var/log/syslog.monster.* /var/log/auth.log.monster.*

# 5. Verify
df -h /
```

### Recipe B: Identify the noisiest log sender
```bash
sudo awk '{print $5}' /var/log/syslog | sort | uniq -c | sort -nr | head -20
```

## Verification Checklist

- [ ] Baseline `df -h /` recorded before any changes
- [ ] Top space consumers identified with `sudo du`
- [ ] Active log files sampled before truncation
- [ ] Live logs rotated and logging daemon restarted
- [ ] Disk usage re-measured after reclaim
- [ ] Logrotate/timer status confirmed
- [ ] Post-cleanup log growth rate measured or estimated
- [ ] User-defined off-limits directories/services were not touched

## References

- `references/session-tailscale-log-flood-2026-06-17.md` — worked example of 500 GB `/var/log` blow-up from `tailscaled` and looping systemd units on `cmhpec-wk-01`.