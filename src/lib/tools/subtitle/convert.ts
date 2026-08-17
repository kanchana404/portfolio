/**
 * SubRip (.srt) and WebVTT (.vtt) conversion, and cue time shifting.
 *
 * The two formats are close enough that most converters do a find-and-replace
 * on the timestamp separator and call it done. That is wrong in four ways that
 * all produce a file which *looks* converted and silently fails in a player:
 *
 * 1. **WEBVTT header.** A .vtt file without the magic first line is rejected
 *    outright by every browser's `<track>` element. Nothing renders and there
 *    is no error in the UI.
 * 2. **Comma vs dot.** SRT writes `00:00:01,500`; WebVTT requires `.`.
 * 3. **The hour field is optional in WebVTT** (`01:30.000`) and mandatory in
 *    SRT. Reading a VTT that omits it and writing `01:30,000` as SRT yields a
 *    file whose cues are ~90 minutes late.
 * 4. **Byte order mark.** Files exported from Windows tooling frequently start
 *    with a UTF-8 BOM, which lands in front of either the index or `WEBVTT`
 *    and breaks the parse on the very first cue.
 *
 * Everything here is pure string work over a parsed intermediate — no regex
 * find-and-replace on the whole document — so a malformed cue is reported with
 * its line number rather than silently mangled.
 */

export interface Cue {
  /** Cue identifier. SRT indices are discarded; VTT text ids are preserved. */
  id?: string;
  /** Milliseconds from the start of the media. */
  start: number;
  end: number;
  /** Cue body, newlines preserved. */
  text: string;
}

export interface ParseResult {
  cues: Cue[];
  /** Non-fatal problems worth telling the user about. */
  warnings: string[];
}

export class SubtitleError extends Error {
  constructor(
    message: string,
    /** 1-based line in the input, for pointing the user at the problem. */
    readonly line?: number
  ) {
    super(message);
    this.name = "SubtitleError";
  }
}

/** Strips a UTF-8 BOM and normalises CRLF/CR to LF. */
function normalise(input: string): string {
  return input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
}

/**
 * Parses one timestamp in either dialect.
 *
 * Accepts `HH:MM:SS,mmm`, `HH:MM:SS.mmm` and WebVTT's hourless `MM:SS.mmm`.
 */
function parseTimestamp(raw: string, line: number): number {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})$/.exec(raw.trim());
  if (!m) {
    throw new SubtitleError(`"${raw.trim()}" is not a valid timestamp.`, line);
  }

  const [, h, mm, ss, frac] = m;
  const minutes = Number(mm);
  const seconds = Number(ss);

  if (minutes > 59 || seconds > 59) {
    throw new SubtitleError(
      `"${raw.trim()}" has a minute or second value above 59.`,
      line
    );
  }

  // "5" means 500ms, not 5ms — pad right, not left.
  const ms = Number(frac.padEnd(3, "0"));

  return (
    (h ? Number(h) : 0) * 3_600_000 + minutes * 60_000 + seconds * 1000 + ms
  );
}

const TIMING_LINE =
  /^([^\s]+)\s*-->\s*([^\s]+)(?:\s+(.*))?$/;

/**
 * Parses either format into cues.
 *
 * Deliberately format-agnostic: both dialects are cue blocks separated by blank
 * lines, and the only structural difference is the optional SRT index line and
 * the VTT header. Detecting rather than demanding means a mislabelled file —
 * a .srt that is really a .vtt is extremely common — still converts.
 */
