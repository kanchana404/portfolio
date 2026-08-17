import type { ToolDef } from "../types";

/** Subtitle and video tools. */
export const VIDEO_TOOLS: readonly ToolDef[] = [
  {
    slug: "srt-to-vtt",
    title: "SRT to VTT Converter",
    metaTitle: "SRT to VTT Converter (and VTT to SRT)",
    description:
      "Convert subtitles between SRT and WebVTT, and shift their timing, " +
      "without uploading the file. Adds the WEBVTT header players require.",
    category: "video",
    audience: ["general", "developers"],
    compute: "browser",
    status: "stable",
    publishedAt: "2026-08-17",
    updatedAt: "2026-08-17",
    keywords: [
      "srt to vtt",
      "vtt to srt",
      "subtitle converter",
      "convert srt to webvtt",
      "subtitle timing shift",
      "srt converter online",
    ],
    intro:
      "Drop in an SRT or WebVTT file and get the other format back. Both " +
      "directions work, timing can be shifted at the same time, and the file " +
      "never leaves your browser.",
    howToUse: [
      "Drop your .srt or .vtt file in, or paste its contents.",
      "The format you gave it is detected, and the other one is preselected.",
      "To fix subtitles that run early or late, set a shift in seconds — negative moves them earlier.",
      "Copy the result, or download it with the right extension.",
    ],
    faqs: [
      {
        q: "Why doesn't my VTT file work in a browser video player?",
        a: "Almost always a missing WEBVTT header. The format requires that exact word on the first line, and a converter that only swaps commas for dots leaves it out. Nothing renders and no error appears.",
      },
      {
        q: "What is the actual difference between SRT and VTT?",
        a: "WebVTT uses a dot before milliseconds, allows an optional hour field, and supports styling and cue identifiers. SRT uses a comma, always writes the hour, and numbers its cues.",
      },
      {
        q: "Can it fix subtitles that are out of sync?",
        a: "Yes, if they are off by a constant amount. Set the shift in seconds and every cue moves together. Subtitles that drift further out as the video plays are a frame-rate mismatch and need rescaling instead.",
      },
      {
        q: "Is my file uploaded anywhere?",
        a: "No. The conversion is JavaScript running on this page, so the file is read by your own browser and no copy is sent to a server.",
      },
    ],
    related: ["word-counter", "text-diff-checker"],
  },
];
