---
name: screen-recording
description: "Configure screen recording with audio on Linux desktops (GNOME/Wayland + PipeWire), diagnose why recordings are silent, and set up alternatives.""
version: 1.0.0
author: Hermes Agent
category: media
source: hermes-converted
converted_at: 2026-07-02T21:03:36.306561
---

# Screen Recording with Audio on Linux

## The Core Problem

GNOME's built-in screen recorder (activated by `Ctrl+Shift+Alt+R` or the Screencast DBus API) **records video ONLY** — it has no audio capture capability. The `org.gnome.Shell.Screencast` API accepts only `draw-cursor`, `framerate`, and `pipeline` options. No audio source parameter exists. This is why "shorts" come out silent even though the mic works elsewhere.

The user may refer to the tool as "Take a Screenshot" or "Snapshot" because GNOME's Camera app (`.desktop` file `org.gnome.Snapshot.desktop`) is called Snapshot — but that is a webcam/camera app, not the screen recorder. The actual recorder is triggered via the GNOME Shell keybinding or DBus.

## Platform Facts (Wayland + PipeWire)

- **Audio server:** Modern Ubuntu/GNOME uses PipeWire (check with `pgrep pipewire`). The recorder must route through PipeWire to capture mic or system audio.
- **Display server:** Wayland requires screen capture via `xdg-desktop-portal` (not raw X11 screengrab).
- **Native GNOME recorder:** No audio. Period. Do not waste time trying to enable it.

## Diagnosis — Identify the Actual Setup

Before proposing fixes, run these probes:

```bash
# Which screen recording tool is actually installed?
which snapshot obs simplescreenrecorder kazam wf-recorder ffmpeg 2>/dev/null

# Is the session Wayland or X11?
echo $XDG_SESSION_TYPE  # expect 'wayland'

# Audio server running?
pactl info 2>/dev/null | head -5
pw-cli info 2>/dev/null | head -5
pgrep -a pipewire

# What portals are available?
ls /usr/share/xdg-desktop-portal/portals/ 2>/dev/null

# DBus: does GNOME Screencast expose audio options?
gdbus introspect --session --dest org.gnome.Shell.Screencast --object-path /org/gnome/Shell/Screencast 2>&1
# Look for methods: Screencast, ScreencastArea, StopScreencast only — NO audio args.
```

## Recommended Solutions

### Option 1: Kooha (simplest, GNOME-native feel)

Built for GNOME/Wayland. One-click record, captures screen + system audio + mic.

```bash
# Ubuntu / Debian (PREFERRED — native apt avoids snap confinement issues)
sudo apt-get update && sudo apt-get install -y kooha

# or flatpak
flatpak install flathub io.github.seadve.Kooha
```

**AVOID snap install for Kooha** — it is severely broken on Wayland:
- Kooha snap lacks `pipewire` and `screencast-legacy` plugs entirely
- AppArmor denies DBus calls to `xdg-desktop-portal`:
  `apparmor="DENIED" operation="dbus_method_call" bus="session" path="/org/freedesktop/portal/desktop" interface="org.freedesktop.portal.Registry" peer_label="unconfined"`
- Result: `stream error: target not found` from `GstPipeWireSrc:pipewiresrc0` — recording fails entirely, not just audio missing.
- Even if you connect `audio-record`, the portal stream never reaches the snap.

Use **apt/flatpak** instead. If user already installed via snap, remove it and reinstall.

### Option 1b: VokoscreenNG (apt, Qt-based, quick GUI)

```bash
sudo apt-get install -y vokoscreen-ng
```

- Launch `vokoscreenNG`
- Video tab: select Fullscreen or Area
- Audio tab: enable Microphone (and optionally Computer Audio)
- Hit red record button
- Works natively on Wayland with PipeWire, no snap confinement issues

### Option 2: OBS Studio (full control)

```bash
sudo apt-get install -y obs-studio
```

Add "Screen Capture (PipeWire)" source and "Audio Input Capture (PulseAudio)" source. Works on Wayland via portal.

### Option 3: ffmpeg (quick command-line, often already installed)

ffmpeg is often already present (`/usr/bin/ffmpeg`). For Wayland screen + audio, use:

```bash
# List pipewire nodes first to identify audio source
pactl list short sources 2>/dev/null || pw-cli ls Node 2>/dev/null | grep -E "node\.name|id "

# x11grab only works on X11, not Wayland. On Wayland the robust path is complex.
# Prefer a portal-aware wrapper or pipewire-specific ffmpeg pipeline.
```

**Rule of thumb:** If the user just wants to make shorts with voice, recommend Kooha first. If they need multi-source mixing, recommend OBS.

## Pitfalls

| Pitfall | Why it happens |
|---------|---------------|
| GNOME Ctrl+Shift+Alt+R is silent | Native recorder = video only. Audio is impossible. |
| "Snapshot" app does not record screen | Snapshot (`org.gnome.Snapshot.desktop`) is GNOME Camera (webcam), not screen recorder. |
| `gnome-screenshot` command not found | Deprecated; GNOME 40+ replaced it with Camera/Snapshot. |
| ffmpeg x11grab fails on Wayland | x11grab only works on X11, not Wayland. Use portal or Wayland-specific ffmpeg flags. |
| No audio devices showing in recorder | PipeWire service may not be running, or user may need to grant portal permission for Audio permission. |
| Kooha (snap) fails with `stream error: target not found` | Snap AppArmor blocks `xdg-desktop-portal` access. Kooha snap has NO `pipewire` or `screencast-legacy` plugs. Use apt/flatpak instead. |
| `GDBUS.Error: UnknownMethod` on screencast session path | Stale/abandoned portal session from a previous failed recording. Restart portal services: `systemctl --user restart xdg-desktop-portal-gnome.service xdg-desktop-portal.service` |
| `pactl list sources` returns "command not found" | System may be PipeWire-native with no PulseAudio tools installed. Use `pw-cli ls Node` or `pw-link -l` instead. |
| Kazam or simplescreenrecorder do not work | Both are X11-only tools. Kazam depends on `gir1.2-wnck-3.0` (window manager introspection, no Wayland equivalent). simplescreenrecorder depends on `libGLInject` (OpenGL injection, X11-specific). On Wayland they will not capture screen at all. |

## Decision Tree

1. User on GNOME + Wayland + wants audio? → **Do not use native recorder.**
2. ffmpeg already installed and user is CLI-savvy? → Offer ffmpeg one-liner with pipewire audio source.
3. User wants GUI, minimal setup, for social-media shorts? → **Kooha via apt or flatpak** (NOT snap — snap is broken on Wayland).
4. User wants an even simpler Qt GUI, or prefers apt-only installs? → **VokoscreenNG**.
5. User wants multi-track (game audio + mic + screen)? → **OBS Studio**.
6. User insists on using built-in tool? → Explain it's video-only; no workaround exists via gsettings or keybinding.
7. User has Kazam or simplescreenrecorder already installed? → Warn them: **X11-only, will not work on Wayland**. Recommend OBS/Vokoscreen/Kooha instead.

## References

- `references/gnome-screencast-api.md` — DBus API introspection and option dictionary schema.
- `references/kooha-snap-wayland-failure.md` — Full error transcript, AppArmor denial trace, and fix for snap Kooha `stream error: target not found`.
- `references/pipewire-audio-sources.md` — Commands to list and validate PipeWire audio sources before recording.
- `scripts/diagnose-screen-recording.sh` — One-shot bash probe that runs all 8 checks (session type, GNOME version, PipeWire state, installed tools, snap permissions, DBus API, keybinding). Run this first when a user reports "my recordings are silent."