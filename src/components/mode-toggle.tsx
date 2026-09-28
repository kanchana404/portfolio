"use client";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { forwardRef, useEffect, useState } from "react";

/**
 * Forwards its ref because the Navbar mounts it inside a Radix
 * `<TooltipTrigger asChild>`, which clones this element and attaches a ref to
 * it. A plain function component drops that ref, which React reports as
 * "Function components cannot be given refs" and which leaves the tooltip with
 * nothing to anchor to.
 */
export const ModeToggle = forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<"button">
>(function ModeToggle({ className, ...props }, ref) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Avoid a hydration mismatch: render a same-size placeholder until mounted.
  // It stays a <button> so the trigger has a real element to measure on the
  // first paint rather than acquiring one a tick later.
  if (!mounted) {
    return (
      <button
        {...props}
        ref={ref}
        type="button"
        disabled
        aria-hidden
        className={cn("inline-flex size-9 px-2", className)}
      />
    );
  }

  const theme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <AnimatedThemeToggler
      {...props}
      ref={ref}
      theme={theme}
      onThemeChange={(t) => setTheme(t)}
      variant="circle"
      aria-label="Toggle theme"
      className={cn(
        "inline-flex size-9 items-center justify-center px-2 text-neutral-800 dark:text-neutral-200 [&_svg]:size-[1.2rem]",
        className
      )}
    />
  );
});
