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
 * SRT <-> VTT converter and cue editor.
 *
 * Statically imported like every other widget here: pure string work, no
 * dependency, nothing to defer. `lazyWidget` is for the WASM tools.
 *
 * ## One panel, because finding a line and fixing it is one job
 *
 * This had two: a raw textarea you pasted into, and a read-only list of the
 * converted result below it. Searching found the line in the lower one and then
 * left you to hunt for it again in the upper one to change anything, which is
 * the whole task and the part that did not work.
 *
 * So the list *is* the input. Each cue's text is an editable field, edits flow
 * straight into what Copy and Download produce, and jumping to a search hit
 * focuses that field with the matched word already selected — type and it is
 * replaced. The raw textarea only exists in the empty state, where there is
 * nothing to edit yet.
 *
 * Cue numbers are not shown. SRT indices are positional and regenerated on
 * write, so displaying them invites someone to treat them as data.
 */

type Target = "vtt" | "srt";

const SAMPLE = `1
00:00:01,000 --> 00:00:04,000
Drop a file, or paste here.

2
00:00:05,500 --> 00:00:09,250
Edit any line right in the list.

3
00:00:11,000 --> 00:00:14,400
Search a word to jump to it,
or type a timecode like 0:12.
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
  /** Raw text, used only until it parses. */
  const [raw, setRaw] = useState("");
  /** The document being edited. Null until something parses. */
  const [cues, setCues] = useState<Cue[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const [sourceFormat, setSourceFormat] = useState<Target | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [shiftSeconds, setShiftSeconds] = useState("0");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const [flashed, setFlashed] = useState<number | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef(new Map<number, HTMLDivElement>());
  const fieldRefs = useRef(new Map<number, HTMLTextAreaElement>());
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
    },
    []
  );

  const load = useCallback((text: string) => {
    setRaw(text);
    if (text.trim() === "") {
      setCues(null);
      setParseError(null);
      setWarnings([]);
      return;
    }
    try {
      const parsed = parseSubtitles(text);
      setCues(parsed.cues);
      setWarnings(parsed.warnings);
      setParseError(null);
      setSourceFormat(detectFormat(text));
    } catch (error) {
      setCues(null);
      setWarnings([]);
      setParseError(
        error instanceof SubtitleError
          ? error.line
            ? `Line ${error.line}: ${error.message}`
            : error.message
          : "Could not read this file."
      );
    }
  }, []);

  // Target defaults to "the other one", but stays overridable — shifting a
  // file's timing without changing its format is a real use.
  const effectiveTarget: Target = target ?? (sourceFormat === "vtt" ? "srt" : "vtt");

  const offsetMs = Math.round((Number(shiftSeconds) || 0) * 1000);

  /**
   * What gets written out. The shift is a view over the edited cues rather than
   * a mutation of them, so it stays adjustable and edits keep landing on the
   * base document. Order is untouched, so indices still line up.
   */
  const outCues = useMemo(
    () => (cues === null ? [] : offsetMs === 0 ? cues : shiftCues(cues, offsetMs)),
    [cues, offsetMs]
  );

  const output = useMemo(
    () => (effectiveTarget === "vtt" ? toVtt(outCues) : toSrt(outCues)),
    [outCues, effectiveTarget]
  );

  const matches = useMemo(() => searchCues(outCues, query), [outCues, query]);
  const matched = useMemo(() => new Set(matches.map((m) => m.index)), [matches]);

  const editCue = useCallback((index: number, text: string) => {
    setCues((current) =>
      current === null
        ? current
        : current.map((cue, i) => (i === index ? { ...cue, text } : cue))
    );
  }, []);

  const jumpTo = useCallback((match: CueMatch) => {
    const row = rowRefs.current.get(match.index);
    const list = listRef.current;
    if (!row || !list) return;

    // Bring the page to the list only when it is actually off-screen, so using
    // the search while it is already visible does not yank the page around.
    const listBox = list.getBoundingClientRect();
    if (listBox.top < 0 || listBox.bottom > window.innerHeight) {
      list.scrollIntoView({ block: "center" });
    }

    // Rects, not `offsetTop` — that is relative to the nearest *positioned*
    // ancestor rather than to the list, which put the two measurements on
    // different origins and produced a negative target the browser clamped to
    // 0. Re-read here so they also account for the page scroll above.
    const rowRect = row.getBoundingClientRect();
    const listRect = list.getBoundingClientRect();
    list.scrollTop +=
      rowRect.top - listRect.top - (listRect.height - rowRect.height) / 2;

    // The point of the jump: put the caret on the matched word with it already
    // selected, so the next keystroke replaces it. Finding a line you cannot
    // then edit was the original complaint.
    const field = fieldRefs.current.get(match.index);
    if (field && match.range) {
      field.focus({ preventScroll: true });
      field.setSelectionRange(match.range[0], match.range[1]);
    }

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

  const readFile = useCallback(
    (file: File) => {
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => load(String(reader.result ?? ""));
      reader.readAsText(file);
    },
    [load]
  );

  const download = useCallback(() => {
    const base = (fileName ?? "subtitles").replace(/\.[^.]+$/, "");
    const blob = new Blob([output], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${base}.${effectiveTarget}`;
    a.click();
    URL.revokeObjectURL(url);
  }, [output, fileName, effectiveTarget]);

  const clear = useCallback(() => {
    setRaw("");
    setCues(null);
    setParseError(null);
    setWarnings([]);
    setFileName(null);
    setQuery("");
    fieldRefs.current.clear();
    rowRefs.current.clear();
  }, []);

  const loaded = cues !== null;

  return (
    <div className="flex flex-col gap-4">
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
          "rounded-lg border transition-colors",
          loaded ? "" : "border-dashed",
          dragging ? "border-foreground/40 bg-muted/50" : "border-border"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <ToolLabel htmlFor={loaded ? "subtitle-search" : "subtitle-input"}>
            <span className="max-w-[22ch] truncate align-bottom sm:max-w-none">
              {fileName ?? "Your subtitles"}
            </span>
            {sourceFormat && loaded ? (
              <span className="ml-2 font-normal text-muted-foreground">
                {sourceFormat.toUpperCase()} detected · {outCues.length} cues
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
            {loaded ? (
              <button
                type="button"
                onClick={clear}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setFileName(null);
                  load(SAMPLE);
                }}
                className="rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Try a sample
              </button>
            )}
          </div>
        </div>

        {loaded ? (
          <>
            {/* Search sits with the cues it searches and edits. */}
            <div className="relative border-b p-2">
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
                placeholder="Find a word to edit, or jump to a timecode like 0:12"
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

            {/* The document itself: every line editable in place. */}
            <div ref={listRef} className="max-h-[26rem] overflow-auto rounded-b-lg">
              {outCues.map((cue, index) => (
                <div
                  key={index}
                  ref={(el) => {
                    if (el) rowRefs.current.set(index, el);
                    else rowRefs.current.delete(index);
                  }}
                  className={cx(
                    "border-b px-3 py-2 last:border-b-0 transition-colors duration-500",
                    flashed === index
                      ? "bg-amber-200/40 dark:bg-amber-400/15"
                      : matched.has(index)
                        ? "bg-muted/60"
                        : ""
                  )}
                >
                  <p className="font-mono text-xs tabular-nums text-muted-foreground">
                    {displayTime(cue.start, effectiveTarget)} →{" "}
                    {displayTime(cue.end, effectiveTarget)}
                  </p>
                  <textarea
                    ref={(el) => {
                      if (el) fieldRefs.current.set(index, el);
                      else fieldRefs.current.delete(index);
                    }}
                    value={cue.text}
                    onChange={(e) => editCue(index, e.target.value)}
                    spellCheck={false}
                    rows={Math.max(1, cue.text.split("\n").length)}
                    aria-label={`Cue at ${displayTime(cue.start, effectiveTarget)}`}
                    className="mt-0.5 w-full resize-none bg-transparent text-sm outline-none focus:ring-0"
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <textarea
              id="subtitle-input"
              value={raw}
              onChange={(e) => {
                setFileName(null);
                load(e.target.value);
              }}
              spellCheck={false}
              rows={8}
              placeholder="Drop a .srt or .vtt file here, or paste its contents."
              className="w-full resize-y bg-transparent p-3 font-mono text-sm outline-none placeholder:text-muted-foreground"
            />
            {parseError ? (
              <p className="border-t px-3 py-2 text-sm">{parseError}</p>
            ) : null}
          </>
        )}

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

      {loaded ? (
        <>
          {warnings.length > 0 ? (
            <ul className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}

          <div className="flex flex-wrap items-end justify-between gap-4">
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
                <ToolLabel htmlFor="subtitle-shift">
                  Shift timing (seconds)
                </ToolLabel>
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

            <div className="flex items-center gap-2">
              <CopyButton value={output} />
              <button
                type="button"
                onClick={download}
                className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
              >
                Download .{effectiveTarget}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
