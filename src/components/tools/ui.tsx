import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/**
 * Dependency-free primitives for tool widgets.
 *
 * These deliberately duplicate the look of `@/components/ui/input` and
 * `@/components/ui/label` instead of importing them, and the reason is
 * measurable rather than stylistic.
 *
 * A tool widget is the only client-side JavaScript on its page, and tool pages
 * are the SEO surface the whole platform exists to serve. The shared UI kit is
 * built for an app shell where a few kilobytes amortise across many interactive
 * screens:
 *
 * - `cn()` is `clsx` + `tailwind-merge`, and `tailwind-merge` alone is ~21 kB of
 *   client JavaScript. It earns that when a component must resolve conflicting
 *   Tailwind classes arriving through a `className` prop. A self-contained
 *   widget has no such prop and no such conflict.
 * - `@/components/ui/label` additionally pulls `@radix-ui/react-label` and
 *   `class-variance-authority` in order to render a `<label>` with two utility
 *   classes on it. Radix's label exists to associate a label with a control when
 *   `htmlFor` is not available; widgets here always have explicit ids, which is
 *   the stronger association anyway.
 *
 * Swapping the two imports for these took `/tools/[slug]` from 106 kB of first
 * load JS to comfortably inside its budget, with byte-identical rendering.
 *
 * The class strings are copied verbatim from the shared components so the two
 * stay visually identical. If the design system changes, change it here too —
 * `src/components/tools/ui.test.ts` pins them against the originals so the drift
 * is caught rather than discovered.
 */

/**
 * Minimal conditional class joiner.
 *
 * Not a `tailwind-merge` replacement and not trying to be: it concatenates, it
 * does not resolve conflicts. Widgets should not be emitting conflicting classes
 * in the first place.
 */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/** Matches `@/components/ui/input` exactly. */
export const TOOL_INPUT_CLASS =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

/** Matches `@/components/ui/label` exactly. */
export const TOOL_LABEL_CLASS =
  "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70";

export function ToolLabel({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cx(TOOL_LABEL_CLASS, className)} {...props} />;
}

export function ToolInput({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(TOOL_INPUT_CLASS, className)} {...props} />;
}

/**
 * The small uppercase label that names a panel or a column.
 *
 * One constant because there were four: `text-xs uppercase tracking-wide`
 * hand-copied into fourteen places, plus `text-[11px]` and `text-[0.65rem]`
 * variants. Two of those are below DESIGN.md's 12px floor, and at 10.4px with
 * wide tracking a word stops being read and becomes texture, which is exactly
 * why the format picker's FROM and TO lines disappeared into the panel.
 *
 * Set at the DESIGN.md `badge` spec (12px / 500 / +0.2px tracking). The
 * positive tracking is the point: every heading in the system is negatively
 * tracked, so this is the only letter-spacing that opens up, and that alone
 * makes it read as "category" rather than "content" without a second colour or
 * a rule under it.
 */
export const TOOL_PANEL_LABEL_CLASS =
  "text-xs font-medium uppercase tracking-wide text-muted-foreground";

export function ToolPanelLabel({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx(TOOL_PANEL_LABEL_CLASS, className)} {...props} />;
}

/**
 * Exclusive choice, two to four options: a segmented control.
 *
 * This replaces one class string that was hand-copied into ten places across
 * eight widgets, and two things were wrong with it. Its radius was `full`,
 * which DESIGN.md reserves for avatars and skill pills and which was the only
 * radius on the whole tools surface off the 8/6/4 ladder. Worse, its selected
 * state was `bg-foreground text-background`, which *is* the button-primary
 * token: every widget rendered a row of two to thirteen apparent primary
 * buttons, so the one real action on the page had no contrast left to claim.
 *
 * Selection now carries three quieter cues at once (muted fill, ink text, and
 * the group's own hairline) which frees solid black to mean exactly one thing
 * per widget. Removing the highest-contrast element from a page that already
 * reads austere is the contestable part; it is right anyway, because that
 * contrast was being spent on a toggle.
 *
 * Heights are exact under border-box: segment 28px, group 28 + 2px padding +
 * 2px border = 32px.
 */
export const TOOL_SEGMENT_GROUP_CLASS =
  "inline-flex items-center gap-0.5 rounded-md border p-0.5";

export const TOOL_SEGMENT_CLASS =
  "inline-flex h-7 items-center rounded-sm px-3 text-xs font-medium transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1";

export const TOOL_SEGMENT_ON_CLASS = "bg-muted text-foreground";
export const TOOL_SEGMENT_OFF_CLASS =
  "text-muted-foreground hover:text-foreground";

/**
 * Many options, or multi-select: a chip.
 *
 * A segmented control needs a fixed track, so thirteen case formats or eight
 * character sets do not fit one. Chips wrap instead, and carry their own
 * hairline at rest so a wrapped row still reads as a set of controls.
 */
export const TOOL_CHIP_CLASS =
  "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const TOOL_CHIP_ON_CLASS =
  "border-foreground/20 bg-muted text-foreground";
export const TOOL_CHIP_OFF_CLASS =
  "text-muted-foreground hover:border-foreground/20 hover:text-foreground";

/**
 * Multi-line input for the text and developer tools.
 *
 * `font-mono` because everything typed into one of these is data — JSON, base64,
 * a URL — where character-level alignment is the point and a proportional font
 * actively hides mistakes.
 */
export function ToolTextarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "flex w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm",
        "ring-offset-background placeholder:text-muted-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export function ToolSelect({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cx(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2",
        "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

/**
 * A labelled figure in a results grid.
 *
 * No border and no fill: separation is the grid gap's job now. This used to be
 * a bordered rounded card, and it is only ever rendered *inside* another
 * bordered rounded card, so the word counter drew eight hairline boxes inside
 * one hairline box. That is the literal source of the "uniform grey cards"
 * complaint, in a system whose cards are hairline-only by design. Do not
 * reintroduce the border here; widen the gap instead.
 *
 * `tabular-nums` so digits do not jitter as values change under the reader —
 * the numbers in these tools update on every keystroke.
 */
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
