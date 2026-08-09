/**
 * Base64 encoding that survives Unicode.
 *
 * `btoa("සිංහල")` throws `InvalidCharacterError`, because `btoa` accepts only
 * Latin-1 code points. A great many online base64 tools are a thin wrapper
 * around it, so they break on emoji, Sinhala, Tamil, Chinese — anything outside
 * the first 256 code points.
 *
 * The fix is to encode to UTF-8 bytes first and base64 the *bytes*. That is what
 * every server-side base64 does, and it is why round-tripping through those
 * tools can corrupt text that this one handles.
 */

export type DecodeResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

const STANDARD_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const URLSAFE_RE = /^[A-Za-z0-9\-_]*={0,2}$/;

function bytesToBinaryString(bytes: Uint8Array): string {
  // Chunked rather than `String.fromCharCode(...bytes)`: spreading a large array
  // into a call blows the argument limit and throws RangeError somewhere north
  // of ~100 kB, which is well within "paste a file in".
  const CHUNK = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return binary;
}

/** UTF-8 text to base64. `urlSafe` swaps `+/` for `-_` and drops padding. */
export function encodeBase64(text: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(text);
  const base64 = btoa(bytesToBinaryString(bytes));
  if (!urlSafe) return base64;
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Base64 to UTF-8 text.
 *
 * Accepts both alphabets and tolerates missing padding, because base64url
 * commonly omits it and a tool that rejects a valid JWT segment is useless.
 *
 * Decoding is `fatal`, so bytes that are not valid UTF-8 are reported rather
 * than silently replaced with U+FFFD. Quietly returning a string full of
 * replacement characters is how someone concludes their data is corrupt when it
 * is simply not text.
 */
export function decodeBase64(input: string): DecodeResult {
  const cleaned = input.replace(/\s/g, "");
  if (cleaned.length === 0) return { ok: true, text: "" };

  const isUrlSafe = /[-_]/.test(cleaned);
  const valid = isUrlSafe ? URLSAFE_RE.test(cleaned) : STANDARD_RE.test(cleaned);
  if (!valid) {
    return {
      ok: false,
      error:
        "That is not valid base64. Allowed characters are A–Z, a–z, 0–9 and " +
        "either + / (standard) or - _ (URL-safe), with optional = padding.",
    };
  }

  const standard = cleaned.replace(/-/g, "+").replace(/_/g, "/");
  // Restore padding to a multiple of four. A remainder of 1 is impossible in
  // well-formed base64 — three characters cannot encode a whole number of bytes.
  const remainder = standard.length % 4;
  if (remainder === 1) {
    return { ok: false, error: "Truncated base64 — the input is one character short of a valid block." };
  }
  const padded = remainder === 0 ? standard : standard + "=".repeat(4 - remainder);

  let bytes: Uint8Array;
  try {
    const binary = atob(padded);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  } catch {
    return { ok: false, error: "That is not valid base64." };
  }

  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(bytes) };
  } catch {
    return {
      ok: false,
      error:
        `Decoded to ${bytes.length} bytes, but they are not valid UTF-8 text. ` +
        `This is normal for an image or an archive — base64 can carry any bytes, ` +
        `and only some of them are text.`,
    };
  }
}

/** Bytes the decoded payload occupies, without producing the string. */
export function decodedByteLength(input: string): number | null {
  const cleaned = input.replace(/\s/g, "").replace(/=+$/, "");
  if (cleaned.length === 0) return 0;
  if (cleaned.length % 4 === 1) return null;
  return Math.floor((cleaned.length * 3) / 4);
}
