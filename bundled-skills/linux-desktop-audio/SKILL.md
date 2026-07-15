---
name: linux-desktop-audio
description: "Troubleshoot and configure Linux desktop audio stacks: PipeWire, WirePlumber, Bluetooth (BlueZ/A2DP), ALSA, and PulseAudio compatibility. Covers multi-user session conflicts, sink/source routing, and codec/profile issues."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [linux, audio, pipewire, bluetooth, bluez, alsa, wireplumber, desktop, pulseaudio]
    related_skills: [systematic-debugging]
    triggers:
      - audio
      - bluetooth
      - earphones
      - headphones
      - speakers
      - microphone
      - no sound
      - sink
      - source
      - pipewire
      - wireplumber
      - pulseaudio
      - a2dp
      - hfp
      - bluez
      - alsa
      - sound
      - volume
---

# Linux Desktop Audio Troubleshooting

Diagnose and fix audio issues on modern Linux desktops running **PipeWire** + **WirePlumber** (the default on Ubuntu 22.04+, Fedora 34+, and most recent distros). Legacy PulseAudio systems are covered at a compatibility level only.

## Architecture Overview

```
Application → PipeWire → WirePlumber (policy/session) → ALSA / BlueZ / V4L2
                ↑
          pipewire-pulse (PulseAudio compat shim)
```

| Component | Role | Key Commands |
|-----------|------|--------------|
| **pipewire** | Multimedia daemon (core) | `systemctl --user status pipewire` |
| **wireplumber** | Session/policy manager | `systemctl --user status wireplumber`, `wpctl status` |
| **pipewire-pulse** | PulseAudio API compat | `systemctl --user status pipewire-pulse` |
| **bluetoothd** | BlueZ stack | `systemctl status bluetooth`, `bluetoothctl` |
| **spa-bluez5** | PipeWire Bluetooth plugin | `find /usr/lib*/spa-0.2/bluez5/` |

## Quick Diagnostic Flow

When audio is broken or a Bluetooth device connects but produces no sound:

### Step 1 — Verify the Bluetooth service
```bash
systemctl status bluetooth --no-pager
rfkill list
```
If `bluetooth.service` is `inactive (dead)`, enable and start it:
```bash
sudo systemctl enable --now bluetooth
```

### Step 2 — Check PipeWire state
```bash
wpctl status
```
Look for:
- Your device under **Audio → Devices**
- A sink for your device under **Audio → Sinks**
- The `*` marker showing the **default sink**

If the Bluetooth device appears under Devices but has **no Sink**, the audio profile is not being registered. This usually means:
1. Missing `libspa-0.2-bluetooth` (check `dpkg -l | grep libspa-bluetooth`)
2. **Multiple PipeWire instances conflicting** (see Multi-User Conflict below)
3. BlueZ profile registration failure

### Step 3 — Check Bluetooth connection details
```bash
bluetoothctl info <MAC>
bluetoothctl show
```
Verify `Connected: yes`, `ServicesResolved: yes`, and UUIDs include `Audio Sink` (`0000110b-...`).

### Step 4 — Inspect logs for conflicts
```bash
journalctl --user -u wireplumber --since "10 minutes ago" --no-pager
journalctl --user -u pipewire --since "10 minutes ago" --no-pager
```
Look for:
- `Address already in use`
- `RegisterProfile() failed: org.bluez.Error.NotPermitted`
- `Multiple sound server instances ... trying to use Bluetooth audio at the same time`
- `Properties changed in unknown transport`

All four are signatures of **multiple PipeWire/WirePlumber instances competing for BlueZ**.

## Multi-User PipeWire Conflict (Critical Pitfall)

**Symptom:** Bluetooth pairs and connects successfully, but no audio sink appears in `wpctl status`. Desktop Settings shows the device as "Connected" but sound continues through internal speakers. WirePlumber logs contain `Address already in use` or `Multiple sound server instances`.

**Root Cause:** On systems with multiple interactive user accounts (or systemd user sessions from background services), each user session can auto-start its own `pipewire.service` and `wireplumber.service` via systemd socket activation. Only **one** PipeWire stack can own BlueZ audio profiles at a time. When a second instance starts, it wins the D-Bus registration race — or loses it — and the desktop user's session cannot create Bluetooth sinks/sources.

**Common Offenders:**
- HyperCycle Node Manager (`hypercycle` user) — spawns PipeWire + WirePlumber + pipewire-pulse on login
- Any background user session with a graphical seat
- Old PulseAudio (`pulseaudio.service`) running alongside PipeWire

