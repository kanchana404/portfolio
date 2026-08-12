import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONTACT_EMAIL, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What this site collects, what it does not, and who else receives data when you visit. The tools collect nothing at all.",
  alternates: { canonical: `${SITE_URL}/privacy` },
  robots: { index: true, follow: true },
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
 * Statically rendered, no data access — a privacy page that phones home would be
 * its own punchline.
 */
export const dynamic = "force-static";

const LAST_UPDATED = "9 August 2026";

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

      <Section title="The tools collect nothing">
        <p>
          Every tool under{" "}
          <Link href="/tools" className="underline underline-offset-2">
            /tools
          </Link>{" "}
          runs entirely in your browser. What you type into a word counter, a
          JSON formatter, a JWT decoder or a password generator is never sent
          anywhere — there is no server request to send it to. You can confirm
          this by opening your browser&rsquo;s network tab while you type, or by
          disconnecting from the internet and using the tool offline.
        </p>
        <p>
          Nothing you enter is stored, and nothing survives a page reload.
          Passwords and tokens in particular exist only in the tab you generated
          them in.
        </p>
        <p>
          Analytics are not loaded on tool pages at all. If a tool is ever added
          that does need a server — larger file processing, for instance — its
          page will say so in the line under its title, and that line is
          generated from how the tool actually works rather than typed by hand.
        </p>
      </Section>

      <Section title="The rest of the site">
        <p>
          Every page outside the tools section — the home page, the blog, and
          this page — loads one third-party analytics script, from{" "}
          <code className="rounded bg-muted px-1 py-0.5 text-xs">
            app.usecortana.ai
          </code>
          , which records page views and interaction events so I know which
          articles get read. It sets its own identifiers and receives your IP
          address and user agent, as any request to any server does.
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
          Blog content is stored in a database I control. It holds articles, not
          readers — there are no user records because there are no users.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          The site sets no cookies for visitors. There is one cookie used by the
          private admin area, which only exists after logging in and only applies
          to me. The analytics script described above may set storage of its own
          on the pages where it loads.
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
          important — a loan figure, a tax calculation, a contrast ratio in an
          accessibility audit — against a second source before relying on it.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions, corrections, or a request to remove something: email{" "}
          <a
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
