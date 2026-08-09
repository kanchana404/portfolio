/**
 * URL percent-encoding.
 *
 * The reason this deserves a page: there are two encoders in JavaScript and
 * picking the wrong one is the most common URL bug there is.
 *
 * `encodeURI` leaves the reserved characters that give a URL its structure
 * alone — `: / ? # [ ] @ & = + $ ,` — because it is meant for encoding a *whole*
 * URL. `encodeURIComponent` escapes them, because it is meant for a single
 * *piece* that is about to be dropped into a query string.
 *
 * Use `encodeURI` on a value and `?a=1&b=2` inside it silently becomes extra
 * parameters. Use `encodeURIComponent` on a whole URL and `https://` turns into
 * `https%3A%2F%2F`, which is no longer a URL at all.
 */

export type EncodeMode = "component" | "uri";

export type CodecResult = { ok: true; value: string } | { ok: false; error: string };

export function encodeUrl(input: string, mode: EncodeMode): string {
  return mode === "uri" ? encodeURI(input) : encodeURIComponent(input);
}

/**
 * Decode percent-escapes.
 *
 * Both `decodeURI` and `decodeURIComponent` throw `URIError` on a malformed
 * escape such as a bare `%` or `%zz`, so this reports the problem rather than
 * letting the exception reach the UI.
 */
export function decodeUrl(input: string, mode: EncodeMode): CodecResult {
  if (input.length === 0) return { ok: true, value: "" };
  try {
    return {
      ok: true,
      value: mode === "uri" ? decodeURI(input) : decodeURIComponent(input),
    };
  } catch {
    const bad = /%(?![0-9A-Fa-f]{2})/.exec(input);
    return {
      ok: false,
      error:
        bad === null
          ? "That text contains an invalid percent-escape sequence."
          : `Invalid percent-escape at position ${bad.index + 1}. A % must be ` +
            `followed by two hexadecimal digits — write %25 for a literal percent sign.`,
    };
  }
}

export interface QueryParam {
  key: string;
  value: string;
}

export interface ParsedUrl {
  valid: boolean;
  protocol?: string;
  host?: string;
  port?: string;
  path?: string;
  hash?: string;
  params: QueryParam[];
  error?: string;
}

/**
 * Break a URL into its parts, with the query string already decoded.
 *
 * Uses the platform `URL` parser rather than a regex, so it agrees with what the
 * browser will actually do with the address.
 */
export function parseUrl(input: string): ParsedUrl {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { valid: false, params: [] };

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return {
      valid: false,
      params: [],
      error:
        "Not a complete URL. It needs a scheme — try prefixing it with https://",
    };
  }

  const params: QueryParam[] = [];
  url.searchParams.forEach((value, key) => params.push({ key, value }));

  return {
    valid: true,
    protocol: url.protocol.replace(/:$/, ""),
    host: url.hostname,
    port: url.port || undefined,
    path: url.pathname,
    hash: url.hash ? url.hash.slice(1) : undefined,
    params,
  };
}
