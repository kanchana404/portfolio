import { HighlightedText } from "@/components/highlighted-text";

/**
 * Centered section label from the Magic UI portfolio template: a filled pill
 * sitting on a hairline that fades out toward both edges.
 */
export function SectionPill({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full items-center">
      <div className="h-px flex-1 bg-gradient-to-r from-transparent from-5% via-border via-95% to-transparent" />
      <div className="z-10 rounded-xl border bg-primary px-4 py-1">
        <span className="text-sm font-medium text-background">{children}</span>
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent from-5% via-border via-95% to-transparent" />
    </div>
  );
}

export function SectionIntro({
  pill,
  title,
  titleMark,
  children,
}: {
  pill: string;
  title: string;
  /** A phrase in the title to underline by hand when it scrolls into view. */
  titleMark?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-y-4">
      <SectionPill>{pill}</SectionPill>
      <div className="flex flex-col items-center justify-center gap-y-3">
        <h2 className="text-center text-3xl font-bold tracking-tighter sm:text-4xl">
          {titleMark ? (
            <HighlightedText
              text={title}
              marks={[{ text: titleMark, action: "underline" }]}
              strokeWidth={3}
              isView
              delay={200}
            />
          ) : (
            title
          )}
        </h2>
        <p className="text-balance text-center text-muted-foreground md:text-lg/relaxed lg:text-base/relaxed xl:text-lg/relaxed">
          {children}
        </p>
      </div>
    </div>
  );
}
