/**
 * Wider canvas for the tools section.
 *
 * Tools need room the 672px reading column can't give: side-by-side input and
 * output panes, comparison tables, image previews. `pb-28` clears the fixed
 * bottom Dock in <Navbar />, which would otherwise sit on top of a tool's
 * action buttons.
 */
export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-5xl mx-auto py-10 sm:py-16 px-4 sm:px-6 pb-28">
      {children}
    </div>
  );
}