**Diagnosis:**
```bash
# Find ALL pipewire / wireplumber / pulseaudio processes across ALL users
ps aux | grep -E "pipewire|wireplumber|pulseaudio" | grep -v grep
```
If you see instances owned by a user OTHER than the desktop session owner (e.g., `hypercycle` while desktop user is `mauricio`), you have a conflict.

**Fix:**
```bash
# Replace <OTHER_USER> with the conflicting user
sudo -u <OTHER_USER> DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u <OTHER_USER>)/bus \
  systemctl --user stop pipewire wireplumber pipewire-pulse

# Prevent them from restarting
sudo -u <OTHER_USER> DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u <OTHER_USER>)/bus \
  systemctl --user mask pipewire wireplumber pipewire-pulse

# Also mask the sockets (otherwise socket activation will restart them)
sudo -u <OTHER_USER> DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u <OTHER_USER>)/bus \
  systemctl --user mask pipewire.socket pipewire-pulse.socket

# Restart YOUR session's audio stack
systemctl --user restart pipewire wireplumber
```

**Then reconnect the Bluetooth device:**
```bash
bluetoothctl disconnect <MAC>
sleep 2
bluetoothctl connect <MAC>
```

**Verify:**
```bash
wpctl status
# Should now show a Sink for your Bluetooth device, marked with *
```

> See `references/pipewire-multi-user-conflict.md` for a full worked transcript of this failure and fix.

## Bluetooth Audio Profile Selection

WirePlumber automatically negotiates A2DP (high-quality stereo) vs HFP (hands-free with microphone) based on stream roles. To see available profiles:

```bash
pw-cli ls Device | grep -A10 -i bluez
```

If a call/communication app forces HFP but you want A2DP, check the `policy-bluetooth.lua` script logic — WirePlumber switches profiles based on `media.role=Communication`. Stop the communication app or explicitly set the A2DP profile in GNOME Settings → Sound → Output Configuration.

## Codec Support

The `libspa-0.2-bluetooth` package handles codecs. Verify installed codecs:
```bash
ls /usr/lib/x86_64-linux-gnu/spa-0.2/bluez5/
```
Expected: `libspa-bluez5.so`, `libspa-codec-bluez5-sbc.so`, `libspa-codec-bluez5-aptx.so`, etc.

Ubuntu 24.04 ships with SBC, AAC, aptX, FastStream, LDAC, LC3, and Opus support out of the box.

## PulseAudio Coexistence

PipeWire provides a PulseAudio-compatible socket at `/run/user/$UID/pulse/native`. Do **not** run `pulseaudio.service` alongside PipeWire. If you see:
```
Multiple sound server instances (PipeWire/Pulseaudio/bluez-alsa) are probably trying to use Bluetooth audio at the same time
```
Check for a native PulseAudio process:
```bash
pgrep -a pulseaudio
```
If found, stop and mask it:
```bash
systemctl --user stop pulseaudio
systemctl --user mask pulseaudio
```

## Common Commands Reference

| Goal | Command |
|------|---------|
| List all sinks | `wpctl status` or `pw-cli ls Node` + grep `Audio/Sink` |
| Set default sink | `wpctl set-default <ID>` |
| Set sink volume | `wpctl set-volume <ID> 0.5` |
| Inspect a node | `wpctl inspect <ID>` |
| List Bluetooth devices in BlueZ | `bluetoothctl devices` |
| Connect a device | `bluetoothctl connect <MAC>` |
| Disconnect a device | `bluetoothctl disconnect <MAC>` |
| Remove and re-pair | `bluetoothctl remove <MAC>` → put device in pairing mode → `bluetoothctl scan on` → `pair <MAC>` → `trust <MAC>` → `connect <MAC>` |
| Restart your PipeWire session | `systemctl --user restart pipewire wireplumber` |
| Check bluetoothd status | `systemctl status bluetooth` |

## Related Skills

- `systematic-debugging` — Follow the 8-phase methodology when root cause is not immediately obvious.
- `blockchain-node-ops` — If the conflicting user is `hypercycle` (HyperCycle Node Manager), that skill documents the broader Node Manager lifecycle. The audio conflict is an unintended side effect of its systemd user session.

## References

- `references/pipewire-multi-user-conflict.md` — Full session transcript: Dime 3 earbuds connected but silent; WirePlumber `Address already in use`; second `hypercycle` PipeWire instance found and masked.
