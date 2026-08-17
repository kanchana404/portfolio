"use client";

import { useEffect, useRef, useState } from "react";
import { TOOL_PANEL_LABEL_CLASS, cx } from "./ui";

/**
 * The from → to format pair, as two cards with an arrow between them.
 *
 * Deliberately not shadcn. `Select`/`Popover` there would pull `cn()` and
 * therefore tailwind-merge — ~21 kB gzipped — into a **client** widget, which
 * lands on every tool page at once and would take the widget budget from
 * 25.7 kB straight past its 30 kB ceiling. `tool-shell.tsx` uses real shadcn
 * because it is a Server Component and pays nothing; a widget is the other
 * case. Same visual language, `cx()` instead of `cn()`.
 *
 * The menu is a plain popover rather than a listbox: six options do not need
 * type-ahead, and `<select>` cannot carry the card styling this is for.
 */

export interface FormatOption {
  value: string;
  label: string;
  /**
   * What picking this costs to download, e.g. "35 kB once".
   *
   * Shown on the option rather than after the click, so the price is known
   * before the decision. A codec that has already been fetched should pass
   * `null` — quoting a cost that will not be paid is its own kind of wrong.
   */
  cost?: string | null;
}

function Card({
  caption,
  label,
  options,
  onChange,
  disabled,
}: {
  caption: string;
  label: string;
  options?: readonly FormatOption[];
  onChange?: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on an outside click or Escape — the two ways anyone expects to
  // dismiss a popover, and the reason this is not just a hover menu.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const interactive = !disabled && options && options.length > 1;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={!interactive}
        aria-haspopup={interactive ? "menu" : undefined}
        aria-expanded={interactive ? open : undefined}
        onClick={() => interactive && setOpen((v) => !v)}
        className={cx(
          "group flex h-24 w-28 flex-col items-center justify-center gap-1 rounded-xl border bg-background transition-all sm:h-28 sm:w-32",
          interactive
            ? // Border only. DESIGN.md gives cards a hairline and no shadow, and
              // the lift-plus-shadow here was the one place on the tools surface
              // that broke it.
              "cursor-pointer hover:border-foreground/30"
            : "cursor-default"
        )}
      >
        <span className={TOOL_PANEL_LABEL_CLASS}>{caption}</span>
        <span className="text-xl font-semibold tracking-tight sm:text-2xl">
          {label}
        </span>
        {interactive ? (
          /*
            A chevron drawn with two borders rather than set as a glyph.
            This was `▾` (U+25BE), whose name is literally BLACK DOWN-POINTING
            *SMALL* TRIANGLE: it renders a 6px mark no matter what font-size it
            is given, so it read as a stray dot under the format name and the
            card never announced itself as a dropdown. Enlarging the type could
            not fix a glyph that is small by definition.

            Borders instead of an icon package because this widget lands on
            every tool page and the bundle sits at 29.5 kB of a 30 kB cap.
            `border-current` inherits the text colour, so both themes follow
            without a second class.
          */
          <span
            aria-hidden
            className="mt-0.5 size-1.5 border-b border-r border-current text-muted-foreground transition-transform"
            // Inline rather than `rotate-45` / `rotate-[225deg]`. Tailwind
            // drives rotation through the `--tw-rotate` custom property, and
            // with `transition-transform` on the same element Chrome updated
            // the variable but kept resolving `transform` to the old matrix, so
            // the chevron simply never flipped. Verified in the live page:
            // --tw-rotate read 225deg while the computed transform stayed at
            // 45deg. Setting transform directly removes the indirection the bug
            // needs, and still transitions.
            style={{ transform: open ? "rotate(225deg)" : "rotate(45deg)" }}
          />
        ) : (
          // Matches the chevron's box, so a non-interactive card sits at the
          // same height as an interactive one.
          <span aria-hidden className="mt-0.5 size-1.5" />
        )}
      </button>

      {interactive && open ? (
        <div
          role="menu"
          className="absolute left-1/2 z-20 mt-2 w-44 -translate-x-1/2 overflow-hidden rounded-lg border bg-background shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.label === label}
              onClick={() => {
                onChange?.(option.value);
                setOpen(false);
              }}
              className={cx(
                "block w-full px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                option.label === label ? "font-medium" : ""
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span>{option.label}</span>
                {option.cost ? (
                  <span className="text-xs font-normal text-muted-foreground">
                    {option.cost}
                  </span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Both sides are chosen here, the way CloudConvert does it.
 *
 * "From" is a filter rather than a claim: it decides what the file picker
 * offers and what the page says it is for. Whatever you actually drop is still
 * detected per file, so choosing wrongly cannot produce a wrong conversion.
 */
export function FormatPicker({
  fromLabel,
  fromOptions,
  onFromChange,
  toLabel,
  toOptions,
  onToChange,
}: {
  fromLabel: string;
  fromOptions: readonly FormatOption[];
  onFromChange: (value: string) => void;
  toLabel: string;
  toOptions: readonly FormatOption[];
  onToChange: (value: string) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-3 sm:gap-5">
      <Card
        caption="From"
        label={fromLabel}
        options={fromOptions}
        onChange={onFromChange}
      />

      <span aria-hidden className="text-xl text-muted-foreground">
        →
      </span>

      <Card
        caption="To"
        label={toLabel}
        options={toOptions}
        onChange={onToChange}
      />
    </div>
  );
}
