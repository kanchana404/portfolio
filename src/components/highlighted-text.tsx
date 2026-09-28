import { Highlighter } from "@/components/magicui/highlighter";
import { Fragment } from "react";

export interface TextMark {
  /** Exact substring of the text to annotate. Ignored if it is not found. */
  text: string;
  action: "highlight" | "underline";
}

/**
 * Renders a plain string with some phrases hand-marked by Highlighter, so copy
 * can stay a single string in the data file. Marks are drawn in the order they
 * appear in the text, `stagger` ms apart after `delay`.
 */
export function HighlightedText({
  text,
  marks,
  delay = 0,
  stagger = 400,
  isView = false,
  strokeWidth,
}: {
  text: string;
  marks: readonly TextMark[];
  delay?: number;
  stagger?: number;
  isView?: boolean;
  /** Overrides the underline stroke (2px), e.g. thicker on display type. */
  strokeWidth?: number;
}) {
  const found = marks
    .map((mark) => ({ ...mark, at: text.indexOf(mark.text) }))
    .filter((mark) => mark.at >= 0)
    .sort((a, b) => a.at - b.at);

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  found.forEach((mark, i) => {
    if (mark.at < cursor) return; // overlapping marks: keep the first
    parts.push(text.slice(cursor, mark.at));
    parts.push(
      <Highlighter
        key={mark.at}
        action={mark.action}
        delay={delay + i * stagger}
        isView={isView}
        strokeWidth={strokeWidth ?? (mark.action === "underline" ? 2 : 1.5)}
      >
        {/*
          Marked phrases read in ink. Short ones ("1st Place") stay on one line;
          long ones (the hero's role) may wrap, and the mark follows each line.
        */}
        <span className={mark.text.length <= 20 ? "whitespace-nowrap text-foreground" : "text-foreground"}>
          {mark.text}
        </span>
      </Highlighter>
    );
    cursor = mark.at + mark.text.length;
  });
  parts.push(text.slice(cursor));

  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
    </>
  );
}
