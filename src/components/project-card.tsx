import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Props {
  title: string;
  href?: string;
  description: string;
  dates: string;
  tags: readonly string[];
  image?: string;
  video?: string;
  links?: readonly {
    icon: React.ReactNode;
    type: string;
    href: string;
  }[];
  className?: string;
}

// A real, navigable URL (excludes "#", relative, and social-redirect links).
const isReal = (u?: string) =>
  Boolean(
    u &&
      u !== "#" &&
      /^https?:\/\//.test(u) &&
      !u.includes("lnkd.in") &&
      !u.includes("linkedin.com")
  );

export function ProjectCard({
  title,
  href,
  description,
  dates,
  tags,
  links,
  className,
}: Props) {
  const repoUrl = links?.find((l) => l.type === "GitHub" && isReal(l.href))?.href;
  const liveUrl =
    (isReal(href) ? href : undefined) ||
    links?.find((l) => l.type === "Live Demo" && isReal(l.href))?.href;
  const primary = liveUrl || repoUrl;

  return (
    <div
      className={cn(
        "group flex flex-col gap-2 rounded-lg border p-5 transition-colors duration-150 hover:border-foreground/20",
        className
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-medium">
          {primary ? (
            <Link
              href={primary}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline"
            >
              {title}
            </Link>
          ) : (
            title
          )}
        </h3>
        <span className="shrink-0 text-sm text-muted-foreground">{dates}</span>
      </div>

      <p className="line-clamp-4 text-pretty text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {tags && tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1.5">
          {tags.slice(0, 6).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="font-normal text-muted-foreground"
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {(liveUrl || repoUrl) && (
        <div className="mt-auto flex gap-4 pt-2 text-sm text-muted-foreground">
          {liveUrl && (
            <Link
              href={liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline"
            >
              Live ↗
            </Link>
          )}
          {repoUrl && (
            <Link
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="link-underline"
            >
              Code ↗
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
