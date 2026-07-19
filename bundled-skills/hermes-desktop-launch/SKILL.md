---
name: hermes-desktop-launch
description: Launch and troubleshoot Hermes Desktop on Linux. Covers Electron sandbox permissions, GPU process configuration, backend lock-file issues, model context overrides, and the preference to not auto-kill long-running GUI processes.
category: devops
triggers:
  - user asks to launch hermes-desktop
  - ollama launch hermes-desktop fails
  - hermes desktop fails to start
  - Electron desktop app crashes on Linux
  - PermissionError on ~/.hermes/gateway.lock
  - GPU process isn't usable
---

# Hermes Desktop Launch & Troubleshooting

## Overview
Hermes Desktop is an Electron app that spawns its own Hermes backend process. On Linux this path is fragile due to file permissions, Electron sandbox requirements, GPU driver mismatches, and model context requirements.

## Launch Paths

### 1. Source build (development)
```bash
hermes desktop --source
```
Requires `node_modules/electron/dist/chrome-sandbox` to be owned by root with mode `4755`.

### 2. Packaged build
```bash
~/.hermes/hermes-agent/apps/desktop/release/linux-unpacked/Hermes
```

## Common Issues & Fixes

### `npm install` resets chrome-sandbox permissions
Every workspace `npm install` rewrites `node_modules/electron/dist/chrome-sandbox` back to the user with mode `0755`. You must re-apply the SUID fix after any install/build step that refreshes `node_modules`.

Fix:
```bash
sudo chown root:root ~/.hermes/hermes-agent/node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 ~/.hermes/hermes-agent/node_modules/electron/dist/chrome-sandbox
```

### Electron renderer exits cleanly without a window
**Symptom**: `hermes desktop --source` starts, backend becomes ready, but no window appears. Log shows:
```
[renderer] render-process-gone reason=clean-exit exitCode=0
Hermes backend exited (SIGTERM)
```

**Likely causes on Wayland + Intel Arc / i915 + Electron 40.x**:
- Chromium/Electron GPU/zygote incompatibility with the current kernel/graphics stack.
- User namespaces or sandbox policy blocking the renderer.

**Aggressive launch flags that may help**:
```bash
ELECTRON_DISABLE_GPU=1 \
ELECTRON_OZONE_PLATFORM_HINT=x11 \
LIBGL_ALWAYS_SOFTWARE=1 \
__GLX_VENDOR_LIBRARY_NAME=mesa \
MESA_LOADER_DRIVER_OVERRIDE=llvmpipe \
hermes desktop --source -- --disable-gpu --disable-software-rasterizer --disable-gpu-compositing --in-process-gpu --no-sandbox
```

If still no window:
1. Check kernel/user namespaces:
   ```bash
   sudo sysctl kernel.unprivileged_userns_clone=1
   ```
2. Inspect kernel messages:
   ```bash
   dmesg | tail -30
   ```
3. Capture verbose Chromium logging:
   ```bash
   hermes desktop --source -- --enable-logging=stderr --v=1
   ```

See `references/2026-06-17-wayland-intel-arc-debug-notes.md` for a full debug transcript from a session that hit this exact pattern.

### PermissionError on gateway.lock / gateway_state.json
**Symptom**: Backend returns HTTP 500, desktop shows "Waiting for Hermes backend" then restarts in a loop.

**Root cause**: Files in `~/.hermes/` were created by `sudo` and are now owned by `root`.

**Fix**:
```bash
sudo chown $(whoami):$(whoami) ~/.hermes/gateway.lock ~/.hermes/gateway_state.json ~/.hermes/channel_directory.json ~/.hermes/processes.json ~/.hermes/gateway.pid
```

### Electron SUID sandbox abort
**Symptom**: `The SUID sandbox helper binary was found, but is not configured correctly.`

**Fix**:
```bash
sudo chown root:root ~/.hermes/hermes-agent/node_modules/electron/dist/chrome-sandbox
sudo chmod 4755 ~/.hermes/hermes-agent/node_modules/electron/dist/chrome-sandbox
```

