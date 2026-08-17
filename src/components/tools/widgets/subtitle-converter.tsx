"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import {
  SubtitleError,
  detectFormat,
  parseSubtitles,
  shiftCues,
  toSrt,
  toVtt,
} from "@/lib/tools/subtitle/convert";
import { CopyButton } from "../copy-button";
import { ToolInput, ToolLabel, cx } from "../ui";

/**
 * SRT <-> VTT converter.
 *
 * Statically imported like every other widget here: it is pure string work with
 * no dependency, so there is nothing to defer and `lazyWidget` would cost a
 * chunk request to save nothing. `lazyWidget` is for the WASM tools.
 *
 * The UI is deliberately one column and four controls. A converter is used
 * once, by someone who arrived from a search result with a file already in
 * hand — every element that is not "put it in, take it out" is in the way.
 */

type Target = "vtt" | "srt";

const SAMPLE = `1
00:00:01,000 --> 00:00:04,000
Drop a file, or paste here.

2
00:00:05,500 --> 00:00:09,250
Both directions work.
`;

export default function SubtitleConverter() {
  const [input, setInput] = useState("");
  const [target, setTarget] = useState<Target | null>(null);
  const [shiftSeconds, setShiftSeconds] = useState("0");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Direction defaults to "the other one" from whatever was pasted, which is
  // what someone wants ~always, but stays overridable — shifting a file's
  // timing without changing its format is a real use.
  const detected = useMemo(
    () => (input.trim() ? detectFormat(input) : null),
    [input]
  );
  const effectiveTarget: Target =
    target ?? (detected === "vtt" ? "srt" : "vtt");

  const result = useMemo(() => {
    if (!input.trim()) return null;
    try {
      const { cues, warnings } = parseSubtitles(input);
      const offset = Math.round((Number(shiftSeconds) || 0) * 1000);
      const shifted = offset === 0 ? cues : shiftCues(cues, offset);
      return {
        ok: true as const,
        output: effectiveTarget === "vtt" ? toVtt(shifted) : toSrt(shifted),
        count: cues.length,
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
          rows={8}
          placeholder="Drop a .srt or .vtt file here, or paste its contents."
          className="w-full resize-y bg-transparent p-3 font-mono text-sm outline-none placeholder:text-muted-foreground"
        />
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

      {/* Output. aria-live so a screen reader hears the result appear. */}
      <div aria-live="polite">
        {result === null ? null : result.ok ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {result.count} cue{result.count === 1 ? "" : "s"} converted to{" "}
                .{effectiveTarget}
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

            <pre className="max-h-64 overflow-auto rounded-lg border bg-muted/30 p-3 font-mono text-sm">
              {result.output}
            </pre>
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
