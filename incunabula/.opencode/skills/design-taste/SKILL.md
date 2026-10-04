---
name: design-taste
description: Use when rebuilding or polishing Incunabula UI — typography, scale, spacing, layout, density. Pairs with hallmarks-ui; this one governs type and composition.
---

# Design Taste

Typography and composition rules for Incunabula. `hallmarks-ui` covers restraint and tokens; this covers type and rhythm.

## Type scale
One scale, six steps. No arbitrary sizes.
```
display  clamp(40px, 6vw, 64px) / .95   serif italic   weight 400
title    20–24px / 1.15                  sans 700      tracking -0.02em
lead     14px / 1.65                    sans 400      max 36ch
body     13px / 1.5                     sans 400
label    10–11px / 1                    mono 500      tracking 0.14em uppercase
data     11–13px / 1.5                  mono 500      tabular-nums
```

## Rules
1. **Serif for display only** — page title and brand. Never for UI text, labels, or values.
2. **Mono for anything an engine reads**: model ids, keys, base URLs, counts, status words, timestamps. Tabular numerals on every number so columns align.
3. **One idea per line.** Labels are nouns. Never a label that is also a sentence.
4. **Size creates hierarchy, not weight.** Only two weights above 500: 600 (buttons) and 700 (titles/names). Body is 400.
5. **Uppercase is reserved for labels** at 10–11px with positive tracking. Never uppercase prose.
6. **Measure**: lead/body text capped ~36–60ch. Never full-width paragraphs.
7. **Baseline rhythm**: all vertical spacing on the 8px scale (8/12/16/24/32/48). No 10px, no 18px, no 20px gaps.
8. **Optical alignment**: mono values right-align in tables and lists; labels left. Icons align to text baseline, 14px, `currentColor`.
9. **Case in titles**: sentence case, never Title Case.
10. **No truncation of meaning.** Ellipsis only when the full value is one hover/click away (with `title`).

## Density
- Card padding 20–24px; dense data rows 8–10px vertical
- Input height fixed at `--h` (36px); icon buttons 30px, 36px on touch
- At most 4 distinct type sizes visible in one viewport

## Anti-patterns
- Mixed serif and sans in the same block
- More than one accent colour in a single component
- Numbers without `tabular-nums`
- Labels that wrap to two lines
- Fake-bold body text for emphasis — use spacing or a label instead