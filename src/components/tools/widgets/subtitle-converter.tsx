"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type Cue,
  type CueMatch,
  SubtitleError,
  detectFormat,
  displayTime,
  parseSubtitles,
  searchCues,
  shiftCues,
  toSrt,
  toVtt,
} from "@/lib/tools/subtitle/convert";
import { CopyButton } from "../copy-button";
import { ToolInput, ToolLabel, cx } from "../ui";

/**
 * SRT <-> VTT converter, with a jump-to-cue box.
 *
 * Statically imported like every other widget here: it is pure string work with
 * no dependency, so there is nothing to defer and `lazyWidget` would cost a
 * chunk request to save nothing. `lazyWidget` is for the WASM tools.
 *
 * The output is a **cue list rather than a blob of text**. The exact file is
 * still one click away on Copy or Download, but a subtitle file is a list of
 * timed rows, and rendering it as one is what makes it searchable, scrollable
 * and addressable. A `<pre>` can only be read top to bottom.
 */

type Target = "vtt" | "srt";

const SAMPLE = `1
00:00:01,000 --> 00:00:04,000
Drop a file, or paste here.

2
00:00:05,500 --> 00:00:09,250
Both directions work.

3
00:00:11,000 --> 00:00:14,400
Search the text, or type a
timecode like 0:12 to jump.
`;

/** Splits text around a matched range so the hit can be marked. */
function mark(text: string, range?: readonly [number, number]) {
  if (!range) return text;
  const [from, to] = range;
  return (
    <>
      {text.slice(0, from)}
      <mark className="rounded-[2px] bg-amber-200 px-0.5 text-inherit dark:bg-amber-400/30">
        {text.slice(from, to)}
      </mark>
      {text.slice(to)}
    </>
  );
}

