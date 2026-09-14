# DESIGN.md — Incunabula LLM Model Lab

Source: Mobbin DESIGN.md (getdesign.md catalog) — gallery-white light theme.
Read this before writing any UI in this project.

## Colors (light theme, ONE electric-blue accent)
- canvas `#FFFFFF` (page), tint `#F3F3F3`, field `#F0F0F0` (inputs), hairline `#E4E4E4`
- ink `#141414`, ink-2 `#262626`, muted `#707070`, faint `#ADADAD`
- accent `#0066FF` (sole chromatic accent: links, focus, active counts), hover `#0052CC`, soft `#EAF2FF`
- semantic only: success `#0E9F6E`, danger `#E02424`, warn `#C27803`

## Typography (Inter + JetBrains Mono, both free)
- Page title 30px/700/-0.02em; card names 16px/600/-0.01em; body 13.5px/400
- Labels 12px/600; mono 11px for IDs, counts, URLs, badges

## Shape & depth
- Cards 20px radius, inputs 12px, buttons/badges stadium pills (999px).
- No shadows — depth from hairline borders + neutral tint ladder only.

## Components
- Primary button = near-black pill, white text. Ghost = hairline pill.
- Inputs: tinted fill, transparent border; white fill + accent border on focus.
- Status = pill with semantic tint. Cards: white, hairline, 20–22px padding.
- Dialogs: native `<dialog>`, 20px radius, dim backdrop. Icons: inline SVG only.

## Rules
- Accent blue is rationed (counts, focus, links) — never decoration.
- Keep DOM hooks stable: `#nav #cards #lock #prov-dialog #visits #visitors`.
