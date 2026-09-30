import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONTACT_EMAIL, SITE_NAME, SITE_URL } from "@/lib/site";
import { buildableTools } from "@/lib/tools/registry";
import { TOOLS_SECTION_LIVE } from "@/lib/tools/section-flag";

/**
 * While the tools section is dark, every /tools URL answers 410, so this page
 * names the tools as plain text instead of linking to them (the same rule the
 * dock and the homepage follow).
 */
function ToolLink({ href, children }: { href: string; children: React.ReactNode }) {
  if (!TOOLS_SECTION_LIVE) return <>{children}</>;
  return (
    <Link href={href} className="underline underline-offset-2">
      {children}
    </Link>
  );
}

const DESCRIPTION =
  "What this site collects, what it does not, and who else receives data when you visit. Almost every tool runs entirely in your browser; the few that do not are named.";

export const metadata: Metadata = {
  title: "Privacy",
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/privacy` },
  robots: { index: true, follow: true },
  // Its own share metadata; without it the page announces itself with the
  // homepage's title and URL. The card image still comes from
  // (site)/opengraph-image.
  openGraph: {
    title: `Privacy | ${SITE_NAME}`,
    description: DESCRIPTION,
    url: `${SITE_URL}/privacy`,
    type: "website",
    siteName: `${SITE_NAME} Portfolio`,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `Privacy | ${SITE_NAME}`,
    description: DESCRIPTION,
    creator: "@kanchana404",
  },
};

/**
 * Written to be true rather than to be comprehensive.
 *
 * Every tool page prints "Runs in your browser — nothing uploaded", derived from
 * `ToolDef.compute` so it cannot drift from what the tool actually does. This
 * page is where that claim is stated in full, including the part that makes it
 * checkable: what the third-party analytics script is, and which pages it is
 * absent from.
 *
 * ## The list of server-backed tools is read from the registry
 *
 * This page used to open with "Every tool under /tools runs entirely in your
 * browser." That sentence was already false: pdf-to-text and pdf-to-images had
 * shipped, and both upload. A privacy page is the one page on a site where a
 * stale sentence is not a typo, so the exception list is now derived from
 * `compute` rather than typed, exactly like the line under each tool's title.
 * Ship a tool that uses a server and it names itself here.
 *
 * Statically rendered, no data access: a privacy page that phones home would be
 * its own punchline.
 */
export const dynamic = "force-static";

const LAST_UPDATED = "28 September 2026";

/**
 * Tools that send anything to a server, straight from the registry.
 *
 * Derived rather than listed so this page cannot fall behind the code. `browser`
 * is the only compute mode that touches nothing.
 */
const serverTools = buildableTools()
  .filter((tool) => tool.compute !== "browser")
  .sort((a, b) => a.title.localeCompare(b.title));

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main id="main-content">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Privacy</h1>
      <p className="mt-2 text-xs text-muted-foreground">
        Last updated {LAST_UPDATED}
      </p>

      <p className="mt-6 text-sm leading-relaxed">
        This is a personal site run by one person. It has no accounts, no
        newsletter and nothing to sell you, so there is very little to collect
        and no reason to collect it.
      </p>

      <Section title="Almost every tool collects nothing">
        <p>
          Nearly every tool under <ToolLink href="/tools">/tools</ToolLink> runs
          entirely in your browser. What you type into a word counter, a
          JSON formatter, a JWT decoder or a password generator is never sent
          anywhere: there is no server request to send it to. You can confirm
          this by opening your browser&rsquo;s network tab while you type, or by
          disconnecting from the internet and using the tool offline. Nothing you
          enter is stored, and nothing survives a page reload; passwords and
          tokens in particular exist only in the tab you generated them in.
        </p>
        <p>
          {serverTools.length === 0 ? (
            "There are currently no exceptions."
          ) : (
            <>
              The exceptions are named here rather than left for you to discover.
              These {serverTools.length === 1 ? "tool sends" : "tools send"} what
              you give {serverTools.length === 1 ? "it" : "them"} to a server I
              run, because the work cannot be done in a browser:
            </>
          )}
        </p>
        {serverTools.length > 0 ? (
          <ul className="ml-5 list-disc space-y-1">
            {serverTools.map((tool) => (
              <li key={tool.slug}>
                <ToolLink href={`/tools/${tool.slug}`}>{tool.title}</ToolLink>
              </li>
            ))}
          </ul>
        ) : null}
        <p>
          For those, the line under the tool&rsquo;s title says so before you use
          it, and that line is generated from how the tool actually works rather
          than typed by hand. The video downloader is the furthest from &ldquo;runs
          in your browser&rdquo;: for most sites it has to fetch the video onto my
          server, combine the separate video and audio streams, and hand you a
          link. So the file itself passes through my storage and is deleted six
          hours later. The link you paste is processed to find the media and is
          not kept.
        </p>
        <p>Analytics are not loaded on tool pages at all.</p>
      </Section>

      <Section title="The rest of the site">
        <p>
          Every page outside the tools section (the home page, the blog, and
          this page) loads one third-party analytics script, from <code
            className="rounded bg-muted px-1 py-0.5 text-xs text-foreground"
          >
            app.usecortana.ai
          </code>
          , which records page views and interaction events so I know which
          articles get read. It sets its own identifiers and receives your IP
          address and user agent, as any request to any server does.
        </p>
        <p>
          The video downloader page contacts two others. Cloudflare Turnstile
          supplies the &ldquo;are you human&rdquo; check, which is what keeps the
          tool from being drained by scripts, and it receives your IP address and
          browser details. When a download can be served directly, your browser
          fetches the file from the originating platform&rsquo;s own network
          (TikTok&rsquo;s, X&rsquo;s, and so on), which means that platform sees
          the request, though the referrer is stripped so it does not learn that
          you came from here.
        </p>
        <p>
          Yes, including this one. Carving out an exception for the privacy page
          would make the sentence above harder to state honestly, and a policy
          you cannot verify by looking is not worth much.
        </p>
        <p>
          If you would rather it did not load, any content blocker will stop it,
          and the site works normally without it.
        </p>
      </Section>

      <Section title="Hosting and logs">
        <p>
          The site is hosted on Vercel, which keeps standard server logs
          including IP addresses for a limited period as part of operating the
          service. I do not add my own logging beyond that.
        </p>
        <p>
          Blog posts are files in this site&rsquo;s source code, built into
          static pages. There is no database and there are no reader records.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          The site sets no cookies for ordinary browsing. The analytics script
          described above may set storage of its own on the pages where it
          loads.
        </p>
        <p>
          The video downloader sets one cookie, and only once you use it. It
          records that the &ldquo;are you human&rdquo; check has been passed, so a
          single download does not ask you to pass it again for every step. It
          holds no identifier for you (only a one-way hash of your address and
          two timestamps), cannot be read by any script, is not sent to any other
          site, and expires within fifteen minutes of you stopping.
        </p>
      </Section>

      <Section title="What I never do">
        <p>
          I do not sell data, share it with advertisers, or build profiles. There
          is no ad network on this site.
        </p>
      </Section>

      <Section title="Availability">
        <p>
          These tools are provided free and as-is, with no guarantee of uptime,
          accuracy or fitness for any particular purpose. Check anything
          important, such as a loan figure, a tax calculation or a contrast ratio
          in an accessibility audit, against a second source before relying on it.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions, corrections, or a request to remove something: email <a
            href={`mailto:${SITE_CONTACT_EMAIL}`}
            className="underline underline-offset-2"
          >
            {SITE_CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
