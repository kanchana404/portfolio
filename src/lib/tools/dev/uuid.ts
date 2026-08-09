/**
 * UUID generation.
 *
 * Randomness comes from `crypto.getRandomValues`, never `Math.random`.
 * `Math.random` is not a CSPRNG and its output is predictable from a handful of
 * observed values in V8 — which matters because people paste "random" IDs from
 * tools like this straight into password-reset links and API keys.
 */

export type UuidVersion = "v4" | "v7";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

const HEX: string[] = Array.from({ length: 256 }, (_, i) =>
  i.toString(16).padStart(2, "0")
);

function formatUuid(bytes: Uint8Array): string {
  const h = (i: number): string => HEX[bytes[i]];
  return (
    `${h(0)}${h(1)}${h(2)}${h(3)}-${h(4)}${h(5)}-${h(6)}${h(7)}-` +
    `${h(8)}${h(9)}-${h(10)}${h(11)}${h(12)}${h(13)}${h(14)}${h(15)}`
  );
}

/** RFC 9562 version 4 — 122 bits of randomness. */
export function uuidV4(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  return formatUuid(bytes);
}

/**
 * RFC 9562 version 7 — 48-bit Unix millisecond timestamp, then randomness.
 *
 * Worth offering alongside v4 because the two behave very differently as a
 * database primary key. v4 is uniformly random, so inserts scatter across a
 * B-tree and fragment it; v7 sorts by creation time, so inserts append and the
 * index stays dense. The trade is that a v7 leaks its creation timestamp, which
 * is exactly what you do not want in a public identifier.
 */
export function uuidV7(nowMs: number = Date.now()): string {
  const bytes = randomBytes(16);
  const ts = BigInt(Math.max(0, Math.floor(nowMs)));

  bytes[0] = Number((ts >> 40n) & 0xffn);
  bytes[1] = Number((ts >> 32n) & 0xffn);
  bytes[2] = Number((ts >> 24n) & 0xffn);
  bytes[3] = Number((ts >> 16n) & 0xffn);
  bytes[4] = Number((ts >> 8n) & 0xffn);
  bytes[5] = Number(ts & 0xffn);

  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  return formatUuid(bytes);
}

export function generateUuids(
  count: number,
  version: UuidVersion,
  uppercase = false
): string[] {
  const safeCount = Math.max(1, Math.min(500, Math.floor(count) || 1));
  const out: string[] = [];
  for (let i = 0; i < safeCount; i++) {
    const id = version === "v7" ? uuidV7() : uuidV4();
    out.push(uppercase ? id.toUpperCase() : id);
  }
  return out;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-([1-8])[0-9a-f]{3}-([89ab])[0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface UuidInspection {
  valid: boolean;
  version: number | null;
  variant: string | null;
  /** Only meaningful for v7, which embeds its creation time. */
  timestamp: Date | null;
  note: string;
}

/** Validate a UUID and, for v7, recover the embedded timestamp. */
export function inspectUuid(input: string): UuidInspection {
  const value = input.trim();
  const match = UUID_RE.exec(value);
  if (!match) {
    return {
      valid: false,
      version: null,
      variant: null,
      timestamp: null,
      note:
        "Not a well-formed UUID. Expected 8-4-4-4-12 hexadecimal characters " +
        "with a version digit of 1–8 and a variant digit of 8, 9, a or b.",
    };
  }

  const version = Number(match[1]);
  const hex = value.replace(/-/g, "");

  let timestamp: Date | null = null;
  if (version === 7) {
    const ms = Number(BigInt(`0x${hex.slice(0, 12)}`));
    if (Number.isFinite(ms)) timestamp = new Date(ms);
  }

  return {
    valid: true,
    version,
    variant: "RFC 9562 (10xx)",
    timestamp,
    note:
      version === 4
        ? "Version 4: 122 bits of randomness, no embedded information."
        : version === 7
          ? "Version 7: sorts by creation time, and therefore reveals it."
          : `Version ${version}.`,
  };
}
