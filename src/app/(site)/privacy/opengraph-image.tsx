// The site's own share card, re-declared for this segment. The page sets its
// own `openGraph` (so it does not announce itself with the homepage's title),
// and a segment that declares `openGraph` stops inheriting the parent's
// file-based image; a file here puts it back.
export { default, alt, size, contentType } from "../opengraph-image";
