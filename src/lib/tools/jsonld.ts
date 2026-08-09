import { ogImageUrl } from "@/lib/og";
import { PERSON_ID, SITE_URL, WEBSITE_ID } from "@/lib/site";
import { CATEGORY_LABELS, type ToolCategory, type ToolDef } from "./types";

/**
 * Structured data for the tools section.
 *
 * The strategic point of hosting tools on the personal domain rather than a
 * separate one is that each tool page reinforces the *same* Person entity. That
 * only works if every node here either is referenced by `@id` or references the
 * exact identifiers the root layout publishes — hence importing `PERSON_ID` and
 * `WEBSITE_ID` from `@/lib/site` rather than re-deriving the strings. A tool
 * page emitting a standalone `SoftwareApplication` with no `@id` links is a tool
 * page doing nothing for the brand.
 *
 * Note what is deliberately absent: `aggregateRating`. There are no reviews.
 * Inventing them is a structured-data manual action, and a manual action on this
 * domain would take the blog and the homepage down with it.
 */

/** Crawlers want a timestamp; the registry stores a calendar date. */
function toIso(date: string): string {
  return `${date}T00:00:00+05:30`;
}

interface Crumb {
  name: string;
  url: string;
}

function breadcrumb(id: string, trail: Crumb[]): Record<string, unknown> {
  return {
    "@type": "BreadcrumbList",
    "@id": id,
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function toolUrl(slug: string): string {
  return `${SITE_URL}/tools/${slug}`;
}

export function categoryUrl(category: ToolCategory): string {
  return `${SITE_URL}/tools/category/${category}`;
}

export const HUB_URL = `${SITE_URL}/tools`;

/**
 * One `@graph` per tool page: WebPage + SoftwareApplication + FAQPage +
 * BreadcrumbList, glued together so the tool inherits the site's existing entity
 * rather than floating free.
 */
export function toolJsonLd(tool: ToolDef): Record<string, unknown> {
  const url = toolUrl(tool.slug);
  const image = ogImageUrl("tool", tool.title);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: tool.metaTitle,
        description: tool.description,
        inLanguage: "en-US",
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": `${url}#app` },
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: image,
          width: 1200,
          height: 630,
        },
        datePublished: toIso(tool.publishedAt),
        dateModified: toIso(tool.updatedAt),
        breadcrumb: { "@id": `${url}#breadcrumb` },
        // Both point at the identifier the root layout emits, so the tool
        // reinforces one Person rather than minting a second one.
        author: { "@id": PERSON_ID },
        publisher: { "@id": PERSON_ID },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#app`,
        name: tool.title,
        url,
        description: tool.description,
        applicationCategory: "UtilitiesApplication",
        applicationSubCategory: CATEGORY_LABELS[tool.category],
        operatingSystem: "Any — runs in a web browser",
        browserRequirements: "Requires JavaScript enabled.",
        datePublished: toIso(tool.publishedAt),
        dateModified: toIso(tool.updatedAt),
        isAccessibleForFree: true,
        // Free, and explicitly so: omitting `offers` makes Search Console
        // complain, and a zero-price Offer is the honest way to say it.
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          availability: "https://schema.org/InStock",
        },
        author: { "@id": PERSON_ID },
        publisher: { "@id": PERSON_ID },
        isPartOf: { "@id": WEBSITE_ID },
        keywords: tool.keywords.join(", "),
        ...(tool.sources?.length
          ? {
              citation: tool.sources.map((s) => ({
                "@type": "CreativeWork",
                name: s.title,
                url: s.url,
                ...(s.publisher
                  ? { publisher: { "@type": "Organization", name: s.publisher } }
                  : {}),
              })),
            }
          : {}),
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        isPartOf: { "@id": `${url}#webpage` },
        mainEntity: tool.faqs.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: { "@type": "Answer", text: faq.a },
        })),
      },
      breadcrumb(`${url}#breadcrumb`, [
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Tools", url: HUB_URL },
        { name: CATEGORY_LABELS[tool.category], url: categoryUrl(tool.category) },
        { name: tool.title, url },
      ]),
    ],
  };
}

/** Hub: CollectionPage + ItemList + BreadcrumbList. */
export function toolsHubJsonLd(
  tools: readonly ToolDef[]
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${HUB_URL}#webpage`,
        url: HUB_URL,
        name: "Free online tools",
        description:
          "Free browser-based tools built and maintained by Kavitha Kanchana.",
        inLanguage: "en-US",
        isPartOf: { "@id": WEBSITE_ID },
        author: { "@id": PERSON_ID },
        publisher: { "@id": PERSON_ID },
        mainEntity: { "@id": `${HUB_URL}#list` },
        breadcrumb: { "@id": `${HUB_URL}#breadcrumb` },
      },
      {
        "@type": "ItemList",
        "@id": `${HUB_URL}#list`,
        itemListOrder: "https://schema.org/ItemListUnordered",
        numberOfItems: tools.length,
        itemListElement: tools.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.title,
          url: toolUrl(t.slug),
        })),
      },
      breadcrumb(`${HUB_URL}#breadcrumb`, [
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Tools", url: HUB_URL },
      ]),
    ],
  };
}

/** Category page: the hub's shape, scoped to one category. */
export function toolCategoryJsonLd(
  category: ToolCategory,
  tools: readonly ToolDef[]
): Record<string, unknown> {
  const url = categoryUrl(category);
  const label = CATEGORY_LABELS[category];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#webpage`,
        url,
        name: label,
        inLanguage: "en-US",
        isPartOf: { "@id": WEBSITE_ID },
        author: { "@id": PERSON_ID },
        publisher: { "@id": PERSON_ID },
        mainEntity: { "@id": `${url}#list` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "ItemList",
        "@id": `${url}#list`,
        itemListOrder: "https://schema.org/ItemListUnordered",
        numberOfItems: tools.length,
        itemListElement: tools.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.title,
          url: toolUrl(t.slug),
        })),
      },
      breadcrumb(`${url}#breadcrumb`, [
        { name: "Home", url: `${SITE_URL}/` },
        { name: "Tools", url: HUB_URL },
        { name: label, url },
      ]),
    ],
  };
}
