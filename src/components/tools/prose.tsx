/**
 * Renders registry prose.
 *
 * Copy is stored as plain text with blank-line paragraph breaks and split here.
 * Adding a markdown renderer for three fields would ship a parser — react-markdown
 * plus its unified/remark tail — to every tool page in order to render text that
 * contains no markup. The paragraph split is the only structure the copy has.
 */
export function Prose({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, i) => (
        <p key={i} className="text-sm leading-relaxed text-muted-foreground">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
