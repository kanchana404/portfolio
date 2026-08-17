/**
 * Whether the /tools section is served in production.
 *
 * The section is being rebuilt from scratch. Rather than delete a platform that
 * works — the registry, the copy validator, `ToolShell`, the bundle gate and the
 * browser suite are all sound, and the rebuild plan is written on top of them —
 * the whole surface is switched off at the edge and hidden from crawlers, and
 * the code stays in the tree.
 *
 * **Flip this to `true` to bring the section back.** Nothing else needs editing:
 * every consumer below reads this flag rather than hardcoding the decision.
 *
 * - `src/middleware.ts` returns 410 for `/tools` and everything beneath it
 * - `src/app/sitemap.ts` drops the hub, the tool URLs and the category URLs
 * - `src/app/sitemap-tools.xml/route.ts` serves an empty but valid urlset
 * - `src/app/robots.ts` disallows `/tools` instead of allowing it
 * - `src/app/(site)/page.tsx` hides the homepage tools section
 * - the four `tests/browser` specs that exercise /tools skip themselves
 *
 * ## Why 410 and not 404, and not a redirect
 *
 * 410 Gone states the removal was deliberate. Google drops a 410 faster than a
 * 404 and does not keep re-checking it, and neither is treated as an error the
 * way a soft 404 is. A redirect to the homepage would be worse than either: a
 * redirect to a page that is not an equivalent replacement is classified as a
 * soft 404, so the signals are discarded anyway and the reader is dumped
 * somewhere they did not ask for.
 *
 * ## Why the pages are still built
 *
 * They cost nothing to prerender and the middleware never lets a request reach
 * them. Keeping them in the build means `pnpm budget`, the registry validator
 * and the type-level widget map all keep running on every CI pass, so the
 * platform cannot rot silently while the section is dark.
 */
export const TOOLS_SECTION_LIVE = false;