Also fix the packaged build sandbox:
```bash
sudo chown root:root ~/.hermes/hermes-agent/apps/desktop/release/linux-unpacked/chrome-sandbox
sudo chmod 4755 ~/.hermes/hermes-agent/apps/desktop/release/linux-unpacked/chrome-sandbox
```

### GPU process launch failed (error_code=1002)
**Symptom**: Desktop crashes with `GPU process isn't usable. Goodbye.`

**Fix**: Force X11 platform and disable GPU:
```bash
~/.hermes/hermes-agent/apps/desktop/release/linux-unpacked/Hermes --ozone-platform=x11 --disable-gpu
```

For source build, set `ELECTRON_OZONE_PLATFORM_HINT=x11`.

### Desktop using Anthropic API instead of Ollama (HTTP 400)
**Symptom**: Desktop log shows:
```
[hermes] ⚠️  API call failed (attempt 1/3): BadRequestError [HTTP 400]
[hermes]    🔌 Provider: custom  Model: claude-fable-5
[hermes]    🌐 Endpoint: https://api.anthropic.com/v1
[hermes]    📝 Error: HTTP 400: Your credit balance is too low to access the Anthropic API
```

Even though CLI Hermes works fine with Ollama, the Desktop tries to use Anthropic.

**Root causes**:
1. `~/.hermes/config.yaml` has an `anthropic:` provider section that shadows Ollama
2. `~/.hermes/.env` contains `ANTHROPIC_API_KEY` which triggers Anthropic provider detection
3. Desktop's Electron Local Storage has cached `claude-fable-5` as the model (key: `hermes.desktop.composer.model`)

**Fix**:
```bash
# 1. Remove anthropic provider from config (keep only ollama-launch)
# Edit ~/.hermes/config.yaml and delete the anthropic provider block

# 2. Remove ANTHROPIC_API_KEY from env
sed -i '/ANTHROPIC_API_KEY/d' ~/.hermes/.env

# 3. Clear Desktop's cached model/provider storage
rm -rf ~/.config/Hermes/Local\ Storage/*
rm -rf ~/.config/Hermes/Session\ Storage/*
rm -rf ~/.config/Hermes/Partitions/*/Local\ Storage/*
rm -rf ~/.config/Hermes/Partitions/*/Session\ Storage/*

# 4. Restart Desktop - it will read fresh config from ~/.hermes/config.yaml
```

**Verify Ollama is working**:
```bash
curl http://127.0.0.1:11434/v1/models
```

### Ollama runtime context too small
**Symptom**: `❌ Ollama runtime context is too small for Hermes tool use`

**Cause**: Hermes 0.16.0+ requires minimum 64K context. Models like `qwen2.5:32b` have 32K.

**Fix**: Override both config values:
```bash
hermes config set model.context_length 128000
hermes config set model.ollama_num_ctx 65536
```

## User Preference: Don't Auto-Kill Long-Running GUI Processes
When a desktop/GUI process is running and the user hasn't asked to stop it, **do not kill it**. This includes:
- Not killing it to "clean up" before testing a fix
- Not killing it when switching between `hermes desktop --source` and packaged builds
- Not killing it when the backend throws errors (the desktop auto-restarts its own backend)
- Not killing it because it "should have a window by now" or because the renderer exited cleanly
- Only kill when the user explicitly says to restart/stop

**Better workflow when a long-running GUI process is stuck**: leave it running, open a new terminal, and inspect it with `ps`, `pstree`, `DISPLAY=:0 xdotool`, `xwininfo`, or logs while it is alive.

## Verification
After fixes, check the desktop log:
```bash
tail -f ~/.hermes/logs/desktop.log
```

Healthy boot shows:
```
[boot] Hermes backend is ready. Finalizing desktop startup
Hermes Web UI → http://127.0.0.1:9120
```

## References
- See `references/linux-desktop-error-transcripts.md` for historical error log patterns from real sessions.
- See `references/2026-06-17-wayland-intel-arc-debug-notes.md` for the detailed debug transcript and patches from the session where `hermes desktop --source` ran but produced no visible window on Wayland + Intel Arc.