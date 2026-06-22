"use client";

import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ModeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Avoid a hydration mismatch: render a same-size placeholder until mounted.
  if (!mounted) {
    return <span className="inline-flex size-9 px-2" aria-hidden />;
  }

  const theme = resolvedTheme === "dark" ? "dark" : "light";

  return (
    <AnimatedThemeToggler
      theme={theme}
      onThemeChange={(t) => setTheme(t)}
      variant="circle"
      aria-label="Toggle theme"
      className="inline-flex size-9 items-center justify-center px-2 text-neutral-800 dark:text-neutral-200 [&_svg]:size-[1.2rem]"
    />
  );
}
