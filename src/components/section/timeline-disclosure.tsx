"use client";

import {
  DISCLOSURE_TRIGGER_CLASS,
  DisclosureChevron,
  DisclosurePanel,
  DisclosureSurface,
} from "@/components/section/disclosure";
import { cn } from "@/lib/utils";
import { useId, useState } from "react";

/**
 * One Hackathons timeline entry that opens like a work row: the heading is a
 * button with the same always-visible chevron on the right (it flips when
 * open) and the same hover wash, and the description eases open over 0.7s
 * (the parts are shared, section/disclosure.tsx). Everything is rendered by
 * the server and passed in as nodes, so the
 * Highlighter marks and link badges inside keep working; this island only
 * owns the open state.
 *
 * The description stays in the DOM when closed (zero height, hidden from
 * assistive tech), so crawlers still read it. Links sit outside the button:
 * a link inside a button is invalid and cannot be clicked on its own.
 */
export function TimelineDisclosure({
  dates,
  title,
  subtitle,
  location,
  links,
  children,
}: {
  dates?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  location?: string;
  links?: React.ReactNode;
  /** The description, shown when open. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const panelId = `${id}-panel`;
  const triggerId = `${id}-trigger`;

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-start gap-2">
      {dates && <time className="text-xs text-muted-foreground">{dates}</time>}
      <DisclosureSurface open={open}>
        <h3 className="m-0">
          <button
            type="button"
            id={triggerId}
            aria-expanded={children ? open : undefined}
            aria-controls={children ? panelId : undefined}
            onClick={() => setOpen((v) => !v)}
            disabled={!children}
            className={cn(
              DISCLOSURE_TRIGGER_CLASS,
              "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 py-1.5",
              "enabled:cursor-pointer disabled:cursor-default",
              !open && "enabled:hover:bg-muted/50"
            )}
          >
            <span className="flex min-w-0 flex-col items-start gap-2">
              <span className="font-semibold leading-snug">{title}</span>
              {subtitle && (
                <span className="text-sm font-medium text-foreground">{subtitle}</span>
              )}
              {location && (
                <span className="text-sm font-normal text-muted-foreground">{location}</span>
              )}
            </span>
            {children && <DisclosureChevron open={open} />}
          </button>
        </h3>
        {children && (
          <DisclosurePanel id={panelId} labelledBy={triggerId} open={open}>
            <div className="break-words px-2 pb-2 text-sm leading-relaxed text-muted-foreground">
              {children}
            </div>
          </DisclosurePanel>
        )}
      </DisclosureSurface>
      {links}
    </div>
  );
}
