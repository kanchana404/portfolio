---
version: beta
name: kavithakanchana-design-analysis
description: "The Magic UI portfolio template's system (github.com/magicuidesign/portfolio, Jan 2026), ported onto this site's Next 14 / Tailwind v3 stack. A neutral dual-theme canvas: pure white (#ffffff) and a soft charcoal (#121212). Link blue (#0070f3, lifted to #3d98ff on dark) for links only, and a highlighter-pen yellow and amber that appear only as hand-drawn marks. A single 672px column of sections 56px apart. Quiet list sections (About, Work, Education, Skills) with small bold headings, then feature sections (Projects, Hackathons, Contact) introduced by a filled pill on a fading hairline and a large tight headline. Round logo marks with a ring and a soft shadow; hairline-bordered 14px-radius cards that gain a ring on hover. A flickering dot grid fades out across the top 100px, and navigation is a floating magnifying dock at the bottom of the window."
---

# DESIGN.md: kavithakanchana.me

Authored from the live token set in `src/app/globals.css`, `tailwind.config.ts`,
and the components in `src/app/(site)/page.tsx`, `src/components/section/`,
`src/components/navbar.tsx` and `src/components/project-card.tsx`.

The visual source of truth is the Magic UI portfolio template. Where this file
and the template disagree, this file records a deliberate local decision and
says why. Structure follows the
[Google Stitch DESIGN.md](https://stitch.withgoogle.com/docs/design-md/overview/)
convention.

```yaml
colors:
  # Light theme, the default. HSL channels live in :root. Values are the
  # template's shadcn "neutral" oklch tokens converted to HSL for Tailwind v3.
  light:
    canvas: "#ffffff"            # --background  0 0% 100%
    surface-1: "#ffffff"         # --card, identical to canvas
    surface-2: "#f5f5f5"         # --muted / --secondary / --accent  0 0% 96.1%
    ink: "#0a0a0a"               # --foreground  0 0% 3.9%
    ink-muted: "#737373"         # --muted-foreground  0 0% 45.1%  (4.74:1)
    hairline: "#e5e5e5"          # --border / --input  0 0% 89.8%
    primary: "#171717"           # --primary  0 0% 9%  (pills, badges, tooltips)
    on-primary: "#fafafa"        # --primary-foreground
    ring: "#737373"              # --ring  0 0% 45.1%  (4.7:1; the template's #a1a1a1 is 2.6:1)
    link: "#0070f3"              # --link  212.3 100% 47.6%  (4.55:1)
    marker: "#fde68a"            # --marker  48 96.6% 76.7%, --marker-alpha 1 (Highlighter fill)
    marker-stroke: "#d97706"     # --marker-stroke  32 94.6% 43.7% (Highlighter underlines)
    destructive: "#ef4444"       # 0 84.2% 60.2%

  # Dark theme, activated by the .dark class (darkMode: ["class"]).
  dark:
    canvas: "#121212"            # --background  0 0% 6.9%
    surface-1: "#171717"         # --card / --popover  0 0% 9%, one step up
    surface-2: "#262626"         # --muted / --secondary / --accent  0 0% 14.9%
    ink: "#fafafa"               # --foreground  0 0% 98%
    ink-muted: "#a1a1a1"         # --muted-foreground  0 0% 63%  (7.25:1)
    hairline: "#292929"          # --border  0 0% 16.2%  (template: 10% white)
    input: "#353535"             # --input  0 0% 20.8%   (template: 15% white)
    primary: "#e5e5e5"           # --primary, inverts to a light fill
    on-primary: "#171717"
    ring: "#737373"              # --ring  0 0% 45.1%
    link: "#3d98ff"              # --link  212 100% 62%  (6.36:1)
    marker: "#644f18"            # --marker  43.4 61.3% 24.3%: amber-400 at 35% over the canvas, stored opaque
    marker-stroke: "#fbbf24"     # --marker-stroke  43.3 96.4% 56.3%
    destructive: "#7f1d1d"       # 0 62.8% 30.6%

typography:
  # Inter via next/font/google as --font-sans. The template ships Geist; Next
  # 14.2's font list does not include it (see Known Gaps).
  hero:
    fontSize: 30px / 36px / 48px # text-3xl sm:text-4xl lg:text-5xl
    fontWeight: 600
    letterSpacing: tighter       # -0.05em
  hero-lede:
    fontSize: 16px / 18px / 20px # base md:text-lg lg:text-xl
    color: "{colors.ink-muted}"
  feature-title:                 # "Check out my latest work", "Get in Touch"
    fontSize: 30px / 36px        # text-3xl sm:text-4xl (Contact: sm:text-5xl)
    fontWeight: 700
    letterSpacing: tighter
  section-heading:               # About, Work Experience, Education, Skills
    fontSize: 20px               # text-xl
    fontWeight: 700
  list-title:
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.375            # leading-snug, company and school names (they wrap on phones)
  body-prose:
    fontSize: 16px               # prose: About and blog posts
    lineHeight: 1.625
    color: "{colors.ink-muted}"
  body:
    fontSize: 14px               # text-sm, list subtitles, timeline copy
  card-body:
    fontSize: 12px               # text-xs prose inside project cards
  meta:
    fontSize: 12px               # dates, tabular-nums
  tag:
    fontSize: 11px
    fontWeight: 500

rounded:
  sm: 6px                        # calc(--radius - 4px)
  md: 8px                        # calc(--radius - 2px)
  lg: 10px                       # --radius: 0.625rem
  xl: 14px                       # calc(--radius + 4px): cards, pills, chips
  3xl: 24px                      # dock icons
  full: 9999px                   # avatar, logo marks, timeline nodes

spacing:
  section: 56px                  # gap-14 on <main>, between every section
  section-inner: 16px / 24px     # gap-y-4 (prose, chips) / gap-y-6 (lists)
  list-row: 12px                 # gap-3 between work rows (each row has its own py-2); education rows 32px
  feature-inner: 32px            # gap-y-8 between a pill intro and its content
  card-padding: 24px             # p-6
  contact-padding: 40px          # p-10
  scroll-offset: 96px            # scroll-mt-24 on sections; scroll-padding-bottom 6rem on html and scroll-margin-bottom 6rem on focusables clear the dock

layout:
  column: 672px                  # max-w-2xl, (site)/layout.tsx
  column-padding: 24px           # px-6
  top: 48px / 96px               # pt-12 sm:pt-24
  bottom: 112px / 128px          # pb-28 sm:pb-32, clears the dock
  project-grid: 2 columns from sm, max 800px, gap 12px, cards in a row share a height

motion:
  entrance: BlurFade            # components/magicui/blur-fade.tsx
  entrance-duration: 0.4s
  smooth-scroll: Lenis 1.3.23, lerp 0.1 for the wheel, 1.2s timed anchor jumps, (site) routes only
  entrance-trigger: in view      # BlurFade inView (once, -50px margin)
  entrance-stagger: 0.04s        # BLUR_FADE_DELAY, restarted in each section
  css-entrance: .animate-blur-fade  # lib/css-blur-fade.ts; same look without JS: /blog, and the homepage hero and About
  dock-magnification: 40px -> 60px within 100px of the pointer
  work-expand: 0.7s cubic-bezier(0.16, 1, 0.3, 1) height + opacity
  flicker: canvas, random opacity up to 0.3, paused off-screen
  reduced-motion: opacity-only fades (BlurFade keeps its stagger, the CSS entrance has none), static grid, instant expand
```

## Components

- **Section pill** (`section/section-pill.tsx`): a `bg-primary` pill with
  `text-background` label, centred on a hairline that fades to transparent at
  5% and 95% of each side. Always followed by a feature title and a centred,
  balanced muted paragraph. Used by Projects, Hackathons, Tools and (as a tab on
  the card edge) Contact.
- **Logo mark** (`logo-image.tsx`): 32px, 40px from `md`; round, `border`,
  `shadow`, `ring-2 ring-border`, 4px padding. A missing or failed image falls
  back to the same ring on `surface-2`, never a broken-image glyph. An entry
  may give a second mark for the dark theme (`logoUrlDark`, used by Cortana
  AI); CSS on the `dark` class swaps them. Logo files are square, with the
  mark filling the square (a wide canvas draws the mark at half size), at
  160px or less (they render at 32-40px): 256-colour PNGs for flat marks, and
  WebP at q92 for gradient marks, which band in a palette (Cortana AI).
- **Work rows** (`section/work-section.tsx`): the template's row look with
  this site's own behaviour. Six rows a page with the current role pinned
  first, Previous / numbered / Next buttons and a "Page X of Y" line. Each row
  is one grid with a fixed slot for everything: logo, company and title on the
  left; the date range, the duration (LinkedIn style, `lib/duration.ts`, in
  `ink-muted` at 11px) and the employment pills, always on two lines: on
  phones "date · duration" then the pills, under the title; from `sm` a
  right-hand column with the date, then duration and pills; and an
  always-visible chevron on the far right that flips when open. The whole row
  is a real `<button>` in an `<h3>` with a hover wash (open, the header and
  description share one tinted surface), `aria-expanded` and a labelled
  region; rows open independently and the description eases open over 0.7s.
  After a page change, once the new page has rendered
  (`usePageChangeView` in `pager-controls.tsx`, shared with Projects): if the
  list now starts above the viewport, the section scrolls back to its top and
  focus moves to the list; if the focused control is below the fold or under
  the dock, focus moves to the list without scrolling. Otherwise focus stays
  on the page number, which Previous and Next hand it to when they disable
  themselves. The row's surface, chevron and panel are shared with the
  Hackathons entries (`section/disclosure.tsx`).
- **Meta pill** (`meta-pill.tsx`): the one badge for employment type and
  similar tags. 18px tall, rounded-full, hairline border and no fill (so it
  stays above 4.5:1 on the row's hover and open washes), 10px medium
  `ink-muted`, `normal-nums` so Inter's hyphen keeps its normal width. A
  `<span>`, so it is valid inside buttons and headings.
- **Skill chip**: `h-8 rounded-xl border bg-background px-4 ring-2 ring-
  border/20`, 14px medium label, and a 16px mark before it on every chip.
  Marks are the template's inline SVGs, files in `public/skills/` (devicon,
  MIT; Simple Icons, CC0, with the brand colour baked in), or a lucide glyph
  for concepts with no brand (REST APIs). Black marks carry `invertOnDark`;
  wordmark-only logos (GSAP) carry `logoWide` and are drawn 14px tall at their
  own width.
- **Project card** (`project-card.tsx`): `rounded-xl border`, `hover:ring-2
  hover:ring-muted`. Optional 16:9 cover on top (after kalanalk.com's project
  cards) that zooms 3% on card hover (not under reduced motion), with two
  frosted-glass chips on it: year and category bottom-left, `Featured`
  top-right for featured projects. Glass chips are light (`bg-white/55`,
  `border-white/60`, `backdrop-blur-md`, 22px tall, near-black 10px uppercase
  text at 0.1em tracking, 10px from the corner), because the covers are bright
  and kept compact so they cover as little of the art as possible. With a cover the year lives
  on the chip, not in the body. Link badges always sit in the body. Tags are
  24px outline badges. The card is a server component; only the cover (with
  its fallback panel) is client code. Covers follow `docs/project-covers.md`.
- **Timeline** (`timeline.tsx`): 40px ringed nodes joined by a 1px hairline;
  the last node has no line. Each Hackathons entry is a
  `section/timeline-disclosure.tsx`: date, title, award line and location in a
  button, link badges below it, and the description closed until clicked, with
  the same chevron and 0.7s ease as a work row. One award is one entry
  (IDEALIZE 2026 has two), so a win never hides inside a paragraph. Nodes
  render through `LogoImage`, so a missing logo falls back to the empty ring.
- **Contact card**: `rounded-xl border p-10`, flickering grid over the top half
  fading down (the top 80px on phones, so it ends above the paragraph), a
  `Contact` pill straddling the top edge. Its links are link blue and
  underlined at rest; hover thickens the line.
- **Blog index** (`app/(site)/blog/page.tsx`): the template's numbered list,
  generated statically from `content/blog` with plain `<a>` rows (no
  next/link). The post-count pill beside the title is hidden at zero. Each row
  is the number, the title with its hover chevron, and a meta line: the date
  in `tabular-nums` and, for digests, a Meta pill reading `Digest`. The CSS
  entrance plays on the first 8 rows only. The empty state is a hairline
  `rounded-xl` card with muted copy and an underlined link-blue "RSS feed"
  link, as in Contact.
- **Blog figure** (`lib/blog/render.ts`): a Markdown image on a line of its
  own becomes `<figure class="not-prose my-8">`. The WebP comes from
  `public/blog/<slug>/`, with width and height read from the file, so nothing
  shifts as it loads. It spans the full column in a `rounded-xl border` frame
  on `bg-muted` while it loads, and loads lazily. The image's Markdown title
  becomes a 14px `ink-muted` figcaption. An optional cover uses the same frame
  above the article and loads eagerly. No next/image on the post route.
- **Blog table and code block** (`lib/blog/render.ts`): both scroll sideways
  inside the column and take keyboard focus (`tabindex="0"`, the `ring` token
  on `focus-visible`, as on the blog rows), because Safari does not focus a
  scroller on its own. A table sits in a `role="region"` wrapper named after
  its header cells. The wrapper is a new formatting context, so it carries the
  table's prose margin (`my-7`, 2em at the table's 14px) and the table has
  none; otherwise the gap above and below a table would be 48px, not 28px.
