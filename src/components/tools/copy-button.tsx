"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "./ui";

/**
 * Copy-to-clipboard button.
 *
 * Dependency-free on purpose — see the note in `./ui`. Tool widgets are the only
 * client JavaScript on an SEO-critical route, so a button does not get to pull a
 * toast library.
 *
 * Two details that are easy to get wrong:
 *
 * - `navigator.clipboard` is undefined on insecure origins and in some embedded
 *   webviews. The failure is silent unless handled, so the button reports it
 *   instead of appearing to work.
 * - The "Copied" state is cleared on a timer, and that timer must be cancelled on
 *   unmount or React warns about setting state on a dead component every time
 *   someone copies and navigates within two seconds.
 */
export function CopyButton({
  value,
  label = "Copy",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const copy = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    try {
      if (!navigator.clipboard) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = setTimeout(() => setState("idle"), 1800);
  }, [value]);

  return (
    <button
      type="button"
      onClick={copy}
      disabled={value.length === 0}
      className={cx(
        "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
        "hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-50",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        className
      )}
    >
      {/* Announced politely so a screen reader confirms the copy happened. */}
      <span aria-live="polite">
        {state === "copied"
          ? "Copied"
          : state === "failed"
            ? "Press Ctrl+C"
            : label}
      </span>
    </button>
  );
}
