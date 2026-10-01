import { gunzipSync } from "node:zlib";
import { SITE_URL } from "../site";

/**
 * The fetcher's only network code: GET requests with a timeout, a byte cap
 * and a host allowlist that redirects cannot leave.
 *
 * - Redirects are followed by hand, at most MAX_REDIRECTS, and every hop must
 *   be https to a host on the allowlist, so a feed cannot send the fetcher
 *   anywhere the caller did not name.
 * - The body is read in chunks and cut off at the cap. A gzip body served
 *   without a Content-Encoding header is unpacked with an output cap, so a
 *   compression bomb throws instead of filling memory.
 * - The User-Agent says what this is. A host that refuses it is reported,
 *   never evaded with a browser's.
 *
 * Inside Codex Cloud the traffic may go through an HTTP proxy: package.json
 * starts the CLI with NODE_USE_ENV_PROXY=1, which makes Node's fetch honour
 * HTTPS_PROXY (Node 22.21 or later, and 24).
 */

export const USER_AGENT = `kavithakanchana.me-digest/1.0 (+${SITE_URL})`;
export const MAX_REDIRECTS = 5;

export class FetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FetchError";
  }
}

/**
 * The body, up to `maxBytes`. Past the cap it cancels the stream and throws,
 * or with `truncate` returns the first `maxBytes` bytes (for a page whose
 * `<head>` is all that is needed).
 */
export async function readCapped(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  truncate = false
): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (total + value.length > maxBytes) {
      await reader.cancel().catch(() => undefined);
      if (!truncate) throw new FetchError(`larger than ${maxBytes} bytes`);
      chunks.push(value.subarray(0, maxBytes - total));
      total = maxBytes;
      break;
    }
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

/** Gunzip bytes that start with the gzip magic number, with an output cap; anything else as it is. */
export function maybeGunzip(bytes: Uint8Array, maxOut: number): Uint8Array {
  if (bytes.length < 2 || bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes;
  try {
    return new Uint8Array(gunzipSync(bytes, { maxOutputLength: maxOut }));
  } catch (error) {
    throw new FetchError(`bad or oversized gzip body (${error instanceof Error ? error.message : String(error)})`);
  }
}

export interface GetOptions {
  timeoutMs: number;
  maxBytes: number;
  accept: string;
  /** Host names every hop must use, exactly (no subdomain matching). */
  allowedHosts: readonly string[];
  /** Return the first `maxBytes` bytes instead of failing past them. */
  truncate?: boolean;
  /** A Content-Type every accepted response must start with, such as "text/html". */
  requireType?: readonly string[];
}

export interface GetResult {
  bytes: Uint8Array;
  finalUrl: string;
  contentType: string;
}

/** Refuses a URL the fetcher must not request. Exported for the tests. */
export function checkUrl(raw: string, allowedHosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new FetchError("not a valid URL");
  }
  if (url.protocol !== "https:") throw new FetchError(`refusing a ${url.protocol} URL; https only`);
  if (url.username || url.password) throw new FetchError("refusing a URL with credentials");
  if (url.port) throw new FetchError("refusing a URL with a port");
  if (!allowedHosts.includes(url.hostname)) throw new FetchError(`refusing host ${url.hostname}: not a feed host`);
  return url;
}

export async function getBytes(start: string, o: GetOptions): Promise<GetResult> {
  let current = checkUrl(start, o.allowedHosts);
  const signal = AbortSignal.timeout(o.timeoutMs);
  for (let hop = 0; ; hop++) {
    let res: Response;
    try {
      res = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal,
        headers: { "User-Agent": USER_AGENT, Accept: o.accept, "Accept-Language": "en" },
      });
    } catch (error) {
      const cause = error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : "";
      throw new FetchError(`${error instanceof Error ? error.message : String(error)}${cause}`);
    }
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => undefined);
      if (hop >= MAX_REDIRECTS) throw new FetchError(`more than ${MAX_REDIRECTS} redirects`);
      let next: string;
      try {
        next = new URL(location, current).toString();
      } catch {
        throw new FetchError("a redirect to an invalid URL");
      }
      current = checkUrl(next, o.allowedHosts);
      continue;
    }
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw new FetchError(`HTTP ${res.status}`);
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (o.requireType && !o.requireType.some((t) => contentType.startsWith(t))) {
      await res.body?.cancel().catch(() => undefined);
      throw new FetchError(`unexpected content type ${contentType || "(none)"}`);
    }
    const raw = await readCapped(res.body, o.maxBytes, o.truncate);
    return {
      bytes: o.truncate ? raw : maybeGunzip(raw, o.maxBytes * 2),
      finalUrl: current.toString(),
      contentType,
    };
  }
}
