import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SITE_AVATAR_96, SITE_CONTACT_EMAIL, SITE_NAME } from "@/lib/site";
import { toolJsonLd } from "@/lib/tools/jsonld";
import { getTool } from "@/lib/tools/registry";
import { CATEGORY_LABELS, type ToolCompute, type ToolDef } from "@/lib/tools/types";
import "@/lib/tools/widget-slugs";
import ToolWidget from "./tool-widget";
import { WidgetFrame } from "./widget-frame";
import { jsonLdHtml } from "@/lib/json-ld";

/**
 * The tool page template.
 *
 * Section order is load-bearing and this is the only place it exists, so every
 * tool built after the first inherits it for free and the order stops being
 * something anyone has to remember:
 *
 *   breadcrumb → H1 → meta row → intro → **widget** → caveats → how to use
 *   (+ sources) → FAQ → related → author card → JSON-LD
 *
 * The widget sits above the fold because a visitor arriving from a search query
 * wants the tool, and time-to-first-interaction on it is the behavioural signal
 * that decides whether the page keeps its ranking. Nothing may be inserted
 * between the intro and the widget.
 *
 * Server component by design — no `"use client"`. The only interactive part is
 * the widget, which carries its own client boundary. That keeps the page's
 * shipped JavaScript to the widget itself and lets all the prose land in the
 * static HTML a crawler receives.
 */

/**
 * The privacy claim is derived, never hardcoded.
 *
 * "Nothing uploaded" printed on a tool that POSTs to a server is a claim a
 * visitor can disprove with devtools open, and it is exactly the kind of thing
 * that becomes a comment thread. Deriving it from `compute` means the sentence
 * cannot go stale when a tool changes tier.
 */
