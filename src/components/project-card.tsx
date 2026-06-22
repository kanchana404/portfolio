import { Badge } from "@/components/ui/badge";
import { Safari } from "@/components/ui/safari";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Markdown from "react-markdown";

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
  image,
  video,
  links,
  className,
}: Props) {
  const repoUrl = links?.find((l) => l.type === "GitHub" && isReal(l.href))?.href;
  const liveUrl =
    (isReal(href) ? href : undefined) ||
    links?.find((l) => l.type === "Live Demo" && isReal(l.href))?.href;
  const primary = liveUrl || repoUrl;
  const domain = liveUrl
    ? liveUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")
    : undefined;
  const hasImage = Boolean(image);

  return (
    <div className={cn("group flex flex-col gap-4", className)}>
      <div className="overflow-hidden rounded-lg border bg-background">
        <Safari
          url={domain}
          imageSrc={image || undefined}
          videoSrc={video || undefined}
          className={cn(
            "w-full transition-transform duration-300 ease-out motion-reduce:transform-none",
            hasImage && "group-hover:scale-[1.03]"
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
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

        <Markdown className="prose max-w-none text-pretty font-sans text-sm leading-relaxed text-muted-foreground dark:prose-invert">
          {description}
        </Markdown>

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
          <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
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
    </div>
  );
}
