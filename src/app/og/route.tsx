import { ImageResponse } from "next/og";
import { normaliseOgTitle, type OgKind } from "@/lib/og";
import { SITE_URL } from "@/lib/site";

/**
 * Edge runtime.
 *
 * `next/og` is satori (layout) + resvg-wasm (rasterise); both are built for the
 * edge and cost a fraction of a Node lambda per invocation. This is safe *only*
 * because the route uses a generic system font stack and touches no filesystem.
 * Do not add `fs`, `sharp`, or a local font file without moving back to nodejs
 * and re-reading the cost note below.
 *
 * (`src/app/(site)/opengraph-image.tsx` deliberately stays on Node — it reads a
 * headshot off disk. It is statically prerendered, so it renders once at build
 * and never per request.)
 */
export const runtime = "edge";

/**
 * One year, immutable.
 *
 * Before this header existed the route shipped *no* `Cache-Control` at all, so
 * Vercel's CDN stored nothing and every hit was a fresh satori + resvg run on a
 * public, unauthenticated URL: every Googlebot pass, every Slack unfurl, every
 * LinkedIn re-scrape, every Discord hover. The output is a pure function of
 * (kind, title), so a repeat request never needs to re-render.
 *
 * Invalidation is by URL, not by header — see OG_VERSION in `@/lib/og`.
 */
const CACHE_CONTROL =
  "public, max-age=31536000, s-maxage=31536000, immutable, no-transform";

/** Path segment shown in the eyebrow, per card kind. */
const KIND_PATH: Record<OgKind, string> = { blog: "blog", tool: "tools" };

const THEME: Record<OgKind, { glow: string; accent: string; footer: string }> = {
  blog: {
    glow: "radial-gradient(circle at 20% 20%, #1e293b 0%, #0a0a0a 60%)",
    accent: "#7dd3fc",
    footer: "Kavitha Kanchana · Software Engineer at Cortana AI",
  },
  tool: {
    glow: "radial-gradient(circle at 80% 15%, #14532d 0%, #0a0a0a 60%)",
    accent: "#86efac",
    footer: "Free · No signup · Runs in your browser",
  },
};

/** Closed set. Anything unrecognised falls back to the original blog card. */
function parseKind(value: string | null): OgKind {
  return value === "tool" ? "tool" : "blog";
}

export function GET(request: Request): ImageResponse {
  const { searchParams } = new URL(request.url);
  const kind = parseKind(searchParams.get("kind"));

  // Re-normalise whatever actually arrived rather than trusting the caller.
  // `normaliseOgTitle` is idempotent (proved in og.test.ts), so a URL built by
  // `ogImageUrl()` passes through unchanged, while a hand-typed one is clamped
  // and stripped of control characters before it can reach the renderer.
  const title = normaliseOgTitle(searchParams.get("title") ?? "");

  const theme = THEME[kind];
  const host = new URL(SITE_URL).host;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          backgroundImage: theme.glow,
          padding: "80px",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: theme.accent,
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          {`${host}/${KIND_PATH[kind]}`}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 64,
            fontWeight: 700,
            lineHeight: 1.1,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#94a3b8" }}>
          {theme.footer}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: { "Cache-Control": CACHE_CONTROL },
    }
  );
}
