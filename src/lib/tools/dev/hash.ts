/**
 * Cryptographic hashing via the Web Crypto API.
 *
 * Two deliberate omissions, both of which most online hash tools get wrong:
 *
 * **No MD5.** `crypto.subtle` does not implement it, and that is not an
 * oversight — MD5 is collision-broken and has been since 2004. Shipping it would
 * mean bundling a JavaScript implementation, which is both bytes and an
 * invitation to use it for something that matters. The page says so instead.
 *
 * **SHA-1 is offered but labelled.** It is still needed to read Git object IDs
 * and legacy checksums, so refusing to compute it is unhelpful. It is marked as
 * unsuitable for anything security-related, because it is.
 *
 * Note that `crypto.subtle` is only available in a secure context — HTTPS or
 * localhost. On plain HTTP it is `undefined`, and the failure is reported rather
 * than thrown.
 */

export type HashAlgorithm = "SHA-1" | "SHA-256" | "SHA-384" | "SHA-512";

export const HASH_ALGORITHMS: ReadonlyArray<{
  id: HashAlgorithm;
  label: string;
  bits: number;
  note: string;
}> = [
  {
    id: "SHA-256",
    label: "SHA-256",
    bits: 256,
    note: "The sensible default. Used by TLS certificates, Bitcoin and most file checksums.",
  },
  {
    id: "SHA-512",
    label: "SHA-512",
    bits: 512,
    note: "Wider digest. On 64-bit hardware it is often faster than SHA-256, not slower.",
  },
  {
    id: "SHA-384",
    label: "SHA-384",
    bits: 384,
    note: "SHA-512 truncated. Specified for some TLS suites and JWT algorithms.",
  },
  {
    id: "SHA-1",
    label: "SHA-1 (legacy)",
    bits: 160,
    note: "Collision-broken since 2017. Fine for reading a Git object ID; never for security.",
  },
];

export type HashResult =
  | { ok: true; hex: string; base64: string; bytes: number }
  | { ok: false; error: string };

function toHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = "";
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, "0");
  return out;
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Hash UTF-8 text. */
export async function hashText(
  text: string,
  algorithm: HashAlgorithm
): Promise<HashResult> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return {
      ok: false,
      error:
        "Hashing needs the Web Crypto API, which browsers only expose over HTTPS " +
        "or on localhost. Open this page over https and it will work.",
    };
  }

  try {
    const data = new TextEncoder().encode(text);
    const digest = await subtle.digest(algorithm, data);
    return {
      ok: true,
      hex: toHex(digest),
      base64: toBase64(digest),
      bytes: data.length,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Hashing failed.",
    };
  }
}
