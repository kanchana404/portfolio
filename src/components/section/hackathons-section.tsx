import { HighlightedText } from "@/components/highlighted-text";
import { LogoImage } from "@/components/logo-image";
import { SectionIntro } from "@/components/section/section-pill";
import { TimelineDisclosure } from "@/components/section/timeline-disclosure";
import { Timeline, TimelineConnectItem, TimelineItem } from "@/components/timeline";
import { Badge } from "@/components/ui/badge";
import { DATA } from "@/data/resume";
import Link from "next/link";

/**
 * The template's "Hackathons" timeline: competitions first, newest at the top,
 * then open-source work. Each entry shows its date, title (with the win marked
 * by the Highlighter), award and link; the story behind it opens on demand,
 * like a work row, so the section is a list rather than a wall of text.
 */
export default function HackathonsSection() {
  return (
    <div className="flex w-full min-h-0 flex-col gap-y-8 overflow-hidden">
      <SectionIntro pill="Hackathons" title="I like building things" titleMark="building things">
        Outside of work I compete in hackathons and contribute to open source.
        Building alongside motivated people is where I learn the most.
      </SectionIntro>
      <Timeline>
        {DATA.hackathons.map((hackathon) => (
          <TimelineItem
            key={hackathon.title + hackathon.dates}
            className="flex w-full items-start justify-between gap-10"
          >
            <TimelineConnectItem className="flex items-start justify-center">
              {/*
                LogoImage, like the work rows: a missing or failed file falls
                back to the empty ringed disc instead of a broken-image glyph,
                and an entry with `imageDark` swaps marks with the theme.
                Decorative (alt=""): the entry's title sits right beside it.
              */}
              <LogoImage
                src={hackathon.image || undefined}
                darkSrc={"imageDark" in hackathon ? hackathon.imageDark : undefined}
                alt=""
                className="z-10 size-10 shrink-0 bg-card md:size-10"
              />
            </TimelineConnectItem>
            <TimelineDisclosure
              dates={hackathon.dates}
              title={
                // HighlightedText renders the plain title when there is no mark.
                <HighlightedText
                  text={hackathon.title}
                  marks={
                    "titleMark" in hackathon
                      ? [{ text: hackathon.titleMark, action: "highlight" }]
                      : []
                  }
                  isView
                />
              }
              subtitle={"award" in hackathon ? hackathon.award : undefined}
              location={"location" in hackathon ? hackathon.location : undefined}
              links={
                hackathon.links.length > 0 ? (
                  <div className="flex flex-row flex-wrap items-start gap-2">
                    {hackathon.links.map((link) => (
                      <Link
                        href={link.href}
                        key={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${link.title}: ${hackathon.title}`}
                      >
                        <Badge className="flex items-center gap-1.5 bg-primary text-xs text-primary-foreground">
                          <span aria-hidden>{link.icon}</span>
                          {link.title}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                ) : undefined
              }
            >
              {hackathon.description}
            </TimelineDisclosure>
          </TimelineItem>
        ))}
      </Timeline>
    </div>
  );
}
