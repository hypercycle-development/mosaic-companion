---
name: website-reverse-engineering
title: Website Reverse Engineering
version: 1.0.0
description: Systematic reconnaissance of a live web application to extract its tech stack, data model, page structure, routing, design system, and key features for replication or integration.
category: software-development
triggers:
  - "reverse engineer this site"
  - "analyze how this website works"
  - "how is this site built"
  - "what stack does this site use"
  - "replicate this website"
  - "competitive analysis of this web app"
  - "extract data model from live site"
  - "figure out how this marketplace works"
dependencies: []
---

# Website Reverse Engineering

Systematic reconnaissance of a live web application to extract its tech stack, data model, page structure, routing, design system, and key features for replication or integration.

## When to Use

- User wants to build something similar to an existing site
- Need to understand competitor architecture without source access
- Extracting API patterns, data shapes, or UI conventions from a live app
- Pre-build research before writing a single line of code

## Methodology

### Phase 1 — Surface Recon (2-3 min)

1. **Navigate to homepage** (`browser_navigate`)
   - Capture title, meta description, OG tags
   - Note the URL structure — does it use hash routing, query params, or clean paths?

2. **Framework Detection** (`browser_console`)
   - Check for `__next`, `__nuxt`, `root` IDs, React DevTools hook
   - Inspect script src patterns: `_next/static` = Next.js, `/_nuxt` = Nuxt, `vite` = Vite
   - Check `<meta name="generator">`
   - Look at CSS class names — Tailwind uses utility classes (`text-sm`, `bg-gray-900`); BEM uses block-style (`card__title`)

3. **Styling & Theme**
   - Dark mode default? (`prefers-color-scheme` or explicit toggle)
   - Note primary accent color, badge styles, icon sets
   - Font families (look at `font-family` in computed styles or preload links)

### Phase 2 — Page Structure Mapping (5-10 min)

4. **Navigate every major page type**
   - Homepage → `/`
   - Listing/grid → `/?page=2`, `/items`
   - Detail page → `/item/:slug` or `/item/:id`
   - Category/filter → `/categories`, `/category/:slug`
   - Search results → `/?q=term`
   - Auth flows → `/login`, `/submit`
   - Static pages → `/about`, `/blog`, `/faq`

5. **For each page, capture:**
   - Breadcrumb structure
   - Heading hierarchy (H1-H3)
   - Main content sections and their ordering
   - Interactive elements (buttons, links, forms, sort tabs, pagination)
   - Data displayed and its format (dates, counts, badges, progress bars)

6. **URL Routing Discovery**
   - Hover/click links to see hrefs
   - Note patterns: `/skill/:slug` vs `/skill/:owner/:repo`
   - Query params for state: `?page=`, `?sort=`, `?q=`
   - Check if detail pages are server-rendered or client-side (view source vs DOM)

### Phase 3 — Data Model Inference (5-10 min)

7. **Extract entity shapes from rendered content**
   - Card fields: title, subtitle, image, stats (stars, forks, votes), tags, badges, actions
   - Detail page fields: full description, metadata, related items, code blocks, markdown content
   - List controls: sort options, filter chips, pagination (offset vs cursor)

8. **Identify data sources**
   - GitHub API? (stars/forks/repo metadata)
   - Own database? (custom IDs, votes, bookmarks)
   - External embed? (YouTube, Twitter, RSS)
   - Check `browser_console` for `window.__INITIAL_STATE__`, `window.__DATA__`, or network requests

9. **Security & Auth patterns**
   - OAuth provider (GitHub, Google, etc.)
   - Gated features (submit, vote, bookmark require auth)
   - API key patterns if any

### Phase 4 — Design System Extraction (3-5 min)

10. **Component inventory**
    - Card design (padding, corners, shadows, hover states)
    - Badge/pill styles (category, tag, status, language)
    - Button variants (primary, secondary, icon-only)
    - Layout grid (columns at different breakpoints)
    - Empty states, loading skeletons, error pages

11. **Interaction patterns**
    - Infinite scroll vs pagination
    - Sort tabs vs dropdown
    - Search: instant vs submit-on-enter
    - Bookmark/vote: optimistic UI or full reload
    - Modal vs page navigation for detail views

### Phase 6: Video-Specific Analysis (If Applicable)
For video content (not just websites):
- **Video acquisition**: Download via `yt-dlp` or similar tools
- **Frame extraction**: Use `ffmpeg` to capture key frames
- **Technical specs**: Resolution, aspect ratio, frame rate, duration
- **Avatar detection**: Identify AI avatar tools (HeyGen, D-ID, Synthesia)
- **Content structure**: Hook → Value Prop → Steps → CTA pattern

See `references/video-reverse-engineering-technique.md` for detailed video analysis methodology.

12. **Produce structured markdown report:**
    - Tech Stack table
    - URL Routing Structure diagram
    - Data Model (entity definitions with field types)
    - Page-by-page breakdown
    - Design System summary
    - Feature checklist (what to replicate)
    - Inferred data pipeline/architecture
    - Recommendations for the user's specific stack

## Pitfalls

- **Bot detection**: Some sites block headless browsers. If you get 403s or CAPTCHAs, note it and switch to manual description from what you can see.
- **SPA hydration**: The initial HTML may be a shell. Wait for `browser_click` or scroll to reveal dynamic content.
- **Stale data**: Cache-bust by appending `?nocache=1` or checking `Cache-Control` headers.
- **Auth-gated content**: You can only see public pages. Note which features require sign-in and infer their shape from UI hints (e.g., "Sign in to bookmark").
- **Mobile differences**: The site may serve different markup to mobile. Default to desktop viewport.
- **Don't over-engineer inference**: If you can't tell whether pagination is cursor or offset-based, say "unknown" rather than guess.

## Tool Preference

- `browser_navigate` + `browser_snapshot` / `browser_vision` for page capture
- `browser_console` with JS expressions for framework detection and DOM inspection
- `browser_click` for navigation flow testing
- `browser_scroll` to reveal below-fold content
- Write final report with `write_file` to workspace

## Output Format

Save as `{site-name}-reverse-engineering.md` in the current workspace. Include sections: Tech Stack, URL Routing, Data Model, Page Breakdown, Design System, Feature Checklist, Data Pipeline, Stack-Specific Recommendations.
