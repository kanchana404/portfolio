"use client";

import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

/**
 * The pieces shared by every row that opens in place (work rows and the
 * Hackathons entries), so the two cannot drift apart: the tinted surface, the
 * trigger's focus ring, the chevron and the easing panel. Each row still lays
 * out its own header grid.
 */

/** Trigger basics; add the row's own grid, padding and hover wash. */
export const DISCLOSURE_TRIGGER_CLASS =
  "group w-full rounded-lg px-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * Open, the whole block (header and panel) is tinted as one surface; closed,
 * only the header takes a hover wash. -mx-2 gives the wash room (the trigger's
 * px-2 puts the text back on the column).
 */
export function DisclosureSurface({ open, children }: { open: boolean; children: React.ReactNode }) {
  return <div className={cn("-mx-2 rounded-lg transition-colors", open && "bg-muted/40")}>{children}</div>;
}

/** Always visible, so a row reads as openable before it is hovered; flips when open. */
export function DisclosureChevron({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronDown
      aria-hidden
      className={cn(
        "size-4 shrink-0 self-center text-muted-foreground transition-transform duration-300 ease-out group-hover:text-foreground",
        open && "rotate-180",
        className
      )}
    />
  );
}

/**
 * The panel is always in the DOM (crawlers read it), collapsed to zero height
 * and hidden from assistive tech until opened. It eases open over 0.7s, as
 * the pre-redesign ResumeCard did; reduced motion opens it at once.
 */
export function DisclosurePanel({
  id,
  labelledBy,
  open,
  children,
}: {
  id: string;
  labelledBy: string;
  open: boolean;
  children: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      aria-hidden={!open}
      initial={false}
      animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="overflow-hidden"
    >
      {children}
    </motion.div>
  );
}
