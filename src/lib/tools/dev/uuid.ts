/**
 * UUID generation, versions 4 and 7.
 *
 * Version 4 is 122 random bits and the one everybody means by "a UUID". The
 * browser already implements it as `crypto.randomUUID()`, so this file does not
 * reimplement it; wrapping it is enough, and a hand-rolled v4 built on
 * `Math.random()` would be the classic way to ship a generator that looks right
 * and collides.
 *
 * Version 7 is the interesting one, and the reason this tool is not another v4
 * button. It puts a 48-bit millisecond timestamp in the high bits, so the ids
 * sort in creation order as plain text. As a database primary key that matters
 * more than it sounds: a v4 key lands at a random point in a B-tree on every
 * insert, so the index is written all over and its pages fragment. A v7 key
 * appends, which is the access pattern the index is built for.
 *
 * The trade is honest and stated in the copy: v7 leaks the creation time to
 * anyone holding the id. That is a feature in a database and a leak in a
 * password-reset link.
 */

export type UuidVersion = "v4" | "v7";

export interface UuidVersionInfo {
  id: UuidVersion;
  label: string;
  /** One line, shown under the picker. */
  summary: string;
}

export const UUID_VERSIONS: readonly UuidVersionInfo[] = [
  {
    id: "v4",
    label: "v4 random",
    summary: "122 random bits. The default, and the right choice unless you are using it as a database key.",
  },
  {
    id: "v7",
    label: "v7 time-ordered",
    summary: "A millisecond timestamp in the high bits, so ids sort by creation time and index cleanly.",
  },
];

/** Upper bound on one batch. Beyond this the page, not the entropy, is the limit. */
export const MAX_UUID_COUNT = 500;

/** Lowercase hex, the only form RFC 9562 defines for output. */
function hex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

function format(bytes: Uint8Array): string {
  const h = hex(bytes);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Builds a version 7 UUID from a timestamp and 10 random bytes.
 *
 * Separated from the generator so the layout can be tested against a known
 * input. RFC 9562 lays the 128 bits out as:
 *
 *     48 bits  unix_ts_ms, big-endian
 *      4 bits  version, 0111
 *     12 bits  rand_a
 *      2 bits  variant, 10
 *     62 bits  rand_b
 *
 * The two four-bit writes are where hand-written implementations go wrong: the
 * version and variant nibbles must *replace* bits rather than be OR-ed over
 * whatever the random source produced, or roughly half the ids come out
 * claiming a version they are not.
 */
export function buildUuidV7(timestampMs: number, random: Uint8Array): string {
  if (random.length < 10) {
    throw new Error("v7 needs at least 10 random bytes");
  }
  const bytes = new Uint8Array(16);

  // 48-bit big-endian timestamp. Written with division rather than a shift:
  // `<<` coerces to int32 and would silently truncate a millisecond epoch,
  // which is already 41 bits wide.
  const ts = Math.floor(timestampMs);
  bytes[0] = Math.floor(ts / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ts / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ts / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ts / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ts / 2 ** 8) & 0xff;
  bytes[5] = ts & 0xff;

  bytes.set(random.subarray(0, 10), 6);

  // Clear the nibble, then set it. Not `|=`.
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  return format(bytes);
}

/** Reads the embedded timestamp back out of a v7 id. */
export function uuidV7Timestamp(uuid: string): number | null {
  const h = uuid.replace(/-/g, "");
  if (h.length !== 32) return null;
  if (h[12] !== "7") return null;
  return parseInt(h.slice(0, 12), 16);
}

export function generateUuid(version: UuidVersion, now: number = Date.now()): string {
  if (version === "v4") return crypto.randomUUID();
  const random = new Uint8Array(10);
  crypto.getRandomValues(random);
  return buildUuidV7(now, random);
}

export function generateUuids(
  version: UuidVersion,
  count: number,
  now: number = Date.now()
): string[] {
  const n = Math.max(1, Math.min(MAX_UUID_COUNT, Math.floor(count) || 1));
  const out: string[] = [];
  for (let i = 0; i < n; i += 1) out.push(generateUuid(version, now));
  return out;
}

/** RFC 9562 layout check, used by the widget to validate pasted input. */
export function parseUuid(value: string): { valid: boolean; version: number | null } {
  const v = value.trim().toLowerCase();
  const shape = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  if (!shape.test(v)) return { valid: false, version: null };
  const version = parseInt(v[14], 16);
  const variant = parseInt(v[19], 16);
  // Variant 10xx means the high bit set and the next clear: 8, 9, a or b.
  const variantOk = variant >= 0x8 && variant <= 0xb;
  return { valid: variantOk, version: Number.isNaN(version) ? null : version };
}