- **Dock** (`navbar.tsx`): fixed 16px above the bottom edge, `h-14`,
  `bg-card/90` with a heavy backdrop blur and a faint primary glow. Icons are
  bordered 40px circles on `bg-background`; tooltips are `bg-primary` with an
  arrow. Groups: pages, socials, theme, split by short vertical hairlines.
  Every icon's hit area is the whole drawn icon, border included, at every
  magnification (the theme button is `-inset-px rounded-[inherit]`).
- **Highlighter** (`magicui/highlighter.tsx`, on rough-notation): hand-drawn
  marks on the few phrases that carry the page, in the `marker` tokens
  (highlighter yellow `#fde68a` fill and amber `#d97706` strokes; on dark a
  pre-blended `#644f18` fill and amber-400 strokes). Fills are opaque and the
  SVG is blended into the line (multiply on light, screen on dark), so
  rough-notation's two passes never stack and no neighbouring glyph is hidden.
  Hero: one strong mark, a marker behind the name, and one quiet underline
  under the current role. Elsewhere: an underline on the key phrase of each
  feature title, a marker on the second word of the Work Experience and GitHub
  Contributions headings and on the Skills heading, an underline on Education,
  and a marker on the key word of each Hackathons title. Hero marks draw once
  the entrance fade settles, the rest on scroll-in; later redraws are instant
  and follow the theme. Marked words read in `ink`. Never more than two marks
  in one block of text.
