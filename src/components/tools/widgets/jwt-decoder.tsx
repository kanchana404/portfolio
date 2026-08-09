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
  valid: "text-emerald-600",
  expired: "text-destructive",
  "not-yet-valid": "text-amber-600",
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
  const [token, setToken] = useState("");

  // Expiry is relative to the moment of viewing, so it cannot be computed during
  // render without the server and client disagreeing. Same pattern as the
  // timestamp converter: null until mounted.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
  }, []);

  const result = useMemo(
    () => (now ? decodeJwt(token, now) : null),
    [token, now]
  );

  const hasToken = token.trim().length > 0;

  return (
    <div className="rounded-lg border">
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ToolLabel htmlFor={`${id}-token`}>Paste a JWT</ToolLabel>
          <button
            type="button"
            onClick={() => setToken(EXAMPLE)}
            className="rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:border-foreground/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Load an example
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
          Decoding happens in this tab. Nothing is uploaded — which matters,
          because a JWT from a running system is a live credential.
        </p>
      </div>

      {result?.error ? (
        <div className="border-t p-4 sm:p-5" role="alert">
          <p className="text-sm font-medium text-destructive">{result.error}</p>
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
            <span className={cx("font-medium", EXPIRY_STYLE[result.expiry])}>
              {EXPIRY_LABEL[result.expiry]}
            </span>
            {result.expiresAt ? (
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
                        <span className="ml-2 text-xs font-medium text-destructive">
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
                <li key={warning} className="text-amber-600 [&+&]:mt-2">
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
