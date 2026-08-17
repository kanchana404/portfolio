import { describe, expect, it } from "vitest";
import {
  SubtitleError,
  detectFormat,
  parseSubtitles,
  shiftCues,
  toSrt,
  toVtt,
} from "./convert";

const SRT = `1
00:00:01,000 --> 00:00:04,000
Hello there.

2
00:00:05,500 --> 00:00:09,250
Second line
spans two rows.
`;

const VTT = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello there.

00:00:05.500 --> 00:00:09.250
Second line
spans two rows.
`;

describe("parsing", () => {
  it("reads SRT", () => {
    const { cues } = parseSubtitles(SRT);
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ start: 1000, end: 4000, text: "Hello there." });
    expect(cues[1].text).toBe("Second line\nspans two rows.");
  });

  it("reads WebVTT", () => {
    const { cues } = parseSubtitles(VTT);
    expect(cues).toHaveLength(2);
    expect(cues[1]).toMatchObject({ start: 5500, end: 9250 });
  });

  it("accepts the hourless WebVTT timestamp", () => {
    // MM:SS.mmm is legal in WebVTT and means what it says — not an hour offset.
    const { cues } = parseSubtitles("WEBVTT\n\n01:30.000 --> 01:32.000\nHi\n");
    expect(cues[0].start).toBe(90_000);
  });

  it("pads a short fractional part to the right", () => {
    // ",5" is 500ms. Padding left would make it 5ms and desync the whole file.
    const { cues } = parseSubtitles("1\n00:00:01,5 --> 00:00:02,25\nHi\n");
    expect(cues[0].start).toBe(1500);
    expect(cues[0].end).toBe(2250);
  });

  it("strips a UTF-8 BOM", () => {
    const { cues } = parseSubtitles("﻿" + SRT);
    expect(cues).toHaveLength(2);
  });

  it("handles CRLF line endings", () => {
    const { cues } = parseSubtitles(SRT.replace(/\n/g, "\r\n"));
    expect(cues).toHaveLength(2);
    expect(cues[0].text).toBe("Hello there.");
  });

  it("keeps a WebVTT cue identifier but discards an SRT index", () => {
    const { cues } = parseSubtitles(
      "WEBVTT\n\nintro\n00:00:01.000 --> 00:00:02.000\nHi\n"
    );
    expect(cues[0].id).toBe("intro");
    expect(parseSubtitles(SRT).cues[0].id).toBeUndefined();
  });

  it("skips NOTE, STYLE and REGION blocks", () => {
    const { cues } = parseSubtitles(
      "WEBVTT\n\nNOTE this is a comment\nspanning lines\n\n" +
        "STYLE\n::cue { color: red }\n\n" +
        "00:00:01.000 --> 00:00:02.000\nHi\n"
    );
    expect(cues).toHaveLength(1);
    expect(cues[0].text).toBe("Hi");
  });

  it("parses a file whose extension lied about its format", () => {
    // A .srt that is really a WebVTT is extremely common; it should still work.
    expect(parseSubtitles(VTT).cues).toHaveLength(2);
  });
});

describe("parse failures name the problem", () => {
  it("rejects an empty file", () => {
    expect(() => parseSubtitles("   ")).toThrow(/empty/i);
  });

  it("rejects a file with no cues", () => {
    expect(() => parseSubtitles("just some prose\n")).toThrow(/no subtitle cues/i);
  });

  it("reports a bad timestamp with its line number", () => {
    try {
      parseSubtitles("1\n00:00:01,000 --> 99:99\nHi\n");
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(SubtitleError);
      expect((error as SubtitleError).line).toBe(2);
    }
  });

  it("rejects a minute or second above 59", () => {
    expect(() => parseSubtitles("1\n00:75:00,000 --> 00:76:00,000\nHi\n")).toThrow(
      /above 59/
    );
  });
});

describe("warnings rather than failures", () => {
  it("swaps a cue that ends before it starts", () => {
    const { cues, warnings } = parseSubtitles(
      "1\n00:00:04,000 --> 00:00:01,000\nBackwards\n"
    );
    expect(cues[0]).toMatchObject({ start: 1000, end: 4000 });
    expect(warnings[0]).toMatch(/ends before it starts/);
  });

  it("counts empty cues", () => {
    const { warnings } = parseSubtitles(
      "1\n00:00:01,000 --> 00:00:02,000\n\n2\n00:00:03,000 --> 00:00:04,000\nHi\n"
    );
    expect(warnings.some((w) => /no text/.test(w))).toBe(true);
  });
});

describe("serialising", () => {
  it("writes the WEBVTT header", () => {
    // Without it every browser <track> silently renders nothing.
    expect(toVtt(parseSubtitles(SRT).cues).startsWith("WEBVTT\n")).toBe(true);
  });

  it("writes SRT with commas and VTT with dots", () => {
    const { cues } = parseSubtitles(SRT);
    expect(toSrt(cues)).toContain("00:00:01,000 --> 00:00:04,000");
    expect(toVtt(cues)).toContain("00:00:01.000 --> 00:00:04.000");
  });

  it("always writes the hour field", () => {
    const { cues } = parseSubtitles("WEBVTT\n\n01:30.000 --> 01:32.000\nHi\n");
    expect(toSrt(cues)).toContain("00:01:30,000");
  });

  it("renumbers SRT indices from position", () => {
    const { cues } = parseSubtitles(
      "7\n00:00:01,000 --> 00:00:02,000\nA\n\n99\n00:00:03,000 --> 00:00:04,000\nB\n"
    );
    const out = toSrt(cues);
    expect(out.startsWith("1\n")).toBe(true);
    expect(out).toContain("\n2\n");
  });

  it("round-trips SRT -> VTT -> SRT unchanged", () => {
    const once = toSrt(parseSubtitles(SRT).cues);
    const twice = toSrt(parseSubtitles(toVtt(parseSubtitles(once).cues)).cues);
    expect(twice).toBe(once);
  });
});

describe("shifting", () => {
  it("moves every cue", () => {
    const shifted = shiftCues(parseSubtitles(SRT).cues, 2000);
    expect(shifted[0]).toMatchObject({ start: 3000, end: 6000 });
  });

  it("clamps at zero rather than going negative", () => {
    // A negative timestamp is not representable and players disagree on it.
    const shifted = shiftCues(parseSubtitles(SRT).cues, -5000);
    expect(shifted[0].start).toBe(0);
    expect(shifted[0].end).toBe(0);
  });
});

describe("format detection", () => {
  it("recognises WebVTT, with or without a BOM", () => {
    expect(detectFormat(VTT)).toBe("vtt");
    expect(detectFormat("﻿" + VTT)).toBe("vtt");
  });

  it("treats anything else as SRT", () => {
    expect(detectFormat(SRT)).toBe("srt");
  });
});
