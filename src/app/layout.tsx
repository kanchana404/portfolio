import Navbar from "@/components/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import TrackingScript from "@/components/tracking-script";
import { ScrollProgress } from "@/components/ui/scroll-progress";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DATA } from "@/data/resume";
import { PERSON_ID, WEBSITE_ID } from "@/lib/site";
import { cn } from "@/lib/utils";
import type { Metadata, Viewport } from "next";
import { Inter as FontSans } from "next/font/google";
import "./globals.css";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

// Single source of truth for the site's SEO copy (current role: Software
// Engineer @ Cortana AI — keep in sync with the Person JSON-LD below).
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
    siteName: `${DATA.name} — Portfolio`,
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const personImage = new URL(DATA.avatarUrl, DATA.url).toString();

  // Unified structured-data graph: WebSite + Person + ProfilePage, cross-linked
  // by @id so search engines resolve one consistent entity for the site owner.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        url: DATA.url,
        name: `${DATA.name} — Portfolio`,
        alternateName: `${DATA.name} Portfolio`,
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
        // Explicit gender signal — the name is often misread as female online.
        gender: "https://schema.org/Male",
        pronouns: "he/him",
        url: DATA.url,
        image: {
          "@type": "ImageObject",
          url: personImage,
        },
        jobTitle: "Software Engineer",
        description:
          "Kavitha Kanchana is a software engineer at Cortana AI and the co-founder of Ryzera Technologies and PulseOpes Ai. He builds SaaS products ranging from micro SaaS tools to enterprise-level platforms, and also develops AI automation. He specializes in full-stack development with React, Next.js, Node.js and TypeScript.",
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
        memberOf: { "@type": "Organization", name: "Generation ALPHA" },
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
      {
        "@type": "ProfilePage",
        "@id": `${DATA.url}/#profilepage`,
        url: DATA.url,
        name: `${DATA.name} - Software Engineer & Founder`,
        dateCreated: "2025-08-01T00:00:00+05:30",
        dateModified: "2026-06-18T00:00:00+05:30",
        isPartOf: { "@id": WEBSITE_ID },
        about: { "@id": PERSON_ID },
        mainEntity: { "@id": PERSON_ID },
        primaryImageOfPage: { "@type": "ImageObject", url: personImage },
        inLanguage: "en-US",
      },
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
        {/* Structured data: WebSite + Person + ProfilePage (one cross-linked graph) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {/* Scroll progress bar (top of every page) */}
        <ScrollProgress />

        {/* Cortana AI pixel tracking script */}
        <TrackingScript />

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
