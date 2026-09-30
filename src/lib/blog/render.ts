import { createElement, type ReactElement } from "react";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { rehypeBlog, tableName } from "./rehype-blog";
import { classifyHref, type Post } from "./validate";

/** The post page's `<main>` id, kept out of the heading ids. */
export const POST_MAIN_ID = "main-content";

/** The ring the blog's other focusable rows use (app/(site)/blog/page.tsx). */
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Adds a class to what GFM set, such as `sr-only` on the footnotes heading. */
const withClass = (className: unknown, extra: string) =>
  typeof className === "string" && className !== "" ? `${className} ${extra}` : extra;

/**
 * A post's Markdown body as React elements, for the page and for the publish
 * gate's test, so the test checks exactly the HTML that ships.
 *
 * A .ts file built with createElement, not JSX, on purpose: tsconfig has
 * `jsx: "preserve"`, under which vitest's esbuild emits classic
 * `React.createElement` calls, and a TSX module without React in scope would
 * throw "React is not defined" the moment a test rendered it.
 *
 * Server-only, with no next/*, lucide or motion import: `/blog/[slug]` is the
 * bundle budget's canary. A link that breaks the policy, an image that is not
 * in the post's folder, or prose that the gate should have stopped
 * (rehype-blog.ts) throws, which fails `next build` even if the vitest gate
 * was skipped (`pnpm build:only`).
 */
export function renderPostBody(
  post: Pick<Post, "slug" | "body" | "images"> & { bodyLine?: number },
  knownSlugs: ReadonlySet<string>
): ReactElement {
  const components: Components = {
    // An H1 never reaches these: rehype-blog.ts refuses it.
    h2: ({ node, ...props }) =>
      createElement("h2", { ...props, className: withClass(props.className, "scroll-mt-24") }),
    h3: ({ node, ...props }) =>
      createElement("h3", { ...props, className: withClass(props.className, "scroll-mt-24") }),
    a: ({ node, href, ...props }) => {
      const link = classifyHref(href, knownSlugs);
      if (link.kind === "invalid") {
        throw new Error(`blog link policy: ${post.slug}: ${JSON.stringify(href)}: ${link.reason}`);
      }
      return link.kind === "external"
        ? createElement("a", { ...props, href, target: "_blank", rel: "noopener noreferrer" })
        : createElement("a", { ...props, href });
    },
    img: ({ src, alt }) => {
      // An own property only: `constructor` or `__proto__` must not pass as a file.
      const image = src && Object.hasOwn(post.images, src) ? post.images[src] : undefined;
      if (!image) {
        throw new Error(`blog image: ${post.slug}: ${JSON.stringify(src)} is not in public/blog/${post.slug}/`);
      }
      // Width and height come from the file, so the box is reserved before
      // the bytes arrive; bg-muted fills it meanwhile.
      return createElement("img", {
        src: image.src,
        alt: alt ?? "",
        width: image.width,
        height: image.height,
        loading: "lazy",
        decoding: "async",
        className: "h-auto w-full rounded-xl border border-border bg-muted",
      });
    },
    // not-prose: typography's caption and image rules would override the
    // frame with raw greys and margins.
    figure: ({ node, ...props }) => createElement("figure", { ...props, className: "not-prose my-8" }),
    figcaption: ({ node, ...props }) =>
      createElement("figcaption", {
        ...props,
        className: "mt-3 text-sm leading-snug text-muted-foreground",
      }),
    // Sideways scrollers keep Lenis off horizontal gestures (DESIGN.md,
    // Motion Rules). They take keyboard focus themselves because Safari does
    // not focus a scroller on its own, and a keyboard user could not reach
    // what overflows.
    pre: ({ node, ...props }) =>
      createElement("pre", {
        ...props,
        tabIndex: 0,
        className: withClass(props.className, FOCUS_RING),
        "data-lenis-prevent-horizontal": true,
      }),
    // The wrapper is a new formatting context, so the table's prose margin
    // (2em at its 14px) would add to the paragraph's instead of collapsing
    // with it. The wrapper takes that margin as my-7 and the table drops it.
    table: ({ node, ...props }) =>
      createElement(
        "div",
        {
          className: `my-7 overflow-x-auto rounded-sm ${FOCUS_RING}`,
          role: "region",
          "aria-label": tableName(node),
          tabIndex: 0,
          "data-lenis-prevent-horizontal": true,
        },
        createElement("table", { ...props, className: withClass(props.className, "my-0") })
      ),
  };

  return createElement(
    Markdown,
    {
      remarkPlugins: [remarkGfm],
      rehypePlugins: [
        [rehypeBlog, { slug: post.slug, firstLine: post.bodyLine ?? 1, reservedIds: [POST_MAIN_ID] }],
      ],
      components,
    },
    post.body
  );
}
