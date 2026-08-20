"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ToolInput, ToolLabel, ToolTextarea, cx } from "@/components/tools/ui";
import { REGEX_FLAGS, type Match, compile } from "@/lib/tools/dev/regex";
import type { MatchResponse } from "@/lib/tools/dev/regex.worker";

const DEFAULT_PATTERN = "(\\w+)@(\\w+)\\.com";
const DEFAULT_INPUT =
  "Write to sam@example.com or to the team at hello@usecortana.com.\nOld address: nobody@example.org";

/** How long a pattern gets before the thread running it is killed. */
const TIMEOUT_MS = 1000;

export default function RegexTester() {
  const id = useId();
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [flags, setFlags] = useState("g");
  const [input, setInput] = useState(DEFAULT_INPUT);
  const [matches, setMatches] = useState<Match[]>([]);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const worker = useRef<Worker | null>(null);

  const status = compile(pattern, flags);

  const run = useCallback(() => {
    setRuntimeError(null);
    setTimedOut(false);
    if (!status.ok) {
      setMatches([]);
      return;
    }

    // A fresh worker per run. Terminating is the only way to stop a regex that
    // is backtracking, and a terminated worker cannot be reused.
    worker.current?.terminate();
    let done = false;
    let w: Worker;
    try {
      w = new Worker(new URL("@/lib/tools/dev/regex.worker.ts", import.meta.url), {
        type: "module",
      });
    } catch {
      // No workers available. Refusing is the honest option: running this
      // inline is exactly the freeze the worker exists to prevent.
      setRuntimeError("This browser does not allow workers, so matching is disabled here.");
      return;
    }
    worker.current = w;

    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      w.terminate();
      setMatches([]);
      setTimedOut(true);
    }, TIMEOUT_MS);

    w.onmessage = (event: MessageEvent<MatchResponse>) => {
      done = true;
      clearTimeout(timer);
      if (event.data.ok) setMatches(event.data.matches);
      else setRuntimeError(event.data.message);
      w.terminate();
    };

    w.postMessage({ pattern, flags, input, limit: 1000 });
  }, [pattern, flags, input, status.ok]);

  useEffect(() => {
    const t = setTimeout(run, 150);
    return () => clearTimeout(t);
  }, [run]);

  useEffect(() => () => worker.current?.terminate(), []);

  const toggle = (f: string) =>
    setFlags((c) => (c.includes(f) ? c.replace(f, "") : c + f));

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="border-b p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-p`}>Pattern</ToolLabel>
        <ToolInput
          id={`${id}-p`}
          value={pattern}
          spellCheck={false}
          onChange={(e) => setPattern(e.target.value)}
          className="mt-2 font-mono"
        />
        <div role="group" aria-label="Flags" className="mt-3 flex flex-wrap gap-2">
          {REGEX_FLAGS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={flags.includes(f.id)}
              title={f.note}
              onClick={() => toggle(f.id)}
              className={cx(
                "inline-flex h-7 items-center rounded-sm border px-2.5 text-xs font-medium transition-colors",
                flags.includes(f.id)
                  ? "border-foreground/20 bg-muted text-foreground"
                  : "text-muted-foreground hover:border-foreground/20 hover:text-foreground"
              )}
            >
              {f.id} {f.label}
            </button>
          ))}
        </div>
        {!status.ok ? (
          <p className="mt-3 text-sm text-muted-foreground">{status.error}</p>
        ) : status.warning ? (
          <p className="mt-3 max-w-prose text-xs text-muted-foreground">
            {status.warning}
          </p>
        ) : null}
      </div>

      <div className="border-b p-4 sm:p-5">
        <ToolLabel htmlFor={`${id}-in`}>Test against</ToolLabel>
        <ToolTextarea
          id={`${id}-in`}
          rows={5}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="mt-2"
        />
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        {timedOut ? (
          <p className="max-w-prose text-sm text-muted-foreground">
            This pattern took longer than a second and was stopped. That is
            catastrophic backtracking, and a program using this pattern on this
            input would not have recovered.
          </p>
        ) : runtimeError ? (
          <p className="text-sm text-muted-foreground">{runtimeError}</p>
        ) : !status.ok ? null : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">No matches.</p>
        ) : (
          <>
            <p className="text-xs tabular-nums text-muted-foreground">
              {matches.length} match{matches.length === 1 ? "" : "es"}
            </p>
            <ul className="mt-2 max-h-72 overflow-auto">
              {matches.map((m, i) => (
                <li
                  key={`${m.index}-${i}`}
                  className={cx(
                    "flex min-h-11 items-start gap-3 py-1.5",
                    i > 0 && "border-t border-border/60"
                  )}
                >
                  <span className="w-12 shrink-0 pt-0.5 text-xs tabular-nums text-muted-foreground">
                    {m.index}
                  </span>
                  <span className="min-w-0 flex-1 break-all font-mono text-sm">
                    {m.text || "(empty match)"}
                    {m.groups.length > 0 ? (
                      <span className="block text-xs text-muted-foreground">
                        {m.groups.map((g, gi) => `${gi + 1}: ${g ?? "—"}`).join("   ")}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
