import Navbar from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DATA } from "@/data/resume";
import { PERSON_ID, SITE_AVATAR, WEBSITE_ID } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";
import { jsonLdHtml } from "@/lib/json-ld";

// "optional", not "swap": the font is preloaded, so nearly every load has
// Inter within the block period, and a late font no longer swaps in after the
// first paint. With swap, a slow first visit on a phone reflowed the About
// paragraph by a line when Inter arrived (CLS 0.118 at 390px). The cost: that
// one slow page view shows the metric-matched fallback; later views have
// Inter from cache.
const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "optional",
});

// Single source of truth for the site's SEO copy (current role: Software
// Engineer @ Cortana AI; keep in sync with the Person JSON-LD below).
const SITE_TITLE = `${DATA.name} - Full-Stack & SaaS Software Engineer`;
const SITE_DESCRIPTION =
  "Software Engineer at Cortana AI building SaaS products, from micro SaaS to enterprise scale, plus AI automation. Next.js, React, Node.js. Based in Sri Lanka.";
const OG_DESCRIPTION =
  "Software Engineer at Cortana AI building SaaS products, from micro SaaS to enterprise scale, plus AI automation, with Next.js, React & Node.js.";
const TWITTER_DESCRIPTION =
  "Software Engineer at Cortana AI building SaaS products, from micro SaaS to enterprise scale, plus AI automation, with React, Next.js & Node.js. Based in Sri Lanka.";

export const metadata: Metadata = {
  metadataBase: new URL(DATA.url),
  title: {
    default: SITE_TITLE,
    template: `%s | ${DATA.name}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "Kavitha Kanchana",
    "Software Engineer",
    "SaaS Developer",
    "Micro SaaS Developer",
    "Enterprise SaaS Developer",
    "Full-Stack Developer",
    "Next.js Developer",
    "React Developer",
    "AI Automation",
    "Sri Lanka Software Engineer",
    "Cortana AI",
    "Ryzera Technologies",
  ],
  authors: [{ name: DATA.name, url: DATA.url }],
  creator: DATA.name,
  publisher: DATA.name,
  openGraph: {
    title: SITE_TITLE,
    description: OG_DESCRIPTION,
    url: DATA.url,
    siteName: `${DATA.name} Portfolio`,
    locale: "en_US",
    type: "website",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: TWITTER_DESCRIPTION,
    creator: "@kanchana404",
  },
  verification: {
    google: "ruMST9fSdT__2l747yzmAhzGJX4xsyYYKYX9EwymwVc",
  },
  alternates: {
    canonical: DATA.url,
  },
};

export const viewport: Viewport = {
  // The default (light) theme. ThemeColorSync in theme-provider.tsx switches
  // it with the site's theme; the OS setting does not choose the theme here.
  themeColor: "#ffffff",
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const personImage = new URL(SITE_AVATAR, DATA.url).toString();

  // Site-wide structured data: WebSite + Person, cross-linked by @id so search
  // engines resolve one consistent entity for the site owner. Pages add their
  // own nodes (the homepage its ProfilePage) that point back at these @ids.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: DATA.url,
        name: `${DATA.name} Portfolio`,
        alternateName: DATA.name,
        description:
          "Portfolio of Kavitha Kanchana, a software engineer specializing in full-stack development, building SaaS products from micro SaaS to enterprise-level platforms, plus AI automation.",
        inLanguage: "en-US",
        publisher: { "@id": PERSON_ID },
      },
      {
        "@type": "Person",
        "@id": PERSON_ID,
        name: DATA.name,
        givenName: "Kavitha",
        familyName: "Kanchana",
        alternateName: "kanchana404",
        // Explicit gender signal: the name is often misread as female online.
        gender: "https://schema.org/Male",
        pronouns: "he/him",
        url: DATA.url,
        image: {
          "@type": "ImageObject",
          url: personImage,
        },
        jobTitle: "Software Engineer",
        description:
          "Kavitha Kanchana is a software engineer at Cortana AI and the co-founder of Ryzera Technologies. He builds SaaS products ranging from micro SaaS tools to enterprise-level platforms, and also develops AI automation. He specializes in full-stack development with React, Next.js, Node.js and TypeScript.",
        worksFor: {
          "@type": "Organization",
          name: "Cortana AI",
          url: "https://usecortana.ai",
        },
        alumniOf: {
          "@type": "CollegeOrUniversity",
          name: "Birmingham City University",
          url: "https://www.bcu.ac.uk",
        },
        address: { "@type": "PostalAddress", addressCountry: "LK" },
        nationality: { "@type": "Country", name: "Sri Lanka" },
        award: [
          "1st Place, Master of Agents (AI Mastery Award for Best AI Integration), IDEALIZE 2026",
          "1st Runner-Up, Open Category, IDEALIZE 2026",
        ],
        sameAs: [
          DATA.contact.social.GitHub.url,
          DATA.contact.social.LinkedIn.url,
          "https://x.com/kanchana404",
        ],
        knowsAbout: [
          "Software Engineering",
          "Full-Stack Development",
          "SaaS Development",
          "Micro SaaS",
          "Enterprise Software",
          "Software as a Service",
          "AI Automation",
          "JavaScript",
          "TypeScript",
          "React",
          "Next.js",
          "Node.js",
          "PostgreSQL",
          "REST APIs",
          "Cloud Deployment",
        ],
      },
      // The ProfilePage node lives on the homepage itself (app/(site)/page.tsx):
      // emitted here it described every route, /blog and /privacy included.
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          // Layout width lives in the route-group layouts, not here: (site) keeps
          // the narrow reading column, (tools) needs a wider canvas for side-by-side
          // panes. Putting it on <body> capped every route at 672px.
          "min-h-screen bg-background font-sans antialiased",
          fontSans.variable
        )}
      >
        {/* Structured data: WebSite + Person (the homepage adds its ProfilePage) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdHtml(jsonLd) }}
        />
        <ThemeProvider attribute="class" defaultTheme="light">
          <TooltipProvider delayDuration={0}>
            {children}
            <Navbar />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
