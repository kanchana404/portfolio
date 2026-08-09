---
version: alpha
name: kavithakanchana-design-analysis
description: "A dual-theme, near-neutral personal-site canvas built on pure white (#ffffff) and a cool near-black (#08090a) — the only chromatic value in the entire system is a single Vercel-blue (#0070f3) reserved exclusively for link hover. The system reads as engineering resume, not marketing page: dense, small-type, tightly tracked, generously spaced between sections. Body copy runs at 14px against a muted gray, so the 30–48px display sizes carry all the contrast. Cards are hairline-bordered panels with no fill lift and no shadow — separation comes from the border alone. Type is Inter throughout at 400–600 with negative tracking on every heading. Page rhythm is a vertical stack of 64px-separated sections, each capped at prose width; there is no full-bleed imagery and no atmospheric color anywhere."
---

# DESIGN.md — kavithakanchana.me

Authored from the live token set in `src/app/globals.css`, `tailwind.config.ts`, and
observed utility usage across `src/app/(site)/page.tsx` and `src/components/`.
Structure follows the [Google Stitch DESIGN.md](https://stitch.withgoogle.com/docs/design-md/overview/) convention.

```yaml
colors:
  # Light theme — the default. HSL source of truth lives in :root.
  light:
    canvas: "#ffffff"            # --background  0 0% 100%
    surface-1: "#ffffff"         # --card — deliberately identical to canvas
    surface-2: "#f5f5f5"         # --muted / --secondary / --accent  0 0% 96.1%
    ink: "#08090a"               # --foreground  210 11.1% 3.53%
    ink-muted: "#737373"         # --muted-foreground  0 0% 45.1%
    hairline: "#e5e5e5"          # --border / --input  0 0% 89.8%
    primary: "#171717"           # --primary  0 0% 9%  (near-black button fill)
    on-primary: "#fafafa"        # --primary-foreground
    ring: "#0a0a0a"              # --ring  0 0% 3.9%
    destructive: "#ef4444"       # 0 84.2% 60.2%

  # Dark theme — activated by .dark class (darkMode: ["class"]).
  dark:
    canvas: "#08090a"            # --background  210 11.1% 3.53%
    surface-1: "#08090a"         # --card — again identical to canvas
    surface-2: "#262626"         # --muted / --secondary / --accent  0 0% 14.9%
    ink: "#fafafa"               # --foreground  0 0% 98%
    ink-muted: "#a3a3a3"         # --muted-foreground  0 0% 63.9%
    hairline: "#262626"          # --border  0 0% 14.9%
    primary: "#fafafa"           # --primary — inverts to light fill
    on-primary: "#171717"
    ring: "#d4d4d4"              # --ring  0 0% 83.1%
    destructive: "#7f1d1d"       # 0 62.8% 30.6%

  # The system's ONLY chromatic accent. Theme-independent.
  accent-link: "#0070f3"         # link hover, .link-underline — nothing else

typography:
  # Inter (next/font/google) via --font-sans. One family, no display/mono split.
  display-hero:
    fontFamily: Inter
    fontSize: 48px               # text-5xl — used exactly once, on the hero name
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: -1.2px        # tracking-tighter
  display-lg:
    fontFamily: Inter
    fontSize: 36px               # text-4xl
    fontWeight: 700
    lineHeight: 1.11
    letterSpacing: -0.9px        # tracking-tight
  section-title:
    fontFamily: Inter
    fontSize: 30px               # text-3xl — the standard section heading
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.75px       # tracking-tight
  card-title:
    fontFamily: Inter
    fontSize: 16px               # text-base
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: -0.2px
  body:
    fontFamily: Inter
    fontSize: 14px               # text-sm — DOMINANT. 55 uses; the site's real body size.
    fontWeight: 400
    lineHeight: 1.625            # leading-relaxed
    letterSpacing: 0
  body-lg:
    fontFamily: Inter
    fontSize: 16px               # text-base — hero summary only
    fontWeight: 400
    lineHeight: 1.625
    letterSpacing: 0
  caption:
    fontFamily: Inter
    fontSize: 12px               # text-xs — 25 uses; dates, badges, meta
    fontWeight: 400
    lineHeight: 1.333
    letterSpacing: 0
  badge:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: 0.2px         # tracking-wide

rounded:
  sm: 4px                        # calc(--radius - 4px)
  md: 6px                        # calc(--radius - 2px)
  lg: 8px                        # --radius: 0.5rem — DOMINANT (15 uses)
  xl: 12px
  full: 9999px                   # avatars, skill pills

spacing:
  xxs: 4px                       # gap-1
  xs: 8px                        # gap-2 — most common gap
  sm: 12px                       # gap-3 / space-y-3
  md: 16px                       # gap-4
  lg: 24px                       # gap-6 / space-y-6
  xl: 32px
  section: 64px                  # space-y-16 — the gap between every <section>
  scroll-offset: 96px            # scroll-mt-24 — anchor clearance under the nav

layout:
  container-max: 1400px          # container.screens.2xl
  container-padding: 32px        # container.padding: 2rem
  prose-max: 65ch                # max-w-prose — caps ALL body copy
  page: single-column-stack      # no sidebars, no multi-column sections

motion:
  # BlurFade (src/components/magicui/blur-fade.tsx) — the site's signature entrance.
  entrance-duration: 0.4s
  entrance-y-offset: 6px
  entrance-blur: 6px
  entrance-stagger: 0.04s        # BLUR_FADE_DELAY — multiplied per section index
  link-transition: 150ms ease
  reduced-motion: opacity-only   # translate + blur are dropped entirely

components:
  section-heading:
    typography: "{typography.section-title}"
    textColor: "{colors.ink}"
    marginBottom: "{spacing.sm}"
  body-copy:
    typography: "{typography.body}"
    textColor: "{colors.ink-muted}"
    maxWidth: "{layout.prose-max}"
    textWrap: pretty
  card:
    backgroundColor: "{colors.surface-1}"
    borderColor: "{colors.hairline}"
    borderWidth: 1px
    rounded: "{rounded.lg}"
    padding: "{spacing.lg}"
    shadow: none
  badge:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.md}"
    padding: 2px 8px
  skill-pill:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.badge}"
    rounded: "{rounded.md}"
    padding: 8px 14px
  link:
    textColor: inherit
    hoverColor: "{colors.accent-link}"
    underline: left-origin-wipe  # scaleX(0) → scaleX(1), transform-origin: left
    underlineOffset: 2px
    underlineWeight: 1px
    transition: "{motion.link-transition}"
  avatar:
    rounded: "{rounded.full}"
    borderColor: "{colors.hairline}"
```

## Layout Rules

- The page is one `<main>` with `space-y-16` — every section is separated by exactly 64px. Do not introduce per-section padding to create rhythm; the stack gap owns it.
- Every section carries `scroll-mt-24` so anchor navigation clears the fixed nav.
- Body copy is always capped at `max-w-prose`. Headings and card grids may exceed it; paragraphs never do.
- Cards separate by **hairline border only**. No shadow, no background lift — `surface-1` is intentionally identical to `canvas` in both themes.
- `surface-2` is for *inline* chips and pills, not for section backgrounds. There are no alternating section bands.

## Color Rules

- **Treat `#0070f3` as scarce.** It appears on link hover and nowhere else. Do not use it for buttons, badges, icons, borders, or focus rings — the ring token is neutral (`#0a0a0a` / `#d4d4d4`) by design.
- Text hierarchy is carried by two values only: `ink` for headings and emphasis, `ink-muted` for all running copy. Do not invent intermediate grays.
- Every color must resolve through the HSL CSS variables in `globals.css`. Adding a raw hex to a component breaks theme switching.
- The system is genuinely dual-theme. Any new token must be defined in both `:root` and `.dark`.

## Typography Rules

- 14px is the body size. This is a deliberately dense, resume-like register — resist raising it to 16px for "readability"; the compactness is the character.
- Negative tracking scales with size: `-0.75px` at 30px, `-0.9px` at 36px, `-1.2px` at 48px. Never apply negative tracking below 16px.
- Weight jumps straight from 400 (body) to 600/700 (titles). There is no 500-weight body variant.
- One family. Do not add a display face or a mono face for prose — `code`/`pre` styling is already handled by Shiki tokens in `globals.css`.

## Motion Rules

- New sections enter via `BlurFade` with the index-multiplied `BLUR_FADE_DELAY` (0.04s) stagger. Keep the sequence continuous — a new section inserted mid-page should take the next delay multiple, not restart at zero.
- Entrance is 0.4s / 6px / 6px blur. Do not lengthen it; the page is a stack and long entrances make scrolling feel laggy.
- `prefers-reduced-motion` collapses everything to a 0.001ms opacity change globally. Any new animation must survive that override — never rely on a transform to convey meaning.

## Responsive Behavior

- Single column throughout; the stack needs no breakpoint restructuring.
- Hero splits row → column below `sm`, with the avatar moving above the text.
- Container padding is a flat 32px at every width until the 1400px cap.
- Display type steps down from 48px toward 30px on mobile; body stays at 14px.

## Iteration Guide

1. Reference components by their `components:` token name when requesting a change.
2. Before adding a section, decide where it falls in the `BLUR_FADE_DELAY` sequence.
3. Default all new prose to `{typography.body}` at `{colors.ink-muted}`.
4. Add tokens to `globals.css` in both themes before using them in a component.
5. Check any new surface against both themes — `surface-1 == canvas` means fills are invisible by design.

## Known Gaps

- The `/tools` routes (`src/app/(tools)/`) are in active development on `feat/sprint1-tools-platform` and are not yet reflected here; tool-specific UI may need surface and data-density tokens this file does not define.
- Chart and data-visualisation colors are undefined. The scattered hexes in source (`#7dd3fc`, `#86efac`, `#2684fc`, `#23b33a`, `#ea4335`) are third-party brand marks and integration logos, not a system palette — do not generalise them into one.
- Form field, validation, and error states are not specified; `destructive` is declared but effectively unused.
- Focus-visible styling beyond the neutral `ring` token is not documented.
- Tailwind's default type scale is used unmodified, so the `typography:` block above describes observed *usage*, not a constrained set — nothing prevents an out-of-system size.