export function parseSubtitles(input: string): ParseResult {
  const text = normalise(input);
  const warnings: string[] = [];

  if (text.trim() === "") {
    throw new SubtitleError("The file is empty.");
  }

  // Decided before parsing, because the two failures deserve different answers.
  // A document with no `-->` anywhere is not a broken subtitle file, it is not a
  // subtitle file — and telling someone who pasted an essay that line 2 should
  // have been a timing line is a worse answer than telling them what this tool
  // eats. Once there is at least one arrow, malformed cues get the precise
  // line-numbered error instead.
  if (!text.includes("-->")) {
    throw new SubtitleError(
      "No subtitle cues found. Check this is a .srt or .vtt file."
    );
  }

  const lines = text.split("\n");
  const cues: Cue[] = [];

  let i = 0;

  // WEBVTT header, if present. Anything on the same line (a label) is ignored,
  // as are the NOTE/STYLE/REGION blocks that may follow.
  if (/^WEBVTT/.test(lines[0] ?? "")) {
    i = 1;
  }

  while (i < lines.length) {
    // Skip blank lines and metadata blocks between cues.
    if (lines[i].trim() === "") {
      i += 1;
      continue;
    }
    if (/^(NOTE|STYLE|REGION)\b/.test(lines[i])) {
      while (i < lines.length && lines[i].trim() !== "") i += 1;
      continue;
    }

    let id: string | undefined;

    // A line that is not a timing line is either an SRT index or a VTT cue id.
    if (!TIMING_LINE.test(lines[i])) {
      const candidate = lines[i].trim();
      // Pure digits is an SRT index: positional, meaningless once parsed, and
      // regenerated on write. A non-numeric id is a real WebVTT identifier and
      // is worth keeping.
      if (!/^\d+$/.test(candidate)) id = candidate;
      i += 1;

      if (i >= lines.length) {
        throw new SubtitleError(
          "The file ends after a cue heading with no timing line.",
          i
        );
      }
    }

    const timing = TIMING_LINE.exec(lines[i]);
    if (!timing) {
      throw new SubtitleError(
        `Expected a timing line like "00:00:01,000 --> 00:00:04,000".`,
        i + 1
      );
    }

    const start = parseTimestamp(timing[1], i + 1);
    const end = parseTimestamp(timing[2], i + 1);

    if (end < start) {
      warnings.push(
        `Cue ${cues.length + 1} ends before it starts; times were swapped.`
      );
    }

    i += 1;

    const body: string[] = [];
    while (i < lines.length && lines[i].trim() !== "") {
      body.push(lines[i]);
      i += 1;
    }

    cues.push({
      id,
      start: Math.min(start, end),
      end: Math.max(start, end),
      text: body.join("\n").trim(),
    });
  }

  if (cues.length === 0) {
    throw new SubtitleError(
      "No subtitle cues found. Check this is a .srt or .vtt file."
    );
  }

  const empty = cues.filter((c) => c.text === "").length;
  if (empty > 0) {
    warnings.push(`${empty} cue${empty === 1 ? " has" : "s have"} no text.`);
  }

  return { cues, warnings };
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

function formatTimestamp(ms: number, separator: "," | "."): string {
  const clamped = Math.max(0, Math.round(ms));
  const h = Math.floor(clamped / 3_600_000);
  const m = Math.floor((clamped % 3_600_000) / 60_000);
  const s = Math.floor((clamped % 60_000) / 1000);
  const frac = clamped % 1000;
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${separator}${pad(frac, 3)}`;
}

/** Serialises cues as SubRip. Indices are regenerated from position. */
export function toSrt(cues: readonly Cue[]): string {
  return (
    cues
      .map((cue, index) => {
        const time = `${formatTimestamp(cue.start, ",")} --> ${formatTimestamp(cue.end, ",")}`;
        return `${index + 1}\n${time}\n${cue.text}`;
      })
      .join("\n\n") + "\n"
  );
}

/** Serialises cues as WebVTT, including the mandatory header. */
export function toVtt(cues: readonly Cue[]): string {
  const blocks = cues.map((cue) => {
    const time = `${formatTimestamp(cue.start, ".")} --> ${formatTimestamp(cue.end, ".")}`;
    return cue.id ? `${cue.id}\n${time}\n${cue.text}` : `${time}\n${cue.text}`;
  });
  return `WEBVTT\n\n${blocks.join("\n\n")}\n`;
}

/**
 * Shifts every cue by `offsetMs`.
 *
 * Negative offsets clamp at zero rather than going negative, because a cue at a
 * negative timestamp is not representable in either format and players differ
 * on whether they skip it or refuse the file.
 */
export function shiftCues(cues: readonly Cue[], offsetMs: number): Cue[] {
  return cues.map((cue) => ({
    ...cue,
    start: Math.max(0, cue.start + offsetMs),
    end: Math.max(0, cue.end + offsetMs),
  }));
}

/** Detects which format a document is, for choosing the output direction. */
export function detectFormat(input: string): "vtt" | "srt" {
  return /^﻿?WEBVTT/.test(input) ? "vtt" : "srt";
}

export interface CueMatch {
  /** Position in the cue array, so the caller can scroll to it. */
  index: number;
  cue: Cue;
  /** `[start, end)` character range inside `cue.text` that matched a text query. */
  range?: readonly [number, number];
  reason: "text" | "time";
}

/**
 * Parses a timecode *query* — deliberately looser than `parseTimestamp`.
 *
 * Someone looking for the line around ninety seconds types `1:30`, not
 * `00:01:30,000`. Accepts `M:SS`, `MM:SS`, `H:MM:SS` and an optional
 * `.mmm`/`,mmm` tail.
 *
 * A colon is required. Without one, `90` would be a time query *and* a
 * perfectly ordinary thing to search for in the subtitle text, and guessing
 * wrong silently returns the wrong cue.
 */
export function parseTimeQuery(query: string): number | null {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(query.trim());
  if (!m) return null;

  const [, h, mm, ss, frac] = m;
  const minutes = Number(mm);
  const seconds = Number(ss);
  if (minutes > 59 || seconds > 59) return null;

  return (
    (h ? Number(h) : 0) * 3_600_000 +
    minutes * 60_000 +
    seconds * 1000 +
    (frac ? Number(frac.padEnd(3, "0")) : 0)
  );
}

/**
 * Finds cues matching a query, for the jump-to-cue box.
 *
 * Two query kinds, chosen by shape rather than by a mode toggle the user would
 * have to think about:
 *
 * - **A timecode** (`1:30`) returns the cue playing at that moment, or the next
 *   one if the timestamp falls in a gap between cues. Returning nothing for a
 *   time that lands in silence would look broken.
 * - **Anything else** is a case-insensitive substring search over cue text,
 *   returning the character range so the caller can mark the hit rather than
 *   just highlighting the whole line.
 *
 * Newlines inside a cue are flattened to spaces before matching, so a phrase
 * broken across two displayed rows — which is most of them — is still found.
 */
export function searchCues(
  cues: readonly Cue[],
  query: string,
  limit = 8
): CueMatch[] {
  const trimmed = query.trim();
  if (trimmed === "") return [];

  const time = parseTimeQuery(trimmed);
  if (time !== null) {
    const playing = cues.findIndex((c) => time >= c.start && time <= c.end);
    const index = playing === -1 ? cues.findIndex((c) => c.start >= time) : playing;
    return index === -1 ? [] : [{ index, cue: cues[index], reason: "time" }];
  }

  const needle = trimmed.toLowerCase();
  const matches: CueMatch[] = [];

  for (let i = 0; i < cues.length && matches.length < limit; i += 1) {
    const cue = cues[i];
    // Flattened for searching, but the offset still points into the original
    // string: replacing newlines with spaces is length-preserving.
    const haystack = cue.text.replace(/\n/g, " ").toLowerCase();
    const at = haystack.indexOf(needle);
    if (at !== -1) {
      matches.push({
        index: i,
        cue,
        range: [at, at + needle.length] as const,
        reason: "text",
      });
    }
  }

  return matches;
}

/** Formats a cue time for display, in the dialect being written. */
export function displayTime(ms: number, format: "srt" | "vtt"): string {
  return formatTimestamp(ms, format === "srt" ? "," : ".");
}
