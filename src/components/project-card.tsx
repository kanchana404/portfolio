import { ProjectImage } from "@/components/project-image";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import Markdown from "react-markdown";

interface Props {
  title: string;
  href?: string;
  description: string;
  dates: string;
  tags: readonly string[];
  /** Short kind of project shown after the year on the cover, e.g. "E-commerce". */
  category?: string;
  /** Adds a "Featured" chip to the cover. */
  featured?: boolean;
  image?: string;
  video?: string;
  links?: readonly {
    icon: React.ReactNode;
    type: string;
    href: string;
  }[];
  className?: string;
}

// Any link a visitor can actually follow: not "#", and absolute.
const isNavigable = (u?: string) => Boolean(u && u !== "#" && /^https?:\/\//.test(u));

// The card's own destination is the project itself, so a LinkedIn post (or its
// lnkd.in redirect) is shown as a badge but never used as the card link.
const isProjectUrl = (u?: string) =>
  isNavigable(u) && !u!.includes("lnkd.in") && !u!.includes("linkedin.com");

// Frosted-glass chips over a cover. Light glass with dark text: the covers are
// bright, where white text on clear glass drops well under 4.5:1, and 55%
// white under near-black text stays legible on a dark cover too.
const GLASS_CHIP =
  "pointer-events-none absolute inline-flex h-[22px] items-center rounded-full border border-white/60 bg-white/55 px-2 text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-neutral-900 shadow-sm backdrop-blur-md";

/**
 * Project card from the Magic UI portfolio template. Two departures, both so
 * the card never shows something broken: with no image or video the media
 * block is left out instead of drawing an empty grey panel, and links that go
 * nowhere ("#") are not rendered at all.
 *
 * With a cover, the media follows kalanalk.com's project cards: a 16:9 box
 * that zooms slightly on hover, with frosted-glass chips on it (the year and
 * category bottom-left, "Featured" top-right). The year moves onto the cover;
 * the link badges stay in the body, where three of them fit on one line.
 *
 * A server component, unlike the template's: there the whole card is a client
 * component for one image-error flag, which ships react-markdown and micromark
 * (about 40 kB gzipped) to the browser to render plain sentences.
 */
export function ProjectCard({
  title,
  href,
  description,
  dates,
  tags,
  category,
  featured,
  image,
  video,
  links,
  className,
}: Props) {
  const badgeLinks = (links ?? []).filter((link) => isNavigable(link.href));
  const primary =
    (isProjectUrl(href) ? href : undefined) ??
    badgeLinks.find((link) => isProjectUrl(link.href))?.href;
  const hasMedia = Boolean(video || image);

  // Primary pills, as in Hackathons. The template's black badges were drawn
  // over a screenshot; on the dark canvas #000 is 1.1:1 and they read as
  // loose text.
  const badges = badgeLinks.length > 0 && (
    <div className="flex flex-wrap gap-2">
      {badgeLinks.map((link) => (
        <Link
          href={link.href}
          key={link.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${link.type}: ${title}`}
        >
          <Badge
            className="flex items-center gap-1.5 bg-primary text-xs text-primary-foreground hover:bg-primary/80"
            variant="default"
          >
            <span aria-hidden>{link.icon}</span>
            {link.type}
          </Badge>
        </Link>
      ))}
    </div>
  );

  // alt="": the title is the next thing in the card, so the cover adds nothing
  // a screen reader needs.
  const media = video ? (
    <video
      src={video}
      autoPlay
      loop
      muted
      playsInline
      className="absolute inset-0 h-full w-full object-cover"
    />
  ) : image ? (
    <ProjectImage src={image} alt="" />
  ) : null;

  return (
    <div
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-xl border border-border transition-all duration-200 hover:ring-2 hover:ring-muted",
        className
      )}
    >
      {hasMedia && (
        <div className="relative aspect-video shrink-0 overflow-hidden border-b border-border bg-muted">
          {primary ? (
            <Link
              href={primary}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-0 block"
              tabIndex={-1}
              aria-hidden
            >
              {media}
            </Link>
          ) : (
            media
          )}
          {/* One inline span inside the flex chip: a flex item trims the
              space before the separator. */}
          <span className={cn(GLASS_CHIP, "bottom-2.5 left-2.5")}>
            <span>
              <time>{dates}</time>
              {category && ` · ${category}`}
            </span>
          </span>
          {featured && <span className={cn(GLASS_CHIP, "right-2.5 top-2.5")}>Featured</span>}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">{title}</h3>
            {!hasMedia && <time className="text-xs text-muted-foreground">{dates}</time>}
          </div>
          {primary && (
            <Link
              href={primary}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={`Open ${title}`}
            >
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          )}
        </div>
        <div className="prose max-w-full flex-1 text-pretty font-sans text-xs leading-relaxed text-muted-foreground dark:prose-invert">
          <Markdown>{description}</Markdown>
        </div>
        {badges}
        {tags && tags.length > 0 && (
          <div className="mt-auto flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge
                key={tag}
                className="h-6 w-fit border border-border px-2 text-[11px] font-medium"
                variant="outline"
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
