import type {
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
    <div className="rounded-lg border p-3">
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
