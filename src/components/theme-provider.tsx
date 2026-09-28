"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { ThemeProviderProps } from "next-themes/dist/types";
import { useEffect } from "react";

/**
 * Keeps the mobile browser bar (meta theme-color) on the site's theme, not the
 * OS one. The server sends the light colour, matching defaultTheme="light";
 * the theme is chosen by the visitor, so a media-query pair gave OS-dark
 * phones a dark bar over a white page.
 */
function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    // The dark canvas, --background 0 0% 6.9% in globals.css.
    const color = resolvedTheme === "dark" ? "#121212" : "#ffffff";
    document
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute("content", color));
  }, [resolvedTheme]);
  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return (
    <NextThemesProvider {...props}>
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
