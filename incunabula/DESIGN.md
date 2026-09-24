# DESIGN.md — Incunabula LLM Station

Design read: dark-tech lab console for developers. MiMo-style rational structure
+ taste-skill editorial restraint (serif display, grotesk body, mono data)
+ micro-animations on every state change.

## Structure
1. Fixed left sidebar — brand, actions, provider list, status foot
2. Mobile: top bar + slide-over sidebar (≤900px)
3. Editorial page head — Instrument Serif + mono kicker
4. Gateway console — terminal chrome, base/key + copy (no export-all)
5. Station grid — first station full-width, rest 2-col
6. Station: side (identity + ledger) | main (Catalog → Probe → Output)

## Activation defaults
- Free models (`FREE_RE = /free|pickle|:free$/i`) → **active**
- Paid / unknown → **inactive** unless stored `provider/model` is explicitly true
- Stored visibility map always wins; empty map ⇒ free-only gateway surface

## Tokens
- canvas `#0C0D0F` · panel `#121417` · panel-2 `#181B1F` · line `rgba(255,255,255,.07)`
- ink `#F2F0EB` · muted `#B8B5AE` · faint `#7A7770`
- accent `#C8F04A` (focus/active/CTA only) · ok `#5DDBA4` · err `#FF6B6B` · warn `#F0C14A`
- radius 4 / 8 · fonts Instrument Serif / Schibsted Grotesk / IBM Plex Mono
- ease `cubic-bezier(.22,1,.36,1)` · spring `cubic-bezier(.34,1.56,.64,1)`

## Motion
- Entrance: staggered `rise` on stations, page head, console
- Probe: `.is-probing` glow + sweep on output + spinner button
- Success: `okPulse` ring · Error: one-shot `shake`
- Copy: check morph + toast · Toggle: spring knob · Nav hover: slide 2px
- `prefers-reduced-motion: reduce` kills all animation

## Rules
- Accent lime rationed — never large fills
- Hairline borders + panel ladder, no heavy shadows
- Keep DOM: `#nav #cards #lock #prov-dialog #gw-base #gw-key #all-dialog #add-prov-btn`
- Station id `card-<providerId>` · badge `nav-badge-<providerId>`
- Removed: `#gw-copy-all` export button
