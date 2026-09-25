---
name: hallmarks-ui
description: Use when designing or reviewing Incunabula UI (public/index.html, public/app.js) — page shell, station cards, dialogs, components, motion. Enforces calm, editorial, uncluttered design.
---

# Hallmarks UI

Apply whenever creating or changing UI in this project. Imperative rules.

## Hallmarks
1. Hierarchy — one clear title, one secondary line max. Sections split by whitespace or a single hairline. No numbered step badges, no section boxes inside cards, no double borders, no nested frames.
2. Restraint — one accent `#C8F04A` on monochrome greys. No gradients on headers. No decorative `::before` hairlines or accent edge bars on rows. One accent only.
3. Spacing rhythm — 8px base: 8 / 12 / 16 / 24 / 32. Card padding 20–24px. Group controls; don't fence them.
4. Density — credential area is one quiet line or two compact pills, never a row of framed chips. Gateway console stays simple (no traffic-light dots). Badge + tools only in the card header.
5. Card structure — quiet header (icon, name, badge, tools) → single meta line (base · key, copy affordances) → controls block (search + activation list, select, custom id, prompt + presets, actions) → output. Wide first card: controls-left / output-right at ≥1100px. Activation list max-height ~220px, flat rows.
6. Consistency — one button style, one input height (36px), icons 14px `currentColor`, max one border weight, radius 6–8px.
7. Mobile — stack cleanly, drawer unchanged, touch targets ≥36px.
8. Animations — subtle rise/fade + probe busy states only; remove anything flashy (glows, hue-rotate, shimmer, rotating monograms).
9. Reduced motion — keep the `prefers-reduced-motion` block that kills all transitions/animations.

## Tokens
- canvas `#0C0D0F` · panel `#121417` · panel-2 `#181B1F` · panel-3 `#1E2228`
- line `rgba(255,255,255,.07)` · line-2 `rgba(255,255,255,.12)` (max one border weight in use)
- ink `#F2F0EB` / `#B8B5AE` / `#7A7770` / `#514F4A`
- accent `#C8F04A` (+ dim `rgba(200,240,74,.12)`) · ok `#5DDBA4` · err `#FF6B6B` · warn `#F0C14A`
- radius: `--r:6px` controls, `--r-lg:8px` cards · height `--h:36px`
- serif (Instrument Serif) for display titles only; sans for UI; mono for ids/keys/badges.

## Never
- Numbered step badges (01/02/03), section boxes-in-boxes, double borders, gradient headers, traffic-light dots, hover gimmicks (scale/rotate/translate), more than one accent.