export default function SubtitleConverter() {
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [shiftSeconds, setShiftSeconds] = useState("0");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [flashed, setFlashed] = useState<number | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const rowRefs = useRef(new Map<number, HTMLLIElement>());
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (flashTimer.current) clearTimeout(flashTimer.current);
  }, []);

  // Direction defaults to "the other one" from whatever was pasted, which is
  // what someone wants ~always, but stays overridable — shifting a file's
  // timing without changing its format is a real use.
  const detected = useMemo(
    () => (input.trim() ? detectFormat(input) : null),
    [input]
  );
  const effectiveTarget: Target = target ?? (detected === "vtt" ? "srt" : "vtt");

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      const { cues, warnings } = parseSubtitles(input);
      const offset = Math.round((Number(shiftSeconds) || 0) * 1000);
      const shifted = offset === 0 ? cues : shiftCues(cues, offset);
      return {
        ok: true as const,
        cues: shifted,
        output: effectiveTarget === "vtt" ? toVtt(shifted) : toSrt(shifted),
        warnings,
      };
    } catch (error) {
      const message =
        error instanceof SubtitleError
          ? error.line
            ? `Line ${error.line}: ${error.message}`
            : error.message
          : "Could not read this file.";
      return { ok: false as const, message };
    }
  }, [input, effectiveTarget, shiftSeconds]);

  const cues: readonly Cue[] = result?.ok ? result.cues : [];
  const matches = useMemo(() => searchCues(cues, query), [cues, query]);

  /** Marked ranges keyed by cue index, so the list highlights as you type. */
  const ranges = useMemo(() => {
    const map = new Map<number, readonly [number, number]>();
    for (const m of matches) if (m.range) map.set(m.index, m.range);
    return map;
  }, [matches]);

  const jumpTo = useCallback((match: CueMatch) => {
    const row = rowRefs.current.get(match.index);
    const list = listRef.current;
    if (!row || !list) return;

    // The search box sits with the file, in the panel above, so the list can be
    // off-screen when a suggestion is picked — and scrolling a list nobody can
    // see looks exactly like a broken button. Bring the page to it first, and
    // only when it is actually out of view, so using the search while the list
    // is already visible does not yank the page around.
    const listBox = list.getBoundingClientRect();
    const offScreen = listBox.top < 0 || listBox.bottom > window.innerHeight;
    if (offScreen) {
      list.scrollIntoView({ block: "center" });
    }

    // Then scroll within the list. Measured with rects rather than `offsetTop`,
    // which is relative to the nearest *positioned* ancestor and not to the
    // list. The list is not positioned, so the two offsets came from different
    // origins, the target went negative, and the browser clamped it to 0 — the
    // right row highlighted while the list sat still. Rect deltas have no such
    // dependency on the positioning context, and re-reading them here also
    // picks up the page scroll above.
    const rowRect = row.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    const centred =
      rowRect.top - listRect.top - (listRect.height - rowRect.height) / 2;

    // Assigned rather than `scrollTo({ behavior: "smooth" })`, which was tried
    // first and measured landing at scrollTop 0 while the same call with
    // `behavior: "auto"` reached 1791 — the smooth animation simply never ran.
    // A jump that silently does nothing is the worst outcome here.
    //
    // Instant is also the better interaction: animating past thirty-odd rows to
    // reach a search result wastes the reader's time and loses their place, and
    // the amber flash below is what actually says "it is this one". It needs no
    // prefers-reduced-motion branch for the same reason.
    list.scrollTop = list.scrollTop + centred;

    setFlashed(match.index);
    setOpen(false);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashed(null), 1600);
  }, []);

  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (matches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((i) => (i - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      jumpTo(matches[active] ?? matches[0]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const readFile = useCallback((file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setInput(String(reader.result ?? ""));
    reader.readAsText(file);
  }, []);

  const download = useCallback(() => {
    if (!result?.ok) return;
    const base = (fileName ?? "subtitles").replace(/\.[^.]+$/, "");
    const blob = new Blob([result.output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.${effectiveTarget}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, fileName, effectiveTarget]);

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone doubles as the input. One surface, not two. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file) readFile(file);
        }}
        className={cx(
          "rounded-lg border border-dashed transition-colors",
          dragging ? "border-foreground/40 bg-muted/50" : "border-border"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <ToolLabel htmlFor="subtitle-input">
            {fileName ?? "Your subtitles"}
            {detected ? (
              <span className="ml-2 font-normal text-muted-foreground">
                {detected.toUpperCase()} detected
              </span>
            ) : null}
          </ToolLabel>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="rounded-md border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              Choose file
            </button>
            <button
              type="button"
              onClick={() => {
                setInput(SAMPLE);
                setFileName(null);
              }}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Try a sample
            </button>
          </div>
        </div>

        <textarea
          id="subtitle-input"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setFileName(null);
          }}
          spellCheck={false}
          rows={6}
          placeholder="Drop a .srt or .vtt file here, or paste its contents."
          className="w-full resize-y bg-transparent p-3 font-mono text-sm outline-none placeholder:text-muted-foreground"
        />
        {/*
          Find-a-cue lives with the file it searches, in the same panel, rather
          than above the results further down. You load a subtitle file and look
          for a line in it — that is one action, and splitting it across two
          boxes made the search read as a step you take afterwards.

          The consequence is handled in `jumpTo`: the cue list it scrolls is now
          well below this box, so the page has to be brought to it first or the
          click appears to do nothing.
        */}
        {cues.length > 0 ? (
          <div className="relative border-t p-2">
            <ToolInput
              id="subtitle-search"
              type="search"
              role="combobox"
              aria-expanded={open && matches.length > 0}
              aria-controls="subtitle-suggestions"
              aria-autocomplete="list"
              aria-activedescendant={
                open && matches[active]
                  ? `cue-option-${matches[active].index}`
                  : undefined
              }
              autoComplete="off"
              value={query}
              placeholder="Find a line, or jump to a timecode like 0:12"
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => window.setTimeout(() => setOpen(false), 120)}
              onKeyDown={onSearchKeyDown}
            />

            {open && query.trim() !== "" ? (
              <ul
                id="subtitle-suggestions"
                role="listbox"
                aria-label="Matching cues"
                className="absolute left-2 right-2 z-10 mt-1 max-h-56 overflow-auto rounded-lg border bg-background shadow-md"
              >
                {matches.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    Nothing matches “{query.trim()}”.
                  </li>
                ) : (
                  matches.map((match, i) => (
                    <li
                      key={match.index}
                      id={`cue-option-${match.index}`}
                      role="option"
                      aria-selected={i === active}
                      onMouseDown={(e) => {
                        e.preventDefault(); // keep focus; blur would close first
                        jumpTo(match);
                      }}
                      onMouseEnter={() => setActive(i)}
                      className={cx(
                        "cursor-pointer px-3 py-2 text-sm",
                        i === active ? "bg-muted" : ""
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {displayTime(match.cue.start, effectiveTarget)}
                        {match.reason === "time" ? " · at this time" : ""}
                      </span>
                      <span className="mt-0.5 block truncate">
                        {mark(match.cue.text.replace(/\n/g, " "), match.range)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept=".srt,.vtt,text/plain,text/vtt"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) readFile(file);
          }}
        />
      </div>

      {/* Controls: direction and timing. Two decisions, one row. */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <ToolLabel>Convert to</ToolLabel>
          <div role="group" aria-label="Output format" className="flex gap-1">
            {(["vtt", "srt"] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={effectiveTarget === option}
                onClick={() => setTarget(option)}
                className={cx(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  effectiveTarget === option
                    ? "border-foreground/20 bg-foreground text-background"
                    : "hover:bg-muted"
                )}
              >
                .{option}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <ToolLabel htmlFor="subtitle-shift">Shift timing (seconds)</ToolLabel>
          <ToolInput
            id="subtitle-shift"
            type="number"
            step="0.1"
            value={shiftSeconds}
            onChange={(e) => setShiftSeconds(e.target.value)}
            className="w-32"
          />
        </div>
      </div>

      <div aria-live="polite">
        {result === null ? null : result.ok ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {cues.length} cue{cues.length === 1 ? "" : "s"} converted to .
                {effectiveTarget}
              </p>
              <div className="flex items-center gap-2">
                <CopyButton value={result.output} />
                <button
                  type="button"
                  onClick={download}
                  className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  Download .{effectiveTarget}
                </button>
              </div>
            </div>

            {result.warnings.length > 0 ? (
              <ul className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}

            {/* The converted file, as the list of timed rows it actually is. */}
            <ol
              ref={listRef}
              className="max-h-72 overflow-auto rounded-lg border bg-muted/30"
            >
              {cues.map((cue, index) => (
                <li
                  key={index}
                  ref={(el) => {
                    if (el) rowRefs.current.set(index, el);
                    else rowRefs.current.delete(index);
                  }}
                  className={cx(
                    "flex gap-3 border-b px-3 py-2 last:border-b-0 transition-colors duration-500",
                    flashed === index ? "bg-amber-200/40 dark:bg-amber-400/15" : ""
                  )}
                >
                  <span className="w-6 shrink-0 pt-0.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs tabular-nums text-muted-foreground">
                      {displayTime(cue.start, effectiveTarget)} →{" "}
                      {displayTime(cue.end, effectiveTarget)}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-sm">
                      {mark(cue.text, ranges.get(index)) || (
                        <span className="text-muted-foreground">(empty)</span>
                      )}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <p className="rounded-md border border-dashed px-3 py-2 text-sm">
            {result.message}
          </p>
        )}
      </div>
    </div>
  );
}
