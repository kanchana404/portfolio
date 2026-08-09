/**
 * Canonical site identity primitives.
 *
 * This module exists for two reasons, and both are load-bearing.
 *
 * 1. **It is JSX-free.** `src/data/resume.tsx` is 460 lines of portfolio data
 *    carrying seventeen embedded React icon elements, so importing `DATA` drags
 *    `@/components/icons` and `lucide-react` into whatever module graph touched
 *    it. SEO plumbing (JSON-LD builders, the sitemap, OG URLs, the tools
 *    registry) only ever needs a handful of strings. Importing them from here
 *    keeps React out of graphs that have no business rendering anything — and
 *    keeps the validator and its tests runnable in plain Node.
 *
 * 2. **It owns the schema.org `@id` strings.** The root layout publishes a
 *    Person and a WebSite node, and every tool page must reference those exact
 *    `@id` values or Google resolves the tools as unrelated entities and they do
 *    nothing for the personal brand — which is the entire reason the tools live
 *    on this domain rather than a separate one. Two hand-written
 *    `${DATA.url}/#person` templates in two files is a fracture waiting for a
 *    refactor. Exported constants cannot drift.
 *
 * `src/data/resume.tsx` imports from here, so there is exactly one definition of
 * the site's URL and name in the codebase.
 */

/** Absolute origin, no trailing slash. Everything else is derived from this. */
export const SITE_URL = "https://kavithakanchana.me";

export const SITE_NAME = "Kavitha Kanchana";

/** Full-resolution headshot (896×1195, ~272 kB). Used for Person.image and OG. */
export const SITE_AVATAR = "/kavitha-kanchana-software-engineer.jpg";

/**
 * Pre-sized 96×96 crop of the headshot, ~6 kB.
 *
 * Exists so the tools author card can use a plain `<img>` at its natural size.
 * The alternatives were both bad: `next/image` ships a 12 kB client runtime to
 * every tool page to render a 48px avatar, and a plain `<img>` pointing at the
 * full headshot downloads 272 kB to display 48 pixels. A purpose-built asset
 * costs 6 kB and no JavaScript.
 *
 * Regenerate alongside the headshot:
 *   sips -Z 128 public/kavitha-kanchana-software-engineer.jpg --out /tmp/a.jpg
 *   sips -c 96 96 /tmp/a.jpg --out /tmp/b.jpg
 *   sips -s format jpeg -s formatOptions 55 /tmp/b.jpg \
 *     --out public/kavitha-kanchana-avatar-96.jpg
 */
export const SITE_AVATAR_96 = "/kavitha-kanchana-avatar-96.jpg";

/** Where "a number looks wrong" reports should land. */
export const SITE_CONTACT_EMAIL = "kanchanakavitha6@gmail.com";

/**
 * schema.org node identifiers.
 *
 * Emitted by `src/app/layout.tsx` and referenced by every tool, hub and
 * category page. Changing either string is a site-wide entity migration, not a
 * refactor — Google has to re-resolve every node that points at them.
 */
export const PERSON_ID = `${SITE_URL}/#person`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
