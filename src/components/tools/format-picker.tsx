"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "./ui";

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
            ? "cursor-pointer hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md"
            : "cursor-default"
        )}
      >
        <span className="text-[0.65rem] uppercase tracking-widest text-muted-foreground">
          {caption}
        </span>
        <span className="text-xl font-semibold tracking-tight sm:text-2xl">
          {label}
        </span>
        {interactive ? (
          <span
            aria-hidden
            className={cx(
              "text-[0.6rem] text-muted-foreground transition-transform",
              open ? "rotate-180" : ""
            )}
          >
            ▾
          </span>
        ) : (
          <span aria-hidden className="h-[0.9rem]" />
        )}
      </button>

      {interactive && open ? (
        <div
          role="menu"
          className="absolute left-1/2 z-20 mt-2 w-32 -translate-x-1/2 overflow-hidden rounded-lg border bg-background shadow-lg"
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
              {option.label}
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