- **Theme toggle** (`ui/animated-theme-toggler.tsx`): Magic UI's
  AnimatedThemeToggler, a circular View Transitions reveal from the button,
  controlled by next-themes through `mode-toggle.tsx`.
- **Header grid**: `FlickeringGrid` in the top 100px of `(site)` pages only
  (72px on phones, where the column starts 48px down, so it fades out before
  the first line of muted text), 2px squares on a 2px gap, masked to fade out
  downward. Tool pages keep a plain canvas.

## Layout Rules

- The page is one `<main>` with `gap-14`. Sections do not add their own
  vertical padding to create rhythm.
- Every section carries `scroll-mt-24`.
- Order: hero, About, Work Experience, Education, Skills, GitHub
  Contributions, Projects, Tools (only while live), Hackathons, Contact.
  GitHub Contributions and Tools are this site's additions; the rest is the
  template's order.
- Education rows use the work-row grid without the chevron: dates in a
  right-hand column from `sm`, under the degree on phones.
- The dock is a `<nav aria-label="Site">`.
- List sections use a plain `section-heading`. Feature sections use a section
  pill. Do not mix the two on one section.

## Color Rules

- `link` is the only chromatic token. It colours inline links (Contact copy at
  rest, the 404 links on hover) and nothing else: not buttons, badges, icons,
  borders or focus rings. The one other hue is the Highlighter's `marker`
  pair, which only ever appears as a hand-drawn mark. The template uses
  Tailwind's `blue-500` for links; this site keeps its own blue so links have
  one accent, not two.
