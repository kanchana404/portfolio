"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { CopyButton } from "@/components/tools/copy-button";
import { ToolLabel, ToolTextarea, cx } from "@/components/tools/ui";
import { encodeBase64 } from "@/lib/tools/dev/base64";
import { decodeJwt } from "@/lib/tools/dev/jwt";

/**
 * Built rather than hardcoded so the segments are guaranteed to be well-formed.
 * Module scope, so the server and the client compute the identical string.
 */
const EXAMPLE = [
  encodeBase64(JSON.stringify({ alg: "HS256", typ: "JWT" }), true),
  encodeBase64(
    JSON.stringify({
      sub: "1234567890",
      name: "Ada Lovelace",
      admin: true,
      iat: 1516239022,
      exp: 1516242622,
    }),
    true
  ),
  "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
].join(".");

const EXPIRY_STYLE: Record<string, string> = {
  valid: "text-emerald-700 dark:text-emerald-400",
  expired: "text-red-700 dark:text-red-400",
  "not-yet-valid": "text-amber-700 dark:text-amber-400",
  unknown: "text-muted-foreground",
};

const EXPIRY_LABEL: Record<string, string> = {
  valid: "Within its validity window",
  expired: "Expired",
  "not-yet-valid": "Not valid yet",
  unknown: "No expiry claim",
};

export default function JwtDecoder() {
  const id = useId();
  // Prefilled, like every other tool here. An empty box asks the visitor to
  // supply a JWT before the page shows it can do anything, and it was the only
  // one of the seventeen whose server-rendered HTML contained no worked example
  // — so a crawler (and anyone without JS) saw an empty widget and no evidence
  // the tool works. The header/payload split below is the whole product; show it
  // immediately.
  const [token, setToken] = useState(EXAMPLE);

  // Expiry is relative to the moment of viewing, so it cannot be computed during
  // render without the server and client disagreeing. Same pattern as the
  // timestamp converter: null until mounted.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  // Decode unconditionally. Splitting and JSON-parsing the header and payload
  // does not need a clock — only the expiry verdict does — so gating the whole
  // decode on `now` meant the server rendered an empty widget for the one tool
  // whose entire value is showing you what is inside the token.
  //
  // `now ?? null` keeps the expiry field at "unknown" during SSR, and the block
  // that displays it is gated on `now` below, so there is no hydration mismatch:
  // the server never renders an expiry verdict at all.
  const result = useMemo(() => decodeJwt(token, now ?? undefined), [token, now]);

  const hasToken = token.trim().length > 0;

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ToolLabel htmlFor={`${id}-token`}>Paste a JWT</ToolLabel>
          <button
            type="button"
            onClick={() => setToken(token === EXAMPLE ? "" : EXAMPLE)}
            className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:border-foreground/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {token === EXAMPLE ? "Clear" : "Load an example"}
          </button>
        </div>
        <ToolTextarea
          id={`${id}-token`}
          rows={4}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          spellCheck={false}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.…"
          className="mt-2 break-all"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          Decoding happens in this tab. Nothing is uploaded, which matters
          because a JWT from a running system is a live credential.
        </p>
      </div>

      {result?.error ? (
        <div className="border-t p-4 sm:p-5" role="alert">
          <p className="text-sm font-medium text-red-700 dark:text-red-400">{result.error}</p>
        </div>
      ) : null}

      {result && hasToken && !result.error ? (
        <>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t p-4 text-sm sm:p-5">
            <span>
              <span className="text-muted-foreground">Algorithm </span>
              <span className="font-mono font-medium">
                {result.algorithm ?? "not stated"}
              </span>
            </span>
            {now ? (
              <span className={cx("font-medium", EXPIRY_STYLE[result.expiry])}>
                {EXPIRY_LABEL[result.expiry]}
              </span>
            ) : null}
            {/* Local time, so it can only be rendered after mount — the server
                has a different timezone and would hydrate-mismatch. The UTC
                value is always present in the claims table above. */}
            {now && result.expiresAt ? (
              <span className="text-muted-foreground">
                Expires{" "}
                <time dateTime={result.expiresAt.toISOString()}>
                  {result.expiresAt.toLocaleString()}
                </time>
              </span>
            ) : null}
          </div>

          <div className="grid gap-4 border-t p-4 sm:p-5 md:grid-cols-2">
            {(
              [
                ["Header", result.header],
                ["Payload", result.payload],
              ] as const
            ).map(([label, segment]) => (
              <div key={label}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  {segment?.json ? (
                    <CopyButton value={segment.json} label={`Copy ${label.toLowerCase()}`} />
                  ) : null}
                </div>
                <pre className="mt-2 max-h-64 overflow-auto rounded-md border bg-muted/40 p-3 text-xs leading-relaxed">
                  <code>{segment?.json ?? segment?.error ?? ""}</code>
                </pre>
              </div>
            ))}
          </div>

          {result.claims.length > 0 ? (
            <div className="border-t p-4 sm:p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Claims
              </p>
              <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[minmax(0,10rem)_1fr]">
                {result.claims.map((claim) => (
                  <div key={claim.name} className="contents">
                    <dt className="text-muted-foreground">
                      {claim.label}
                      <span className="ml-1 font-mono text-xs opacity-60">
                        {claim.name}
                      </span>
                    </dt>
                    <dd className="break-words">
                      {claim.display}
                      {claim.note ? (
                        <span className="ml-2 text-xs font-medium text-red-700 dark:text-red-400">
                          {claim.note}
                        </span>
                      ) : null}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}

          <div className="border-t p-4 sm:p-5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Signature
            </p>
            <p className="mt-2 break-all font-mono text-xs">{result.signature}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Shown, not checked. Verifying a signature needs the signing key, so
              no browser tool can do it and no website should ask you for one.
            </p>
          </div>

          {result.warnings.length > 0 ? (
            <ul className="border-t p-4 text-sm sm:p-5">
              {result.warnings.map((warning) => (
                <li key={warning} className="text-amber-700 dark:text-amber-400 [&+&]:mt-2">
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
