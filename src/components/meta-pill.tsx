import { cn } from "@/lib/utils";

/**
 * The small label used for employment type and similar tags (Full-time,
 * Co-Founder, Mentor). A <span>, so it is valid inside buttons and headings,
 * where the Badge component's <div> is not.
 */
export function MetaPill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        // Border only, no fill, so the label stays above 4.5:1 on the row's
        // hover and open washes too. normal-nums: an inherited tabular-nums
        // gives Inter's hyphen a tabular advance ("Co - Founder").
        "inline-flex h-[18px] shrink-0 items-center rounded-full border border-border px-2 text-[10px] font-medium normal-nums leading-none text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}
