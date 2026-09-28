/**
 * A URL slug from a post title: lowercase ASCII letters, digits and single
 * hyphens, with no hyphen at either end. Returns null when nothing usable is
 * left (a title with no Latin letters or digits), so callers can answer 400
 * instead of failing schema validation with a generic 500.
 *
 * The one copy of this rule. It used to be pasted into four places, where a
 * trailing .trim() ran after spaces had already become hyphens and did
 * nothing, so " Hello " became "-hello-".
 */
export function slugify(title: string): string | null {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.length > 0 ? slug : null;
}
