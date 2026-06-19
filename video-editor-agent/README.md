# Mosaic Video Editor Agent
## AI-Powered Marketing Video Creation System

**Version:** 1.0  
**Location:** `/home/mauricio/mosaic-companion/video-editor-agent/`  
**Based on:** Reverse-engineered from Julian Goldie's HeyGen workflow

---

## Overview

The Mosaic Video Editor Agent automates the creation of marketing videos using AI avatars, following the proven format from successful viral videos.

### What It Does
- Generates scripts using the Hook→Value→Steps→CTA pattern
- Creates HeyGen API payloads for avatar generation
- Manages video assets and templates
- Provides a complete pipeline from script to rendered video

---

## Quick Start

```bash
cd /home/mauricio/mosaic-companion/video-editor-agent

# Generate a script
./video-editor-agent.sh script intro

# Create HeyGen payload
./video-editor-agent.sh heygen intro

# Run full pipeline
./video-editor-agent.sh full intro
```

---

## Video Types

### 1. Intro Video
**Purpose:** First impression, value proposition  
**Duration:** 30-45 seconds  
**Script Pattern:**
```
[HOOK] You can run production AI agents directly on your computer.
[Value Props] No cloud. No API keys. No bills.
[Steps] → Download → Connect → Deploy → Run
[Reinforcement] That's local-first AI.
[CTA] Save this / Link in bio
```

### 2. Demo Video
**Purpose:** Feature showcase, quick tutorial  
**Duration:** 60 seconds  
**Script Pattern:**
```
[HOOK] Watch me deploy an AI agent in 60 seconds.
[Steps] → Open → Select → Choose → Define → Deploy
[Proof] Done. Ask it anything.
[CTA] Mosaic Companion. Local AI, supercharged.
```

### 3. Stargate Video
**Purpose:** Technical integration showcase  
**Duration:** 30-45 seconds  
**Script Pattern:**
```
[HOOK] Connect to decentralized compute grid.
[Value] → Mosaic → Stargate → GPU Network → Scale
[Reinforcement] Your agents. Distributed compute.
[CTA] Powered by Stargate.
```

---

## File Structure

```
video-editor-agent/
├── video-editor-agent.sh    # Main executable
├── assets/                   # Video assets, images, music
├── templates/                # Script templates
├── output/                   # Generated scripts and payloads
│   ├── script_intro_*.txt
│   ├── script_demo_*.txt
│   ├── script_stargate_*.txt
│   └── heygen_payload.json
└── README.md                # This file
```

---

## HeyGen Integration

### Avatar Selection
- **Daisy-Default**: Professional female, studio lighting
- **Tom-Default**: Professional male, business attire
- **Anna-Default**: Friendly female, casual professional

### Voice Options
- **en-US-JennyNeural**: Natural, professional female
- **en-US-GuyNeural**: Natural, professional male
- **en-US-AriaNeural**: Energetic, modern female

### Video Specs
- **Format**: MP4 H.264
- **Dimensions**: 1280x720 (HD 16:9 landscape)
- **Frame Rate**: 30fps
- **Platform**: Twitter/X optimized

---

## Usage Examples

### Generate Script Only
```bash
./video-editor-agent.sh script intro
# Output: output/script_intro_20260612_115332.txt
```

### Create HeyGen Payload
```bash
./video-editor-agent.sh heygen intro Daisy-Default en-US-JennyNeural
# Output: output/heygen_payload.json
```

### Full Pipeline
```bash
./video-editor-agent.sh full intro
# Generates script + HeyGen payload + ready to upload
```

---

## Script Template Format

All scripts follow the proven viral video structure:

| Element | Purpose | Length |
|---------|---------|--------|
| **Hook** | Grab attention with unexpected result | 3-5 sec |
| **Value Props** | Three key benefits (pattern: X. Y. Z.) | 5-7 sec |
| **Steps** | Arrow-format actionable steps | 15-20 sec |
| **Reinforcement** | Emphasize simplicity | 3-5 sec |
| **Objections** | Address concerns before they arise | 5 sec |
| **CTA** | Save + Lead generation | 5 sec |

---

## Next Steps

1. **Sign up for HeyGen** ($29/mo Creator Plan)
2. **Get API Key** from HeyGen dashboard
3. **Upload payload** using the generated JSON
4. **Download rendered video**
5. **Post to Twitter/X** with optimized text

---

## Customization

### Add New Video Types
Edit `video-editor-agent.sh` and add new case to `generate_script()`:

```bash
"custom")
    cat > "$output_file" << 'SCRIPT'
[Your custom script here]
SCRIPT
    ;;
```

### Change Avatar/Voice
Pass custom parameters:
```bash
./video-editor-agent.sh heygen intro Anna-Default en-US-AriaNeural
```

### Add Background Music
Place audio files in `assets/` and modify render function.

---

## Cost Analysis

| Component | Cost |
|-----------|------|
| HeyGen Creator Plan | $29/month |
| Video generation | ~$0.50-2.00 per minute |
| 5-min marketing video | ~$3-10 |
| FFmpeg rendering | Free (local) |

---

## Troubleshooting

### "No such file or directory"
Make sure you're in the video-editor-agent directory:
```bash
cd /home/mauricio/mosaic-companion/video-editor-agent
```

### Permission denied
Make script executable:
```bash
chmod +x video-editor-agent.sh
```

### HeyGen API errors
- Verify API key is set
- Check avatar_id exists in your HeyGen account
- Ensure voice_id is available for your plan

---

## References

- Original analysis: `/home/mauricio/avatar_research/AI_AVATAR_ANALYSIS_REPORT.md`
- Julian Goldie source: https://x.com/JulianGoldieSEO/status/2065455479627919591
- HeyGen: https://app.heygen.com

---

**Created:** June 12, 2026  
**Board:** quest-marketing-videos
