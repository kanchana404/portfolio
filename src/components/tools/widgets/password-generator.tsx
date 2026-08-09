"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolInput, ToolLabel, cx } from "@/components/tools/ui";
import {
  CHARSETS,
  type CharsetOption,
  type PasswordResult,
  describeStrength,
  generatePassphrase,
  generatePassword,
} from "@/lib/tools/dev/password";

type Mode = "password" | "passphrase";

const BAND_STYLE: Record<string, string> = {
  weak: "text-destructive",
  fair: "text-amber-600",
  strong: "text-emerald-600",
  excellent: "text-emerald-600",
};

const BAND_WIDTH: Record<string, string> = {
  weak: "w-1/4",
  fair: "w-2/4",
  strong: "w-3/4",
  excellent: "w-full",
};

const BAND_BAR: Record<string, string> = {
  weak: "bg-destructive",
  fair: "bg-amber-500",
  strong: "bg-emerald-500",
  excellent: "bg-emerald-600",
};

export default function PasswordGenerator() {
  const id = useId();
  const [mode, setMode] = useState<Mode>("password");
  const [length, setLength] = useState(20);
  const [charsets, setCharsets] = useState<Array<CharsetOption["id"]>>([
    "lower",
    "upper",
    "digits",
    "symbols",
  ]);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false);

  const [words, setWords] = useState(4);
  const [separator, setSeparator] = useState("-");
  const [capitalise, setCapitalise] = useState(true);
  const [appendNumber, setAppendNumber] = useState(true);

  const [result, setResult] = useState<PasswordResult | null>(null);

  const regenerate = useCallback(() => {
    setResult(
      mode === "password"
        ? generatePassword({ length, charsets, excludeAmbiguous })
        : generatePassphrase({ words, separator, capitalise, appendNumber })
    );
  }, [
    mode,
    length,
    charsets,
    excludeAmbiguous,
    words,
    separator,
    capitalise,
    appendNumber,
  ]);

  // Generated after mount only. The value comes from crypto.getRandomValues, so
  // a server render would produce a different string from the client's first
  // render and React would report a hydration mismatch.
  useEffect(() => {
    regenerate();
  }, [regenerate]);

  const strength = result ? describeStrength(result.bits) : null;
  const nothingSelected = mode === "password" && charsets.length === 0;

  const toggleCharset = (charsetId: CharsetOption["id"]) => {
    setCharsets((current) =>
      current.includes(charsetId)
        ? current.filter((c) => c !== charsetId)
        : [...current, charsetId]
    );
  };

  return (
    <div className="rounded-lg border">
      <div className="flex flex-wrap items-center gap-2 border-b p-4 sm:p-5">
        <div role="group" aria-label="Kind of secret" className="flex gap-2">
          {(
            [
              ["password", "Password"],
              ["passphrase", "Passphrase"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cx(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                mode === m
                  ? "border-foreground bg-foreground text-background"
                  : "hover:border-foreground/30"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 sm:p-5" aria-live="polite">
        {nothingSelected ? (
          <p className="text-sm text-destructive">
            Pick at least one character set.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <p className="min-w-0 flex-1 break-all font-mono text-lg sm:text-xl">
                {result?.password ?? (
                  <span className="text-muted-foreground">Generating…</span>
                )}
              </p>
              {result ? <CopyButton value={result.password} /> : null}
            </div>

            {strength && result ? (
              <div className="mt-4">
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                  role="presentation"
                >
                  <div
                    className={cx(
                      "h-full rounded-full transition-all",
                      BAND_WIDTH[strength.band],
                      BAND_BAR[strength.band]
                    )}
                  />
                </div>
                <p className="mt-2 text-sm">
                  <span className={cx("font-medium", BAND_STYLE[strength.band])}>
                    {strength.label}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {Math.round(result.bits)} bits of entropy · about{" "}
                    {strength.crackTime} to crack offline
                  </span>
                </p>
              </div>
            ) : null}
          </>
        )}

        <button
          type="button"
          onClick={regenerate}
          className="mt-4 rounded-md border px-3 py-2 text-xs font-medium transition-colors hover:border-foreground/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Generate another
        </button>
      </div>

      {mode === "password" ? (
        <div className="border-t p-4 sm:p-5">
          <ToolLabel htmlFor={`${id}-length`}>Length · {length} characters</ToolLabel>
          <input
            id={`${id}-length`}
            type="range"
            min={8}
            max={64}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="mt-2 w-full accent-foreground"
          />

          <div
            role="group"
            aria-label="Character sets"
            className="mt-4 flex flex-wrap gap-2"
          >
            {CHARSETS.map((set) => (
              <button
                key={set.id}
                type="button"
                aria-pressed={charsets.includes(set.id)}
                onClick={() => toggleCharset(set.id)}
                className={cx(
                  "rounded-full border px-3 py-1.5 font-mono text-xs transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
                  charsets.includes(set.id)
                    ? "border-foreground bg-foreground text-background"
                    : "hover:border-foreground/30"
                )}
              >
                {set.label}
              </button>
            ))}
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={excludeAmbiguous}
              onChange={(e) => setExcludeAmbiguous(e.target.checked)}
              className="size-4"
            />
            Leave out look-alikes (l I 1 O 0 o)
          </label>
          <p className="mt-1 text-xs text-muted-foreground">
            Worth it for something you will read off a screen and type. A pure
            loss for anything going straight into a password manager — every
            character removed is entropy removed.
          </p>
        </div>
      ) : (
        <div className="border-t p-4 sm:p-5">
          <div className="flex flex-wrap gap-4">
            <div className="w-28">
              <ToolLabel htmlFor={`${id}-words`} className="text-xs">
                Words
              </ToolLabel>
              <ToolInput
                id={`${id}-words`}
                type="number"
                min={2}
                max={12}
                value={words}
                onChange={(e) => setWords(Number(e.target.value))}
                className="mt-1 h-9"
              />
            </div>
            <div className="w-28">
              <ToolLabel htmlFor={`${id}-separator`} className="text-xs">
                Separator
              </ToolLabel>
              <ToolInput
                id={`${id}-separator`}
                value={separator}
                maxLength={3}
                onChange={(e) => setSeparator(e.target.value)}
                className="mt-1 h-9 font-mono"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={capitalise}
                onChange={(e) => setCapitalise(e.target.checked)}
                className="size-4"
              />
              Capitalise each word
            </label>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={appendNumber}
                onChange={(e) => setAppendNumber(e.target.checked)}
                className="size-4"
              />
              Add a two-digit number
            </label>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Capitalising and appending digits add almost nothing against a real
            attack — the entropy is in the number of words. They are here because
            some password policies demand a mix.
          </p>
        </div>
      )}
    </div>
  );
}
