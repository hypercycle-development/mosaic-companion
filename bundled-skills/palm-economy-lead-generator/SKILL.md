---
name: palm-economy-lead-generator
description: "End-to-end lead generation system for Palm Economy. Composite skill assembling 20+ vault capabilities into prospecting, enrichment, campaign creation, email dispatch, and CRM tracking."
category: palm-economy
version: 1.0.0
author: Mosaic Companion
trigger: "When the user asks about lead generation, prospecting, email campaigns, outreach, sales, marketing, CRM, or Palm Economy."
---

# Palm Economy — Lead Generator

## Overview

Palm Economy Lead Generator is a **composite orchestration skill** that chains existing vault capabilities into a unified pipeline:

```
DISCOVER → ENRICH → CREATE → DISPATCH → TRACK
```

## Phase 1: DISCOVER (Prospect Discovery)

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `website-reverse-engineering` | Extract tech stack, contact info, business model from prospect sites | "Analyze [domain] for leads" |
| `maps` | Geolocate local businesses | "Find businesses near [location]" |
| `xurl` | Twitter/X search for trigger events | "Search Twitter for [keyword]" |
| `blogwatcher` | Monitor RSS for funding/launch/hiring news | "Monitor [feed] for events" |
| `github-repo-management` | Analyze prospect repos for tech fit | "Analyze GitHub org [name]" |
| `arxiv` | Research-based lead discovery | "Find research leads in [field]" |

## Phase 2: ENRICH (Data Enrichment)

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `notion` | Create structured lead database | "Create lead database" |
| `airtable` | CRM with scoring, filtering, upserts | "Store leads in CRM" |
| `linear` | Campaign project tracking | "Track campaign tasks" |
| `llm-wiki` | Build interlinked prospect knowledge base | "Build prospect wiki" |

## Phase 3: CREATE (Campaign Assets)

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `ai-avatar-video-marketing` | HeyGen outreach videos | "Generate outreach video" |
| `comfyui` | AI campaign imagery | "Generate campaign image" |
| `baoyu-infographic` | Marketing infographics (21 layouts) | "Create infographic" |
| `popular-web-designs` | Landing page templates (Stripe, Linear, etc.) | "Build landing page" |
| `sketch` | Throwaway HTML mockups | "Create landing page mockup" |
| `claude-design` | One-off HTML artifacts | "Design campaign page" |
| `humanizer` | Strip AI-isms from copy | "Humanize this email" |
| `architecture-diagram` | Dark-themed proposal diagrams | "Create proposal diagram" |

## Phase 4: DISPATCH (Email & Outreach)

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `himalaya` | IMAP/SMTP email client | "Send email campaign" |
| `google-workspace` | Gmail, Sheets integration | "Send via Gmail" |

## Phase 5: TRACK (Analytics & CRM)

| Skill | Purpose | Trigger |
|-------|---------|---------|
| `notion` | Update lead status | "Update lead to contacted" |
| `airtable` | Track open rates, replies | "Track campaign metrics" |
| `linear` | Follow-up task management | "Create follow-up task" |
| `webhook-subscriptions` | Event-driven alerts | "Alert on email reply" |

## Orchestration

Use `kanban-orchestrator` to route tasks:
```python
t1 = kanban_create("discover-prospects", assignee="scout")
t2 = kanban_create("enrich-data", assignee="enricher", parents=[t1])
t3 = kanban_create("create-campaign", assignee="creator", parents=[t2])
t4 = kanban_create("dispatch-emails", assignee="dispatcher", parents=[t3])
t5 = kanban_create("track-results", assignee="tracker", parents=[t4])
```

## Agent Team

| Agent | Role | Skills |
|-------|------|--------|
| **Scout** | Discovery | website-reverse-engineering, maps, xurl, blogwatcher |
| **Enricher** | Data | notion, airtable, github-repo-management |
| **Creator** | Assets | ai-avatar-video-marketing, comfyui, sketch, humanizer |
| **Dispatcher** | Send | himalaya, google-workspace |
| **Tracker** | Analytics | notion, airtable, linear, webhook-subscriptions |
| **Orchestrator** | Management | kanban-orchestrator, mosaic-bot-orchestrator |

## Quick Recipes

### Recipe A: Local Business Blast
1. `maps` → find 50 businesses in [zip]
2. `website-reverse-engineering` → extract contacts
3. `airtable` → store with scoring
4. `sketch` → build landing page
5. `humanizer` → write email
6. `himalaya` → send
7. `notion` → track

### Recipe B: Twitter Prospecting
1. `xurl` → search "hiring [role]"
2. `website-reverse-engineering` → analyze company
3. `ai-avatar-video-marketing` → personalized video
4. `himalaya` → send

### Recipe C: Content Funnel
1. `blogwatcher` → monitor industry news
2. `youtube-content` → summarize trends
3. `baoyu-infographic` → create graphic
4. `xurl` → post thread
5. `popular-web-designs` → squeeze page
6. `webhook-subscriptions` → alert on signup

## Pitfalls

1. **Rate limits**: Space out `xurl` and `website-reverse-engineering` calls
2. **GDPR**: Track consent in `notion`/`airtable`
3. **Deliverability**: Warm SMTP IPs before bulk sending via `himalaya`
4. **Deduplication**: Use `airtable` upsert with email as key
5. **SMTP setup**: `himalaya` requires pre-configured credentials

## Dependencies

- `kanban-orchestrator` (for pipeline routing)
- `mosaic-bot-orchestrator` (for auto-skill-loading)
- `skill-ecosystem-migration` (if porting to external systems)

## Version History

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2026-06-12 | Initial composite skill |

---
*Composite skill assembled from 20+ vault capabilities. Part of Hermes Vault.*
