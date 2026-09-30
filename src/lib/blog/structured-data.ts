import { ogImageUrl } from "../og";
import { PERSON_ID, SITE_URL, WEBSITE_ID } from "../site";
import { ymdToIso } from "./dates";
import { BLOG_DESCRIPTION, BLOG_NAME, BLOG_URL, postUrl } from "./meta";
import type { Post, PostMeta } from "./validate";

/**
 * schema.org nodes for the blog. Author and publisher point at the Person the
 * root layout publishes, through the shared `@id` constants in src/lib/site.ts
 * rather than hand-built `${url}/#person` strings. Pages serialise the result
 * through jsonLdHtml.
 */

const COLLECTION_ID = `${BLOG_URL}#collection`;

/** The cover (or the /og card without one), then up to four body images. */
export function postImageUrls(post: Pick<Post, "title" | "cover" | "bodyImages">): string[] {
  const first = post.cover ? `${SITE_URL}${post.cover}` : ogImageUrl("blog", post.title);
  return [first, ...post.bodyImages.slice(0, 4).map((src) => `${SITE_URL}${src}`)];
}

function breadcrumbs(extra: Array<{ name: string; item: string }>) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: [
      { name: "Home", item: SITE_URL },
      { name: "Blog", item: BLOG_URL },
      ...extra,
    ].map((crumb, index) => ({ "@type": "ListItem", position: index + 1, ...crumb })),
  };
}

export function blogPostingJsonLd(post: Post) {
  const url = postUrl(post.slug);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#post`,
        headline: post.title,
        description: post.summary,
        image: postImageUrls(post),
        url,
        mainEntityOfPage: url,
        datePublished: ymdToIso(post.publishedAt),
        dateModified: ymdToIso(post.updatedAt ?? post.publishedAt),
        author: { "@id": PERSON_ID },
        publisher: { "@id": PERSON_ID },
        inLanguage: "en",
        isPartOf: { "@id": COLLECTION_ID },
        ...(post.tags.length > 0 ? { keywords: post.tags.join(", ") } : {}),
        ...(post.kind === "digest" ? { articleSection: "Weekly digest" } : {}),
      },
      breadcrumbs([{ name: post.title, item: url }]),
    ],
  };
}

export function blogIndexJsonLd(posts: PostMeta[]) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": COLLECTION_ID,
        url: BLOG_URL,
        name: BLOG_NAME,
        description: BLOG_DESCRIPTION,
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": PERSON_ID },
        ...(posts.length > 0
          ? {
              mainEntity: {
                "@type": "ItemList",
                itemListElement: posts.map((post, index) => ({
                  "@type": "ListItem",
                  position: index + 1,
                  url: postUrl(post.slug),
                  name: post.title,
                })),
              },
            }
          : {}),
      },
      breadcrumbs([]),
    ],
  };
}
