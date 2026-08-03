# Bonjou Design System

Derived from what ships in `website/src/share/`. Update this file when the
shipped design changes, not before.

## Concept

A light workbench with a dark instrument sitting on it.

The page is bright because Bonjou is used in bright rooms: a lab at 2pm, a
classroom, a table at a hackathon. The tool itself is dark, so it reads as a
physical object resting on the page rather than a region of it. That figure and
ground split is the whole composition; keep it.

The tool is the hero. Not a screenshot of the tool, not an illustration of it,
the working thing itself, at the top of the page, already connected.

## Color

OKLCH throughout. No pure black or white; every neutral is tinted toward the
brand hue.

| Token | Value | Use |
|---|---|---|
| `--paper` | `oklch(96.5% 0.006 250)` | Page ground |
| `--paper-2` / `--paper-3` | `93.5%` / `89.5%` | Raised and sunken paper |
| `--ink` | `oklch(19% 0.022 262)` | Body and headings |
| `--ink-2` / `--ink-3` | `44%` / `60%` | Secondary, tertiary |
| `--signal` | `oklch(56% 0.208 32)` | The committed colour |
| `--signal-bright` | `oklch(66% 0.2 38)` | Live states on dark |
| `--signal-wash` | `oklch(95% 0.035 40)` | The one emphasised panel |
| `--panel` | `oklch(20.5% 0.026 262)` | Instrument body |
| `--panel-2` / `--panel-3` / `--panel-line` | `25.5%` / `30%` / `34%` | Instrument surfaces and rules |
| `--wire` | `oklch(88% 0.012 250)` | Hairlines on paper |

**Strategy: committed.** Vermilion means one thing, presence, and is never
decorative. A blip glows because somebody is there. A node is tinted because it
is selected. A fact is vermilion because it is a limitation rather than a
guarantee. If it is not about presence or a caveat, it is not vermilion.

Mixing the signal against the blue panel produces purple. Where a tinted dark
surface is needed, use an explicit warm dark (`oklch(30% 0.075 32)`) rather than
`color-mix` with `--panel`.

## Typography

**Satoshi** (Fontshare) carries display and body. Geometric and warm rather
than newsy, which is the register product interfaces sit in. Headings at 900,
body at 400. Hierarchy comes from weight and size only: never `font-stretch`,
which distorts letterforms rather than substituting a drawn width.

**JetBrains Mono** is reserved for things that are literally data: room codes,
byte counts, shell commands, step numbers. Labels are small-caps sans. Wide
mono set in caps at 10px is hard to read and looks like a readout for its own
sake, which is what the first version got wrong.

Rejected on purpose: Inter, IBM Plex, Space Grotesk, Archivo, and the other
training-default faces. Do not reintroduce them.

Scale is fluid `clamp()` with at least a 1.25 ratio between steps. Body measure
caps at 68ch.

## Layout

- A strict, visible grid is the voice. Hairline rules separate sections and
  rows. Left aligned, never a centred stack.
- Spacing varies deliberately: `clamp(3.5rem, 7vw, 7rem)` between sections,
  tight groupings inside panels.
- Uneven by design where the content is uneven. The "what travels" grid gives
  the first item full width because it is the argument and the rest support it.
  Equal cards would flatten that.

## Information architecture

The tool is a conversation, not a dashboard. People on the left, one thread on
the right, one composer beneath both.

**Everyone is a view, not a channel.** Selecting it shows every event from
everybody merged by time, and the composer addresses all reachable peers.
Selecting a person filters to events involving them and retargets the composer.
This keeps broadcast working without a multi-select mode.

Messages and transfers are one event type with one timeline. They were three
parallel lists with timestamps on only one of them, which made correct
ordering impossible rather than merely missing. If a new kind of activity is
added, it joins `ThreadEvent`; it does not get its own list.

A fan-out to several people collapses to a single row carrying the aggregate,
and the aggregate reports every state present ("Sent to 1, 2 yet to approve"),
because a broadcast is rarely in one state and naming only the dominant one
misleads.

## Components

- **Instrument.** Dark panel, 14px radius. Rail and thread divided by a 1px
  rule drawn with a grid gap over `--panel-line`. Composer spans the full
  width beneath both.
- **Rail chip.** A conversation. Pulsing blip, name, and either a source tag
  or an unread count. `aria-current` marks the active one.
- **Pending offer.** The only row that carries the signal colour, because it
  is the only one asking for a decision. It stays in chronological position
  rather than being hoisted into a separate region.
- **Steps.** Numbered `01`/`02`/`03` because the order genuinely carries meaning:
  nothing can be approved before it is offered. Do not number things that are
  not sequences.
- **Facts list.** A `<dl>`. Guarantees in ink, limitations in vermilion, at the
  same visual weight. Bonjou states what it does not protect.

## Motion

Ease with `cubic-bezier(0.22, 1, 0.36, 1)` at 140 to 200ms. No bounce.

Only `transform` and `opacity` animate. The progress bar scales rather than
changing width. `prefers-reduced-motion` disables animation and smooth
scrolling.

The blip's ping is the only ambient motion on the page. Keep it that way.

## Rules

- No side-stripe borders, gradient text, decorative glassmorphism, hero metrics,
  or grids of identical cards.
- No em dashes in interface or marketing copy.
- File inputs are wrapped in a `<label>`, never a button with an invisible input
  layered over it, which produces two controls in the accessibility tree.
- Sticky surfaces are opaque. A translucent masthead lets body text scroll
  through it and reads as a rendering fault.
- Sections carry `scroll-margin-top` matching the masthead height so anchors do
  not land underneath it.
- Page-level rules are scoped to `main > section`, never bare `section`. The
  thread inside the instrument is a section element too, and a bare selector
  silently gave it 100px of page padding.
- Install commands are copied verbatim from README.md. They are executed as
  written, so they are never paraphrased or pointed at a nicer-looking domain.
