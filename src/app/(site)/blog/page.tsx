import { DATA } from "@/data/resume";
import type { Metadata } from "next";
import { cssBlurFade } from "@/lib/css-blur-fade";
import { jsonLdHtml } from "@/lib/json-ld";
import { ogImageUrl } from "@/lib/og";

// Static; nothing here reads the request.
export const dynamic = "error";

const OG_TITLE = "Blog | Kavitha Kanchana";
const OG_DESCRIPTION =
  "Articles on software development, SaaS engineering, and building with Next.js & React.";
// Declaring openGraph here replaces the (site) route's inherited og:image,
// so the card image, site name and locale have to be restated, and twitter
// needs its own title or it keeps the homepage's.
const OG_IMAGE = ogImageUrl("blog", "Blog");

export const metadata: Metadata = {
  title: "Software Development & SaaS Engineering Blog",
  description:
    "Articles by Kavitha Kanchana on software development, building SaaS products, scalable architecture, full-stack development, and shipping with Next.js and React.",
  alternates: { canonical: `${DATA.url}/blog` },
  openGraph: {
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    url: `${DATA.url}/blog`,
    type: "website",
    siteName: `${DATA.name} Portfolio`,
    locale: "en_US",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: OG_TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: OG_TITLE,
    description: OG_DESCRIPTION,
    // Restated: a route's twitter object replaces the root layout's outright.
    creator: "@kanchana404",
    images: [{ url: OG_IMAGE, alt: OG_TITLE }],
  },
};

const BLUR_FADE_DELAY = 0.04;

/**
 * The template's BlurFade entrance, done in CSS (lib/css-blur-fade.ts). The
 * motion library costs ~37 kB gzipped in this route's budgeted first load,
 * and a one-shot fade on a static list needs no JS.
 */
const fade = (delay: number) => cssBlurFade({ delay });

export default function BlogPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${DATA.url}/blog#collection`,
        url: `${DATA.url}/blog`,
        name: "Blog | Kavitha Kanchana",
        description:
          "Articles on software development, SaaS engineering, and building with Next.js.",
        isPartOf: { "@id": `${DATA.url}/#website` },
        about: { "@id": `${DATA.url}/#person` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: DATA.url },
          {
            "@type": "ListItem",
            position: 2,
            name: "Blog",
            item: `${DATA.url}/blog`,
          },
        ],
      },
    ],
  };

  // Layout after the Magic UI portfolio template's blog index. Until the first
  // post it is the title, the subtitle and the empty state.
  return (
    <main className="flex min-h-[100dvh] flex-col">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
      />

      <section id="blog">
        <div {...fade(BLUR_FADE_DELAY)}>
          <h1 className="mb-2 text-2xl font-semibold tracking-tight">Blog</h1>
          <p className="mb-8 text-sm text-muted-foreground">
            Notes on software development, building SaaS products and shipping
            with Next.js.
          </p>
        </div>

        <div {...fade(BLUR_FADE_DELAY * 2)}>
          <div className="flex flex-col items-center justify-center rounded-xl border border-border px-4 py-12">
            <p className="text-center text-muted-foreground">No posts yet.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