- Blog blockquotes use a neutral rule (`border-foreground/20`) where the
  template uses amber, for the same reason.
- Text hierarchy is `ink` for headings and names, `ink-muted` for all running
  copy.
- Every colour resolves through the HSL variables in `globals.css`. A raw hex
  in a component breaks theme switching. Third-party brand marks (the skill
  SVGs, company logos) are the exception.
- Any new token is defined in both `:root` and `.dark`. Dark tokens that the
  template writes as translucent white are stored opaque (composited over the
  dark canvas) so Tailwind opacity modifiers keep working.

## Typography Rules

- Headings tighten (`tracking-tighter`) from 30px up; nothing below 16px gets
  negative tracking.
- Dates and ranges are `tabular-nums` so rows line up.
- Posts start headings at `##` and go down one level at a time; the page
  title is the only H1. The publish gate and the renderer both enforce it.
- `code` and `pre` in blog posts are styled by the `.prose` rules at the end of
  `globals.css`. Inline code follows the template. Code blocks do not: the
  template's are transparent because shiki colours them, and this site has no
  highlighter, so a block is `surface-2` at 50% with a hairline border,
  `ink` text, 13px on relaxed lines.
- Spaces between a text run and an inline element live inside the string
  (`{"Just "}<Link/>{" or "}`), never as a separate `{" "}`: Chromium drops
  space-only text nodes next to React's comment separators from the
  accessibility tree, which glues words together for screen readers.

