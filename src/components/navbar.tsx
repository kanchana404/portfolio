import { Dock, DockIcon } from "@/components/magicui/dock";
import { ModeToggle } from "@/components/mode-toggle";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipArrow,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DATA } from "@/data/resume";
import { TOOLS_SECTION_LIVE } from "@/lib/tools/section-flag";
import Link from "next/link";

/**
 * `DATA.navbar` stays pure data, so the retired section is filtered here at the
 * render site, the same place the homepage makes the decision. The Dock is a
 * real `<Link>` on every page of the site, so leaving it in would point every
 * crawl and every visitor at a 410.
 */
const NAV_ITEMS = DATA.navbar.filter(
  (item) => TOOLS_SECTION_LIVE || !item.href.startsWith("/tools")
);

const SOCIAL_ITEMS = Object.entries(DATA.contact.social).filter(
  ([, social]) => social.navbar
);

// Dock styling follows the Magic UI portfolio template: bordered circular
// icons on a frosted card, a primary-filled tooltip with an arrow.
//
// Focus rings are drawn on the DockIcon, not the focusable element, so they
// follow the icon's own radius: a circle at rest, a rounded square when
// magnified. The links wrap their DockIcon (group-focus-visible); the theme
// button sits inside its DockIcon (has-[:focus-visible]).
const LINK_CLASS = "group rounded-full focus-visible:outline-none";
const LINK_RING =
  "group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring";
const TOGGLE_RING =
  "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring";
const ICON_CLASS =
  "rounded-3xl cursor-pointer size-full bg-background p-0 text-muted-foreground hover:text-foreground hover:bg-muted backdrop-blur-3xl border border-border transition-colors";
// overflow-visible: TooltipContent's base overflow-hidden clipped the arrow
// while the zoom-in transform ran.
const TOOLTIP_CLASS =
  "overflow-visible rounded-xl bg-primary text-primary-foreground px-4 py-2 text-sm shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] dark:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)]";

function DockTooltip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" sideOffset={8} className={TOOLTIP_CLASS}>
        <p>{label}</p>
        <TooltipArrow className="fill-primary" />
      </TooltipContent>
    </Tooltip>
  );
}

export default function Navbar() {
  return (
    <nav aria-label="Site" className="pointer-events-none fixed inset-x-0 bottom-4 z-30">
      <Dock className="pointer-events-auto relative z-50 mx-auto flex h-14 w-fit gap-2 border bg-card/90 p-2 shadow-[0_0_10px_3px] shadow-primary/5 backdrop-blur-3xl">
        {NAV_ITEMS.map((item) => (
          <DockTooltip key={item.href} label={item.label}>
            <Link href={item.href} aria-label={item.label} className={LINK_CLASS}>
              <DockIcon className={`${ICON_CLASS} ${LINK_RING}`}>
                <item.icon aria-hidden className="size-full overflow-hidden rounded-sm object-contain" />
              </DockIcon>
            </Link>
          </DockTooltip>
        ))}
        <Separator orientation="vertical" className="m-auto h-2/3 w-px bg-border" />
        {SOCIAL_ITEMS.map(([name, social]) => {
          const isExternal = social.url.startsWith("http");
          return (
            <DockTooltip key={name} label={social.name}>
              <a
                href={social.url}
                aria-label={social.name}
                target={isExternal ? "_blank" : undefined}
                rel={isExternal ? "noopener noreferrer" : undefined}
                className={LINK_CLASS}
              >
                <DockIcon className={`${ICON_CLASS} ${LINK_RING}`}>
                  <social.icon aria-hidden className="size-full overflow-hidden rounded-sm object-contain" />
                </DockIcon>
              </a>
            </DockTooltip>
          );
        })}
        <Separator orientation="vertical" className="m-auto h-2/3 w-px bg-border" />
        {/*
          The trigger wraps the toggle, not the DockIcon: DockIcon is a plain
          function component that neither forwards a ref nor passes through the
          pointer handlers Radix attaches, so a tooltip on it never opens.
          ModeToggle forwards both.

          The button is the icon's whole square box, border included
          (-inset-px against the positioned wrapper; size-auto undoes
          ModeToggle's own size-9), so every point of the drawn icon is
          clickable at rest and magnified. inset-0 missed the 1px border ring.
          A rounded button would match the drawing but not the pointer: the
          icon starts magnifying under the cursor, and in Firefox the pointerup
          of an edge click then landed outside a rounded button.

          So the focus ring is drawn on the DockIcon (TOGGLE_RING above). The
          glyph is half the icon, as the others' are.
        */}
        <DockIcon className={`${ICON_CLASS} ${TOGGLE_RING}`}>
          <DockTooltip label="Theme">
            <ModeToggle className="absolute -inset-px size-auto p-0 focus-visible:outline-none [&_svg]:size-1/2" />
          </DockTooltip>
        </DockIcon>
      </Dock>
    </nav>
  );
}
