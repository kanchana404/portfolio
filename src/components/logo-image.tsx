/* eslint-disable @next/next/no-img-element */
"use client";

import { cn } from "@/lib/utils";
import { useCallback, useState } from "react";

/**
 * Round company or school mark from the Magic UI portfolio template. Falls
 * back to an empty ringed circle when there is no logo or the file fails to
 * load, so a missing asset never shows the browser's broken-image glyph.
 *
 * `darkSrc` is an optional second mark for the dark theme. Both are in the
 * markup and the `dark` class on <html> picks one with CSS, so the swap
 * follows the theme toggle instantly and cannot mismatch during hydration.
 */
export function LogoImage({
  src,
  darkSrc,
  alt,
  className,
}: {
  src?: string;
  darkSrc?: string;
  alt: string;
  className?: string;
}) {
  const [imageError, setImageError] = useState(false);
  // An image that failed before hydration fired its error event before React
  // was listening, so onError never runs. Check once the element is attached.
  // Not-yet-fetched lazy images report complete=false, so they are left alone.
  const checkLoaded = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0) setImageError(true);
  }, []);
  const base =
    "size-8 md:size-10 p-1 border rounded-full shadow ring-2 ring-border flex-none";

  if (!src || imageError) {
    // A span, not a div: the mark sits inside work-row buttons.
    return <span className={cn(base, "block bg-muted", className)} aria-hidden />;
  }

  const img = "overflow-hidden object-contain";

  if (!darkSrc) {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn(base, img, className)}
        ref={checkLoaded}
        onError={() => setImageError(true)}
      />
    );
  }

  return (
    <>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className={cn(base, img, "dark:hidden", className)}
        ref={checkLoaded}
        onError={() => setImageError(true)}
      />
      <img
        src={darkSrc}
        alt={alt}
        loading="lazy"
        className={cn(base, img, "hidden dark:block", className)}
        ref={checkLoaded}
        onError={() => setImageError(true)}
      />
    </>
  );
}