## Motion Rules

- Sections enter via `BlurFade`, which waits for each block to scroll into
  view (its `inView` default), so the page reveals section by section rather
  than all at once on load. Delays count from the moment a section appears:
  heading at `BLUR_FADE_DELAY` (0.04s), content at twice that, list items a
  further 0.03-0.05s apart. Do not carry a page-wide multiple into a new
  section; it would make lower sections wait for no reason.
- Scrolling is inertial (`components/smooth-scroll.tsx`, Lenis, the library
  kalanalk.com uses): wheel and trackpad ease in over about a second, touch
  stays native, same-page anchors glide for 1.2s and still honour
  `scroll-mt-24`. Anchor jumps are timed rather than lerped because Lenis
  never finishes a lerp toward a half-pixel target, and while it runs it
  snaps keyboard and focus scrolling back.
  Tool pages keep native scrolling because their widgets scroll on their own.
  Anything that scrolls inside the page needs a Lenis prevent attribute or
  the page will steal the wheel: `data-lenis-prevent-horizontal` on sideways
  scrollers (blog code blocks, the contributions calendar), so a vertical
  wheel over them still scrolls the page, and `data-lenis-prevent` on panes
  that scroll vertically.
- Content that is on screen at load uses the CSS `.animate-blur-fade`
  (`lib/css-blur-fade.ts`) instead of the component: the homepage hero and
  About, and the budgeted `/blog` lists. It paints from the HTML without
  waiting for JavaScript; the component renders at opacity 0 until hydration,
  which held the largest paint to 4-5s on a slow phone connection.
- Every animation must degrade under `prefers-reduced-motion`: BlurFade and
  the CSS entrance drop to an opacity fade (the CSS one with no stagger), the
  flickering grid paints once and stops, work rows open instantly, Highlighter
  marks appear already drawn, the theme toggle switches without the circular
  reveal, and the global CSS rule cuts other keyframes to 0.001ms. Lenis is
  not created at all, so scrolling is native.

## Responsive Behavior

- One column at every width. The hero is a column below `md` with the avatar
  first (96px), and a row from `md` with the avatar on the right (128px).
- The project grid is one column below `sm` and two from `sm`.
- The dock keeps its size at every width; it holds at most six icons.

## Iteration Guide

1. Reference components by the names in **Components** when asking for a change.
2. Before adding a section, decide whether it is a list section (plain heading)
   or a feature section (pill intro), and where it falls in the delay sequence.
3. Keep content in `src/data/resume.tsx`; sections render it and hold no copy
   of their own beyond the pill intros. The About summary is Markdown: link
   things shown further down with in-page anchors (`/#education`) and
   everything else externally, as the template does.
4. Client components take data as props. A client component that imports
   `DATA` ships the whole resume module to the browser.
5. Check every change in both themes and at 390px, 768px and 1280px.

## Known Gaps

- **Font.** The template uses Geist. Next 14.2's `next/font/google` list does
  not include it, so the site stays on Inter. Moving to Geist means adding the
  font files (vercel/geist-font, OFL) and loading them with `next/font/local`.
- **Work Experience above the fold.** At 1280x900 the Work heading and first
  rows sit in the lower third of the first screen but keep the motion
  BlurFade, so they wait for hydration (about 2s after the hero on a slow
  phone connection). Kept on purpose: the entrance is meant to play as each
  section scrolls in, and on phones Work starts below the fold.
- **Back after an anchor jump (Firefox).** Firefox sometimes saves the page's
  scroll position one Lenis frame into the jump, so Back returns 40-85px
  below where the visitor was. Fixing it means handling hash links without
  Lenis `anchors`.
- The `/tools` routes share these tokens but are not described here; tool UI
  may need data-density tokens this file does not define.
- Form field, validation and error states are not specified; `destructive` is
  declared but effectively unused on the portfolio.
