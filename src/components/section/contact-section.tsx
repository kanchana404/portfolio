import { FlickeringGrid } from "@/components/magicui/flickering-grid";
import { Highlighter } from "@/components/magicui/highlighter";
import { DATA } from "@/data/resume";
import Link from "next/link";

// Underlined at rest, not only on hover: the link blue against the muted
// paragraph grey is 1.04:1 (1.14:1 dark), so colour alone does not mark them
// as links (WCAG 1.4.1). Hover thickens the line.
const LINK_CLASS =
  "rounded-sm text-link underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function ContactSection() {
  return (
    <div className="relative rounded-xl border p-10">
      <div className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 rounded-xl border bg-primary px-4 py-1">
        <span className="text-sm font-medium text-background">Contact</span>
      </div>
      {/*
        The grid fades out over the top half of the card. On phones it stops at
        80px, above the paragraph: the paragraph's first line sat inside it and
        a grid dot under the muted text dropped the contrast to 4.07:1.
      */}
      <div className="absolute inset-x-0 top-0 h-20 overflow-hidden rounded-xl sm:h-1/2" aria-hidden>
        <FlickeringGrid
          className="h-full w-full"
          squareSize={2}
          gridGap={2}
          style={{
            maskImage: "linear-gradient(to bottom, black, transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
          }}
        />
      </div>
      <div className="relative flex flex-col items-center gap-4 text-center">
        <h2 className="text-3xl font-bold tracking-tighter sm:text-5xl">
          {"Get in "}
          <Highlighter action="underline" strokeWidth={3} isView delay={200}>
            Touch
          </Highlighter>
        </h2>
        {/*
          Each space sits inside its string: Chromium drops a space-only text
          node next to React's <!-- --> separators from the accessibility
          tree, which glued "or" to the links around it.
        */}
        <p className="mx-auto max-w-lg text-balance text-muted-foreground">
          {"Open to new opportunities, collaborations and interesting projects. Just "}
          <Link href={DATA.contact.social.email.url} className={LINK_CLASS}>
            send me an email
          </Link>
          {" or "}
          <Link
            href={DATA.contact.social.LinkedIn.url}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            message me on LinkedIn
          </Link>
          {" and I'll get back to you."}
        </p>
      </div>
    </div>
  );
}
