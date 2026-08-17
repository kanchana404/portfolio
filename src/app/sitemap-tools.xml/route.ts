import { SITE_URL } from "@/lib/site";
import {
  activeCategories,
  isCategoryIndexable,
  publicTools,
} from "@/lib/tools/registry";
import { TOOLS_SECTION_LIVE } from "@/lib/tools/section-flag";

/**
 * A sitemap containing *only* the tools cohort.
 *
 * These URLs are also in `/sitemap.xml`, and that duplication is the point.
 * Search Console reports indexation per submitted sitemap, so submitting this
 * one separately is the only way to answer "what fraction of the tool pages
 * specifically got indexed?" without hand-counting URL Inspection results.
 *
 * That question is Gate 1. The sprint plan files this segment as a *remedy* for
 * a failed gate, which is too late: a cohort that was not segmented before
 * publishing cannot be measured afterwards without restarting the 21-day
 * discovery clock. It ships with the first tool instead.
 *
 * Written as a route handler rather than via `generateSitemaps` because that API
 * produces `/sitemap/0.xml`, and a URL nobody can read is a URL nobody submits.
 */
export const dynamic = "force-static";

interface Entry {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
}

/**
 * Escape the five XML predefined entities.
 *
 * Slugs are kebab-case so today nothing here needs escaping — which is exactly
 * why it would be forgotten on the day a URL first contains an ampersand and the
 * whole sitemap becomes unparseable.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function toXml(entries: Entry[]): string {
  // An empty urlset is valid per the sitemaps.org schema, and is the right
  // answer while the section is dark: the sitemap stays submitted and parseable
  // in Search Console, so the cohort's history is not lost, and it simply lists
  // nothing. Removing the file instead would 404 a submitted sitemap.
  if (entries.length === 0) {
    return (
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `</urlset>\n`
    );
  }

  const urls = entries
    .map(
      (e) =>
        `  <url>\n` +
        `    <loc>${escapeXml(e.loc)}</loc>\n` +
        `    <lastmod>${e.lastmod}</lastmod>\n` +
        `    <changefreq>${e.changefreq}</changefreq>\n` +
        `    <priority>${e.priority}</priority>\n` +
        `  </url>`
    )
    .join("\n");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls}\n` +
    `</urlset>\n`
  );
}

export function GET(): Response {
  const today = new Date().toISOString().slice(0, 10);

  const entries: Entry[] = !TOOLS_SECTION_LIVE ? [] : [
    {
      loc: `${SITE_URL}/tools`,
      lastmod: today,
      changefreq: "weekly",
      priority: "0.9",
    },
    ...publicTools().map((tool) => ({
      loc: `${SITE_URL}/tools/${tool.slug}`,
      lastmod: tool.updatedAt,
      changefreq: "monthly",
      priority: "0.8",
    })),
    ...activeCategories()
      .filter(isCategoryIndexable)
      .map((category) => ({
        loc: `${SITE_URL}/tools/category/${category}`,
        lastmod: today,
        changefreq: "monthly",
        priority: "0.5",
      })),
  ];

  return new Response(toXml(entries), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Matches the hourly cadence of the main sitemap. Long enough that
      // crawlers are not re-fetching it constantly, short enough that a newly
      // promoted tool appears the same day.
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
