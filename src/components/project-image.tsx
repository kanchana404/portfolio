"use client";

import Image from "next/image";
import { useCallback, useState } from "react";

/**
 * The only interactive part of a project card: swap a failed cover for a flat
 * panel. Kept in its own client module so the card itself, and the Markdown it
 * renders, stay on the server.
 *
 * Fills its parent (the card's 16:9 media box). next/image serves the cover as
 * AVIF or WebP at the card's width, so a full-size generated PNG is never sent
 * to the browser as is.
 */
export function ProjectImage({ src, alt }: { src: string; alt: string }) {
  const [imageError, setImageError] = useState(false);
  // An image that failed before hydration fired its error event before React
  // was listening, so onError never runs. Check once the element is attached.
  const checkLoaded = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0) setImageError(true);
  }, []);

  if (imageError) {
    return <div className="absolute inset-0 bg-muted" aria-hidden />;
  }

  return (
    <Image
      ref={checkLoaded}
      src={src}
      alt={alt}
      fill
      // Two 304px columns from sm; one column (the 672px column less its
      // 24px gutters) below. calc(), not a bare 100vw: with 100vw Next drops
      // every srcset width under 640, so a 1x desktop card fetched ~1.7x the
      // pixels it shows.
      sizes="(min-width: 640px) 304px, calc(100vw - 48px)"
      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
      onError={() => setImageError(true)}
    />
  );
}
