# Bonjou Website Redesign — Design Spec

**Date:** 2026-05-22
**Scope:** `website/` — the single-page Bonjou CLI marketing site.
**Direction name:** "Quiet Instrument"

## Context

The Bonjou marketing site (`website/`) is competently built — OKLCH tokens, a
spacing scale, GSAP choreography, solid accessibility — but its visual execution
reads as a generic "AI dev-tool" site: four decorative accent colors (cyan,
violet, lime, amber), radial gradient blobs, and backdrop-blur glass panels. The
owner wants it to look unmistakably crafted by an experienced product designer,
true to the product, and safe from looking unpolished. The repo's `DESIGN.md` is
explicitly set aside for this work; art direction is owned by this spec.

The redesign is a **restyle**: all 13 sections, all copy, and all functionality
stay. Nothing is removed. The work is concentrated in `app/globals.css`,
`components/site-page.tsx`, and `app/layout.tsx`. `lib/site-data.ts` content is
unchanged.

## Direction

Bonjou is a precise tool for the people in your room — no cloud, no accounts. The
site should feel the same: **calm, exact, confident, type-led.** Dark,
terminal-true, built to a Linear / Vercel / Resend craft bar. Decoration is
replaced with precision: discipline in color, type as a system, hairline
structure, restrained motion.

## Design system

### Color — near-monochrome + one accent

Dark, near-neutral (faintly cool) palette. Cyan is retained as the **only**
accent because it is the brand color (logo/favicon `#18d9ff`). Violet and lime
retire. Amber is semantic-only (the honest "limitations" caveat). Values in
OKLCH:

| Token | Value | Use |
|---|---|---|
| `--bg` | `oklch(15.5% 0.008 230)` | page background (solid; no gradient blobs) |
| `--surface-1` | `oklch(19% 0.009 230)` | cards, panels |
| `--surface-2` | `oklch(23% 0.010 230)` | raised / hover |
| `--border` | `oklch(28% 0.012 230)` | hairlines |
| `--border-strong` | `oklch(37% 0.014 230)` | stronger dividers |
| `--text` | `oklch(96% 0.004 230)` | primary text |
| `--text-muted` | `oklch(72% 0.008 230)` | secondary text |
| `--text-dim` | `oklch(56% 0.010 230)` | captions, tertiary |
| `--accent` | `oklch(80% 0.135 218)` | cyan — surgical use only |
| `--accent-contrast` | `oklch(17% 0.02 220)` | text/icon on accent fills |
| `--warn` | `oklch(80% 0.10 75)` | amber — limitations caveat only |
| `--danger` | `oklch(65% 0.15 25)` | red terminal dot only |

Accent budget: cursor, focus rings, link/hover, terminal prompt glyphs, and **one**
emphasis moment per section. Never as a fill for large areas.

### Typography

Two faces, used as a system.

- **Sans — Archivo** (`--font-sans`): headings, body, UI. A technical grotesk
  with an engineered, instrument-label character; not on any reflex-reject list.
- **Mono — JetBrains Mono** (`--font-mono`): code, data, labels, metrics.
  Mono is the terminal DNA, applied as a consistent system, not scattered.

Scale (fluid via `clamp`):

| Role | Size | Weight | Tracking / leading |
|---|---|---|---|
| Hero h1 | `clamp(2.75rem, 6vw, 4.5rem)` | 700 | `-0.03em` / 1.03 |
| Section h2 | `clamp(2rem, 3.5vw, 3rem)` | 700 | `-0.02em` / 1.05 |
| h3 | `1.125–1.25rem` | 600 | `-0.01em` / 1.3 |
| Body-lg | `clamp(1.0625rem, 1.2vw, 1.15rem)` | 400 | 1.6 |
| Body | `1rem` | 400 | 1.6 |
| Small | `0.875rem` | 400 | 1.5 |
| Mono label / eyebrow | `0.75rem` | 500 | uppercase, `+0.08em` |

### Space, grid, surfaces

- Spacing scale (4-based): 4, 8, 12, 16, 24, 32, 48, 64, 96, 128.
- `--shell`: `min(1120px, 100vw - 48px)`; one consistent section vertical rhythm.
- Radius: `--radius-sm 6px`, `--radius 10px`, `--radius-lg 14px`.
- Surfaces are **flat**: `1px solid var(--border)` defines them. No
  `backdrop-filter` blur. At most one subtle shadow, reserved for the hero
  terminal. Body background is solid `--bg` (gradient blobs removed). An optional
  whisper-faint grid may fade in only at the very top — kept barely perceptible.

### Motion

- One calm hero load: short staggered fade/translate, `power2.out`, small offsets,
  no overshoot.
- Scroll reveals: quiet opacity + small `y`; subtle, never bouncy.
- The typed-terminal demo animation is kept and retuned for a calmer cadence.
- `prefers-reduced-motion` handling is preserved.

### Component anatomy

One consistent card primitive: `--surface-1` background, `1px --border`,
`--radius-lg`, consistent padding. Hover: border lifts toward `--accent` at low
mix, background → `--surface-2`, `translateY(-2px)`.

Constraints (impeccable brand-register laws):

- **No nested cards.** A bordered panel must not contain bordered cards. Outer
  containers are plain regions or hairline frames; only one card level. The
  current install panel and commands panel are reworked to satisfy this.
- **No identical card grids.** Vary treatments: features stay a divided list;
  use cases and security points use rows / dividers / a diagram rather than a
  repeated icon-heading-text grid.
- No backdrop-blur glass, no gradient text, no colored side-stripe borders.
- Section eyebrows stay, but as a deliberate mono spec-marker system, not
  decorative scaffolding.

Buttons: primary = cyan fill, `--accent-contrast` text; secondary = surface +
border. Focus-visible: 2px `--accent` ring with offset.

## Section treatment

All sections kept; each re-detailed to the system above.

- **Nav** — slimmer, hairline bottom border, mono link labels, sharper install button.
- **Hero** — centerpiece. Tighter headline; the terminal rebuilt as one crisp
  product surface (not stacked decoration cards); peer/transfer detail integrated
  cleanly; one accent moment.
- **Proof band** — quieter, mono metrics, hairline column dividers.
- **Install** — OS tabs, copy buttons, cards kept; unified card anatomy, better
  code-block contrast.
- **Demo / Features / Why / Commands / Security / Use cases / OSS / FAQ / CTA /
  Footer** — re-detailed to one card anatomy, mono labels, hairline structure,
  one accent moment each. Architecture diagram redrawn with hairlines.

## Preserved (no exceptions)

Every section and all copy; command search, OS tabs, copy buttons, FAQ accordion,
GSAP timelines, typed demo; accessibility (skip link, focus-visible, aria,
reduced-motion); responsive behavior at all current breakpoints.

## Files

- `website/app/layout.tsx` — swap fonts to Archivo + JetBrains Mono;
  update `themeColor`.
- `website/app/globals.css` — full restyle: new tokens, type scale, surfaces,
  every component. (~1538 lines rewritten.)
- `website/components/site-page.tsx` — class/structure adjustments, hero rebuild;
  functionality untouched.
- `website/lib/site-data.ts` — unchanged.

## Verification

1. `npm run typecheck` — clean.
2. `npm run lint` — clean.
3. `npm run build` — succeeds.
4. `npm run dev` — manual review of the running site at desktop, tablet, and
   mobile widths; confirm search, OS tabs, copy buttons, FAQ accordion, and the
   typed demo all still work; confirm reduced-motion.
5. Iterate on the running site with the owner.
