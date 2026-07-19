---
name: ai-avatar-video-marketing
title: AI Avatar Video Marketing
version: 1.0.0
description: Create marketing videos using AI avatar tools like HeyGen. Reverse-engineer viral video formats, generate scripts with proven Hook→Value→Steps→CTA patterns, and automate video production pipelines.
category: creative
triggers:
  - "create AI avatar video"
  - "marketing video with talking head"
  - "reverse engineer this video format"
  - "HeyGen video creation"
  - "viral marketing video script"
  - "AI spokesperson video"
dependencies:
  - terminal
  - file
---

# AI Avatar Video Marketing

Create professional marketing videos using AI avatar generation tools like HeyGen, D-ID, or Synthesia. This skill covers reverse-engineering successful video formats, script generation using proven patterns, and building automated production pipelines.

## When to Use

- Creating marketing content for product launches
- Reverse-engineering viral video formats from competitors
- Building repeatable video production workflows
- Generating scripts for AI avatars
- Automating video creation at scale

## Proven Video Format: Hook→Value→Steps→CTA

Based on analysis of successful viral marketing videos, all scripts should follow this structure:

```
[HOOK] You can [unexpected result] [surprising way]
[VALUE PROPS] [Benefit 1]. [Benefit 2]. [Benefit 3].
[SETUP] Here's how:

→ Step 1: [Specific action]
→ Step 2: [Specific action]
→ Step 3: [Specific action]
→ Step 4: [Specific action]

[REINFORCEMENT] That's [simplicity metric]
[OBJECTION HANDLING] No [objection 1]. No [objection 2]. No [objection 3].

[CTA] Save this for [scenario]
[LEAD GEN] Want [deliverable]? [Action]
```

### Timing Guidelines

| Element | Duration | Purpose |
|---------|----------|---------|
| Hook | 3-5 sec | Grab attention |
| Value Props | 5-7 sec | State benefits |
| Steps | 15-20 sec | Show process |
| Reinforcement | 3-5 sec | Emphasize ease |
| Objections | 5 sec | Preempt concerns |
| CTA | 5 sec | Drive action |
| **Total** | **30-45 sec** | Standard length |

## Tool Selection

### HeyGen (Recommended)
- **Best for:** Photorealistic avatars, professional quality
- **Pricing:** $29/mo Creator Plan, ~$0.50-2.00/minute
- **Avatars:** Daisy-Default (female), Tom-Default (male), Anna-Default
- **Voices:** en-US-JennyNeural, en-US-GuyNeural, en-US-AriaNeural
- **API:** REST API with JSON payloads

### D-ID
- **Best for:** Easy API integration, automation
- **Pricing:** Pay-per-minute
- **Pros:** Simple API, good lip-sync
- **Cons:** Less photorealistic than HeyGen

### Synthesia
- **Best for:** Professional templates, corporate
- **Pricing:** Enterprise plans
- **Pros:** High quality, many templates
- **Cons:** More stylized, less natural

## Video Specifications

### Twitter/X Optimization
- **Format:** MP4 H.264
- **Dimensions:** 1280x720 (HD 16:9 landscape)
- **Frame Rate:** 30fps
- **Bitrate:** ~527 kb/s video, 128 kb/s audio
- **Audio:** AAC 44.1kHz stereo

### Platform Variations

| Platform | Dimensions | Aspect | Notes |
|----------|------------|--------|-------|
| Twitter/X | 1280x720 | 16:9 landscape | Feed-optimized |
| YouTube Shorts | 1080x1920 | 9:16 vertical | Mobile-first |
| LinkedIn | 1920x1080 | 16:9 landscape | Professional |
| TikTok/Reels | 1080x1920 | 9:16 vertical | Full-screen |

## Production Pipeline

```
Script Generation → HeyGen Payload → Avatar Video → FFmpeg Render → Platform Optimize → Publish
```

### 1. Script Generation
Use the proven format template. Customize:
- Hook for your product/value prop
- 3-4 specific steps
- Objections your audience might have
- Clear CTA with lead generation

### 2. HeyGen Payload Creation

```json
{
  "video_inputs": [{
    "character": {
      "type": "avatar",
      "avatar_id": "Daisy-Default",
      "avatar_style": "normal"
    },
    "voice": {
      "type": "text",
      "input_text": "[Your script here]",
      "voice_id": "en-US-JennyNeural",
      "speed": 1.0
    },
    "background": {
      "type": "color",
      "value": "#f5f5f5"
    }
  }],
  "dimension": {
    "width": 1280,
    "height": 720
  },
  "title": "Marketing Video"
}
```

### 3. FFmpeg Rendering

```bash
ffmpeg -i input.mp4 \
  -vf "format=yuv420p" \
  -c:v libx264 -preset medium -crf 23 \
  -c:a aac -b:a 128k \
  -movflags +faststart \
  output.mp4
```

## Reverse Engineering Process

When asked to replicate a video format:

1. **Analyze the structure**
   - Hook pattern used
   - Value proposition framing
   - Step format (arrows, numbers, etc.)
   - CTA style

2. **Extract technical specs**
   - Video dimensions
   - Duration
   - Avatar style
   - Background type

3. **Identify the tool**
   - HeyGen: Photorealistic, professional
   - D-ID: API-focused, simpler
   - Synthesia: Corporate, templated

4. **Document the pipeline**
   - Script template
   - Tool configuration
   - Export settings
   - Posting format

## Automation

### Video Editor Agent Pattern

Create a bash script agent that:
- Generates scripts from templates
- Creates HeyGen API payloads
- Manages assets and output
- Tracks video versions

See `references/video-editor-agent-template.sh` for a complete implementation.

## Common Pitfalls

- **Wrong aspect ratio:** Use 16:9 for Twitter/X, 9:16 for Shorts/Reels
- **Too long:** Keep under 60 seconds for social platforms
- **No CTA:** Every video needs clear next step
- **Generic script:** Be specific in steps - "click deploy" not "set it up"
- **No lead gen:** Always include "DM me" or "link in bio" for capture

## References

- references/video-editor-agent-template.sh - Complete automation script
- references/script-templates/ - Hook/Value/Step/CTA templates by industry
- references/heygen-api-examples/ - Payload examples for different use cases
