"use client";

import { useId, useMemo, useState } from "react";
import { StatTile, ToolLabel, ToolTextarea } from "@/components/tools/ui";
import {
  READING_WPM,
  SPEAKING_WPM,
  analyzeText,
  formatDuration,
} from "@/lib/tools/text/analyze";

const SAMPLE =
  "Paste or type anything here and the counts update as you go. " +
  "Nothing is uploaded. The text stays in this tab.";

export default function WordCounter() {
  const id = useId();
  const [text, setText] = useState(SAMPLE);
  const stats = useMemo(() => analyzeText(text), [text]);

  const number = (n: number): string => n.toLocaleString("en-US");

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="p-4 sm:p-5">
        <ToolLabel htmlFor={id}>Your text</ToolLabel>
        <ToolTextarea
          id={id}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          spellCheck={false}
          className="mt-2 min-h-[180px] resize-y"
          placeholder="Paste your text here…"
        />
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setText("")}
            className="underline underline-offset-2 hover:text-foreground"
          >
            Clear
          </button>
          <span aria-hidden>·</span>
          <span>
            Reading at {READING_WPM} wpm, speaking at {SPEAKING_WPM} wpm
          </span>
        </div>
      </div>

      <div
        className="grid grid-cols-2 gap-x-6 gap-y-4 border-t p-4 sm:grid-cols-4 sm:p-5"
        aria-live="polite"
        aria-atomic="true"
      >
        <StatTile label="Words" value={number(stats.words)} />
        <StatTile
          label="Characters"
          value={number(stats.characters)}
          hint={`${number(stats.charactersNoSpaces)} without spaces`}
        />
        <StatTile label="Sentences" value={number(stats.sentences)} />
        <StatTile label="Paragraphs" value={number(stats.paragraphs)} />
        <StatTile label="Lines" value={number(stats.lines)} />
        <StatTile label="Reading time" value={formatDuration(stats.readingMinutes)} />
        <StatTile label="Speaking time" value={formatDuration(stats.speakingMinutes)} />
        <StatTile
          label="Longest word"
          value={stats.longestWord ? String([...stats.longestWord].length) : "0"}
          hint={stats.longestWord || undefined}
        />
      </div>
    </div>
  );
}