function privacyLine(compute: ToolCompute): string {
  switch (compute) {
    case "browser":
      return "Runs in your browser — nothing uploaded";
    case "vercel":
      return "Saved to my server only when you ask it to be";
    case "railway":
      return "Processed on my server, then deleted";
    case "hybrid":
      return "Runs in your browser where it can; larger jobs go to my server and are deleted after";
  }
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function ToolShell({ tool }: { tool: ToolDef }) {
  const categoryHref = `/tools/category/${tool.category}`;
  const related = tool.related
    .map(getTool)
    .filter((t): t is ToolDef => Boolean(t));

  return (
    <>
      <a
        href="#tool-widget"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-3 focus:py-2 focus:text-background"
      >
        Skip to the tool
      </a>

      {/*
        1 — Breadcrumb.

        shadcn/ui, wrapping `next/link` through `asChild` so client-side
        navigation is kept. It is presentational and this file is a Server
        Component, so it adds no client JavaScript.
      */}
      <Breadcrumb className="mb-4">
        <BreadcrumbList className="text-xs">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/tools">Tools</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={categoryHref}>{CATEGORY_LABELS[tool.category]}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{tool.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <main id="main-content">
        {/* 2 — H1, the exact target keyword */}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {tool.title}
        </h1>

        {/* 3 — meta row */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <Link href={categoryHref} className="hover:text-foreground">
            {CATEGORY_LABELS[tool.category]}
          </Link>
          <span aria-hidden>·</span>
          {/* Linked, so the claim is checkable rather than merely asserted. */}
          <Link href="/privacy" className="hover:text-foreground">
            {privacyLine(tool.compute)}
          </Link>
          <span aria-hidden>·</span>
          <span>
            Updated{" "}
            <time dateTime={tool.updatedAt}>{formatDate(tool.updatedAt)}</time>
          </span>
          {tool.status === "beta" ? (
            <>
              <span aria-hidden>·</span>
              <span className="rounded border px-1.5 py-0.5 font-medium">
                Beta
              </span>
            </>
          ) : null}
          {tool.status === "deprecated" ? (
            <>
              <span aria-hidden>·</span>
              <span className="rounded border px-1.5 py-0.5 font-medium">
                No longer maintained
              </span>
            </>
          ) : null}
        </div>

        {/* 4 — intro */}
        <p className="mt-4 text-sm leading-relaxed">{tool.intro}</p>

        {/* 5 — THE WIDGET. Above the fold. Nothing goes between 4 and 5. */}
        <section id="tool-widget" className="mt-6 scroll-mt-6">
          <h2 className="sr-only">{tool.title}</h2>
          <WidgetFrame minHeight={360}>
            <ToolWidget slug={tool.slug} />
          </WidgetFrame>
        </section>

        {/* 6 — Honest limits, for anything that leaves the browser. One line,
             directly under the widget, because that is where someone who just
             got a mediocre result actually looks. */}
        {tool.caveats ? (
          <p className="mt-6 rounded-lg border-l-4 border-amber-500/60 bg-amber-500/5 p-4 text-sm">
            {tool.caveats}
          </p>
        ) : null}

        {/* 7 — How to use it.
             This replaced a pair of essay-length sections. A visitor who came
             from a search query wants the tool, then a short answer to "what do
             I put where" — not four paragraphs before either. */}
        <section className="mt-10">
          <h2 className="text-lg font-semibold tracking-tight">How to use it</h2>
          <ol className="mt-3 space-y-2.5">
            {tool.howToUse.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-relaxed">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-medium tabular-nums text-muted-foreground"
                >
                  {index + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>

          {tool.sources?.length ? (
            <div className="mt-5 rounded-lg border p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Where these numbers come from
              </h3>
              <ul className="mt-2 space-y-1.5">
                {tool.sources.map((source) => (
                  <li key={source.url} className="text-xs text-muted-foreground">
                    <a
                      href={source.url}
                      className="underline underline-offset-2 hover:text-foreground"
                      rel="noopener nofollow"
                      target="_blank"
                    >
                      {source.title}
                    </a>
                    {" — "}
                    {source.publisher}
                    {source.reference ? `, ${source.reference}` : ""}, checked{" "}
                    <time dateTime={source.verifiedOn}>
                      {formatDate(source.verifiedOn)}
                    </time>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        {/* 9 — FAQ. Plain headings rather than <details>: no JavaScript, always
             present in the DOM, and it matches the FAQPage node exactly. */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight">
            Frequently asked questions
          </h2>
          <dl className="mt-3 space-y-4">
            {tool.faqs.map((faq) => (
              <div key={faq.q}>
                <dt className="text-sm font-medium">{faq.q}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {faq.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* 10 — Related tools */}
        {related.length > 0 ? (
          <section className="mt-8">
            <h2 className="text-lg font-semibold tracking-tight">Related tools</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/tools/${r.slug}`}
                    className="block rounded-lg border p-3 transition-colors hover:border-foreground/20"
                  >
                    <span className="text-sm font-medium">{r.title}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {r.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 11 — Author card. The E-E-A-T signal, and a link back into the site. */}
        <section className="mt-10 flex items-start gap-4 rounded-lg border p-4">
          {/*
            Plain <img>, deliberately, and this is a measured decision rather
            than a shortcut.

            `next/image` pulls a ~12 kB client runtime into every tool page in
            order to render one 48px avatar — on a route whose entire budget is
            10 kB over the blog template. Pointing a plain <img> at the full
            headshot is worse still: 272 kB of 896×1195 JPEG to paint 48 pixels.

            So the page references a purpose-built 96×96 crop (~6 kB, 2× for
            retina) at its natural size. Explicit width and height mean the box
            is reserved before the bytes arrive, so this costs no layout shift
            either — which is the only thing `next/image` was buying here.
          */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={SITE_AVATAR_96}
            alt={SITE_NAME}
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            className="size-12 shrink-0 rounded-full object-cover"
          />
          <div>
            <p className="text-sm font-medium">
              Built and maintained by{" "}
              <Link href="/" className="underline underline-offset-2">
                {SITE_NAME}
              </Link>
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Software engineer at Cortana AI and co-founder of Ryzera
              Technologies, based in Sri Lanka. Found a bug or a wrong number?{" "}
              <a
                href={`mailto:${SITE_CONTACT_EMAIL}?subject=${encodeURIComponent(
                  `Feedback: ${tool.title}`
                )}`}
                className="underline underline-offset-2"
              >
                Email me
              </a>
              .
            </p>
          </div>
        </section>
      </main>

      {/* 12 — JSON-LD last, so it never delays first paint */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(toolJsonLd(tool)) }}
      />
    </>
  );
}
